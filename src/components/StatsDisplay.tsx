import React, { useEffect, useState } from "react";

interface Stats {
    events: number;
    relays: number;
    profiles: number;
    notes_24h?: number;
    profiles_24h?: number;
    relays_24h?: number;
    // Add more fields if needed from the API response
}

const StatsDisplay: React.FC = () => {
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [trending, setTrending] = useState<any[]>([]);

    useEffect(() => {
        async function loadStats() {
            setLoading(true);
            setError(null);
            try {
                // Fetch global stats
                const statsRes = await fetch("https://api.nostr.band/v0/stats");
                if (!statsRes.ok) {
                    throw new Error(`Failed to fetch stats: ${statsRes.status} ${statsRes.statusText}`);
                }
                const statsData = await statsRes.json();
                if (statsData && typeof statsData.events === 'number') {
                    setStats(statsData);
                } else {
                    setError('Stats data format incorrect');
                }
            } catch (e: any) {
                console.error("Error loading stats:", e);
                setError(e.message || 'Failed to load stats');
            }
            setLoading(false);
        }
        async function loadTrending() {
            try {
                const trendingRes = await fetch("https://api.nostr.band/v0/trending/notes");
                if (!trendingRes.ok) {
                    throw new Error(`Failed to fetch trending notes: ${trendingRes.status} ${trendingRes.statusText}`);
                }
                const trendingData = await trendingRes.json();
                if (trendingData && Array.isArray(trendingData.notes)) {
                    setTrending(trendingData.notes.slice(0, 5)); // Top 5 trending
                }
            } catch (e: any) {
                // ignore trending error for now, or handle it more gracefully
                console.warn("Failed to load trending notes:", e.message || e);
            }
        }
        loadStats();
        loadTrending();
    }, []);

    return (
        <div className="bg-gray-900 rounded-xl shadow-md p-4 mb-4 border border-gray-800 text-white">
            <h2 className="text-lg font-bold mb-3 text-pink-400">Global Nostr Stats</h2>
            {loading ? (
                <div className="animate-pulse text-gray-400">Loading stats...</div>
            ) : error ? (
                <div className="text-red-500 text-sm">{error}</div>
            ) : stats ? (
                <ul className="space-y-1 mb-4 text-sm">
                    <li className="flex justify-between"><span className="text-gray-400">Total Events</span><span className="font-semibold text-gray-200">{stats.events.toLocaleString()}</span></li>
                    <li className="flex justify-between"><span className="text-gray-400">Total Relays</span><span className="font-semibold text-gray-200">{stats.relays.toLocaleString()}</span></li>
                    <li className="flex justify-between"><span className="text-gray-400">Total Profiles</span><span className="font-semibold text-gray-200">{stats.profiles.toLocaleString()}</span></li>
                    {typeof stats.notes_24h === 'number' && <li className="flex justify-between"><span className="text-gray-400">Notes (24h)</span><span className="font-semibold text-gray-200">{stats.notes_24h.toLocaleString()}</span></li>}
                    {typeof stats.profiles_24h === 'number' && <li className="flex justify-between"><span className="text-gray-400">Profiles (24h)</span><span className="font-semibold text-gray-200">{stats.profiles_24h.toLocaleString()}</span></li>}
                    {typeof stats.relays_24h === 'number' && <li className="flex justify-between"><span className="text-gray-400">Relays (24h)</span><span className="font-semibold text-gray-200">{stats.relays_24h.toLocaleString()}</span></li>}
                </ul>
            ) : (
                !loading && <div className="text-gray-400 text-sm">Stats unavailable.</div>
            )}
            <h3 className="text-md font-semibold mb-2 mt-4 text-pink-400">Trending Notes</h3>
            <ul className="divide-y divide-gray-800">
                {trending.length === 0 && !loading && <li className="text-gray-400 py-2 text-sm">No trending notes available.</li>}
                {trending.map((note) => (
                    <li key={note.id} className="py-2 text-sm">
                        <span className="font-medium text-gray-300">{note.id.slice(0, 8)}...</span>
                        <span className="ml-2 text-gray-500">by {note.pubkey.slice(0, 8)}...</span>
                        {note.event && note.event.content && (
                            <div className="text-xs text-gray-400 mt-1 truncate">{note.event.content.slice(0, 80)}{note.event.content.length > 80 ? '...' : ''}</div>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default StatsDisplay;