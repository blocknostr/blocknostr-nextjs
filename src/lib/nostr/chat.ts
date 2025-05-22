import { SimplePool } from 'nostr-tools';
import { NostrEvent } from '@/types/nostr';
import { getHealthyRelays } from '@/lib/nostr/relay';

export async function publishChatMessage(pool: SimplePool, relays: string[], event: NostrEvent): Promise<boolean> {
    try {
        const publishPromises = relays.map(async url => {
            try {
                const pub = await pool.publish([url], event);
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
        return results.some(success => success);
    } catch (error) {
        console.error("Error publishing message:", error);
        return false;
    }
}

export async function subscribeToChatMessages(
    postId: string,
    onMessage: (ev: NostrEvent) => void
): Promise<{ close: () => void }> {
    const { healthyRelays } = await getHealthyRelays();
    const pool = new SimplePool();

    const sub = pool.subscribeMany(healthyRelays, [{
        kinds: [1],
        "#e": [postId],
        limit: 50,
    }], {
        onevent: onMessage
    });

    return {
        close: () => {
            sub.close();
            pool.close(healthyRelays);
        }
    };
}
