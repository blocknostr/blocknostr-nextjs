import React, { useState, useEffect, useMemo, useRef } from "react";
import Leaderboard from "@/components/games/Leaderboard";
import { useNostr } from "../../hooks/useNostr";
import type { NostrEvent } from "../../types/nostr";
import TetrisGame from "@/components/games/TetrisGame";
import BlockWarriorsGame from "@/components/games/BlockWarriorsGame";
import Tamagotchi from "@/components/games/Tamagotchi";

// --- Replace event filtering with correct tag checks ---
// Helper to check if a tag exists in event.tags
function hasTag(event: any, tag: string, value?: string) {
    if (!event.tags || !Array.isArray(event.tags)) return false;
    return event.tags.some((t: string[]) => t[0] === tag && (value === undefined || t[1] === value));
}

// Helper to extract first image URL from a string (for description parsing)
function getFirstImageUrlFromEvent(event: { content: string }): string | undefined {
    if (!event.content) return undefined;
    const match = event.content.match(/https?:\/\/(\S+\.(?:png|jpg|jpeg|gif|webp))/i);
    return match ? match[0] : undefined;
}

// --- Interfaces ---
export interface Game {
    id: string;
    name: string;
    genre: string[];
    description: string;
    creator: string;
    version: string;
    updated: string;
    thumbnail: string;
    componentId: string;
}

export interface LeaderboardEntry {
    pubkey: string;
    username?: string;
    score: number;
    rank: number;
    relay?: string;
    isFriend?: boolean;
}

// --- New Types for Achievements, Analytics, Uploads, Challenges ---
interface Achievement {
    id: string;
    name: string;
    description: string;
    unlocked: boolean;
    dateUnlocked?: string;
}
interface GameStats {
    highScore: number;
    playCount: number;
    achievements: Achievement[];
}
interface Challenge {
    id: string;
    from: string;
    to: string;
    gameId: string;
    score: number;
    status: "pending" | "accepted" | "declined";
    created: string;
}

// Game component mapping
const gameComponents: { [key: string]: React.ComponentType } = {
    tamagotchi: Tamagotchi,
};

// Default games if no Nostr events are found
const defaultGames: Game[] = [
    {
        id: "tetris",
        name: "Tetris",
        genre: ["Arcade", "Puzzle"],
        description: "Classic Tetris on the decentralized web.",
        creator: "npub1example",
        version: "1.0.0",
        updated: "2025-05-17",
        // Using official Tetris logo from Wikimedia Commons (CC BY-SA 4.0)
        thumbnail: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Tetris_logo.svg/512px-Tetris_logo.svg.png",
        componentId: "tetris",
    },
    {
        id: "ikari",
        name: "BlockWarriors",
        genre: ["Arcade", "Shooter"],
        description: "BlockWarriors: Multiplayer tank action with Nostr chat and scoreboard.",
        creator: "npub1example",
        version: "1.0.0",
        updated: "2025-05-17",
        // Using pixel art tank asset from OpenGameArt (CC0)
        thumbnail: "https://opengameart.org/sites/default/files/tank-preview.png",
        componentId: "ikari",
    },
    {
        id: "tamagotchi",
        name: "Tamagotchi",
        genre: ["Simulation", "Casual"],
        description: "Raise your own digital pet! Feed, play, clean, and keep it happy.",
        creator: "npub1example",
        version: "1.0.0",
        updated: "2025-05-17",
        thumbnail: "https://kaboomjs.com/sprites/bean.png",
        componentId: "tamagotchi",
    },
];

const GameManagerPage: React.FC = () => {
    const [selectedGame, setSelectedGame] = useState<string | null>(null);
    const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([]);
    const [showLeaderboard, setShowLeaderboard] = useState(false);
    const [selectedLeaderboardGame, setSelectedLeaderboardGame] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
    const [previewGame, setPreviewGame] = useState<Game | null>(null);
    const [page, setPage] = useState(1);
    const gamesPerPage = 10;
    // TODO: Replace with actual user pubkey from wallet
    const [currentUserPubkey] = useState("npub1user");

    // Instead of useRelays, useProfileCache, useNostrEvents, useNostr provides pubkey, events, profile, etc.
    const nostr = useNostr();

    // Helper to publish events (replace with your relay logic or NIP-07 extension)
    const publishEvent = async (event: Partial<NostrEvent>) => {
        // TODO: Replace this with your actual event publishing logic (e.g., nostr-tools, relay, or extension)
        console.warn("publishEvent called, but no implementation is provided. Event:", event);
        // Example: await nostrRelay.publish(event);
    };

    // Load game data from Nostr
    const gameEvents = nostr.events.filter(event => event.kind === 30078 && event.tags.some((t: string[]) => t[0] === "game"));

    // Use games from Nostr events or default
    const games: Game[] = useMemo(() => {
        if (!gameEvents || gameEvents.length === 0) return defaultGames;
        return gameEvents.map(event => {
            const thumbnail = event.tags.find((t: string[]) => t[0] === "thumbnail")?.[1] || "/default-game.png";
            const description = event.content;

            // Try to extract preview image from description if no thumbnail
            let finalThumbnail = thumbnail;
            if (thumbnail === "/default-game.png" && description) {
                const img = getFirstImageUrlFromEvent({ content: description });
                if (img) {
                    finalThumbnail = img;
                }
            }

            return {
                id: event.tags.find((t: string[]) => t[0] === "d")?.[1] || event.id,
                name: event.tags.find((t: string[]) => t[0] === "name")?.[1] || "Untitled",
                genre: event.tags.find((t: string[]) => t[0] === "genre")?.[1]?.split(",") || [],
                description,
                creator: event.pubkey,
                version: event.tags.find((t: string[]) => t[0] === "version")?.[1] || "1.0.0",
                updated: new Date(event.created_at * 1000).toISOString().split("T")[0],
                thumbnail: finalThumbnail,
                componentId: event.tags.find((t: string[]) => t[0] === "component")?.[1] || "tetris",
            };
        });
    }, [gameEvents]);

    // Fetch friends from Nostr contact list
    const contactEvents = nostr.events.filter(event => event.kind === 3 && event.pubkey === currentUserPubkey);
    const friends: string[] = useMemo(
        () => (contactEvents as NostrEvent[]).flatMap(e => (e.tags as string[][]).filter(t => t[0] === "p").map(t => t[1])),
        [contactEvents]
    );

    // Memoize filtered games
    const filteredGames: Game[] = useMemo(
        () =>
            games.filter(
                (game: Game) =>
                    game.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
                    (!selectedGenre || game.genre.includes(selectedGenre))
            ),
        [games, searchQuery, selectedGenre]
    );

    // Paginate games
    const paginatedGames: Game[] = filteredGames.slice((page - 1) * gamesPerPage, page * gamesPerPage);

    // Fetch leaderboard data from Nostr
    useEffect(() => {
        if (!showLeaderboard || !selectedLeaderboardGame) return;
        // TODO: Replace with real Nostr relay subscription logic
        // For now, use mock data
        const mockEntries: LeaderboardEntry[] = [
            { pubkey: "npub1user1", score: 12000, rank: 1, isFriend: true },
            { pubkey: "npub1user2", score: 9000, rank: 2 },
            { pubkey: "npub1user3", score: 8000, rank: 3 },
        ];
        setLeaderboardEntries(mockEntries);
    }, [showLeaderboard, selectedLeaderboardGame, friends]);

    // --- New State ---
    const [gameStats, setGameStats] = useState<{ [gameId: string]: GameStats }>({});
    const [showAnalytics, setShowAnalytics] = useState<string | null>(null);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [uploadForm, setUploadForm] = useState({ name: "", description: "", file: null as File | null, uploading: false });
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [challenges, setChallenges] = useState<Challenge[]>([]);
    const [incomingChallenge, setIncomingChallenge] = useState<Challenge | null>(null);

    // --- Challenge Mode: Subscribe to Nostr challenge events ---
    const challengeEvents = useMemo(() => nostr.events.filter(event => event.kind === 30079 && hasTag(event, 't', 'challenge') && hasTag(event, 'to', currentUserPubkey)), [nostr.events, currentUserPubkey]);
    useEffect(() => {
        if (!challengeEvents) return;
        const newChallenges = (challengeEvents as NostrEvent[]).map(e => ({
            id: e.id,
            from: e.pubkey,
            to: e.tags.find((t: string[]) => t[0] === "to")?.[1] || "",
            gameId: e.tags.find((t: string[]) => t[0] === "game")?.[1] || "",
            score: parseInt(e.tags.find((t: string[]) => t[0] === "score")?.[1] || "0"),
            status: e.tags.find((t: string[]) => t[0] === "status")?.[1] as Challenge["status"] || "pending",
            created: new Date(e.created_at * 1000).toISOString(),
        }));
        setChallenges(newChallenges);
        setIncomingChallenge(newChallenges.find(c => c.status === "pending" && c.to === currentUserPubkey) || null);
    }, [challengeEvents, currentUserPubkey]);

    // --- Achievements, High Scores, Play Counts: Local + Nostr (stub) ---
    useEffect(() => {
        // Load from localStorage
        // --- Handlers for Achievements, High Scores, Play Counts ---
        // publishEvent is now defined above; you can implement actual relay logic there.
        // (This block was misplaced and caused a syntax error. If you want to load stats from localStorage, do it here.)
        // Example:
        // const savedStats = localStorage.getItem("gameStats");
        // if (savedStats) setGameStats(JSON.parse(savedStats));
    }, []);

    const unlockAchievement = (gameId: string, achievementId: string) => {
        setGameStats(prev => {
            const stats = { ...prev };
            const game = stats[gameId] || { highScore: 0, playCount: 0, achievements: [] };
            const ach = game.achievements.find(a => a.id === achievementId);
            if (ach && !ach.unlocked) {
                ach.unlocked = true;
                ach.dateUnlocked = new Date().toISOString();
            }
            stats[gameId] = game;
            return stats;
        });

        const event = {
            kind: 30080, // Custom kind for achievements
            tags: [
                ["t", "achievement"],
                ["game", gameId],
                ["achievement", achievementId]
            ],
            content: "Achievement unlocked!",
            created_at: Math.floor(Date.now() / 1000),
        };
        publishEvent(event);
    };

    const recordGamePlay = (gameId: string, score: number) => {
        setGameStats(prev => {
            const stats = { ...prev };
            const game = stats[gameId] || { highScore: 0, playCount: 0, achievements: [] };
            game.playCount += 1;
            if (score > game.highScore) game.highScore = score;
            stats[gameId] = game;
            return stats;
        });

        const event = {
            kind: 30081, // Custom kind for game scores
            tags: [
                ["t", "score"],
                ["game", gameId],
                ["score", score.toString()]
            ],
            content: "Game played!",
            created_at: Math.floor(Date.now() / 1000),
        };
        publishEvent(event);
    };
    // --- Challenge Friend (real Nostr event) ---
    const challengeFriend = async (friendPubkey: string, gameId: string, score: number) => {
        const event = {
            kind: 30079, // Custom kind for challenges
            tags: [
                ["t", "challenge"],
                ["to", friendPubkey],
                ["game", gameId],
                ["score", score.toString()]
            ],
            content: "Challenge issued!",
            created_at: Math.floor(Date.now() / 1000),
        };
        publishEvent(event);
    };
    // --- Accept/Decline Challenge ---
    const respondToChallenge = (challengeId: string, accept: boolean) => {
        // TODO: Publish response event to Nostr
        setChallenges(chs => chs.map(c => c.id === challengeId ? { ...c, status: accept ? "accepted" : "declined" } : c));
        setIncomingChallenge(null);
    };
    // --- Upload Modal Handlers ---
    const handleUploadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setUploadForm(f => ({ ...f, file: e.target.files![0] }));
        }
    };
    const handleUpload = async () => {
        if (!uploadForm.name || !uploadForm.file) {
            setUploadError("Name and file required");
            return;
        }
        setUploadForm(f => ({ ...f, uploading: true }));
        setUploadError(null);
        try {
            // Convert file to base64
            const reader = new FileReader();
            reader.readAsDataURL(uploadForm.file);
            reader.onload = async () => {
                const base64 = reader.result as string;
                // TODO: Publish file as Nostr event (kind 30080)
                // TODO: Publish metadata as Nostr event (kind 30078)
                setUploadForm({ name: "", description: "", file: null, uploading: false });
                setShowUploadModal(false);
            };
        } catch (e) {
            setUploadError("Upload failed");
            setUploadForm(f => ({ ...f, uploading: false }));
        }
    };

    // Track gameplay duration (stub)
    const trackGamePlay = async (gameId: string, duration: number) => {
        // TODO: Publish event to relays using nostr-tools
    };

    // Challenge a friend (stub)
    const challengeFriendStub = async (friendPubkey: string, gameId: string, score: number) => {
        // TODO: Publish event to relays using nostr-tools
    };

    // Get game component
    const GameComponent = selectedGame
        ? gameComponents[games.find((g: Game) => g.id === selectedGame)?.componentId || ""]
        : null;

    // Demo/mock data for enhancements
    const [favorites, setFavorites] = useState<string[]>([]);
    const [recentActivity] = useState([
        { type: "score", game: "Tetris", value: 12000, date: "2025-05-17" },
        { type: "achievement", game: "Tetris", value: "Cleared 10 lines", date: "2025-05-16" },
        { type: "friend", user: "npub1user2", action: "challenged you in Tetris", date: "2025-05-15" },
    ]);
    const [gamesPlayedToday] = useState(2);
    const [globalRank] = useState(42);
    const [featuredGame] = useState(games[0]);
    const sparklineRef = useRef<HTMLCanvasElement>(null);
    // Draw a simple sparkline for demo
    useEffect(() => {
        if (!sparklineRef.current) return;
        const ctx = sparklineRef.current.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, 120, 32);
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        const points = [20, 12, 24, 8, 28, 18, 30, 10, 32, 20, 40, 12];
        points.forEach((y, i) => {
            ctx.lineTo(i * 10, 32 - y);
        });
        ctx.stroke();
    }, [games.length]);

    // --- Multiplayer & Chat State ---
    const [multiplayerUsers, setMultiplayerUsers] = useState<Record<string, { pubkey: string; lastSeen: number }>>({});
    const [chatLog, setChatLog] = useState<{ pubkey: string; content: string; created_at: number }[]>([]);
    const [chatInput, setChatInput] = useState("");

    // --- Multiplayer Presence & Chat via Nostr ---
    useEffect(() => {
        if (!selectedGame) return;

        console.log("Setting up chat and presence for game:", selectedGame);

        const presenceKind = 30090;
        const chatKind = 30091;

        // Clear previous state
        setMultiplayerUsers({});
        setChatLog([]);

        try {
            // Fetch recent chat history first
            nostr.events
                .filter(event => event.kind === chatKind && hasTag(event, 't', selectedGame))
                .forEach(event => {
                    setChatLog(prev => {
                        // Avoid duplicates
                        if (prev.some(m => m.created_at === event.created_at)) return prev;
                        const newLog = [...prev, {
                            pubkey: event.pubkey,
                            content: event.content,
                            created_at: event.created_at
                        }];
                        // Sort by timestamp
                        return newLog.sort((a, b) => a.created_at - b.created_at);
                    });
                });

            // Subscribe to new messages
            const chatSubId = nostr.events
                .filter(event => event.kind === chatKind)
                .forEach(event => {
                    if (hasTag(event, 't', selectedGame)) {
                        setChatLog(prev => {
                            // Avoid duplicates
                            if (prev.some(m => m.created_at === event.created_at)) return prev;
                            return [...prev, {
                                pubkey: event.pubkey,
                                content: event.content,
                                created_at: event.created_at
                            }].sort((a, b) => a.created_at - b.created_at);
                        });
                    }
                });

            // Presence system
            const presSubId = nostr.events
                .filter(event => event.kind === presenceKind && hasTag(event, 't', selectedGame))
                .forEach(event => {
                    setMultiplayerUsers(prev => ({
                        ...prev,
                        [event.pubkey]: { pubkey: event.pubkey, lastSeen: event.created_at }
                    }));
                    // Clean up users who haven't been seen in 2 minutes
                    const twoMinutesAgo = (Date.now() / 1000) - 120;
                    setMultiplayerUsers(prev => {
                        const newUsers = { ...prev };
                        Object.entries(newUsers).forEach(([key, user]) => {
                            if (user.lastSeen < twoMinutesAgo) {
                                delete newUsers[key];
                            }
                        });
                        return newUsers;
                    });
                });

            // Announce presence every 20s
            const presenceInterval = setInterval(() => {
                publishEvent({
                    kind: presenceKind,
                    tags: [['t', selectedGame]],
                    content: 'online',
                    created_at: Math.floor(Date.now() / 1000),
                });
            }, 20000);

            // Initial presence announcement
            publishEvent({
                kind: presenceKind,
                tags: [['t', selectedGame]],
                content: 'online',
                created_at: Math.floor(Date.now() / 1000),
            });

            return () => {
                clearInterval(presenceInterval);
                // if (presSubId) nostrService.unsubscribe(presSubId);
                // if (chatSubId) nostrService.unsubscribe(chatSubId);
            };
        } catch (error) {
            console.error("Error setting up Nostr subscriptions:", error);
        }
    }, [selectedGame]);
    // --- Send Chat Message ---
    const sendChat = () => {
        if (!chatInput.trim() || !selectedGame) return;
        publishEvent({
            kind: 30091,
            tags: [['t', selectedGame]],
            content: chatInput,
            created_at: Math.floor(Date.now() / 1000),
        });
        setChatInput("");
    };

    return (
        <div className="flex h-screen bg-background text-foreground">
            {/* Main Content */}
            <main className="flex-1 p-4 md:p-6 overflow-y-auto">
                {/* --- Enhanced Stats Dashboard --- */}
                <div className="w-full grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white/5 backdrop-blur rounded-lg shadow-lg border border-white/10 p-4 flex flex-col items-start">
                        <span className="text-gray-400 text-xs font-medium mb-1">Total Games</span>
                        <span className="text-xl font-bold text-white" aria-live="polite">{games.length}</span>
                        <canvas ref={sparklineRef} width={120} height={32} className="mt-2 w-24 h-6 opacity-70" aria-label="Games played trend" />
                    </div>
                    <div className="bg-white/5 backdrop-blur rounded-lg shadow-lg border border-white/10 p-4 flex flex-col items-start">
                        <span className="text-gray-400 text-xs font-medium mb-1">Achievements</span>
                        <span className="text-xl font-bold text-white" aria-live="polite">7</span>
                        <span className="text-xs text-gray-400 mt-1">+1 this week</span>
                    </div>
                    <div className="bg-white/5 backdrop-blur rounded-lg shadow-lg border border-white/10 p-4 flex flex-col items-start">
                        <span className="text-gray-400 text-xs font-medium mb-1">Games Today</span>
                        <span className="text-xl font-bold text-white" aria-live="polite">{gamesPlayedToday}</span>
                        <span className="text-xs text-gray-400 mt-1">Keep your streak!</span>
                    </div>
                    <div className="bg-white/5 backdrop-blur rounded-lg shadow-lg border border-white/10 p-4 flex flex-col items-start">
                        <span className="text-gray-400 text-xs font-medium mb-1">Global Rank</span>
                        <span className="text-xl font-bold text-white" aria-live="polite">#{globalRank}</span>
                        <span className="text-[11px] text-yellow-400 mt-1">Top 1%</span>
                    </div>
                </div>
                {/* --- Featured Game Banner --- */}
                {featuredGame && (
                    <div className="w-full flex flex-col md:flex-row items-center bg-white/10 rounded-lg shadow-lg border border-white/10 mb-6 p-4 gap-4">
                        <img src={featuredGame.thumbnail} alt={featuredGame.name} className="w-24 h-24 rounded-lg grayscale hover:grayscale-0 border border-white/20 shadow-lg transition-all duration-300" />
                        <div className="flex-1 flex flex-col gap-1">
                            <span className="uppercase text-[10px] text-gray-400 tracking-wider font-medium">Featured Game</span>
                            <h2 className="text-lg font-bold text-white">{featuredGame.name}</h2>
                            <p className="text-sm text-gray-300 mb-2">{featuredGame.description}</p>
                            <div className="flex gap-2 items-center">
                                <button className="px-3 py-1.5 text-sm rounded-md bg-black text-white font-medium shadow hover:bg-gray-800 border border-white/10">Play Now</button>
                                <span className="text-xs text-gray-400">by {featuredGame.creator.slice(0, 8)}</span>
                            </div>
                        </div>
                    </div>
                )}
                {/* --- Friends Online Bar --- */}
                {friends.length > 0 && (
                    <div className="w-full flex items-center gap-2 mb-6">
                        <span className="text-xs text-gray-400">Friends Online:</span>
                        <div className="flex gap-1.5">
                            {friends.slice(0, 8).map((f, i) => (
                                <div key={f} className="w-6 h-6 rounded-full bg-white/10 border border-white/20 flex items-center justify-center overflow-hidden grayscale hover:grayscale-0 transition-all duration-300">
                                    <img src={"/public/placeholder.svg"} alt={f.slice(0, 8)} className="w-full h-full object-cover" />
                                </div>
                            ))}
                        </div>
                        {friends.length > 8 && <span className="text-xs text-gray-400">+{friends.length - 8} more</span>}
                    </div>
                )}
                {/* --- Recent Activity Feed --- */}
                <div className="w-full mb-6">
                    <h3 className="text-sm font-medium text-white mb-2">Recent Activity</h3>
                    <ul className="space-y-1.5">
                        {recentActivity.map((a, i) => (
                            <li key={i} className="flex items-center gap-2 text-gray-200 text-xs bg-white/5 rounded-md px-3 py-2">
                                {a.type === "score" && <span className="text-green-400">🏆</span>}
                                {a.type === "achievement" && <span className="text-yellow-400">★</span>}
                                {a.type === "friend" && <span className="text-blue-400">👥</span>}
                                <span>
                                    {a.type === "score" && <>You scored <b>{a.value}</b> in <b>{a.game}</b></>}
                                    {a.type === "achievement" && <>Achievement unlocked in <b>{a.game}</b>: <b>{a.value}</b></>}
                                    {a.type === "friend" && <>{a.user} {a.action}</>}
                                </span>
                                <span className="ml-auto text-[11px] text-gray-400">{a.date}</span>
                            </li>
                        ))}
                    </ul>
                </div>
                {/* Search and Filter */}
                <div className="w-full flex gap-3 mb-6">
                    <input
                        type="text"
                        placeholder="Search games..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="px-3 py-1.5 text-sm rounded-md bg-black text-white border border-white/10 focus:outline-none focus:ring-1 focus:ring-white/20"
                        aria-label="Search games"
                    />
                    <select
                        value={selectedGenre || ""}
                        onChange={(e) => setSelectedGenre(e.target.value || null)}
                        className="px-3 py-1.5 text-sm rounded-md bg-black text-white border border-white/10 focus:outline-none focus:ring-1 focus:ring-white/20"
                        aria-label="Filter by genre"
                    >
                        <option value="">All Genres</option>
                        {[...new Set(games.flatMap((g: Game) => g.genre))].map((genre) => (
                            <option key={genre as string} value={genre as string}>
                                {genre as string}
                            </option>
                        ))}
                    </select>
                    <button
                        className="px-3 py-1.5 text-sm bg-white text-black rounded-md font-medium shadow-lg border border-white/20 hover:bg-gray-200 transition ml-auto"
                        onClick={() => setShowUploadModal(true)}
                        aria-label="Upload new game"
                    >＋ Upload Game</button>
                </div>
                {/* --- Challenge Mode Banner --- */}
                {incomingChallenge && (
                    <div className="w-full mb-4 p-4 bg-blue-900/60 border border-blue-400/30 rounded-xl flex items-center gap-4 animate-fade-in">
                        <span className="text-white font-bold">Challenge from {incomingChallenge.from.slice(0, 8)} in {games.find(g => g.id === incomingChallenge.gameId)?.name || "a game"} for score {incomingChallenge.score}</span>
                        <button className="px-3 py-1 bg-green-700 text-white rounded-lg" onClick={() => respondToChallenge(incomingChallenge.id, true)}>Accept</button>
                        <button className="px-3 py-1 bg-red-700 text-white rounded-lg" onClick={() => respondToChallenge(incomingChallenge.id, false)}>Decline</button>
                    </div>
                )}
                {/* Game Cards Table */}
                <div className="w-full bg-white/5 backdrop-blur rounded-2xl shadow-xl border border-white/10 overflow-hidden">
                    <table className="min-w-full text-left text-sm game-table">
                        <thead className="bg-black/60">
                            <tr>
                                <th className="px-6 py-4 text-white font-bold">Game</th>
                                <th className="px-6 py-4 text-white font-bold">Genre</th>
                                <th className="px-6 py-4 text-white font-bold">High Score</th>
                                <th className="px-6 py-4 text-white font-bold">Achievements</th>
                                <th className="px-6 py-4 text-white font-bold">Last Played</th>
                                <th className="px-6 py-4 text-white font-bold">Favorite</th>
                                <th className="px-6 py-4 text-white font-bold">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedGames.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="text-center text-gray-400 py-8">No games found. Try a different search or filter.</td>
                                </tr>
                            )}
                            {paginatedGames.map((game) => {
                                const stats = gameStats[game.id] || { highScore: 0, playCount: 0, achievements: [] };
                                return (
                                    <tr
                                        key={game.id}
                                        className="border-b border-white/10 hover:bg-white/5 transition animate-fade-in"
                                    >
                                        <td className="px-6 py-4 flex items-center gap-3">
                                            <img
                                                src={game.thumbnail}
                                                alt={game.name}
                                                className="w-12 h-12 rounded-lg border border-white/20 shadow cursor-pointer grayscale hover:grayscale-0 hover:border-white transition-all duration-300 focus:outline-white"
                                                onClick={() => setPreviewGame(game)}
                                                aria-label={`Preview ${game.name}`}
                                                tabIndex={0}
                                            />
                                            <div>
                                                <span className="text-white font-bold text-base">{game.name}</span>
                                                <div className="text-xs text-gray-400 font-mono">v{game.version}</div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-200">{game.genre.join(", ")}</td>
                                        <td className="px-6 py-4 text-white font-mono font-bold">{stats.highScore}</td>
                                        <td className="px-6 py-4 text-gray-200">
                                            <div className="w-24 h-2 bg-gray-800 rounded-full overflow-hidden">
                                                <div className="h-2 bg-gradient-to-r from-white to-gray-400" style={{ width: `${(stats.achievements.filter(a => a.unlocked).length / (stats.achievements.length || 1)) * 100}%` }} />
                                            </div>
                                            <span className="text-xs text-gray-400">{stats.achievements.filter(a => a.unlocked).length}/{stats.achievements.length || 1}</span>
                                        </td>
                                        <td className="px-6 py-4 text-gray-400">{game.updated}</td>
                                        <td className="px-6 py-4">
                                            <button
                                                className={`text-2xl focus:outline-white ${favorites.includes(game.id) ? "text-yellow-400" : "text-gray-400 hover:text-white"}`}
                                                onClick={() => setFavorites(favs => favs.includes(game.id) ? favs.filter(id => id !== game.id) : [...favs, game.id])}
                                                aria-label={favorites.includes(game.id) ? "Unfavorite" : "Favorite"}
                                            >
                                                ★
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 flex gap-2">
                                            <button
                                                className="px-3 py-1 rounded bg-black text-white font-semibold shadow hover:bg-gray-800 transition border border-white/10 focus:outline-white"
                                                onClick={() => setSelectedGame(game.id)}
                                                aria-label={`Play ${game.name}`}
                                            >
                                                Play
                                            </button>
                                            <button
                                                className="px-3 py-1 rounded bg-gray-900 text-white font-semibold shadow hover:bg-gray-700 transition border border-white/10 focus:outline-white"
                                                onClick={() => {
                                                    setSelectedLeaderboardGame(game.id);
                                                    setShowLeaderboard(true);
                                                }}
                                                aria-label={`View leaderboard for ${game.name}`}
                                            >
                                                Leaderboard
                                            </button>
                                            <button
                                                className="px-3 py-1 rounded bg-gray-900 text-white font-semibold shadow hover:bg-gray-700 border border-white/10 focus:outline-white"
                                                onClick={() => setShowAnalytics(game.id)}
                                                aria-label={`View analytics for ${game.name}`}
                                            >
                                                Analytics
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                {/* Pagination */}
                <div className="flex gap-4 mt-4">
                    <button
                        disabled={page === 1}
                        onClick={() => setPage(p => p - 1)}
                        className="px-4 py-2 bg-black text-white rounded-lg border border-white/10 disabled:opacity-50 focus:outline-white"
                        aria-label="Previous page"
                    >
                        Previous
                    </button>
                    <button
                        disabled={page * gamesPerPage >= filteredGames.length}
                        onClick={() => setPage(p => p + 1)}
                        className="px-4 py-2 bg-black text-white rounded-lg border border-white/10 disabled:opacity-50 focus:outline-white"
                        aria-label="Next page"
                    >
                        Next
                    </button>
                </div>
                {/* Game Console Modal */}
                {selectedGame && GameComponent && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl game-modal">
                        <div className="relative w-full max-w-[90vw] h-[90vh] flex gap-4">
                            {/* Game Window */}
                            <div className="relative flex-1">
                                <button
                                    className="absolute top-2 right-2 z-50 px-3 py-1.5 text-sm bg-black text-white rounded-md shadow hover:bg-gray-800 transition border border-white/10 focus:outline-white"
                                    onClick={() => setSelectedGame(null)}
                                    aria-label="Close game"
                                >
                                    ✕
                                </button>
                                <div className="w-full h-full bg-black/90 backdrop-blur-2xl rounded-2xl shadow-2xl border border-white/10 flex flex-col items-center justify-center overflow-hidden">
                                    <React.Suspense fallback={<div className="text-white text-sm">Loading…</div>}>
                                        <GameComponent />
                                    </React.Suspense>
                                </div>
                            </div>

                            {/* Chat Panel - Now outside game window */}
                            <div className="w-80 bg-black/90 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl flex flex-col">
                                {/* Chat Header */}
                                <div className="px-4 py-3 border-b border-white/10">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium text-white">Game Chat</span>
                                        <span className="text-xs text-gray-400">{Object.keys(multiplayerUsers).length} online</span>
                                    </div>
                                </div>

                                {/* Players Online */}
                                <div className="px-4 py-2 border-b border-white/10 bg-white/5">
                                    <div className="flex flex-wrap gap-1">
                                        {Object.values(multiplayerUsers).length === 0 ? (
                                            <span className="text-gray-500 text-xs">No other players online</span>
                                        ) : (
                                            Object.values(multiplayerUsers).map(u => (
                                                <span key={u.pubkey}
                                                    className="inline-flex items-center px-2 py-1 rounded-full bg-white/10 text-xs text-cyan-200">
                                                    {u.pubkey.slice(0, 8)}
                                                </span>
                                            ))
                                        )}
                                    </div>
                                </div>

                                {/* Chat Messages */}
                                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                                    {chatLog.length === 0 ? (
                                        <div className="flex flex-col gap-1 text-center py-4">
                                            <span className="text-gray-500 text-xs">No messages yet</span>
                                            <span className="text-gray-500 text-xs">Be the first to chat!</span>
                                        </div>
                                    ) : (
                                        chatLog.map((m, i) => (
                                            <div key={i} className="group flex items-start gap-2 animate-fade-in">
                                                <span className="font-mono text-xs text-cyan-200">{m.pubkey.slice(0, 8)}</span>
                                                <span className="text-white text-sm">{m.content}</span>
                                                <span className="ml-auto text-[10px] text-gray-500">{new Date(m.created_at * 1000).toLocaleTimeString()}</span>
                                            </div>
                                        ))
                                    )}
                                </div>

                                {/* Chat Input */}
                                <div className="p-3 border-t border-white/10 bg-black/60">
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            className="flex-1 px-3 py-1.5 text-sm bg-white/10 text-white rounded-md border border-white/10 focus:outline-none focus:border-white/20 placeholder:text-gray-500"
                                            placeholder="Type your message..."
                                            value={chatInput}
                                            onChange={e => setChatInput(e.target.value)}
                                            onKeyDown={e => { if (e.key === "Enter") sendChat(); }}
                                            aria-label="Chat message input"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {/* Leaderboard Modal */}
                {showLeaderboard && (
                    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                        <div className="relative w-full max-w-xl">
                            <button
                                className="absolute top-2 right-2 z-50 px-3 py-1 bg-black text-white rounded-lg shadow hover:bg-gray-800 transition border border-white/10 focus:outline-white"
                                onClick={() => setShowLeaderboard(false)}
                                aria-label="Close leaderboard"
                            >
                                ✕
                            </button>
                            <Leaderboard
                                entries={leaderboardEntries.map(e => ({
                                    ...e,
                                    username: e.pubkey.slice(0, 8),
                                }))}
                                currentUserPubkey={currentUserPubkey}
                                onProfileClick={(pubkey: string) => {
                                    // TODO: open profile modal
                                }}
                            />
                        </div>
                    </div>
                )}
                {/* Game Preview Modal */}
                {previewGame && (
                    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                        <div className="relative w-full max-w-lg bg-black rounded-2xl p-6 border border-white/10">
                            <button
                                className="absolute top-2 right-2 px-3 py-1 bg-black text-white rounded-lg border border-white/10 focus:outline-white"
                                onClick={() => setPreviewGame(null)}
                                aria-label="Close preview"
                            >
                                ✕
                            </button>
                            <img
                                src={previewGame.thumbnail}
                                alt={previewGame.name}
                                className="w-full h-48 rounded-lg mb-4 grayscale hover:grayscale-0 hover:border-white border border-white/20 transition-all duration-300"
                            />
                            <h2 className="text-2xl font-bold text-white">{previewGame.name}</h2>
                            <p className="text-gray-300">{previewGame.description}</p>
                            <p className="text-gray-200">Creator: {previewGame.creator.slice(0, 8)}</p>
                            <div className="flex gap-4 mt-4">
                                <button className="px-4 py-2 bg-black text-white rounded-lg border border-white/10" onClick={() => setSelectedGame(previewGame.id)}>Play</button>
                            </div>
                        </div>
                    </div>
                )}
                {/* --- Analytics Modal --- */}
                {showAnalytics && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl">
                        <div className="relative w-full max-w-lg bg-black rounded-2xl p-6 border border-white/10">
                            <span className="text-white">Analytics coming soon.</span>
                            <button className="absolute top-2 right-2 px-3 py-1 bg-black text-white rounded-lg border border-white/10 focus:outline-white" onClick={() => setShowAnalytics(null)} aria-label="Close analytics">✕</button>
                        </div>
                    </div>
                )}
                {/* --- Upload Modal --- */}
                {showUploadModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl">
                        <div className="relative w-full max-w-md bg-black rounded-2xl p-6 border border-white/10">
                            <button
                                className="absolute top-2 right-2 px-3 py-1 bg-black text-white rounded-lg border border-white/10 focus:outline-white"
                                onClick={() => setShowUploadModal(false)}
                                aria-label="Close upload modal"
                            >
                                ✕
                            </button>
                            <h2 className="text-xl font-bold text-white mb-4">Upload New Game</h2>
                            <div className="flex flex-col gap-3">
                                <label htmlFor="game-name" className="text-sm text-gray-200">Game Name</label>
                                <input
                                    id="game-name"
                                    type="text"
                                    className="px-3 py-2 rounded-md bg-white/10 text-white border border-white/10 focus:outline-none"
                                    value={uploadForm.name}
                                    onChange={e => setUploadForm(f => ({ ...f, name: e.target.value }))}
                                    placeholder="Enter game name"
                                />
                                <label htmlFor="game-description" className="text-sm text-gray-200">Description</label>
                                <textarea
                                    id="game-description"
                                    className="px-3 py-2 rounded-md bg-white/10 text-white border border-white/10 focus:outline-none"
                                    value={uploadForm.description}
                                    onChange={e => setUploadForm(f => ({ ...f, description: e.target.value }))}
                                    placeholder="Enter game description"
                                />
                                <label htmlFor="game-file" className="text-sm text-gray-200">Game File</label>
                                <input
                                    id="game-file"
                                    type="file"
                                    className="px-3 py-2 rounded-md bg-white/10 text-white border border-white/10 focus:outline-none"
                                    onChange={handleUploadChange}
                                    aria-label="Game file upload"
                                />
                                {uploadError && <div className="text-red-500 text-sm">{uploadError}</div>}
                                <button
                                    className="px-4 py-2 bg-green-700 text-white rounded-lg border border-white/10 mt-2 disabled:opacity-50"
                                    onClick={handleUpload}
                                    disabled={uploadForm.uploading}
                                >
                                    {uploadForm.uploading ? "Uploading..." : "Upload"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default GameManagerPage;
