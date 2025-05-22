import { useState, useRef } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';

const MAX_LENGTH = 280;

interface CreatePostProps {
    onSubmit: (content: string) => Promise<void>;
    isLoggedIn: boolean;
    onLogin: () => void;
}

export function CreatePost({ onSubmit, isLoggedIn, onLogin }: CreatePostProps) {
    const [content, setContent] = useState('');
    const [image, setImage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [showEmoji, setShowEmoji] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!content.trim() && !image) return;
        setIsLoading(true);
        setError(null);
        setSuccess(null);
        try {
            let postContent = content;
            if (image) {
                postContent += `\n[image attached]`;
            }
            await onSubmit(postContent);
            setContent('');
            setImage(null);
            setSuccess('Posted!');
        } catch (err: any) {
            setError('Failed to post. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = ev => setImage(ev.target?.result as string);
            reader.readAsDataURL(file);
        }
    };

    const handleEmojiSelect = (emoji: any) => {
        setContent(content + emoji.native);
        setShowEmoji(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            handleSubmit(e as any);
        }
    };

    // Highlight hashtags and mentions
    const highlightContent = (text: string) => {
        return text.split(/(#[\w-]+|@[\w-]+)/g).map((part, i) => {
            if (/^#[\w-]+$/.test(part)) {
                return <span key={i} className="text-blue-400">{part}</span>;
            }
            if (/^@[\w-]+$/.test(part)) {
                return <span key={i} className="text-pink-400">{part}</span>;
            }
            return part;
        });
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
        <form onSubmit={handleSubmit} className="bg-gray-900/40 backdrop-blur-md rounded-xl border border-white/10 p-6" aria-label="Create a new post">
            <div className="relative">
                <TextareaAutosize
                    minRows={3}
                    maxRows={8}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 text-white border border-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/30 placeholder-gray-500 resize-none pr-10"
                    placeholder="What's happening?"
                    value={content}
                    onChange={e => {
                        if (e.target.value.length <= MAX_LENGTH) setContent(e.target.value);
                    }}
                    onKeyDown={handleKeyDown}
                    aria-label="Post content"
                />
                <button
                    type="button"
                    className="absolute top-2 right-2 text-xl text-yellow-300 hover:text-yellow-400"
                    onClick={() => setShowEmoji(v => !v)}
                    tabIndex={0}
                    aria-label="Add emoji"
                >
                    😊
                </button>
                {showEmoji && (
                    <div className="absolute z-50 top-12 right-0">
                        <Picker data={data} theme="dark" onEmojiSelect={handleEmojiSelect} previewPosition="none" />
                    </div>
                )}
            </div>
            <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        className="px-3 py-1 rounded bg-gray-800 text-white hover:bg-gray-700 border border-white/10 text-sm"
                        onClick={() => fileInputRef.current?.click()}
                        aria-label="Attach image"
                    >
                        📎 Image
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageChange}
                        aria-label="Upload image"
                    />
                    {image && (
                        <div className="relative ml-2">
                            <img src={image} alt="Preview" className="w-16 h-16 object-cover rounded border border-white/10" />
                            <button
                                type="button"
                                className="absolute -top-2 -right-2 bg-black text-white rounded-full w-6 h-6 flex items-center justify-center border border-white/20"
                                onClick={() => setImage(null)}
                                aria-label="Remove image"
                            >
                                ×
                            </button>
                        </div>
                    )}
                </div>
                <span className={`text-xs ${content.length > MAX_LENGTH - 20 ? 'text-red-400' : 'text-gray-400'}`}>{content.length}/{MAX_LENGTH}</span>
            </div>
            <div className="mt-4 flex justify-end items-center gap-3 min-h-[32px]">
                {isLoading && <LoadingSpinner size="sm" />}
                {error && <span className="text-red-400 text-xs">{error}</span>}
                {success && <span className="text-green-400 text-xs">{success}</span>}
                <button
                    type="submit"
                    disabled={isLoading || (!content.trim() && !image)}
                    className="px-6 py-2 rounded-full bg-blue-500/90 text-white font-medium hover:bg-blue-500 focus:ring-2 focus:ring-blue-500/50 focus:outline-none shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:hover:bg-blue-500/90 backdrop-blur-sm transition"
                    aria-label="Post"
                >
                    {isLoading ? 'Posting...' : 'Post'}
                </button>
            </div>
            {/* Live preview with highlights */}
            {content && (
                <div className="mt-4 p-3 bg-black/30 rounded text-white text-sm border border-white/10">
                    {highlightContent(content)}
                </div>
            )}
        </form>
    );
}
