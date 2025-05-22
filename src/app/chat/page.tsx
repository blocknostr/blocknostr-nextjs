"use client";

import { useNostr } from "@/hooks/useNostr";
import { useEffect, useRef, useState } from "react";
import { formatNostrAddresses } from "../page";
import { ErrorMessage } from "@/components/shared/ErrorMessage";

export default function ChatPage() {
    const { pubkey, events, error, login, post } = useNostr();
    const [content, setContent] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [sendError, setSendError] = useState<string | null>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const LOCAL_KEY = "nostr_global_chat_local";

    // Only show kind 1 events (global chat posts)
    const relayChatEvents = events.filter(ev => (ev as any).kind === 1);
    const [localChatEvents, setLocalChatEvents] = useState<any[]>([]);

    // On mount, load local chat events
    useEffect(() => {
        try {
            const raw = localStorage.getItem(LOCAL_KEY);
            if (raw) {
                setLocalChatEvents(JSON.parse(raw));
            }
        } catch {}
    }, []);

    // Merge relay and local events, deduplicate by id
    const chatEvents = [...relayChatEvents, ...localChatEvents.filter(ev => !relayChatEvents.some(e => e.id === ev.id))]
        .sort((a, b) => a.created_at - b.created_at);

    // Scroll to bottom on new message
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chatEvents.length]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!content.trim()) return;
        setIsSending(true);
        setSendError(null);
        try {
            const before = Date.now();
            await post(content);
            setContent("");
            // Save to localStorage for persistence
            const newEvent = {
                id: `local-${before}`,
                pubkey,
                content,
                created_at: Math.floor(before / 1000),
                kind: 1,
                tags: [],
                profile: undefined,
            };
            setLocalChatEvents(prev => {
                const updated = [...prev, newEvent];
                localStorage.setItem(LOCAL_KEY, JSON.stringify(updated));
                return updated;
            });
        } catch (err: any) {
            setSendError("Failed to send message");
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="w-full h-full max-w-2xl px-2 sm:px-6 py-8 bg-gray-950 border border-gray-800 shadow-xl rounded-xl flex flex-col flex-shrink-0">
            {/* Header */}
            <header className="flex items-center gap-2 mb-4">
                <span className="text-xl font-bold text-white"># global-chat</span>
                <span className="ml-auto text-xs text-gray-400">Nostr Global Chat</span>
            </header>
            {/* Chat messages */}
            <div className="flex-1 overflow-y-auto space-y-4">
                {error && <ErrorMessage message={error} />}
                {chatEvents.length === 0 && !error && (
                    <div className="text-center text-gray-400">No messages yet. Start the conversation!</div>
                )}
                {chatEvents.map(ev => (
                    <div key={ev.id} className="flex items-start gap-3 group hover:bg-gray-900/60 rounded-lg px-2 py-1 transition">
                        <img
                            src={ev.profile?.picture || "/file.svg"}
                            alt="avatar"
                            className="w-10 h-10 rounded-full border border-gray-800 bg-black"
                        />
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="font-semibold text-white text-sm truncate">
                                    {ev.profile?.display_name || ev.pubkey.slice(0, 8)}
                                </span>
                                <span className="text-xs text-gray-500">{new Date(ev.created_at * 1000).toLocaleTimeString()}</span>
                            </div>
                            <div className="text-gray-200 text-base whitespace-pre-line break-words">
                                {formatNostrAddresses(ev.content)}
                            </div>
                        </div>
                    </div>
                ))}
                <div ref={chatEndRef} />
            </div>
            {/* Message input */}
            <form onSubmit={handleSend} className="flex items-center gap-3 mt-4">
                {!pubkey ? (
                    <button
                        type="button"
                        onClick={login}
                        className="px-4 py-2 rounded-full bg-blue-500 text-white font-semibold hover:bg-blue-600 transition"
                    >
                        Login with NOSTR
                    </button>
                ) : (
                    <>
                        <input
                            type="text"
                            value={content}
                            onChange={e => setContent(e.target.value)}
                            placeholder="Type your message..."
                            className="flex-1 px-4 py-2 rounded-full bg-gray-900 border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/30 placeholder-gray-400"
                            disabled={isSending}
                            maxLength={500}
                            autoFocus
                        />
                        <button
                            type="submit"
                            className="px-4 py-2 rounded-full bg-blue-500 text-white font-semibold hover:bg-blue-600 transition disabled:opacity-50"
                            disabled={isSending || !content.trim()}
                        >
                            Send
                        </button>
                    </>
                )}
            </form>
            {sendError && <div className="text-red-500 text-center py-2">{sendError}</div>}
        </div>
    );
}
