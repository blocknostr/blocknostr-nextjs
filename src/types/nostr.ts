// Types for NOSTR-related functionality
import { Event } from 'nostr-tools';

export interface NostrProfile {
    displayName?: string;
    bio?: string;
    picture?: string;
    username?: string;
    pubkey?: string;
}

export interface NostrEvent extends Event {
    media?: string[];
    profile?: NostrProfile;
}

export interface FeedOptions {
    limit?: number;
    until?: number;
}

export interface ChatMessage extends NostrEvent {
    id: string;
    pubkey: string;
    content: string;
    created_at: number;
}
