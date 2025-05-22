interface ChatInputProps {
    value: string;
    onChange: (value: string) => void;
    onSubmit: () => void;
    disabled?: boolean;
}

export function ChatInput({ value, onChange, onSubmit, disabled }: ChatInputProps) {
    return (
        <form className="p-4 border-t border-white/10 flex gap-2" onSubmit={e => { e.preventDefault(); onSubmit(); }}>
            <input
                className="flex-1 px-4 py-2 rounded-full bg-white/5 text-white border border-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/30 placeholder-gray-500"
                placeholder="Type your message..."
                value={value}
                onChange={e => onChange(e.target.value)}
                disabled={disabled}
                autoFocus
            />
            <button
                type="submit"
                className="px-6 py-2 rounded-full bg-blue-500/90 text-white font-medium hover:bg-blue-500 focus:ring-2 focus:ring-blue-500/50 focus:outline-none shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:hover:bg-blue-500/90 backdrop-blur-sm transition"
                disabled={disabled || !value.trim()}
            >
                Send
            </button>
        </form>
    );
}
