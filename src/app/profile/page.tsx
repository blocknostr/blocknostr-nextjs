"use client";
import Link from "next/link";
import { useNostr } from "@/hooks/useNostr";
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
                    setUserPosts(events.filter(ev => ev.pubkey === user && ev.kind === 1));
                } else {
                    // Get healthy relays
                    const { healthyRelays } = await getHealthyRelays();
                    // Fetch profile from relays
                    const meta = await fetchNostrProfile(healthyRelays, user);
                    setUserProfile({
                        displayName: meta?.display_name || meta?.name || user,
                        bio: meta?.about,
                        picture: meta?.picture,
                        username: meta?.name,
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
                            displayName: meta?.display_name || meta?.name || user,
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
            setEditDisplayName(userProfile.displayName);
            setEditBio(userProfile.bio ?? userProfile.about ?? "");
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
            {/* Refine the banner and profile header for better visual appeal */}
            <div className="relative mb-6">
                <div className="h-40 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-t-xl shadow-lg"></div>
                <div className="absolute top-20 left-6">
                    {userProfile?.picture ? (
                        <img src={userProfile.picture} alt="Profile" className="w-28 h-28 rounded-full object-cover border-4 border-white shadow-md" />
                    ) : (
                        <div className="w-28 h-28 bg-gray-700 rounded-full flex items-center justify-center text-3xl font-bold text-gray-300 border-4 border-white shadow-md">
                            {userProfile?.username?.slice(0, 2)?.toUpperCase() || userProfile?.pubkey?.slice(2, 4)?.toUpperCase()}
                        </div>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-4 mb-6">
                <div>
                    <h2 className="text-2xl font-bold">{userProfile?.displayName || userProfile?.username || userProfile?.pubkey?.slice(0, 8) + "..."}</h2>
                    <p className="text-gray-400">@{userProfile?.username || userProfile?.pubkey?.slice(0, 8) + "..."}</p>
                    {/* Show Edit Profile button if this is your own profile */}
                    {user === pubkey && !editing && (
                        <button
                            className="mt-2 px-4 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 transition-transform transform hover:scale-105 shadow-lg"
                            onClick={() => setEditing(true)}
                        >Edit Profile</button>
                    )}
                </div>
            </div>
            {/* Edit Profile Form */}
            {editing && user === pubkey && (
                <form
                    className="mb-6 bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col gap-3"
                    onSubmit={async e => {
                        e.preventDefault();
                        await updateProfile({ display_name: editDisplayName, about: editBio });
                        setEditing(false);
                    }}
                >
                    <label className="font-semibold">Display Name</label>
                    <input
                        className="px-3 py-2 rounded bg-gray-800 text-white border border-gray-700"
                        value={editDisplayName}
                        onChange={e => setEditDisplayName(e.target.value)}
                        placeholder="Display Name"
                    />
                    <label className="font-semibold">Bio</label>
                    <textarea
                        className="px-3 py-2 rounded bg-gray-800 text-white border border-gray-700 min-h-[60px]"
                        value={editBio}
                        onChange={e => setEditBio(e.target.value)}
                        placeholder="Bio"
                    />
                    <div className="flex gap-2 mt-2">
                        <button type="submit" className="px-4 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 transition">Save</button>
                        <button type="button" className="px-4 py-1 rounded bg-gray-700 text-white hover:bg-gray-600 transition" onClick={() => setEditing(false)}>Cancel</button>
                    </div>
                </form>
            )}
            {/* Enhance profile stats with tooltips and additional counts */}
            <div className="flex gap-6 mb-6">
                <div title="Number of posts made by this user"><span className="font-bold">{userPosts.length}</span> Posts</div>
                <button title="Posts liked by this user" className={`font-bold ${activeTab === 'liked' ? 'text-blue-400 underline' : ''}`} onClick={() => setActiveTab('liked')}><span>{likesCount}</span> Liked</button>
                <button title="Posts retweeted by this user" className={`font-bold ${activeTab === 'retweeted' ? 'text-blue-400 underline' : ''}`} onClick={() => setActiveTab('retweeted')}><span>{retweetsCount}</span> Retweeted</button>
                <button title="Users this profile is following" className={`font-bold ${activeTab === 'following' ? 'text-blue-400 underline' : ''}`} onClick={() => setActiveTab('following')}><span>{followingCount}</span> Following</button>
            </div>
            {/* Tab content */}
            {activeTab === 'posts' && (
                <>
                    <h3 className="text-xl font-semibold mb-4">Posts</h3>
                    <div className="flex flex-col gap-4">
                        {userPosts.map(ev => (
                            <div key={ev.id} className="relative">
                                <Post
                                    event={ev}
                                    onChatOpen={id => {
                                        if (activeChatPostId === id) return;
                                        if (activeChatPostId) {
                                            handleChatClose(activeChatPostId);
                                            setTimeout(() => setActiveChatPostId(id), 300);
                                        } else {
                                            setActiveChatPostId(id);
                                        }
                                    }}
                                    onChatClose={id => handleChatClose(id)}
                                    isChatActive={activeChatPostId === ev.id}
                                    isAnimating={closingChatId === ev.id}
                                    chatCount={chatCounts?.[ev.id] || 0}
                                />
                                {activeChatPostId === ev.id && (
                                    <ChatBox
                                        postId={ev.id}
                                        pubkey={pubkey}
                                        onClose={() => handleChatClose(ev.id)}
                                        isAnimating={closingChatId === ev.id}
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                </>
            )}
            {activeTab === 'liked' && (
                <>
                    <h3 className="text-xl font-semibold mb-4">Liked Posts</h3>
                    <div className="flex flex-col gap-4">
                        {likedPosts.map(ev => (
                            <div key={ev.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5 shadow-lg">
                                <div className="text-lg text-white whitespace-pre-line break-words mb-1">{ev.content}</div>
                                <p className="text-xs text-gray-500 mt-2">{new Date(ev.created_at * 1000 || ev.created_at).toLocaleString()}</p>
                                <Link href={`/profile?user=${ev.pubkey}`} className="text-blue-400 hover:underline text-xs mt-2 inline-block">View Profile</Link>
                            </div>
                        ))}
                        {likedPosts.length === 0 && <div className="text-gray-400">No liked posts found.</div>}
                    </div>
                </>
            )}
            {activeTab === 'retweeted' && (
                <>
                    <h3 className="text-xl font-semibold mb-4">Retweeted Posts</h3>
                    <div className="flex flex-col gap-4">
                        {retweetedPosts.map(ev => (
                            <div key={ev.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5 shadow-lg">
                                <div className="text-lg text-white whitespace-pre-line break-words mb-1">{ev.content}</div>
                                <p className="text-xs text-gray-500 mt-2">{new Date(ev.created_at * 1000 || ev.created_at).toLocaleString()}</p>
                                <Link href={`/profile?user=${ev.pubkey}`} className="text-blue-400 hover:underline text-xs mt-2 inline-block">View Profile</Link>
                            </div>
                        ))}
                        {retweetedPosts.length === 0 && <div className="text-gray-400">No retweeted posts found.</div>}
                    </div>
                </>
            )}
            {activeTab === 'following' && (
                <>
                    <h3 className="text-xl font-semibold mb-4">Following</h3>
                    <input
                        type="text"
                        value={followingFilter}
                        onChange={e => setFollowingFilter(e.target.value)}
                        placeholder="Search following..."
                        className="mb-4 px-4 py-2 rounded-full bg-gray-900 border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/30 placeholder-gray-500 w-full"
                    />
                    <div className="flex flex-col gap-4">
                        {followingUsers
                            .filter(user => {
                                const hasUsername = user.username && user.username !== user.pubkey;
                                const shortPubkey = user.pubkey ? `${user.pubkey.slice(0, 8)}...${user.pubkey.slice(-6)}` : '';
                                const displayName = hasUsername ? user.displayName : shortPubkey;
                                const username = hasUsername ? user.username : shortPubkey;
                                const q = followingFilter.toLowerCase();
                                return (
                                    displayName.toLowerCase().includes(q) ||
                                    username.toLowerCase().includes(q) ||
                                    user.pubkey.toLowerCase().includes(q)
                                );
                            })
                            .map(user => {
                                const hasUsername = user.username && user.username !== user.pubkey;
                                const shortPubkey = user.pubkey ? `${user.pubkey.slice(0, 8)}...${user.pubkey.slice(-6)}` : '';
                                const displayName = hasUsername ? user.displayName : shortPubkey;
                                const username = hasUsername ? user.username : shortPubkey;
                                const following = isFollowing && isFollowing(user.pubkey);
                                return (
                                    <div
                                        key={user.pubkey}
                                        className="bg-gray-900 border border-gray-800 rounded-xl p-5 shadow-lg flex items-center gap-4 hover:bg-gray-800 transition group"
                                    >
                                        {user.picture ? (
                                            <img src={user.picture} alt="avatar" className="w-12 h-12 rounded-full border border-gray-800 object-cover" />
                                        ) : (
                                            <div className="w-12 h-12 rounded-full border border-gray-800 bg-gray-700 flex items-center justify-center text-2xl font-bold text-gray-300">
                                                {displayName[0]}
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <div className="text-lg text-white font-semibold truncate">{displayName}</div>
                                            <div className="text-gray-400 truncate">@{username}</div>
                                            <Link href={`/profile?user=${user.pubkey}`} className="text-blue-400 hover:underline text-xs mt-2 inline-block">View Profile</Link>
                                        </div>
                                        {/* Follow/Unfollow button, only if not self */}
                                        {user.pubkey !== pubkey && (
                                            following ? (
                                                <button
                                                    className="ml-4 px-4 py-1 rounded-full bg-gray-800 text-white border border-gray-600 hover:bg-gray-700 transition text-sm font-semibold group-hover:bg-pink-900/30 group-hover:text-pink-400"
                                                    onClick={() => unfollowUser(user.pubkey)}
                                                >Unfollow</button>
                                            ) : (
                                                <button
                                                    className="ml-4 px-4 py-1 rounded-full bg-blue-500 text-white hover:bg-blue-600 transition text-sm font-semibold group-hover:ring-2 group-hover:ring-blue-400"
                                                    onClick={() => followUser(user.pubkey)}
                                                >Follow</button>
                                            )
                                        )}
                                    </div>
                                );
                            })}
                        {followingUsers.length === 0 && <div className="text-gray-400">Not following anyone yet.</div>}
                    </div>
                </>
            )}
            {/* Lightbox overlay for media display */}
            {lightboxMedia && (
                <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
                    <button
                        className="absolute top-4 right-4 text-white text-3xl hover:text-gray-300"
                        onClick={() => setLightboxMedia(null)}
                    >
                        &times;
                    </button>
                    {lightboxMedia.match(/\.(jpeg|jpg|gif|png)$/i) ? (
                        <img src={lightboxMedia} alt="media" className="max-w-full max-h-full rounded-lg shadow-lg" />
                    ) : (
                        <video src={lightboxMedia} controls className="max-w-full max-h-full rounded-lg shadow-lg" />
                    )}
                </div>
            )}
        </div>
    );
}
