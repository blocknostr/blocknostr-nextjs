export function toast({ title, description, variant }: { title: string; description: string; variant?: string }) {
    // Simple fallback toast for demo/dev
    alert(`${title}\n${description}`);
}

// Ensure compatibility with default imports
export default toast;
