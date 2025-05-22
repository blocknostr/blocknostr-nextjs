// nostr-relay.ts
// Simple NOSTR relay fetcher using nostr-tools
import { SimplePool, type Event, type Filter } from 'nostr-tools';

export interface FeedOptions {
    limit?: number;
    until?: number;
}

let userRelays: string[] = [];

// --- IMPROVED RELAY MANAGEMENT ---
// Allow dynamic relay list (user + default relays)
export function addUserRelay(url: string) {
    if (!userRelays.includes(url)) userRelays.push(url);
}

// Fix: When removing a relay, only remove from userRelays, not SOLID_RELAYS
export function removeUserRelay(url: string) {
    userRelays = userRelays.filter(r => r !== url);
}

// Fix: Always include SOLID_RELAYS in getAllRelays, even if userRelays removes them
export function getAllRelays(): string[] {
    // Merge user relays and default relays, deduped (user relays take priority)
    return Array.from(new Set([...userRelays, ...SOLID_RELAYS])).filter(r => !isRelayBad(r));
}

export async function fetchNostrFeed(relayUrls?: string[], options: FeedOptions = {}): Promise<Event[]> {
    // Use merged relay list if not provided
    const relays = relayUrls && relayUrls.length ? relayUrls : getAllRelays();
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

export async function fetchNostrProfile(relayUrls: string[], pubkey: string) {
    // Only fetch from relays using SimplePool
    const pool = new SimplePool();
    const filter: Filter = {
        kinds: [0], // kind 0 = metadata
        authors: [pubkey],
        limit: 1,
    };
    try {
        const events = await pool.querySync(relayUrls, filter);
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
        pool.close(relayUrls);
    }
}

// Relay health check utility
const SOLID_RELAYS = [
    "wss://relay.damus.io",
    "wss://relay.nostr.band",
    "wss://nostr-pub.wellorder.net",
    "wss://relay.snort.social",
    "wss://nostr.mom",
    "wss://nostr.wine",
    "wss://nostr.oxtr.dev",
    "wss://relay.primal.net",
    "wss://nostr.fmt.wiz.biz",
    "wss://nostr.plebstr.com",
    "wss://offchain.pub",
    "wss://eden.nostr.land",
    "wss://nostr.bitcoiner.social",
    "wss://nostr.zebedee.cloud",
    "wss://nostr.rocks",
    // ...add/remove as needed for reliability
];

// --- BAD RELAY CACHE ---
const BAD_RELAY_CACHE_KEY = 'nostr_bad_relays_v1';
const BAD_RELAY_THRESHOLD = 1; // Mark as bad after first failure
const BAD_RELAY_COOLDOWN = 60 * 60 * 1000; // 1 hour cooldown in ms
let badRelayCounts: Record<string, number> = {};
let badRelayTimestamps: Record<string, number> = {};

function loadBadRelays() {
    try {
        const raw = typeof window !== 'undefined' ? localStorage.getItem(BAD_RELAY_CACHE_KEY) : null;
        if (raw) {
            const parsed = JSON.parse(raw);
            badRelayCounts = parsed.counts || {};
            badRelayTimestamps = parsed.timestamps || {};
        }
    } catch { }
}
function saveBadRelays() {
    try {
        if (typeof window !== 'undefined') {
            localStorage.setItem(BAD_RELAY_CACHE_KEY, JSON.stringify({ counts: badRelayCounts, timestamps: badRelayTimestamps }));
        }
    } catch { }
}
function markRelayFailure(url: string) {
    badRelayCounts[url] = (badRelayCounts[url] || 0) + 1;
    badRelayTimestamps[url] = Date.now();
    saveBadRelays();
}
function isRelayBad(url: string) {
    if ((badRelayCounts[url] || 0) >= BAD_RELAY_THRESHOLD) {
        // Check cooldown
        const lastFail = badRelayTimestamps[url] || 0;
        if (Date.now() - lastFail < BAD_RELAY_COOLDOWN) return true;
        // Cooldown expired, reset
        delete badRelayCounts[url];
        delete badRelayTimestamps[url];
        saveBadRelays();
        return false;
    }
    return false;
}
export function clearBadRelayCache() {
    badRelayCounts = {};
    badRelayTimestamps = {};
    saveBadRelays();
}
// Load on module init
if (typeof window !== 'undefined') loadBadRelays();


// Cache relay status with expiration
interface RelayStatus {
    healthy: boolean;
    timestamp: number;
}

const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes
const relayStatusCache = new Map<string, RelayStatus>();

async function isRelayHealthy(url: string): Promise<boolean> {
    const now = Date.now();
    const cached = relayStatusCache.get(url);

    // Use cached value if fresh
    if (cached && (now - cached.timestamp < CACHE_EXPIRY)) {
        return cached.healthy;
    }
    // Exclude bad relays
    if (isRelayBad(url)) return false;

    let ws: WebSocket | null = null;
    try {
        ws = new WebSocket(url);
        const status = await new Promise<boolean>((resolve) => {
            const timeout = setTimeout(() => {
                if (ws) {
                    ws.close();
                    resolve(false);
                }
            }, 2000);

            if (ws) {
                ws.onopen = () => {
                    clearTimeout(timeout);
                    resolve(true);
                };

                ws.onerror = () => {
                    clearTimeout(timeout);
                    resolve(false);
                };
            } else {
                clearTimeout(timeout);
                resolve(false);
            }
        });

        // Update cache
        relayStatusCache.set(url, { healthy: status, timestamp: now });
        if (!status) markRelayFailure(url); // Increment failure count
        return status;
    } catch (err) {
        if (err instanceof Error && err.message.includes("interrupted while the page was loading")) {
            console.debug(`Non-critical WebSocket error for ${url}:`, err.message);
        } else {
            console.warn(`Error checking relay ${url}:`, err);
        }
        relayStatusCache.set(url, { healthy: false, timestamp: now });
        markRelayFailure(url); // Increment failure count
        return false;
    } finally {
        if (ws) {
            try {
                ws.close();
            } catch (err) {
                console.debug(`Error closing WebSocket for ${url}:`, err);
            }
        }
    }
}

export async function getHealthyRelays(): Promise<{ healthyRelays: string[]; healthyCount: number; totalCount: number }> {
    const allRelays = getAllRelays();
    const healthy: string[] = [];
    await Promise.all(
        allRelays.map(async url => {
            const isHealthy = await isRelayHealthy(url);
            if (isHealthy) healthy.push(url);
            return isHealthy;
        })
    );
    return {
        healthyRelays: healthy,
        healthyCount: healthy.length,
        totalCount: allRelays.length
    };
}

// Fetch global stats from NOSTR Band API (using the correct endpoint)
export async function fetchNostrBandStats(): Promise<any> {
    const apiUrl = "https://api.nostr.band/v0/stats";
    try {
        const response = await fetch(apiUrl, {
            headers: {
                'Accept': 'application/json',
            },
        });
        if (!response.ok) {
            console.warn(`Failed to fetch stats from NOSTR Band: ${response.statusText}`);
            return null;
        }
        return await response.json();
    } catch (error) {
        console.error("Error fetching stats from NOSTR Band:", error);
        return null;
    }
}
