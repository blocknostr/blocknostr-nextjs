// link-preview.ts
// Fetch OpenGraph/Twitter Card metadata for a given URL (server-side)

export interface LinkPreview {
    url: string;
    title?: string;
    description?: string;
    image?: string;
    siteName?: string;
    favicon?: string;
}

export async function fetchLinkPreview(url: string): Promise<LinkPreview | null> {
    try {
        const res = await fetch(`https://opengraph.rocks/api/preview?url=${encodeURIComponent(url)}`);
        if (!res.ok) return null;
        const data = await res.json();
        return {
            url,
            title: data.title,
            description: data.description,
            image: data.image,
            siteName: data.site_name,
            favicon: data.favicon,
        };
    } catch {
        return null;
    }
}
