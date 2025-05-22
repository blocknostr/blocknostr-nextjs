// filepath: src/components/layout/RightSidebar.tsx
import StatsDisplay from "../StatsDisplay";

interface RightSidebarProps {
    trendingHashtags: [string, number][];
    searchHashtag: (tag: string) => void;
}

export default function RightSidebar({ trendingHashtags, searchHashtag }: RightSidebarProps) {
    return (
        <aside className="hidden xl:flex flex-col w-[320px] h-screen sticky top-0 right-0 z-30 border-l border-gray-800 bg-gray-950 px-6 py-8 gap-6">
            <StatsDisplay />
            <div>
                <h3 className="text-lg font-bold mb-2 text-white">Trending Hashtags</h3>
                <div className="flex flex-wrap gap-2">
                    {trendingHashtags.map(([tag, count]) => (
                        <button
                            key={tag}
                            className="bg-gray-800 text-pink-400 px-3 py-1 rounded-full text-sm font-medium hover:bg-pink-600 transition"
                            onClick={() => searchHashtag(tag)}
                        >
                            #{tag} <span className="ml-1 text-xs text-gray-400">{count}</span>
                        </button>
                    ))}
                </div>
            </div>
        </aside>
    );
}
