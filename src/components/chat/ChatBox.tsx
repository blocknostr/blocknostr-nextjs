import { useEffect, useRef, useState } from "react";
import { getHealthyRelays } from "@/lib/nostr/relay";
import { SimplePool } from "nostr-tools";
import { NostrEvent } from "@/types/nostr";
import { ChatHeader } from "./ChatHeader";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";

type SubCloser = { close: () => void };

interface ChatBoxProps {
    postId: string;
    pubkey: string | null;
    onClose: () => void;
    isAnimating?: boolean;
}

export function ChatBox({ postId, pubkey, onClose, isAnimating = false }: ChatBoxProps) {
    const [messages, setMessages] = useState<NostrEvent[]>([]);
    const [input, setInput] = useState<string>("");
    const [sending, setSending] = useState<boolean>(false);
    const [relays, setRelays] = useState<string[]>([]);
    const poolRef = useRef<SimplePool | null>(null);
    const chatRef = useRef<HTMLDivElement>(null);

    // Subscribe to chat events for this post
    useEffect(() => {
        let unsub: SubCloser | undefined;
        let pool: SimplePool | null = null;

        const setupPool = async () => {
            const { healthyRelays } = await getHealthyRelays();
            setRelays(healthyRelays);
            pool = new SimplePool();
            poolRef.current = pool;

            unsub = pool.subscribeMany(healthyRelays, [{
                kinds: [1], // Use kind 1 for text_note
                "#e": [postId], // tag with post id
                limit: 50,
            }], {
                onevent: (ev: NostrEvent) => {
                    setMessages((msgs: NostrEvent[]) => {
                        if (msgs.find((m: NostrEvent) => m.id === ev.id)) return msgs;
                        return [...msgs, ev].sort((a, b) => a.created_at - b.created_at);
                    });
                }
            });
        };

        setupPool();

        return () => {
            if (typeof unsub?.close === 'function') unsub.close();
            if (pool && relays.length > 0) pool.close(relays);
        };
    }, [postId]);

    // Scroll to bottom on new message
    useEffect(() => {
        if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }, [messages]);

    // Send a chat message
    async function sendMessage() {
        if (!input.trim() || !pubkey || !(window as any).nostr || relays.length === 0) return;
        setSending(true);
        const event = {
            kind: 1,  // kind 1 for text_note
            pubkey,
            created_at: Math.floor(Date.now() / 1000),
            tags: [["e", postId]],
            content: input,
        };

        let signedEvent;
        try {
            signedEvent = await (window as any).nostr.signEvent(event);
        } catch {
            alert("Failed to sign chat message.");
            setSending(false);
            return;
        }
        try {
            // Ensure we have the pool
            if (!poolRef.current) {
                throw new Error("Pool not initialized");
            }

            // Publish to all relays
            const publishPromises = relays.map(async url => {
                try {
                    const pub = await poolRef.current!.publish([url], signedEvent);
                    // Wait for confirmation
                    await Promise.race([
                        pub,
                        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 5000))
                    ]);
                    return true;
                } catch (err) {
                    console.warn(`Failed to publish to ${url}:`, err);
                    return false;
                }
            });

            // Wait for at least one successful publish
            const results = await Promise.all(publishPromises);
            if (!results.some(success => success)) {
                throw new Error("Failed to publish to any relay");
            }

            setInput("");
            // Add the message locally for immediate feedback
            setMessages(prev => [...prev, signedEvent].sort((a, b) => a.created_at - b.created_at));

        } catch (error) {
            console.error("Error publishing message:", error);
            alert("Failed to send message. Please try again.");
        } finally {
            setSending(false);
        }
    }

    return (
        <div className={`mt-2 bg-gray-900/40 backdrop-blur-md rounded-b-xl transition-all duration-300 ${isAnimating ? 'opacity-0 transform translate-y-[-10px]' : 'opacity-100 transform translate-y-0'
            }`}>
            <ChatHeader messageCount={messages.length} onClose={onClose} />

            <div ref={chatRef} className="max-h-[480px] overflow-y-auto p-6 space-y-4">
                {messages.length === 0 ? (
                    <div className="text-gray-400 text-center py-8">
                        <div className="text-3xl mb-3">💭</div>
                        Start the conversation!
                    </div>
                ) : (
                    messages.map(msg => (
                        <ChatMessage
                            key={msg.id}
                            message={msg}
                            isOwnMessage={msg.pubkey === pubkey}
                        />
                    ))
                )}
            </div>

            <ChatInput
                value={input}
                onChange={setInput}
                onSubmit={sendMessage}
                disabled={sending}
            />
        </div>
    );
}
