import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import StatsDisplay from "../StatsDisplay";

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
                </nav>
            </div>
        </aside>
    );
}
