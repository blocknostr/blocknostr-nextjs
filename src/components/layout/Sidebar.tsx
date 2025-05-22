import Link from "next/link";
import { useRouter } from "next/navigation";
import { useNostr } from "@/hooks/useNostr";

interface SidebarProps {
    onNav: (key: string) => void;
    activePane: string | null;
}

const navItems = [
    { key: "feed", label: "Feed", href: "/" },
    { key: "explore", label: "Explore", href: "/explore" },
    { key: "wallet", label: "Wallet", href: "/wallet" },
    { key: "community", label: "Community", href: "/community" },
    { key: "games", label: "Games", href: "/games" },
    { key: "notifications", label: "Notifications", href: "/notifications" },
    { key: "chat", label: "Chat", href: "/chat" }, // Added Chat page
];

export default function Sidebar({ onNav, activePane }: SidebarProps) {
    const router = useRouter();
    const { pubkey, profile } = useNostr();
    // Fallbacks for avatar and username
    const avatar = profile?.picture || "/file.svg";
    // Use display_name for display, username for handle
    const displayName = profile?.display_name || profile?.username || (profile?.pubkey ? profile.pubkey.slice(0, 8) + "..." : "");
    const username = profile?.username || (profile?.pubkey ? profile.pubkey.slice(0, 8) + "..." : "");
    return (
        <aside className="h-screen w-64 bg-gray-950 border-r border-gray-800 flex flex-col justify-between fixed left-0 top-0 z-40">
            <div>
                <div className="p-6 text-2xl font-bold text-white tracking-tight mb-8">
                    raw.rocks
                </div>
                <nav className="flex flex-col gap-2">
                    {navItems.map(item => (
                        <button
                            key={item.key}
                            className={`px-6 py-3 flex items-center gap-3 text-lg rounded-lg transition-colors w-full text-left ${activePane === item.key ? "bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white" : "text-gray-300 hover:bg-gray-800 hover:text-white"}`}
                            onClick={() => onNav(item.key)}
                        >
                            {item.label}
                        </button>
                    ))}
                    {/* Add Profile link below Chat */}
                    <button
                        key="profile"
                        className={`px-6 py-3 flex items-center gap-3 text-lg rounded-lg transition-colors w-full text-left ${activePane === "profile" ? "bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white" : "text-gray-300 hover:bg-gray-800 hover:text-white"}`}
                        onClick={() => onNav("profile")}
                    >
                        Profile
                    </button>
                    {/* Add Post link below Profile */}
                    <button
                        key="post"
                        className={`px-6 py-3 flex items-center gap-3 text-lg rounded-lg transition-colors w-full text-left border border-white/20 mt-6 ${activePane === "post" ? "bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white" : "text-gray-300 hover:bg-gray-800 hover:text-white"}`}
                        onClick={() => onNav("post")}
                    >
                        Post
                    </button>
                </nav>
            </div>
            {/* User profile at bottom */}
            {/* Removed user profile section from sidebar */}
        </aside>
    );
}
