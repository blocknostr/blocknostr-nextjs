// Types for NOSTR-related functionality
import { Event } from 'nostr-tools';

export interface NostrProfile {
    username?: string; // Always set: mapped from 'name' in Nostr spec
    display_name?: string; // Nostr spec: display name
    about?: string; // Nostr spec: bio
    picture?: string; // Nostr spec: avatar
    banner?: string; // Nostr spec: banner
    website?: string; // Nostr spec: website
    lud06?: string; // Nostr spec: LNURL
    lud16?: string; // Nostr spec: LN Address
    nip05?: string; // Nostr spec: NIP-05 identifier
    pubkey?: string; // Always set: user's pubkey
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
