import { useEffect, useState } from "react";
import { fetchNostrBandStats } from "@/lib/nostr/relay";
import NostrStats from "@/components/NostrStats";

export default function StatsPage() {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setLoading(true);
        fetchNostrBandStats()
            .then(data => {
                setStats(data);
                setError(null);
            })
            .catch(err => {
                setError("Failed to fetch stats from nostr.band");
            })
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className="max-w-2xl mx-auto p-8 text-white">
            <h1 className="text-3xl font-bold mb-6">Nostr Network Stats</h1>
            {loading && <div>Loading stats...</div>}
            {error && <div className="text-red-400 mb-4">{error}</div>}
            {stats && (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                            <div className="text-lg text-gray-400">Total Users</div>
                            <div className="text-2xl font-bold">{stats.users.toLocaleString()}</div>
                        </div>
                        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                            <div className="text-lg text-gray-400">Total Notes</div>
                            <div className="text-2xl font-bold">{stats.notes.toLocaleString()}</div>
                        </div>
                        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                            <div className="text-lg text-gray-400">Total Relays</div>
                            <div className="text-2xl font-bold">{stats.relays.toLocaleString()}</div>
                        </div>
                        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                            <div className="text-lg text-gray-400">Total Reactions</div>
                            <div className="text-2xl font-bold">{stats.reactions.toLocaleString()}</div>
                        </div>
                    </div>
                    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                        <h2 className="text-xl font-semibold mb-4">Network Activity</h2>
                        <NostrStats />
                    </div>
                </div>
            )}
        </div>
    );
}
