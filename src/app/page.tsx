"use client";

import { useNostr } from "@/hooks/useNostr";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { fetchLinkPreview } from "@/lib/utils/link-preview";
import { LinkPreview } from "@/types/link-preview";
import { ChatBox } from "@/components/chat/ChatBox";
import { Post } from "@/components/feed/Post";
import { CreatePost } from "@/components/feed/CreatePost";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { ErrorMessage } from "@/components/shared/ErrorMessage";
import { ProfilePane } from "@/components/ProfilePane";
import { FinancialTicker } from "@/components/shared/BitcoinTicker";
import { MediaPlayer } from "@/components/shared/MediaPlayer";
import { getHealthyRelays, fetchNostrFeed, clearBadRelayCache } from "@/lib/nostr/relay";
import { SimplePool } from "nostr-tools";
import StatsDisplay from "@/components/StatsDisplay";
import ProfilePage from "@/app/profile/page";
import ExplorePage from "@/app/explore/page";
import WalletPage from "@/app/wallet/page";
import ChatPage from "@/app/chat/page";
import Sidebar from "@/components/layout/Sidebar";
import RightSidebar from "@/components/layout/RightSidebar";

function relativeTime(timestamp: number) {
  const now = Date.now();
  const diff = Math.floor((now - (timestamp * 1000 || timestamp)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(timestamp * 1000 || timestamp).toLocaleDateString();
}

function renderLinkPreview(preview: LinkPreview) {
  return (
    // Replace inline style with Tailwind for anchor
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-xl border border-gray-800 bg-gray-950 hover:bg-gray-900 transition shadow flex gap-4 p-4 mt-2 max-w-xl no-underline"
    >
      {preview.image && (
        <img
          src={preview.image}
          alt={preview.title || preview.url}
          className="w-24 h-24 object-cover rounded-lg border border-gray-800 bg-black flex-shrink-0"
        />
      )}
      <div className="flex flex-col min-w-0">
        <div className="text-base font-semibold text-white truncate">{preview.title || preview.url}</div>
        {preview.siteName && (
          <div className="text-xs text-gray-400 mb-1 truncate flex items-center gap-1">
            {preview.favicon && <img src={preview.favicon} alt="favicon" className="inline w-4 h-4 mr-1 align-middle rounded" />} {preview.siteName}
          </div>
        )}
        {preview.description && (
          <div className="text-sm text-gray-300 truncate">{preview.description}</div>
        )}
        <div className="text-xs text-blue-400 truncate mt-1">{preview.url}</div>
      </div>
    </a>
  );
}

// Utility to format NOSTR addresses in text
export function formatNostrAddresses(text: string) {
  // Regex for hex pubkey (64 hex chars) and npub1... bech32 NOSTR addresses
  const nostrRegex = /(npub1[0-9a-z]{59}|[a-f0-9]{64})/gi;
  return text.split(nostrRegex).map((part, i) => {
    if (part.match(nostrRegex)) {
      return part; // No special formatting or linking
    }
    return part;
  });
}

// Helper for advanced relay queries (like likes, reposts, hashtag search)
async function queryRelayEvents(filter: any) {
  const { healthyRelays } = await getHealthyRelays();
  const pool = new SimplePool();
  try {
    return await pool.querySync(healthyRelays, filter);
  } finally {
    pool.close(healthyRelays);
  }
}

export default function Home() {
  const { pubkey, events, error, login, fetchEvents, post, followUser, unfollowUser, isFollowing, relayStats } = useNostr();
  const [content, setContent] = useState("");
  const [linkPreviews, setLinkPreviews] = useState<{ [url: string]: LinkPreview | null }>({});
  const [activeChatPostId, setActiveChatPostId] = useState<string | null>(null);
  const [closingChatId, setClosingChatId] = useState<string | null>(null);
  const [chatCounts, setChatCounts] = useState<{ [postId: string]: number }>({});
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const [profilePaneOpen, setProfilePaneOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchFocused, setSearchFocused] = useState(false);
  const [hashtag, setHashtag] = useState<string>("");
  const [hashtagResults, setHashtagResults] = useState<any[]>([]);
  const [filterTag, setFilterTag] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const [showFullProfile, setShowFullProfile] = useState(false);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const lastPostRef = useRef<HTMLDivElement | null>(null);
  const globalPostCount = useGlobalNostrPostCount();
  const [likeCounts, setLikeCounts] = useState<{ [postId: string]: number }>({});
  const [likedPosts, setLikedPosts] = useState<{ [postId: string]: boolean }>({});
  const [repostCounts, setRepostCounts] = useState<{ [postId: string]: number }>({});
  const [repostedPosts, setRepostedPosts] = useState<{ [postId: string]: boolean }>({});
  const [lightboxMedia, setLightboxMedia] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [activePane, setActivePane] = useState<string | null>(null);
  const [sidePaneComponent, setSidePaneComponent] = useState<React.ReactNode>(null);
  const [profilePanePubkey, setProfilePanePubkey] = useState<string | null>(null);

  // Handle sidebar navigation
  const handleNav = useCallback((key: string) => {
    console.log("handleNav triggered with key:", key);
    console.log("Current activePane:", activePane);
    console.log("Current sidePaneComponent:", sidePaneComponent);

    if (activePane === key) {
      setActivePane(null);
      setSidePaneComponent(null);
      return;
    }
    if (key === "profile") {
      if (!pubkey) {
        alert("Please log in to view your profile.");
        return;
      }
      setProfilePanePubkey(pubkey);
      setActivePane("profile");
      setSidePaneComponent(null);
    } else if (key === "post") {
      setActivePane("post");
      setSidePaneComponent(
        <div className="p-8 text-white">
          <h2 className="text-xl font-bold mb-4">Create a New Post</h2>
          <CreatePost
            onSubmit={async (content) => {
              await post(content);
              alert("Post created successfully!");
              setActivePane(null);
              setSidePaneComponent(null);
            }}
            isLoggedIn={!!pubkey}
            onLogin={login}
          />
        </div>
      );
      return;
    } else {
      setActivePane(key);
      setSidePaneComponent(null);
    }
  }, [activePane, pubkey]);

  // Search logic: filter all known profiles by displayName, username, or pubkey
  const allProfiles = useMemo(() => {
    const seen = new Set();
    return events
      .map(ev => ev.profile || { pubkey: ev.pubkey })
      .filter(p => {
        if (!p.pubkey || seen.has(p.pubkey)) return false;
        seen.add(p.pubkey);
        return true;
      });
  }, [events]);

  // Debounced search
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!search.trim()) {
      setSearchResults([]);
      return;
    }
    searchTimeout.current = setTimeout(() => {
      const q = search.trim().toLowerCase();
      const results = allProfiles.filter(p =>
        (p.display_name && p.display_name.toLowerCase().includes(q)) ||
        (p.username && p.username.toLowerCase().includes(q)) ||
        (p.pubkey && p.pubkey.toLowerCase().includes(q))
      ).slice(0, 10); // Top 10
      setSearchResults(results);
    }, 150);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, allProfiles]);

  // Close dropdown on outside click
  const searchRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
    }
    if (searchFocused) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [searchFocused]);

  // Handle infinite scrolling
  const handleObserver = useCallback((entries: IntersectionObserverEntry[]) => {
    const target = entries[0];
    if (target.isIntersecting && !isLoadingMore && hasMore) {
      const oldestEvent = events[events.length - 1];
      if (oldestEvent) {
        setIsLoadingMore(true);
        fetchEvents({ until: oldestEvent.created_at })
          .then(hasNewEvents => {
            setHasMore(hasNewEvents);
            setIsLoadingMore(false);
            setRetryCount(0); // Reset retry count on successful fetch
          })
          .catch(() => {
            setIsLoadingMore(false);
            setRetryCount(prev => prev + 1);
          });
      }
    }
  }, [events, fetchEvents, isLoadingMore, hasMore]);

  // Setup intersection observer
  useEffect(() => {
    if (lastPostRef.current && !observerRef.current) {
      observerRef.current = new IntersectionObserver(handleObserver, {
        root: null,
        rootMargin: "100px",
        threshold: 0.1
      });
    }

    if (lastPostRef.current) {
      observerRef.current?.observe(lastPostRef.current);
    }

    return () => {
      observerRef.current?.disconnect();
    };
  }, [handleObserver]);

  // Handle chat closing with animation
  const handleChatClose = (postId: string) => {
    setClosingChatId(postId);
    setTimeout(() => {
      setActiveChatPostId(null);
      setClosingChatId(null);
    }, 300);
  };

  // Initial fetch
  useEffect(() => {
    // 1. Fetch a small batch for fast initial render
    fetchEvents().then(() => {
      // 2. In the background, fetch more posts and append
      setTimeout(() => {
        if (events.length > 0) {
          const oldest = events[events.length - 1];
          if (oldest) {
            fetchEvents({ until: oldest.created_at, limit: 40 });
          }
        }
      }, 100); // slight delay to allow first render
    });
    // Live polling every 30 seconds for new posts
    const interval = setInterval(() => {
      fetchEvents();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchEvents]);

  // Fetch link previews for all unique links in events
  useEffect(() => {
    const allLinks = Array.from(
      new Set(
        events.flatMap(ev =>
          (ev.media || []).filter(url => !url.match(/\.(jpeg|jpg|gif|png|mp4|webm)$/i))
        )
      )
    );
    allLinks.forEach(async url => {
      if (!linkPreviews[url]) {
        const preview = await fetchLinkPreview(url);
        setLinkPreviews(prev => ({ ...prev, [url]: preview }));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  // Enhanced hashtag extraction
  const extractHashtags = (event: any) => {
    // 1. From content: #hashtag, #hash_tag, #hash123, Unicode, and quoted hashtags
    const contentTags = Array.from(
      new Set(
        [
          // Standard hashtags (letters, numbers, underscores, Unicode)
          ...(event.content.match(/#([\p{L}\p{N}_-]{2,50})/gu) || []).map((h: string) => h.slice(1).toLowerCase()),
          // Quoted hashtags: "#hashtag"
          ...(event.content.match(/"#([\p{L}\p{N}_-]{2,50})"/gu) || []).map((h: string) => h.replace(/"/g, '').slice(1).toLowerCase()),
          // Hashtags in URLs (e.g., https://.../#hashtag)
          ...(event.content.match(/\/#([\p{L}\p{N}_-]{2,50})/gu) || []).map((h: string) => h.replace('/#', '').toLowerCase()),
        ]
      )
    );
    // 2. From tags array: all tag types with a value that looks like a hashtag
    const tagTags = (event.tags || [])
      .filter((t: any) => t[1] && /^([\p{L}\p{N}_-]{2,50})$/u.test(t[1]))
      .map((t: any) => t[1].toLowerCase());
    return Array.from(new Set([...contentTags, ...tagTags]));
  };

  // Memoized map of postId -> hashtags
  const eventHashtagsRef = useRef<{ [id: string]: string[] }>({});
  const eventHashtags = useMemo<{ [id: string]: string[] }>(() => {
    if (!events.length) return eventHashtagsRef.current;
    const map: { [id: string]: string[] } = {};
    events.forEach((ev: any) => { map[ev.id] = extractHashtags(ev); });
    eventHashtagsRef.current = map;
    return map;
  }, [events]);

  // Hashtag search (NIP-12)
  const searchHashtag = useCallback(async (tag: string) => {
    setHashtag(tag);
    setHashtagResults([]);
    setSearch("");
    setSearchResults([]);
    // NIP-12 filter
    const filter = { kinds: [1], "#t": [tag.toLowerCase()], limit: 50 };
    const posts = await queryRelayEvents(filter);
    setHashtagResults(posts || []);
  }, []);

  // Render hashtags for a post
  function renderHashtags(ev: any) {
    const tags = eventHashtags[ev.id] || [];
    if (!tags.length) return null;
    return (
      <div className="flex flex-wrap gap-2 mt-2">
        {tags.map(tag => (
          <button
            key={tag}
            className="text-blue-400 hover:underline bg-blue-900/20 rounded px-2 py-0.5 text-xs font-mono"
            onClick={e => { e.stopPropagation(); searchHashtag(tag); }}
          >
            #{tag}
          </button>
        ))}
      </div>
    );
  }

  // Enhanced filter: filter posts by tag
  const filteredEvents = (hashtagResults.length > 0 ? hashtagResults : events).filter(ev => {
    if (!filterTag) return true;
    // Check if event content or tags include the filterTag
    const tagMatch = (ev.content && ev.content.toLowerCase().includes(filterTag.toLowerCase()));
    const tagArray = (ev.tags || []).map((t: any) => t[1]?.toLowerCase?.() || "");
    return tagMatch || tagArray.includes(filterTag.toLowerCase());
  });

  // Trending hashtags calculation
  const trendingHashtags = useMemo(() => {
    const tagCounts: { [tag: string]: number } = {};
    events.forEach(ev => {
      const tags = eventHashtags[ev.id] || [];
      tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });
    // Sort by frequency, descending
    return Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
  }, [events, eventHashtags]);

  // Fetch like counts for visible posts
  useEffect(() => {
    let isMounted = true;
    (async () => {
      const postIds = filteredEvents.map(ev => ev.id);
      if (postIds.length === 0) return;
      // Query for kind 7 (like) events referencing these posts
      const likeEvents = await queryRelayEvents({ kinds: [7], '#e': postIds, limit: 1000 });
      if (!isMounted) return;
      // Count likes per post
      const counts: { [postId: string]: number } = {};
      const liked: { [postId: string]: boolean } = {};
      likeEvents?.forEach((ev: any) => {
        const refId = (ev.tags.find((t: any) => t[0] === 'e') || [])[1];
        if (refId) {
          counts[refId] = (counts[refId] || 0) + 1;
          if (ev.pubkey === pubkey) liked[refId] = true;
        }
      });
      setLikeCounts(counts);
      setLikedPosts(liked);
    })();
    return () => { isMounted = false; };
  }, [filteredEvents, pubkey]);

  // Like a post (publish kind 7 event)
  const handleLike = useCallback(async (postId: string, postPubkey: string) => {
    if (!pubkey || !window.nostr) return;
    // Optimistically update UI
    setLikeCounts(prev => ({ ...prev, [postId]: (prev[postId] || 0) + 1 }));
    setLikedPosts(prev => ({ ...prev, [postId]: true }));
    // Build like event
    const event = {
      kind: 7,
      pubkey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ["e", postId],
        ["p", postPubkey],
      ],
      content: "+",
      sig: "", // Will be filled by extension
    };
    // Sign and publish
    try {
      const signed = await window.nostr.signEvent(event);
      // TODO: Publish signed event to relay
    } catch (err) {
      // Rollback optimistic update on error
      setLikeCounts(prev => ({ ...prev, [postId]: Math.max((prev[postId] || 1) - 1, 0) }));
      setLikedPosts(prev => ({ ...prev, [postId]: false }));
    }
  }, [pubkey]);

  // Fetch repost counts for visible posts
  useEffect(() => {
    let isMounted = true;
    (async () => {
      const postIds = filteredEvents.map(ev => ev.id);
      if (postIds.length === 0) return;
      // Query for kind 6 (repost) events referencing these posts
      const repostEvents = await queryRelayEvents({ kinds: [6], '#e': postIds, limit: 1000 });
      if (!isMounted) return;
      // Count reposts per post
      const counts: { [postId: string]: number } = {};
      const reposted: { [postId: string]: boolean } = {};
      repostEvents?.forEach((ev: any) => {
        const refId = (ev.tags.find((t: any) => t[0] === 'e') || [])[1];
        if (refId) {
          counts[refId] = (counts[refId] || 0) + 1;
          if (ev.pubkey === pubkey) reposted[refId] = true;
        }
      });
      setRepostCounts(counts);
      setRepostedPosts(reposted);
    })();
    return () => { isMounted = false; };
  }, [filteredEvents, pubkey]);

  // Repost a post (publish kind 6 event)
  const handleRepost = useCallback(async (postId: string, postPubkey: string, postContent: string) => {
    if (!pubkey || !window.nostr) return;
    // Optimistically update UI
    setRepostCounts(prev => ({ ...prev, [postId]: (prev[postId] || 0) + 1 }));
    setRepostedPosts(prev => ({ ...prev, [postId]: true }));
    // Build repost event
    const event = {
      kind: 6,
      pubkey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ["e", postId],
        ["p", postPubkey],
      ],
      content: postContent,
      sig: "", // Will be filled by extension
    };
    // Sign and publish
    try {
      const signed = await window.nostr.signEvent(event);
      // TODO: Publish signed event to relay
    } catch (err) {
      // Rollback optimistic update on error
      setRepostCounts(prev => ({ ...prev, [postId]: Math.max((prev[postId] || 1) - 1, 0) }));
      setRepostedPosts(prev => ({ ...prev, [postId]: false }));
    }
  }, [pubkey]);

  // Update renderMediaWithPreview to accept setLightboxMedia as a prop
  function renderMediaWithPreview(media: string[], linkPreviews: { [url: string]: LinkPreview | null }, setLightboxMedia: (url: string) => void) {
    if (!media || media.length === 0) return null;
    const images = media.filter(url => url.match(/\.(jpeg|jpg|gif|png)$/i));
    // Detect YouTube and SoundCloud links
    const youTubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)[\w-]+/i;
    const soundCloudRegex = /soundcloud\.com\//i;
    const videos = media.filter(url => url.match(/\.(mp4|webm)$/i) || youTubeRegex.test(url));
    const audios = media.filter(url => url.match(/\.(mp3|wav|ogg)$/i) || soundCloudRegex.test(url));
    const mediaSet = new Set([...images, ...videos, ...audios]);
    const links = media.filter(url => !mediaSet.has(url) && !url.match(/\.(jpeg|jpg|gif|png|mp4|webm|mp3|wav|ogg)$/i) && !youTubeRegex.test(url) && !soundCloudRegex.test(url));
    return (
      <div className="flex flex-col gap-2 mt-2">
        {images.length > 0 && (
          <div className={`grid gap-2 ${images.length === 1 ? "grid-cols-1" : images.length === 2 ? "grid-cols-2" : "grid-cols-2"}`}>
            {images.slice(0, 4).map((url, idx) => (
              // Replace inline style with Tailwind for image
              <img
                key={idx}
                src={url}
                alt="media"
                className="rounded-xl object-cover border border-gray-800 bg-black w-full h-60 cursor-pointer aspect-square object-cover"
                onClick={e => { e.stopPropagation(); setLightboxMedia(url); }}
              />
            ))}
          </div>
        )}
        {(videos.length > 0 || audios.length > 0) && (
          <div className="flex flex-col gap-2">
            {[...videos, ...audios].map((url, idx) => (
              <div key={idx} className="relative">
                <MediaPlayer url={url} className="rounded-xl border border-gray-800 bg-black w-full shadow-lg" />
                <span className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                  {url.match(/\.(mp4|webm)$/i) || youTubeRegex.test(url) ? "Video" : "Audio"}
                </span>
              </div>
            ))}
          </div>
        )}
        {links.length > 0 && (
          <div className="flex flex-col gap-2">
            {links.map((url, idx) =>
              linkPreviews[url] ? (
                linkPreviews[url] && renderLinkPreview(linkPreviews[url]!)
              ) : (
                <a
                  key={idx}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 underline break-all hover:text-blue-300"
                >
                  {url}
                </a>
              )
            )}
          </div>
        )}
      </div>
    );
  }

  function ProfileDropdown({ children, menu }: { children: React.ReactNode, menu: React.ReactNode }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    // Close dropdown on outside click
    useEffect(() => {
      function handleClick(e: MouseEvent) {
        if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
      }
      if (open) document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }, [open]);
    return (
      <div className="relative" ref={ref}>
        {/* Replace inline style with Tailwind for ProfileDropdown clickable div */}
        <div onClick={() => setOpen(v => !v)} className="cursor-pointer">
          {children}
        </div>
        {open && (
          <div className="absolute left-0 mt-2 z-20 bg-gray-900 border border-gray-800 rounded-xl shadow-lg min-w-[120px] p-2 flex flex-col">
            {menu}
          </div>
        )}
      </div>
    );
  }

  function useGlobalNostrPostCount() {
    const [totalCount, setTotalCount] = useState<number | null>(null);

    useEffect(() => {
      const fetchCount = async () => {
        try {
          // Get healthy relays
          const { healthyRelays } = await getHealthyRelays();
          // Fetch a large number of events and deduplicate by id for an estimate
          const result = await fetchNostrFeed(healthyRelays, {
            limit: 1000, // Fetch up to 1000 events for estimation
          });
          // Deduplicate by event id
          const uniqueIds = new Set((result || []).map(ev => ev.id));
          setTotalCount(uniqueIds.size);
        } catch (e) {
          setTotalCount(null);
        }
      };
      fetchCount();
    }, []);

    return totalCount;
  }

  // Fetch NOSTR Band stats on component mount
  useEffect(() => {
    // Remove fetchNostrBandStats usage or replace with correct implementation if needed
    setLoadingStats(false);
  }, []);

  // Open profile pane with a given pubkey
  const openProfilePane = (pubkey: string) => {
    setProfilePanePubkey(pubkey);
    setActivePane("profile");
    setSidePaneComponent(null); // Will be set in useEffect
  };

  // Dynamic import logic for side pane
  useEffect(() => {
    if (!activePane) {
      setSidePaneComponent(null);
      return;
    }
    let component: React.ReactNode = null;
    if (activePane === "explore") {
      component = <ExplorePage />;
    } else if (activePane === "wallet") {
      component = <WalletPage />;
    } else if (activePane === "chat") {
      component = <ChatPage />;
    } else if (activePane === "profile" && profilePanePubkey) {
      component = <ProfilePage userOverride={profilePanePubkey} onClose={() => setActivePane(null)} />;
    } else if (activePane === "post") {
      component = (
        <div className="p-8 text-white">
          <h2 className="text-xl font-bold mb-4">Create a New Post</h2>
          <CreatePost
            onSubmit={async (content) => {
              await post(content);
              alert("Post created successfully!");
              setActivePane(null);
              setSidePaneComponent(null);
            }}
            isLoggedIn={!!pubkey}
            onLogin={login}
          />
        </div>
      );
    } else {
      // Placeholder for other panes
      component = <div className="p-8 text-white">Coming soon...</div>;
    }
    setSidePaneComponent(component);
  }, [activePane, profilePanePubkey]);

  // --- Layout Refactor Start ---
  // Relay health state
  const [healthyRelayCount, setHealthyRelayCount] = useState<number | null>(null);
  const [checkingRelays, setCheckingRelays] = useState(false);
  useEffect(() => {
    let mounted = true;
    async function checkRelays() {
      setCheckingRelays(true);
      try {
        const { healthyRelays } = await getHealthyRelays();
        if (mounted) setHealthyRelayCount(healthyRelays.length);
      } catch {
        if (mounted) setHealthyRelayCount(null);
      } finally {
        if (mounted) setCheckingRelays(false);
      }
    }
    checkRelays();
    // Optionally, re-check every 2 minutes
    const interval = setInterval(checkRelays, 120000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  // --- Layout Refactor Start ---
  return (
    <div className="min-h-screen w-full bg-black flex flex-row">
      {/* Left Sidebar (fixed) */}
      <aside className="hidden md:flex flex-col w-[80px] xl:w-[240px] h-screen sticky top-0 left-0 z-30 border-r border-gray-800 bg-gray-950">
        <Sidebar onNav={handleNav} activePane={activePane} />
      </aside>

      {/* Centered content group: Feed + Side Pane */}
      <div className="flex-1 flex justify-center">
        <div
          className={`flex flex-row w-full max-w-[calc(100vw-400px)] xl:max-w-[calc(100vw-400px)] 2xl:max-w-[1800px] transition-all duration-300 ${activePane && sidePaneComponent ? "gap-8" : ""} justify-center`}
        >
          {/* Main Feed (centered, but shifts left if side pane is open) */}
          <div
            className={`w-full max-w-2xl px-2 sm:px-6 py-8 bg-gray-950 border border-gray-800 shadow-xl rounded-xl transition-all duration-300 flex-shrink-0 ${activePane && sidePaneComponent ? "" : "mx-auto"} overflow-y-auto h-[calc(100vh-32px)]`}
          >
            {/* Search and Filter */}
            <div className="mb-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    onFocus={() => setSearchFocused(true)}
                    placeholder="Search users by name, username, or npub..."
                    className="w-full px-4 py-2 rounded-full bg-gray-900 border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/30 placeholder-gray-500"
                    autoComplete="off"
                  />
                </div>
                <button
                  className={`ml-0 sm:ml-2 px-4 py-2 rounded-full border border-blue-500 text-blue-400 bg-blue-900/20 hover:bg-blue-900/40 transition font-semibold ${showFilter ? 'ring-2 ring-blue-400' : ''}`}
                  onClick={() => setShowFilter(v => !v)}
                >
                  {showFilter ? 'Hide Filters' : 'Filter by Tag'}
                </button>
              </div>
              {showFilter && (
                <div className="mb-6 flex gap-2 items-center">
                  <input
                    type="text"
                    value={filterTag}
                    onChange={e => setFilterTag(e.target.value)}
                    placeholder="Enter tag (e.g. bitcoin, nostr, ai)"
                    className="px-4 py-2 rounded-full bg-gray-900 border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/30 placeholder-gray-500 w-full"
                  />
                  <button
                    className="px-4 py-2 rounded-full bg-blue-500 text-white hover:bg-blue-600 transition font-semibold"
                    onClick={() => setFilterTag("")}
                  >
                    Clear
                  </button>
                </div>
              )}

              {/* Header */}
              <header className="flex items-center justify-between mb-6">
                {/* <h1 className="text-2xl font-bold">RAW.ROCKS</h1> */}
                <div>
                  {!pubkey && (
                    <button
                      onClick={login}
                      className="px-4 py-2 rounded-full bg-blue-500 text-white font-medium hover:bg-blue-600 shadow-lg shadow-blue-500/20 transition"
                    >
                      Login with NOSTR
                    </button>
                  )}
                </div>
              </header>

              {/* Global Post Count */}
              {globalPostCount !== null ? (
                <div className="text-xs text-gray-400 mb-2 text-center">
                  🌎 Global Nostr Posts: <span className="font-bold">{globalPostCount.toLocaleString()}</span>
                </div>
              ) : (
                <div className="text-xs text-gray-400 mb-2 text-center">Loading global post count...</div>
              )}

              {/* Relay Health Warning */}
              {healthyRelayCount !== null && healthyRelayCount < 3 && (
                <div className="mb-4 p-3 rounded-xl bg-yellow-900/80 border border-yellow-600 text-yellow-200 text-center flex flex-col items-center gap-2">
                  <span className="font-semibold">⚠️ Low relay connectivity</span>
                  <span>Only {healthyRelayCount} healthy relay{healthyRelayCount === 1 ? '' : 's'} detected. Some posts may be missing or delayed.</span>
                  <button
                    className="mt-1 px-3 py-1 rounded bg-yellow-700 text-white hover:bg-yellow-800 text-xs font-semibold"
                    onClick={() => {
                      setHealthyRelayCount(null);
                      setCheckingRelays(true);
                      getHealthyRelays().then(({ healthyRelays }) => {
                        setHealthyRelayCount(healthyRelays.length);
                        setCheckingRelays(false);
                      }).catch(() => setCheckingRelays(false));
                    }}
                    disabled={checkingRelays}
                  >
                    {checkingRelays ? 'Checking...' : 'Retry Relays'}
                  </button>
                </div>
              )}
            </div>

            {/* Post Feed */}
            <main className="flex flex-col gap-6">
              {/* Error State */}
              {error && (
                <ErrorMessage
                  message={error}
                  relayStats={relayStats}
                  onRetry={() => fetchEvents()}
                  onClearRelays={() => {
                    clearBadRelayCache();
                    fetchEvents();
                  }}
                />
              )}

              {/* Empty State */}
              {events.length === 0 && !isLoadingMore && !error && (
                <div className="text-center text-gray-500 py-12">
                  <p className="mb-4">No posts yet. Be the first to post!</p>
                  {!pubkey && (
                    <button
                      onClick={login}
                      className="px-6 py-2 bg-blue-500/20 hover:bg-blue-500/30 rounded-full text-blue-400 transition"
                    >
                      Connect with NOSTR to Post
                    </button>
                  )}
                </div>
              )}

              {/* Posts */}
              {filteredEvents.map((ev, index) => (
                <div
                  key={ev.id}
                  ref={hashtagResults.length === 0 && index === events.length - 1 ? lastPostRef : null}
                  className="relative"
                >
                  <div
                    onClick={() => {
                      if (activeChatPostId === ev.id) {
                        handleChatClose(ev.id);
                      } else {
                        if (activeChatPostId) {
                          handleChatClose(activeChatPostId);
                          setTimeout(() => setActiveChatPostId(ev.id), 300);
                        } else {
                          setActiveChatPostId(ev.id);
                        }
                      }
                    }}
                    className={`bg-gray-900/40 backdrop-blur-sm border border-white/10 rounded-xl p-5 shadow-lg flex flex-col gap-2 cursor-pointer transition hover:bg-gray-900/60 hover:border-white/20 ${activeChatPostId === ev.id ? 'rounded-b-none border-b-0' : ''}`}
                  >
                    {/* Post header */}
                    <div className="flex items-center gap-4 mb-1">
                      <ProfileDropdown
                        menu={pubkey && ev.pubkey !== pubkey ? (
                          isFollowing(ev.pubkey) ? (
                            <button
                              className="text-xs px-3 py-1 rounded bg-gray-800 border border-gray-600 text-gray-300 hover:bg-gray-700 w-full text-left"
                              onClick={(e) => { e.stopPropagation(); unfollowUser(ev.pubkey); }}
                            >Unfollow</button>
                          ) : (
                            <button
                              className="text-xs px-3 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 w-full text-left"
                              onClick={(e) => { e.stopPropagation(); followUser(ev.pubkey); }}
                            >Follow</button>
                          )
                        ) : null}
                      >
                        <img
                          src={ev.profile?.picture || "/file.svg"}
                          alt="avatar"
                          className="w-12 h-12 rounded-full border border-gray-800"
                        />
                      </ProfileDropdown>
                      <div className="min-w-0 flex flex-col">
                        {/* Remove inline style from button in post header, use Tailwind for reset */}
                        <button
                          type="button"
                          className="font-semibold text-white truncate hover:underline text-left outline-none bg-transparent border-0 p-0 m-0 cursor-pointer"
                          onClick={e => {
                            e.stopPropagation();
                            openProfilePane(ev.pubkey);
                          }}
                          tabIndex={0}
                          aria-label={`Open profile for ${ev.profile?.display_name || ev.profile?.name || ev.profile?.username || ev.pubkey}`}
                        >
                          {ev.profile?.display_name || ev.profile?.name || ev.profile?.username || ev.pubkey.slice(0, 8) + "..." }
                        </button>
                        <div className="text-sm text-gray-400 flex items-center gap-2">
                          <span>
                            @{ev.profile?.name || ev.profile?.username || (ev.profile?.pubkey ? `${ev.profile.pubkey.slice(0, 6)}...${ev.profile.pubkey.slice(-4)}` : ev.pubkey.slice(0, 6) + '...' + ev.pubkey.slice(-4))}
                          </span>
                          <span className="text-xs text-gray-500">{relativeTime(ev.created_at)}</span>
                        </div>
                      </div>
                      <div className="flex-1" />

                      {/* Chat count badge */}
                      {chatCounts[ev.id] > 0 && (
                        <div className="px-2 py-1 rounded-full bg-blue-500/10 text-blue-400 text-sm flex items-center gap-1">
                          <span>💬</span>
                          {chatCounts[ev.id]}
                        </div>
                      )}
                    </div>

                    {/* Post content */}
                    <div className="text-lg text-white whitespace-pre-line break-words mb-1">
                      {formatNostrAddresses(ev.content)}
                    </div>
                    {renderMediaWithPreview(ev.media, linkPreviews, setLightboxMedia)}
                    {renderHashtags(ev)}

                    {/* Post actions */}
                    <div className="flex gap-6 mt-2 text-sm text-gray-400 border-t border-gray-800 pt-3">
                      <div className={`flex items-center gap-2 transition ${activeChatPostId === ev.id ? 'text-blue-400' : 'hover:text-blue-400'}`}>
                        <span>💬</span>
                        <span>Chat{chatCounts[ev.id] > 0 ? ` (${chatCounts[ev.id]})` : ''}</span>
                      </div>
                      <button
                        className={`flex items-center gap-2 hover:text-pink-400 transition ${likedPosts[ev.id] ? 'text-pink-400 font-bold' : ''}`}
                        onClick={e => { e.stopPropagation(); if (!likedPosts[ev.id]) handleLike(ev.id, ev.pubkey); }}
                        disabled={!!likedPosts[ev.id]}
                        aria-label={likedPosts[ev.id] ? 'Liked' : 'Like'}
                        type="button"
                      >
                        <span>❤️</span>
                        <span>Like{likeCounts[ev.id] ? ` (${likeCounts[ev.id]})` : ''}</span>
                      </button>
                      <button
                        className={`flex items-center gap-2 hover:text-green-400 transition ${repostedPosts[ev.id] ? 'text-green-400 font-bold' : ''}`}
                        onClick={e => { e.stopPropagation(); if (!repostedPosts[ev.id]) handleRepost(ev.id, ev.pubkey, ev.content); }}
                        disabled={!!repostedPosts[ev.id]}
                        aria-label={repostedPosts[ev.id] ? 'Reposted' : 'Repost'}
                        type="button"
                      >
                        <span>🔁</span>
                        <span>Repost{repostCounts[ev.id] ? ` (${repostCounts[ev.id]})` : ''}</span>
                      </button>
                    </div>
                  </div>

                  {/* Chat box below post */}
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
              {/* Loading State */}
              {isLoadingMore && (
                <div className="text-center py-4">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                  <p className="mt-2 text-gray-400 text-sm">Loading more posts...</p>
                </div>
              )}

              {/* End of Feed */}
              {!hasMore && events.length > 0 && (
                <div className="text-center py-8 text-gray-500">
                  You've reached the end!
                </div>
              )}

              {/* Retry State */}
              {retryCount > 0 && !isLoadingMore && hasMore && (
                <div className="text-center py-4">
                  <p className="text-gray-400 mb-2">Failed to load more posts</p>
                  <button
                    onClick={() => {
                      const oldestEvent = events[events.length - 1];
                      if (oldestEvent) {
                        setIsLoadingMore(true);
                        fetchEvents({ until: oldestEvent.created_at })
                          .then(hasNewEvents => {
                            setHasMore(hasNewEvents);
                            setIsLoadingMore(false);
                            setRetryCount(0);
                          })
                          .catch(() => {
                            setIsLoadingMore(false);
                            setRetryCount(prev => prev + 1);
                          });
                      }
                    }}
                    className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 rounded-full text-sm transition"
                  >
                    Try Again
                  </button>
                </div>
              )}
            </main>
          </div>

          {/* Dynamic Side Pane (Explore, Wallet, Chat, Profile, etc.) */}
          {activePane && sidePaneComponent && (
            <section className="hidden lg:block w-full max-w-2xl px-2 sm:px-6 py-8 bg-gray-950 border border-gray-800 shadow-xl rounded-xl overflow-y-auto relative animate-slide-in-left flex-shrink-0 h-[calc(100vh-32px)]">
              {sidePaneComponent}
            </section>
          )}
        </div>
      </div>

      {/* Right Sidebar (fixed) */}
      <aside className="hidden xl:flex flex-col w-[320px] h-screen sticky top-0 right-0 z-30 border-l border-gray-800 bg-gray-950">
        <RightSidebar trendingHashtags={trendingHashtags} searchHashtag={searchHashtag} />
      </aside>
    </div>
  );
}
