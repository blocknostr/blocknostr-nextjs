import { useState, useCallback, useRef, useEffect } from "react";
import { fetchNostrFeed, fetchNostrProfile, getHealthyRelays } from "@/lib/nostr/relay";

// Extend FeedOptions to include 'authors'
export interface FeedOptions {
    limit?: number;
    until?: number;
    kinds?: number[];
    authors?: string[]; // Added authors property to match usage
}
import { SimplePool, nip19, type Event as NostrToolsEvent, type UnsignedEvent, getEventHash } from "nostr-tools";

// Define the NIP-07 window.nostr interface
interface WindowNostr {
    getPublicKey(): Promise<string>;
    signEvent(event: UnsignedEvent): Promise<NostrToolsEvent>;
    signMessage?(message: string): Promise<string>; // Optional NIP-42 or custom usage
    getRelays?(): Promise<{ [url: string]: { read: boolean; write: boolean } }>; // Optional
}

declare global {
    interface Window {
        nostr?: WindowNostr;
    }
}

export const RELAYS = [
    "wss://relay.damus.io",
    "wss://relay.nostr.band",
    "wss://nostr-pub.wellorder.net",
    // Add more default relays or make this configurable
];

export interface NostrProfile {
    username?: string; // Always set: mapped from 'name' in Nostr spec
    display_name?: string;
    about?: string;
    picture?: string;
    banner?: string;
    website?: string;
    lud06?: string;
    lud16?: string;
    nip05?: string;
    pubkey?: string; // Added for convenience
}

export interface NostrEvent {
    id: string;
    pubkey: string;
    content: string;
    created_at: number;
    kind: number;
    tags: string[][];
    media: string[]; // Custom derived field
    profile?: NostrProfile; // Custom derived field
    // Add other event fields if needed
}

export function useNostr() {
    const [pubkey, setPubkey] = useState<string | null>(null);
    const [events, setEvents] = useState<NostrEvent[]>([]);
    const [profile, setProfile] = useState<NostrProfile | null>(null); // Current user's profile
    const [following, setFollowing] = useState<string[]>([]); // List of pubkeys the user follows
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false); // General loading state
    const [relayStats, setRelayStats] = useState<{ healthyCount: number; totalCount: number; } | null>(null);
    const profileCache = useRef<{ [pubkey: string]: NostrProfile }>({});

    const getWindowNostr = (): WindowNostr | undefined => {
        return window.nostr;
    };

    // --- Persist pubkey in localStorage ---
    // On mount, rehydrate pubkey from localStorage if present
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const storedPubkey = window.localStorage.getItem('nostr_pubkey');
            if (storedPubkey && !pubkey) {
                setPubkey(storedPubkey);
            }
        }
    }, []);

    // When pubkey changes, persist to localStorage
    useEffect(() => {
        if (typeof window !== 'undefined' && pubkey) {
            window.localStorage.setItem('nostr_pubkey', pubkey);
        }
    }, [pubkey]);

    // Auth/login
    const login = useCallback(async () => {
        const nostr = getWindowNostr();
        if (nostr) {
            setIsLoading(true);
            setError(null);
            try {
                const pk = await nostr.getPublicKey();
                setPubkey(pk);

                // Optional: Schnorr signing for custom message (e.g., NIP-42 auth)
                const message = `Login to RAW.ROCKS: ${Date.now()}`;
                if (typeof nostr.signMessage === "function") {
                    try {
                        const signature = await nostr.signMessage(message);
                        console.log("Signed login message:", signature);
                    } catch (err) {
                        console.warn("signMessage for login failed:", err);
                    }
                } else {
                    console.warn("signMessage is not supported by this NOSTR extension.");
                }

                // Load profile from relays
                const { healthyRelays } = await getHealthyRelays();
                if (healthyRelays.length > 0) {
                    const userProfileData = await fetchNostrProfile(healthyRelays, pk);
                    if (userProfileData) {
                        const userProfile: NostrProfile = {
                            ...userProfileData,
                            pubkey: pk,
                            username: userProfileData.name || pk,
                        };
                        setProfile(userProfile);
                        profileCache.current[pk] = userProfile;
                    }
                } else {
                    console.warn("No healthy relays to fetch initial profile.");
                }
            } catch (err: any) {
                console.error("Login failed:", err);
                setError(err.message || "Login failed. Please ensure your NOSTR extension is configured.");
                setPubkey(null);
            } finally {
                setIsLoading(false);
            }
        } else {
            setError("NOSTR extension not found. Please install a NOSTR browser extension.");
            // alert("NOSTR extension not found. Please install a NOSTR browser extension.");
        }
    }, []);

    // Fetch feed with pagination support
    const fetchEvents = useCallback(async (options?: FeedOptions): Promise<boolean> => {
        setIsLoading(true);
        setError(null);
        try {
            const { healthyRelays, healthyCount, totalCount } = await getHealthyRelays();
            setRelayStats({ healthyCount, totalCount });

            if (!healthyRelays.length) {
                setError("No healthy relays available to fetch feed.");
                return false;
            }

            const fetchedNostrEvents = await fetchNostrFeed(healthyRelays, {
                limit: 20,
                ...options
            });

            const uniquePubkeys = Array.from(new Set(fetchedNostrEvents.map(ev => ev.pubkey)));
            const profilesToFetch = uniquePubkeys.filter(pk => !profileCache.current[pk]);

            if (profilesToFetch.length > 0) {
                await Promise.all(profilesToFetch.map(async (pk) => {
                    const meta = await fetchNostrProfile(healthyRelays, pk);
                    if (meta) {
                        profileCache.current[pk] = {
                            ...meta,
                            pubkey: pk,
                            username: meta.name || pk,
                        };
                    }
                }));
            }

            const processedFeed = fetchedNostrEvents.map((ev): NostrEvent => {
                let media: string[] = [];
                const urlRegex = /(https?:\/\/(?:[\w-]+\.)+[\w-]+(?:\/[\w\-._~:/?#[\]@!$&'()*+,;=]*)?\.(?:jpg|jpeg|png|gif|mp4|webm))/gi;
                let match;
                while ((match = urlRegex.exec(ev.content))) {
                    media.push(match[1]);
                }

                const userProf = profileCache.current[ev.pubkey] || { pubkey: ev.pubkey, username: ev.pubkey };
                const picture = userProf.picture || "/file.svg"; // Default avatar

                return {
                    ...ev,
                    media,
                    profile: {
                        ...userProf,
                        display_name: userProf.display_name || userProf.username || `${ev.pubkey.slice(0, 6)}...${ev.pubkey.slice(-4)}`,
                        picture: userProf.picture || "/file.svg",
                        username: userProf.username || ev.pubkey,
                        pubkey: ev.pubkey,
                    },
                };
            });

            if (options?.until) {
                setEvents(prev => {
                    const existingIds = new Set(prev.map(e => e.id));
                    const newEvents = processedFeed.filter(e => !existingIds.has(e.id));
                    return [...prev, ...newEvents].sort((a, b) => b.created_at - a.created_at);
                });
            } else {
                setEvents(processedFeed.sort((a, b) => b.created_at - a.created_at));
            }
            return processedFeed.length > 0;
        } catch (err: any) {
            console.error("Error fetching events:", err);
            setError(err.message || "Failed to fetch posts. Please try again later.");
            return false;
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Helper to publish a signed event
    const publishEvent = async (signedEvent: NostrToolsEvent): Promise<boolean> => {
        try {
            const { healthyRelays } = await getHealthyRelays();
            if (!healthyRelays.length) {
                setError("No healthy relays available to publish event.");
                return false;
            }
            const pool = new SimplePool();
            const promises = pool.publish(healthyRelays, signedEvent);
            // Wait for at least one successful publish or timeout
            // This is a simplified version; nostr-tools' publish returns promises for each relay
            await Promise.any(promises.map(p => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000))])));
            pool.close(healthyRelays); // Close connections after publishing
            return true;
        } catch (err) {
            console.error("Failed to publish event to relays:", err);
            setError("Failed to publish event. Some relays might be offline.");
            return false;
        }
    };

    // Post event (sign and publish using extension)
    const post = useCallback(async (content: string) => {
        const nostr = getWindowNostr();
        if (!pubkey || !nostr) {
            setError("Not logged in or NOSTR extension not found.");
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const unsignedEvent: UnsignedEvent = {
                kind: 1,
                pubkey,
                created_at: Math.floor(Date.now() / 1000),
                tags: [],
                content,
            };
            const signedEvent = await nostr.signEvent(unsignedEvent);

            if (await publishEvent(signedEvent)) {
                // Optimistic update
                const currentProfile = profileCache.current[pubkey] || { pubkey, username: pubkey };
                setEvents(prev => [
                    {
                        id: signedEvent.id,
                        pubkey: signedEvent.pubkey,
                        content: signedEvent.content,
                        created_at: signedEvent.created_at,
                        kind: signedEvent.kind,
                        tags: signedEvent.tags,
                        media: [], // Derive media if needed, or leave for display component
                        profile: {
                            display_name: currentProfile.display_name || currentProfile.username || `${pubkey.slice(0, 6)}...${pubkey.slice(-4)}`,
                            username: currentProfile.username || pubkey,
                            picture: currentProfile.picture || "/file.svg",
                            pubkey: pubkey,
                        }
                    },
                    ...prev,
                ].sort((a, b) => b.created_at - a.created_at));
                return true;
            }
        } catch (err: any) {
            console.error("Failed to post event:", err);
            setError(err.message || "Failed to post. Please try again.");
        } finally {
            setIsLoading(false);
        }
        return false;
    }, [pubkey, profile]);

    // Update profile (Kind 0)
    const updateProfileMetadata = useCallback(async (newProfileData: NostrProfile) => {
        const nostr = getWindowNostr();
        if (!pubkey || !nostr) {
            setError("Not logged in or NOSTR extension not found.");
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            // Ensure only valid profile fields are included
            const contentPayload: any = {};
            if (newProfileData.username !== undefined) contentPayload.name = newProfileData.username; // Always set 'name' from 'username'
            if (newProfileData.display_name !== undefined) contentPayload.display_name = newProfileData.display_name;
            if (newProfileData.about !== undefined) contentPayload.about = newProfileData.about;
            if (newProfileData.picture !== undefined) contentPayload.picture = newProfileData.picture;
            if (newProfileData.banner !== undefined) contentPayload.banner = newProfileData.banner;
            if (newProfileData.website !== undefined) contentPayload.website = newProfileData.website;
            if (newProfileData.lud06 !== undefined) contentPayload.lud06 = newProfileData.lud06;
            if (newProfileData.lud16 !== undefined) contentPayload.lud16 = newProfileData.lud16;
            if (newProfileData.nip05 !== undefined) contentPayload.nip05 = newProfileData.nip05;


            const unsignedEvent: UnsignedEvent = {
                kind: 0,
                pubkey,
                created_at: Math.floor(Date.now() / 1000),
                tags: [],
                content: JSON.stringify(contentPayload),
            };
            const signedEvent = await nostr.signEvent(unsignedEvent);
            if (await publishEvent(signedEvent)) {
                const updatedFullProfile = { ...profile, ...newProfileData, pubkey, username: newProfileData.username };
                setProfile(updatedFullProfile);
                profileCache.current[pubkey] = updatedFullProfile; // Update cache
                return true;
            }
        } catch (err: any) {
            console.error("Failed to update profile:", err);
            setError(err.message || "Failed to update profile. Please try again.");
        } finally {
            setIsLoading(false);
        }
        return false;
    }, [pubkey, profile]);

    // Manage contact list (Kind 3)
    const updateContactList = useCallback(async (newFollowingPubkeys: string[]) => {
        const nostr = getWindowNostr();
        if (!pubkey || !nostr) {
            setError("Not logged in or NOSTR extension not found.");
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            // NIP-02 recommends preserving existing non-"p" tags if any.
            // For simplicity, this example only manages "p" tags.
            // Fetch existing contact list to preserve other tags if necessary (more complex)

            const tags = newFollowingPubkeys.map(pk => ["p", pk]);
            const unsignedEvent: UnsignedEvent = {
                kind: 3,
                pubkey,
                created_at: Math.floor(Date.now() / 1000),
                tags: tags,
                content: "", // Or JSON string of relay hints per NIP-02
            };
            const signedEvent = await nostr.signEvent(unsignedEvent);
            if (await publishEvent(signedEvent)) {
                setFollowing(newFollowingPubkeys);
                return true;
            }
        } catch (err: any) {
            console.error("Failed to update contact list:", err);
            setError(err.message || "Failed to update contact list. Please try again.");
        } finally {
            setIsLoading(false);
        }
        return false;
    }, [pubkey]);

    const followUser = useCallback(async (userPubkey: string) => {
        if (following.includes(userPubkey)) return true; // Already following
        const newFollowingList = [...following, userPubkey];
        return await updateContactList(newFollowingList);
    }, [following, updateContactList]);

    const unfollowUser = useCallback(async (userPubkey: string) => {
        if (!following.includes(userPubkey)) return true; // Not following
        const newFollowingList = following.filter(pk => pk !== userPubkey);
        return await updateContactList(newFollowingList);
    }, [following, updateContactList]);


    const isFollowing = useCallback((userPubkey: string) => {
        return following.includes(userPubkey);
    }, [following]);

    // Effect to load initial following list for the logged-in user
    useEffect(() => {
        if (pubkey) {
            (async () => {
                try {
                    const { healthyRelays } = await getHealthyRelays();
                    if (healthyRelays.length === 0) return;

                    // Use correct filter type for nostr-tools
                    const filter = {
                        kinds: [3],
                        authors: [pubkey],
                        limit: 1,
                    };
                    // @ts-ignore: Filter type is broader than FeedOptions
                    const contactListEvents = await fetchNostrFeed(healthyRelays, filter);

                    if (contactListEvents.length > 0) {
                        const latestContactList = contactListEvents.sort((a: any, b: any) => b.created_at - a.created_at)[0];
                        const followedPubkeys = latestContactList.tags
                            .filter((tag: string[]) => tag[0] === 'p' && tag[1])
                            .map((tag: string[]) => tag[1]);
                        setFollowing(followedPubkeys);
                    }
                } catch (err) {
                    console.error("Failed to fetch initial contact list:", err);
                }
            })();
        } else {
            setFollowing([]); // Clear following list if not logged in
        }
    }, [pubkey]);


    return {
        pubkey,
        events,
        profile,
        following,
        error,
        isLoading,
        relayStats,
        login,
        fetchEvents,
        post,
        updateProfile: updateProfileMetadata, // Renamed for clarity
        followUser,
        unfollowUser,
        isFollowing,
        setEvents, // Exposing setters can be useful but use with caution
        setProfile,
        setFollowing,
    };
}