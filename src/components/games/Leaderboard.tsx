import React from "react";

interface LeaderboardEntry {
    pubkey: string;
    username?: string;
    score: number;
    rank: number;
    relay?: string;
    isFriend?: boolean;
}

interface LeaderboardProps {
    entries: LeaderboardEntry[];
    currentUserPubkey?: string;
    relayStatus?: Record<string, { healthy: boolean; latency: number }>;
    onProfileClick?: (pubkey: string) => void;
}

const rankColors = [
    "text-yellow-400", // 1st
    "text-gray-300",   // 2nd
    "text-amber-700",  // 3rd
];

const Leaderboard: React.FC<LeaderboardProps> = ({
    entries,
    currentUserPubkey,
    relayStatus,
    onProfileClick,
}) => {
    return (
        <div className="bg-black/80 backdrop-blur rounded-2xl shadow-2xl border border-white/10 p-6 w-full max-w-2xl mx-auto glassy">
            <h2 className="text-white text-2xl font-extrabold mb-4 flex items-center gap-2">
                <span className="inline-block w-6 h-6 bg-gradient-to-br from-pink-500 via-yellow-400 to-blue-400 rounded-full mr-2 animate-pulse" />
                Leaderboard
                <span className="ml-auto text-xs font-semibold text-gray-400">Live</span>
            </h2>
            <div className="overflow-x-auto">
                <table className="min-w-full text-left text-base">
                    <thead>
                        <tr className="text-gray-400 border-b border-white/10">
                            <th className="px-2 py-1">#</th>
                            <th className="px-2 py-1">Player</th>
                            <th className="px-2 py-1">Score</th>
                            <th className="px-2 py-1">Plays</th>
                            <th className="px-2 py-1">Relay</th>
                            <th className="px-2 py-1">Country</th>
                        </tr>
                    </thead>
                    <tbody>
                        {entries.map((entry, idx) => (
                            <tr
                                key={entry.pubkey}
                                className={
                                    (entry.pubkey === currentUserPubkey
                                        ? "bg-gradient-to-r from-pink-100/10 to-white/5 text-pink-400 font-bold"
                                        : entry.isFriend
                                            ? "bg-gradient-to-r from-blue-100/10 to-white/5 text-blue-300"
                                            : "bg-white/5 text-white") +
                                    " hover:bg-white/10 transition border-b border-white/10"
                                }
                            >
                                <td className={`px-2 py-1 font-mono font-bold text-lg ${rankColors[idx] || "text-white"}`}>
                                    {idx < 3 && (
                                        <span title={idx === 0 ? "Champion" : idx === 1 ? "Runner-up" : "Top 3"} className="inline-block align-middle mr-1">
                                            {idx === 0 && <span>🏆</span>}
                                            {idx === 1 && <span>🥈</span>}
                                            {idx === 2 && <span>🥉</span>}
                                        </span>
                                    )}
                                    {entry.rank}
                                </td>
                                <td className="px-2 py-1 flex items-center gap-2">
                                    {/* Mock country flag */}
                                    <span className="inline-block w-5 h-5 rounded-full bg-gradient-to-br from-blue-400 to-pink-400 border-2 border-white/20 shadow mr-1" title="Country" />
                                    <button
                                        className="hover:underline text-white font-semibold focus:outline-white"
                                        onClick={() => onProfileClick?.(entry.pubkey)}
                                    >
                                        {entry.username || entry.pubkey.slice(0, 12)}
                                    </button>
                                    {entry.isFriend && (
                                        <span className="ml-2 text-xs bg-blue-500/80 text-white px-2 py-0.5 rounded-full">Friend</span>
                                    )}
                                    {entry.pubkey === currentUserPubkey && (
                                        <span className="ml-2 text-xs bg-pink-500/80 text-white px-2 py-0.5 rounded-full">You</span>
                                    )}
                                </td>
                                <td className="px-2 py-1 font-mono text-lg">
                                    <span className="inline-block animate-pulse text-green-400 font-bold">{entry.score}</span>
                                </td>
                                <td className="px-2 py-1 text-center">
                                    {/* Mock play count for demo */}
                                    <span className="inline-block bg-gradient-to-br from-gray-800 to-gray-600 text-white px-2 py-0.5 rounded-full text-xs font-mono shadow">{Math.floor(10 + Math.random() * 90)}</span>
                                </td>
                                <td className="px-2 py-1 flex items-center gap-1">
                                    {entry.relay && relayStatus?.[entry.relay] ? (
                                        <span
                                            className={`inline-block w-3 h-3 rounded-full mr-1 ${relayStatus[entry.relay].healthy ? "bg-green-400" : "bg-red-400"}`}
                                            title={`Relay: ${entry.relay} | Latency: ${relayStatus[entry.relay].latency}ms`}
                                        />
                                    ) : null}
                                    <span className="text-xs text-gray-200">{entry.relay || "-"}</span>
                                </td>
                                <td className="px-2 py-1">
                                    {/* Mock country flag emoji for demo */}
                                    <span className="text-xl" title="Country">{["🇺🇸", "🇯🇵", "🇫🇷", "🇩🇪", "🇬🇧"][idx % 5]}</span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Leaderboard;
