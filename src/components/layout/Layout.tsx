// Main layout component for the application
import Link from "next/link";
import { LoginButton } from "@/components/layout/LoginButton";
import { useNostr } from "@/hooks/useNostr";
import { useState, useRef, useEffect } from "react";

interface HeaderProps {
    pubkey: string | null;
    onLogin: () => void;
}

export function Header({ pubkey, onLogin }: HeaderProps) {
    return (
        <header className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">RAW.ROCKS</h1>
            <div>
                {!pubkey ? (
                    <LoginButton onClick={onLogin} />
                ) : (
                    <Link
                        href="/profile"
                        className="px-4 py-2 rounded-full border border-gray-700 text-gray-300 hover:bg-gray-900 transition"
                    >
                        Profile
                    </Link>
                )}
            </div>
        </header>
    );
}

interface ProfileDropdownProps {
    children: React.ReactNode;
    menu: React.ReactNode;
}

export function ProfileDropdown({ children, menu }: ProfileDropdownProps) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        if (open) document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, [open]);

    return (
        <div className="relative" ref={ref}>
            <div onClick={() => setOpen(v => !v)} style={{ cursor: "pointer" }}>
                {children}
            </div>
            {open && (
                <div className="absolute left-0 mt-2 z-20 bg-gray-900 border border-gray-800 rounded-xl shadow-lg min-w-[120px] p-2 flex flex-col">
                    {menu}
                </div>
            )}
        </div>
    );
}
