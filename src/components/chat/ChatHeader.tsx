interface ChatHeaderProps {
    messageCount: number;
    onClose: () => void;
}

export function ChatHeader({ messageCount, onClose }: ChatHeaderProps) {
    return (
        <div className="flex items-center justify-between px-6 py-3 border-b border-white/10">
            <div className="flex items-center gap-3">
                <span className="text-blue-400 text-xl">💬</span>
                <div className="font-medium text-white">Live Chat</div>
                <span className="px-2 py-0.5 rounded-full bg-white/5 text-xs text-blue-300">
                    {messageCount}
                </span>
            </div>
            <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-white hover:bg-gray-800/50 transition"
            >
                ×
            </button>
        </div>
    );
}
