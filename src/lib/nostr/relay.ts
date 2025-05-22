// nostr-relay.ts
// Simple NOSTR relay fetcher using nostr-tools
import relayManager from "./RelayManager";
import { SimplePool, type Event, type Filter } from "nostr-tools";

export interface FeedOptions {
  limit?: number;
  until?: number;
}

// --- RELAY MANAGEMENT (delegated to RelayManager) ---
export function addUserRelay(url: string) {
  relayManager.addRelay(url);
}
export function removeUserRelay(url: string) {
  relayManager.removeRelay(url);
}
export function getAllRelays(): string[] {
  return relayManager.getAllRelays().map(r => r.url);
}

// --- FEED FETCHING ---
export async function fetchNostrFeed(relayUrls?: string[], options: FeedOptions = {}): Promise<Event[]> {
  // Use provided relays or healthy relays from manager
  const relays = relayUrls && relayUrls.length ? relayUrls : relayManager.getHealthyRelays().map(r => r.url);
  const pool = new SimplePool();
  const filter: Filter = {
    kinds: [1],
    limit: options.limit || 20,
    ...(options.until ? { until: options.until } : {}),
  };
  try {
    const events = await pool.querySync(relays, filter);
    return events.sort((a, b) => b.created_at - a.created_at);
  } finally {
    pool.close(relays);
  }
}

// --- PROFILE FETCHING ---
export async function fetchNostrProfile(relayUrls: string[], pubkey: string) {
  const relays = relayUrls && relayUrls.length ? relayUrls : relayManager.getHealthyRelays().map(r => r.url);
  const pool = new SimplePool();
  const filter: Filter = {
    kinds: [0],
    authors: [pubkey],
    limit: 1,
  };
  try {
    const events = await pool.querySync(relays, filter);
    if (events.length > 0) {
      try {
        return JSON.parse(events[0].content);
      } catch (err) {
        console.warn(`Failed to parse profile content for ${pubkey}:`, err);
        return null;
      }
    }
    return null;
  } finally {
    pool.close(relays);
  }
}

// --- RELAY HEALTH ---
export async function getHealthyRelays(): Promise<{ healthyRelays: string[]; healthyCount: number; totalCount: number }> {
  const healthy = relayManager.getHealthyRelays();
  const all = relayManager.getAllRelays();
  return {
    healthyRelays: healthy.map(r => r.url),
    healthyCount: healthy.length,
    totalCount: all.length,
  };
}

export async function checkAllRelays() {
  await relayManager.checkAllRelays();
}

export function clearBadRelayCache() {
  // For compatibility, just re-check all relays and mark all as healthy
  relayManager.getAllRelays().forEach(r => relayManager.markRelay(r.url, true));
}
