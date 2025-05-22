interface LoginButtonProps {
    onClick: () => void;
}

export function LoginButton({ onClick }: LoginButtonProps) {
    return (
        <button
            onClick={onClick}
            className="px-4 py-2 rounded-full bg-blue-500 text-white font-medium hover:bg-blue-600 shadow-lg shadow-blue-500/20 transition"
        >
            Login with NOSTR
        </button>
    );
}
