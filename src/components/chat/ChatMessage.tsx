import { NostrEvent } from "@/types/nostr";

interface ChatMessageProps {
    message: NostrEvent;
    isOwnMessage: boolean;
}

export function ChatMessage({ message, isOwnMessage }: ChatMessageProps) {
    return (
        <div className={`group flex items-start gap-3 ${isOwnMessage ? 'flex-row-reverse' : ''}`}>
            <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex-shrink-0 flex items-center justify-center text-xs text-blue-300">
                {message.pubkey.slice(0, 2)}
            </div>
            <div className={`flex-1 relative ${isOwnMessage ? 'text-right' : ''}`}>
                <div className={`inline-block max-w-[80%] ${isOwnMessage
                        ? 'bg-blue-500/20 text-blue-100 border border-blue-500/20'
                        : 'bg-white/5 text-white border border-white/10'
                    } rounded-2xl px-4 py-2 text-sm backdrop-blur-sm`}
                >
                    <div className="whitespace-pre-line break-words">{message.content}</div>
                </div>
                <div className="mt-1 text-xs text-gray-500">
                    {new Date(message.created_at * 1000).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                    })}
                </div>
            </div>
        </div>
    );
}
