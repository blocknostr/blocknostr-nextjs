import { clearBadRelayCache } from "@/lib/nostr/relay";

interface ErrorMessageProps {
    message: string;
    onRetry?: () => void;
    relayStats?: {
        healthyCount: number;
        totalCount: number;
    } | null;
    onClearRelays?: () => void;
}

export function ErrorMessage({ message, onRetry, relayStats, onClearRelays }: ErrorMessageProps) {
    return (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400 backdrop-blur-lg">
            <p>
                {relayStats
                    ? `${relayStats.healthyCount}/${relayStats.totalCount} relays connected. ${relayStats.healthyCount === 0 ? message : ''}`
                    : message
                }
            </p>
            <div className="flex gap-2 mt-2">
                {onRetry && (
                    <button
                        onClick={onRetry}
                        className="px-4 py-1 bg-red-500/20 hover:bg-red-500/30 rounded-full text-sm transition"
                    >
                        Retry
                    </button>
                )}
                {onClearRelays && (
                    <button
                        onClick={onClearRelays}
                        className="px-4 py-1 bg-blue-500/20 hover:bg-blue-500/30 rounded-full text-sm transition"
                    >
                        Reset Relays
                    </button>
                )}
            </div>
        </div>
    );
}
