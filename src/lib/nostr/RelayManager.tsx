import { SimplePool } from "nostr-tools";

// Type for relay status
export type RelayStatus = {
  url: string;
  healthy: boolean;
  lastChecked: number;
  failCount: number;
};

class RelayManager {
  private relays: Map<string, RelayStatus> = new Map();
  private listeners: Set<() => void> = new Set();
  private readonly maxFail = 3;
  private readonly retryDelay = 60 * 1000; // 1 min

  constructor(initialRelays: string[] = []) {
    // Load from localStorage or use initial
    const saved = typeof window !== 'undefined' ? localStorage.getItem("nostr-relay-status") : null;
    if (saved) {
      try {
        const arr: RelayStatus[] = JSON.parse(saved);
        arr.forEach(r => this.relays.set(r.url, r));
      } catch {}
    }
    initialRelays.forEach(url => {
      if (!this.relays.has(url)) {
        this.relays.set(url, { url, healthy: true, lastChecked: 0, failCount: 0 });
      }
    });
  }

  // Subscribe to relay status changes
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  private notify() {
    this.listeners.forEach(fn => fn());
  }
  private persist() {
    if (typeof window !== 'undefined') {
      localStorage.setItem(
        "nostr-relay-status",
        JSON.stringify(Array.from(this.relays.values()))
      );
    }
  }

  getAllRelays() {
    return Array.from(this.relays.values());
  }
  getHealthyRelays(min = 3) {
    const healthy = Array.from(this.relays.values()).filter(r => r.healthy);
    if (healthy.length < min) {
      // Fallback: include some recently failed relays
      const fallback = Array.from(this.relays.values())
        .filter(r => !r.healthy && Date.now() - r.lastChecked > this.retryDelay)
        .slice(0, min - healthy.length);
      return healthy.concat(fallback);
    }
    return healthy;
  }
  markRelay(url: string, healthy: boolean) {
    const r = this.relays.get(url);
    if (r) {
      r.healthy = healthy;
      r.lastChecked = Date.now();
      r.failCount = healthy ? 0 : r.failCount + 1;
      if (r.failCount >= this.maxFail) r.healthy = false;
      this.persist();
      this.notify();
    }
  }
  async checkRelay(url: string): Promise<boolean> {
    // Simple check: try to connect and fetch a dummy event
    const pool = new SimplePool();
    try {
      await pool.querySync([url], { limit: 1 });
      this.markRelay(url, true);
      return true;
    } catch {
      this.markRelay(url, false);
      return false;
    } finally {
      pool.close([url]);
    }
  }
  async checkAllRelays() {
    await Promise.all(
      Array.from(this.relays.keys()).map(url => this.checkRelay(url))
    );
  }
  // Fetch with retry/aggregation
  async fetchWithRetry(filter: any, minRelays = 3, maxAttempts = 2) {
    let relays = this.getHealthyRelays(minRelays).map(r => r.url);
    let results: any[] = [];
    let tried = new Set<string>();
    let attempts = 0;
    while (results.length === 0 && attempts < maxAttempts && relays.length > 0) {
      const pool = new SimplePool();
      try {
        const res = await pool.querySync(relays, filter);
        results = res || [];
        // Mark all as healthy
        relays.forEach(url => this.markRelay(url, true));
      } catch {
        // Mark all as failed
        relays.forEach(url => this.markRelay(url, false));
      } finally {
        pool.close(relays);
      }
      // Prepare next attempt
      relays.forEach(url => tried.add(url));
      relays = this.getAllRelays()
        .filter(r => !tried.has(r.url) && r.healthy)
        .map(r => r.url);
      attempts++;
    }
    return results;
  }
  // Add/remove relays (for power users)
  addRelay(url: string) {
    if (!this.relays.has(url)) {
      this.relays.set(url, { url, healthy: true, lastChecked: 0, failCount: 0 });
      this.persist();
      this.notify();
    }
  }
  removeRelay(url: string) {
    if (this.relays.has(url)) {
      this.relays.delete(url);
      this.persist();
      this.notify();
    }
  }
}

// Singleton instance with default relays
const DEFAULT_RELAYS = [
  "wss://relay.damus.io",
  "wss://relay.nostr.band",
  "wss://nostr.wine",
  "wss://nostr-pub.wellorder.net",
  "wss://nostr.oxtr.dev",
  "wss://nostr.mom",
];

const relayManager = new RelayManager(DEFAULT_RELAYS);
export default relayManager;
