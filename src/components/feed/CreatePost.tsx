import { useState } from 'react';

interface CreatePostProps {
    onSubmit: (content: string) => Promise<void>;
    isLoggedIn: boolean;
    onLogin: () => void;
}

export function CreatePost({ onSubmit, isLoggedIn, onLogin }: CreatePostProps) {
    const [content, setContent] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!content.trim()) return;
        await onSubmit(content);
        setContent('');
    };

    if (!isLoggedIn) {
        return (
            <div className="bg-gray-900/40 backdrop-blur-md rounded-xl border border-white/10 p-6 text-center">
                <button
                    onClick={onLogin}
                    className="px-6 py-2 rounded-full bg-blue-500/90 text-white font-medium hover:bg-blue-500 shadow-lg shadow-blue-500/20 transition"
                >
                    Connect with NOSTR to Post
                </button>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="bg-gray-900/40 backdrop-blur-md rounded-xl border border-white/10 p-6">
            <textarea
                className="w-full px-4 py-3 rounded-xl bg-white/5 text-white border border-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/30 placeholder-gray-500 min-h-[100px] resize-none"
                placeholder="What's happening?"
                value={content}
                onChange={e => setContent(e.target.value)}
            />
            <div className="mt-4 flex justify-end">
                <button
                    type="submit"
                    disabled={!content.trim()}
                    className="px-6 py-2 rounded-full bg-blue-500/90 text-white font-medium hover:bg-blue-500 focus:ring-2 focus:ring-blue-500/50 focus:outline-none shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:hover:bg-blue-500/90 backdrop-blur-sm transition"
                >
                    Post
                </button>
            </div>
        </form>
    );
}
