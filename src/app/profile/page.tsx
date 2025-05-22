"use client";
import Link from "next/link";
import { useNostr } from "@/hooks/useNostr";

// Extend the Window interface to include NostrTools
declare global {
    interface Window {
        NostrTools?: any;
    }
}
import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { fetchNostrProfile, getHealthyRelays, fetchNostrFeed } from "@/lib/nostr/relay";
import { Post } from "@/components/feed/Post";
import { NostrEvent } from "@/types/nostr";
import { useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChatBox } from "@/components/chat/ChatBox";

export const dynamic = "force-static";

interface ProfilePageProps {
    userOverride?: string;
    onClose?: () => void;
}

export default function ProfilePage({ userOverride, onClose }: ProfilePageProps) {
    const { events: rawEvents, profile, pubkey, updateProfile, isFollowing, followUser, unfollowUser } = useNostr();
    const searchParams = useSearchParams();
    const user = userOverride || searchParams.get("user") || pubkey;
    const [userProfile, setUserProfile] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [editing, setEditing] = useState(false);
    const [editDisplayName, setEditDisplayName] = useState("");
    const [editBio, setEditBio] = useState("");
    const [editUsername, setEditUsername] = useState("");
    const [editPicture, setEditPicture] = useState("");
    const [editBanner, setEditBanner] = useState("");
    const [editWebsite, setEditWebsite] = useState("");
    const [editNip05, setEditNip05] = useState("");
    const [userPosts, setUserPosts] = useState<NostrEvent[]>([]);
    const [likesCount, setLikesCount] = useState(0);
    const [retweetsCount, setRetweetsCount] = useState(0);
    const [lightboxMedia, setLightboxMedia] = useState<string | null>(null);
    const [profileLoaded, setProfileLoaded] = useState(false);
    const [activeTab, setActiveTab] = useState<'posts' | 'liked' | 'retweeted' | 'following'>('posts');
    const [likedPosts, setLikedPosts] = useState<NostrEvent[]>([]);
    const [retweetedPosts, setRetweetedPosts] = useState<NostrEvent[]>([]);
    const [followingUsers, setFollowingUsers] = useState<any[]>([]);
    const [followingCount, setFollowingCount] = useState<number>(0);
    const [followingFilter, setFollowingFilter] = useState("");
    const lastUserRef = useRef<string | null>(null);

    // Ensure events are NostrEvent[]
    const events = rawEvents as NostrEvent[];

    // Fetch posts for the profile being viewed
    useEffect(() => {
        if (!user) return;
        // Prevent re-fetching if already loaded for this user
        if (userProfile && userProfile.pubkey === user && userPosts.length > 0) return;
        setLoading(true);
        (async () => {
            try {
                if (user === pubkey) {
                    setUserProfile(profile);
                    setEditDisplayName(profile?.display_name || "");
                    setEditBio(profile?.about || "");
                    setEditUsername(profile?.username || "");
                    setEditPicture(profile?.picture || "");
                    setEditBanner(profile?.banner || "");
                    setEditWebsite(profile?.website || "");
                    setEditNip05(profile?.nip05 || "");
                    setUserPosts(events.filter(ev => ev.pubkey === user && ev.kind === 1));
                } else {
                    // Get healthy relays
                    const { healthyRelays } = await getHealthyRelays();
                    // Fetch profile from relays
                    const meta = await fetchNostrProfile(healthyRelays, user);
                    setUserProfile({
                        display_name: meta?.display_name || meta?.name || user,
                        bio: meta?.about,
                        picture: meta?.picture,
                        username: meta?.name || user,
                        pubkey: user,
                    });
                    // Try fetching posts with 'authors' filter first
                    let posts: NostrEvent[] = [];
                    try {
                        posts = await fetchNostrFeedWithFilter(healthyRelays, {
                            kinds: [1],
                            authors: [user],
                            limit: 100,
                        }) || [];
                    } catch {
                        // Fallback: try with 'pubkey' (legacy/compat)
                        posts = await fetchNostrFeedWithFilter(healthyRelays, {
                            kinds: [1],
                            pubkey: user,
                            limit: 100,
                        }) || [];
                    }
                    // If still no posts, fallback to local events
                    if (!posts.length) {
                        posts = events.filter(ev => ev.pubkey === user && ev.kind === 1);
                    }
                    setUserPosts(posts.map((ev: any) => ({
                        ...ev,
                        media: [],
                        profile: {
                            display_name: meta?.display_name || meta?.name || user,
                            username: meta?.name || user,
                            picture: meta?.picture,
                            bio: meta?.about,
                            pubkey: user,
                        }
                    })));
                }
                setProfileLoaded(true);
            } catch (error) {
                console.error("Error fetching user posts or profile:", error);
            } finally {
                setLoading(false);
            }
        })();
    }, [user, pubkey, profile, events]);

    // Helper to allow passing custom filter to fetchNostrFeed
    function fetchNostrFeedWithFilter(relayUrls: string[], filter: any): Promise<NostrEvent[]> {
        // This is a workaround to allow custom filters for likes/retweets
        const pool = new (require('nostr-tools').SimplePool)();
        return pool.querySync(relayUrls, filter).then((events: any) => {
            pool.close(relayUrls);
            return events;
        });
    }

    // Fetch likes and retweets for the user's posts
    useEffect(() => {
        if (!userPosts.length) return;
        (async () => {
            // Get all post ids
            const postIds = userPosts.map(ev => ev.id);
            // Get healthy relays
            const { healthyRelays } = await getHealthyRelays();
            // Fetch likes (kind 7) referencing these posts
            const likeEvents = await fetchNostrFeedWithFilter(healthyRelays, {
                kinds: [7],
                '#e': postIds,
                limit: 1000,
            }) || [];
            setLikesCount(likeEvents.length);
            // Fetch retweets (kind 6) referencing these posts
            const retweetEvents = await fetchNostrFeedWithFilter(healthyRelays, {
                kinds: [6],
                '#e': postIds,
                limit: 1000,
            }) || [];
            setRetweetsCount(retweetEvents.length);
        })();
    }, [userPosts]);

    // Fetch liked posts
    useEffect(() => {
        if (activeTab !== 'liked' || !user) return;
        (async () => {
            setLoading(true);
            try {
                const { healthyRelays } = await getHealthyRelays();
                // Fetch like events (kind 7) by this user
                const likeEvents = await fetchNostrFeedWithFilter(healthyRelays, {
                    kinds: [7],
                    authors: [user],
                    limit: 100,
                }) || [];
                // For each like event, get the referenced post id
                const postIds = likeEvents.map(ev => {
                    const tag = ev.tags.find((t: any) => t[0] === 'e');
                    return tag ? tag[1] : null;
                }).filter(Boolean);
                // Fetch the actual posts
                let posts: NostrEvent[] = [];
                if (postIds.length) {
                    posts = await fetchNostrFeedWithFilter(healthyRelays, {
                        kinds: [1],
                        ids: postIds,
                        limit: 100,
                    }) || [];
                }
                setLikedPosts(posts);
            } catch (e) {
                setLikedPosts([]);
            } finally {
                setLoading(false);
            }
        })();
    }, [activeTab, user]);

    // Fetch retweeted posts
    useEffect(() => {
        if (activeTab !== 'retweeted' || !user) return;
        (async () => {
            setLoading(true);
            try {
                const { healthyRelays } = await getHealthyRelays();
                // Fetch retweet events (kind 6) by this user
                const retweetEvents = await fetchNostrFeedWithFilter(healthyRelays, {
                    kinds: [6],
                    authors: [user],
                    limit: 100,
                }) || [];
                // For each retweet event, get the referenced post id
                const postIds = retweetEvents.map(ev => {
                    const tag = ev.tags.find((t: any) => t[0] === 'e');
                    return tag ? tag[1] : null;
                }).filter(Boolean);
                // Fetch the actual posts
                let posts: NostrEvent[] = [];
                if (postIds.length) {
                    posts = await fetchNostrFeedWithFilter(healthyRelays, {
                        kinds: [1],
                        ids: postIds,
                        limit: 100,
                    }) || [];
                }
                setRetweetedPosts(posts);
            } catch (e) {
                setRetweetedPosts([]);
            } finally {
                setLoading(false);
            }
        })();
    }, [activeTab, user]);

    // Fetch following count (and optionally, following users for the tab)
    useEffect(() => {
        if (!user) return;
        (async () => {
            try {
                const { healthyRelays } = await getHealthyRelays();
                // Fetch contact list (kind 3) for this user
                const contactEvents = await fetchNostrFeedWithFilter(healthyRelays, {
                    kinds: [3],
                    authors: [user],
                    limit: 1,
                }) || [];
                const tags = contactEvents[0]?.tags || [];
                const pubkeys = tags.filter((t: any) => t[0] === 'p').map((t: any) => t[1]);
                setFollowingCount(pubkeys.length);
                // If the following tab is open, fetch profiles
                if (activeTab === 'following') {
                    let profiles: any[] = [];
                    if (pubkeys.length) {
                        profiles = await Promise.all(pubkeys.slice(0, 50).map(async (pk: string) => {
                            const meta = await fetchNostrProfile(healthyRelays, pk);
                            return {
                                pubkey: pk,
                                displayName: meta?.display_name || meta?.name || pk,
                                picture: meta?.picture,
                                username: meta?.name || pk,
                            };
                        }));
                    }
                    setFollowingUsers(profiles);
                }
            } catch (e) {
                setFollowingCount(0);
                if (activeTab === 'following') setFollowingUsers([]);
            }
        })();
    }, [user, activeTab === 'following']);

    useEffect(() => {
        if (userProfile) {
            setEditDisplayName(userProfile.display_name);
            setEditBio(userProfile.bio ?? userProfile.about ?? "");
            setEditUsername(userProfile.username || "");
            setEditPicture(userProfile.picture || "");
            setEditBanner(userProfile.banner || "");
            setEditWebsite(userProfile.website || "");
            setEditNip05(userProfile.nip05 || "");
        }
    }, [userProfile]);

    // --- Main feed feature parity state ---
    const [activeChatPostId, setActiveChatPostId] = useState<string | null>(null);
    const [closingChatId, setClosingChatId] = useState<string | null>(null);
    const [chatCounts, setChatCounts] = useState<{ [postId: string]: number }>({});

    // Handle chat closing with animation (matches main feed)
    const handleChatClose = (postId: string) => {
        setClosingChatId(postId);
        setTimeout(() => {
            setActiveChatPostId(null);
            setClosingChatId(null);
        }, 300);
    };

    // Add skeleton loaders for profile and posts
    if (loading) {
        return (
            <div className="max-w-2xl mx-auto p-6 text-white">
                <div className="flex items-center gap-4 mb-6 animate-pulse">
                    <div className="w-20 h-20 bg-gray-700 rounded-full"></div>
                    <div className="flex flex-col gap-2">
                        <div className="w-32 h-6 bg-gray-700 rounded"></div>
                        <div className="w-24 h-4 bg-gray-700 rounded"></div>
                    </div>
                </div>
                <div className="flex flex-col gap-4">
                    {[...Array(3)].map((_, idx) => (
                        <div key={idx} className="bg-gray-800 border border-gray-700 rounded-xl p-4 animate-pulse">
                            <div className="w-full h-6 bg-gray-700 rounded mb-2"></div>
                            <div className="w-full h-4 bg-gray-700 rounded"></div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (!user) {
        return <div className="p-8 text-center">No user selected.</div>;
    }

    return (
        <div className="max-w-2xl mx-auto p-6 text-white relative">
            {/* DEBUG: Show user and pubkey values */}
            <div className="mb-2 text-xs text-gray-400">user: {user}<br/>pubkey: {pubkey}</div>
            {onClose && (
                <button
                    className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl font-bold z-10"
                    onClick={onClose}
                    aria-label="Close profile pane"
                >×</button>
            )}
            {/* Profile Card */}
            <div className="relative mb-8 rounded-xl shadow-xl bg-gradient-to-br from-[#23243a] to-[#181926] border border-gray-800 overflow-hidden">
                {/* Banner */}
                <div className="h-40 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
                {/* Avatar and Info */}
                <div className="flex items-end gap-6 px-8 pb-6 relative -mt-14">
                    <div className="w-28 h-28 rounded-full border-4 border-white shadow-lg bg-gray-900 flex items-center justify-center overflow-hidden">
                        {userProfile?.picture ? (
                            <img src={userProfile.picture} alt="Profile" className="w-full h-full rounded-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-gray-300">
                                {userProfile?.username?.slice(0, 2)?.toUpperCase() || userProfile?.pubkey?.slice(2, 4)?.toUpperCase()}
                            </div>
                        )}
                    </div>
                    <div className="flex-1 flex flex-col gap-1">
                        <h2 className="text-3xl font-bold leading-tight">{userProfile?.display_name || userProfile?.username || userProfile?.pubkey?.slice(0, 8) + "..."}</h2>
                        <div className="flex items-center gap-2">
                            <span className="text-gray-400 text-lg font-mono">@{userProfile?.username || userProfile?.pubkey?.slice(0, 8) + "..."}</span>
                            {/* Follow/Unfollow button for other users */}
                            {user !== pubkey && userProfile?.pubkey && (
                                isFollowing && isFollowing(userProfile.pubkey) ? (
                                    <button
                                        className="ml-2 px-4 py-1 rounded bg-gray-700 text-white hover:bg-gray-600 text-xs font-semibold"
                                        onClick={() => unfollowUser(userProfile.pubkey)}
                                    >Unfollow</button>
                                ) : (
                                    <button
                                        className="ml-2 px-4 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 text-xs font-semibold"
                                        onClick={() => followUser(userProfile.pubkey)}
                                    >Follow</button>
                                )
                            )}
                        </div>
                        {user === pubkey && !editing && (
                            <button
                                className="mt-3 w-fit px-5 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition font-semibold shadow-md"
                                onClick={() => setEditing(true)}
                            >Edit Profile</button>
                        )}
                    </div>
                </div>
                {/* Stats Row */}
                <div className="flex gap-8 px-8 py-4 border-t border-gray-800 bg-black/30 text-center text-base font-medium">
                    <button
                        type="button"
                        className={`focus:outline-none transition px-2 py-1 rounded-md ${activeTab === 'posts' ? 'bg-blue-600/20 text-blue-400 font-bold' : 'hover:bg-gray-800 text-white'}`}
                        onClick={() => setActiveTab('posts')}
                        aria-current={activeTab === 'posts'}
                    >
                        <span className="font-bold">{userPosts.length}</span>
                        <span className="ml-1">Posts</span>
                    </button>
                    <button
                        type="button"
                        className={`focus:outline-none transition px-2 py-1 rounded-md ${activeTab === 'liked' ? 'bg-blue-600/20 text-blue-400 font-bold' : 'hover:bg-gray-800 text-white'}`}
                        onClick={() => setActiveTab('liked')}
                        aria-current={activeTab === 'liked'}
                    >
                        <span className="font-bold">{likesCount}</span>
                        <span className="ml-1">Liked</span>
                    </button>
                    <button
                        type="button"
                        className={`focus:outline-none transition px-2 py-1 rounded-md ${activeTab === 'retweeted' ? 'bg-blue-600/20 text-blue-400 font-bold' : 'hover:bg-gray-800 text-white'}`}
                        onClick={() => setActiveTab('retweeted')}
                        aria-current={activeTab === 'retweeted'}
                    >
                        <span className="font-bold">{retweetsCount}</span>
                        <span className="ml-1">Retweeted</span>
                    </button>
                    <button
                        type="button"
                        className={`focus:outline-none transition px-2 py-1 rounded-md ${activeTab === 'following' ? 'bg-blue-600/20 text-blue-400 font-bold' : 'hover:bg-gray-800 text-white'}`}
                        onClick={() => setActiveTab('following')}
                        aria-current={activeTab === 'following'}
                    >
                        <span className="font-bold">{followingCount}</span>
                        <span className="ml-1">Following</span>
                    </button>
                </div>
            </div>
            {/* Edit Profile Form */}
            {editing && user === pubkey && (
                <form
                    className="mb-6 bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col gap-3"
                    onSubmit={async e => {
                        e.preventDefault();
                        await updateProfile({
                            display_name: editDisplayName,
                            username: editUsername,
                            about: editBio,
                            picture: editPicture,
                            banner: editBanner,
                            website: editWebsite,
                            nip05: editNip05,
                        });
                        setEditing(false);
                    }}
                >
                    <label className="font-semibold">Avatar</label>
                    <div className="flex items-center gap-4 mb-2">
                        {editPicture ? (
                            <img
                                src={editPicture}
                                alt="Avatar preview"
                                className="w-16 h-16 rounded-full object-cover border border-gray-700"
                            />
                        ) : (
                            <div className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center text-2xl text-gray-300 border border-gray-700">
                                {editUsername?.slice(0,2)?.toUpperCase() || userProfile?.pubkey?.slice(2,4)?.toUpperCase()}
                            </div>
                        )}
                        <input
                            type="file"
                            accept="image/*"
                            className="block text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                            aria-label="Upload avatar"
                            onChange={async e => {
                                const file = e.target.files?.[0];
                                if (file) {
                                    const reader = new FileReader();
                                    reader.onloadend = () => {
                                        setEditPicture(reader.result as string);
                                    };
                                    reader.readAsDataURL(file);
                                }
                            }}
                        />
                    </div>
                    <label className="font-semibold">Display Name</label>
                    <input
                        className="px-3 py-2 rounded bg-gray-800 text-white border border-gray-700"
                        value={editDisplayName}
                        onChange={e => setEditDisplayName(e.target.value)}
                        placeholder="Display Name"
                    />
                    <label className="font-semibold">Bio</label>
                    <textarea
                        className="px-3 py-2 rounded bg-gray-800 text-white border border-gray-700 resize-none"
                        value={editBio}
                        onChange={e => setEditBio(e.target.value)}
                        placeholder="Tell us about yourself"
                        rows={3}
                    ></textarea>
                    <label className="font-semibold">Username</label>
                    <input
                        className="px-3 py-2 rounded bg-gray-800 text-white border border-gray-700"
                        value={editUsername}
                        onChange={e => setEditUsername(e.target.value)}
                        placeholder="Username"
                    />
                    <label className="font-semibold">Picture URL</label>
                    <input
                        className="px-3 py-2 rounded bg-gray-800 text-white border border-gray-700"
                        value={editPicture}
                        onChange={e => setEditPicture(e.target.value)}
                        placeholder="http://example.com/your-avatar.jpg"
                    />
                    <label className="font-semibold">Banner URL</label>
                    <input
                        className="px-3 py-2 rounded bg-gray-800 text-white border border-gray-700"
                        value={editBanner}
                        onChange={e => setEditBanner(e.target.value)}
                        placeholder="http://example.com/your-banner.jpg"
                    />
                    <label className="font-semibold">Website</label>
                    <input
                        className="px-3 py-2 rounded bg-gray-800 text-white border border-gray-700"
                        value={editWebsite}
                        onChange={e => setEditWebsite(e.target.value)}
                        placeholder="http://example.com"
                    />
                    <label className="font-semibold">NIP05 (email)</label>
                    <input
                        className="px-3 py-2 rounded bg-gray-800 text-white border border-gray-700"
                        value={editNip05}
                        onChange={e => setEditNip05(e.target.value)}
                        placeholder="yourname@domain.com"
                    />
                    <button
                        type="submit"
                        className="mt-4 px-4 py-2 rounded bg-green-500 text-white hover:bg-green-600 transition-transform transform hover:scale-105 shadow-lg"
                    >
                        Save Changes
                    </button>
                </form>
            )}
            {/* Profile tabs (Posts, Liked, Retweeted, Following) */}
            <div className="mb-6">
                <Tabs
                    defaultValue={activeTab}
                    onValueChange={(val) => setActiveTab(val as typeof activeTab)}
                >
                    <TabsList>
                        <TabsTrigger value="posts">Posts ({userPosts.length})</TabsTrigger>
                        <TabsTrigger value="liked">Liked ({likesCount})</TabsTrigger>
                        <TabsTrigger value="retweeted">Retweeted ({retweetsCount})</TabsTrigger>
                        <TabsTrigger value="following">Following ({followingCount})</TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>
            {/* Active tab content */}
            <div>
                {activeTab === 'posts' && (
                    <div>
                        {userPosts.length === 0 ? (
                            <div className="p-4 text-center text-gray-400">
                                No posts found for this user.
                            </div>
                        ) : (
                            userPosts.map(ev => (
                                <Post
                                    key={ev.id}
                                    event={ev}
                                    onChatOpen={() => {}}
                                    onChatClose={() => {}}
                                    isChatActive={false}
                                    isAnimating={false}
                                    chatCount={chatCounts[ev.id] || 0}
                                />
                            ))
                        )}
                    </div>
                )}
                {activeTab === 'liked' && (
                    <div>
                        {likedPosts.length === 0 ? (
                            <div className="p-4 text-center text-gray-400">No liked posts found.</div>
                        ) : (
                            likedPosts.map(ev => (
                                <Post
                                    key={ev.id}
                                    event={ev}
                                    onChatOpen={() => {}}
                                    onChatClose={() => {}}
                                    isChatActive={false}
                                    isAnimating={false}
                                    chatCount={chatCounts[ev.id] || 0}
                                />
                            ))
                        )}
                    </div>
                )}
                {activeTab === 'retweeted' && (
                    <div>
                        {retweetedPosts.length === 0 ? (
                            <div className="p-4 text-center text-gray-400">No retweeted posts found.</div>
                        ) : (
                            retweetedPosts.map(ev => (
                                <Post
                                    key={ev.id}
                                    event={ev}
                                    onChatOpen={() => {}}
                                    onChatClose={() => {}}
                                    isChatActive={false}
                                    isAnimating={false}
                                    chatCount={chatCounts[ev.id] || 0}
                                />
                            ))
                        )}
                    </div>
                )}
                {activeTab === 'following' && (
                    <div>
                        {followingUsers.length === 0 ? (
                            <div className="p-4 text-center text-gray-400">Not following anyone yet.</div>
                        ) : (
                            followingUsers.map(user => (
                                <div key={user.pubkey} className="flex items-center gap-4 p-3 border-b border-gray-800 hover:bg-gray-900/60 transition group">
                                    <img src={user.picture || '/file.svg'} alt="avatar" className="w-12 h-12 rounded-full object-cover border border-gray-700 bg-black" />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-white truncate text-base">{user.displayName || user.username || user.pubkey.slice(0, 8) + '...'}</span>
                                            <span className="text-xs text-gray-400">@{user.username || user.pubkey.slice(0, 8) + '...'}</span>
                                        </div>
                                        <div className="text-xs text-gray-500 font-mono break-all">
                                            {user.pubkey ?
                                                `npub1${window.NostrTools?.nip19?.npubEncode ? window.NostrTools.nip19.npubEncode(user.pubkey).slice(5, 15) + '...' + window.NostrTools.nip19.npubEncode(user.pubkey).slice(-6) : user.pubkey.slice(0, 12) + '...' + user.pubkey.slice(-6)}`
                                                : ''}
                                        </div>
                                    </div>
                                    {pubkey !== user.pubkey && (
                                        isFollowing && isFollowing(user.pubkey) ? (
                                            <button
                                                className="px-4 py-1 rounded bg-gray-700 text-white hover:bg-gray-600 text-xs font-semibold"
                                                onClick={() => unfollowUser(user.pubkey)}
                                            >Unfollow</button>
                                        ) : (
                                            <button
                                                className="px-4 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 text-xs font-semibold"
                                                onClick={() => followUser(user.pubkey)}
                                            >Follow</button>
                                        )
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
