import { useEffect, useState } from "react";
import { useNostr } from "@/hooks/useNostr";
import { fetchNostrProfile, getHealthyRelays } from "@/lib/nostr/relay";

interface ProfilePaneProps {
    pubkey: string;
    isOpen: boolean;
    onClose: () => void;
    isSelf: boolean;
}

export function ProfilePane({ pubkey, isOpen, onClose, isSelf }: ProfilePaneProps) {
    const { events, profile, updateProfile } = useNostr();
    const [userProfile, setUserProfile] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [editing, setEditing] = useState(false);
    const [editDisplayName, setEditDisplayName] = useState("");
    const [editBio, setEditBio] = useState("");

    useEffect(() => {
        if (!pubkey) return;
        setLoading(true);
        (async () => {
            const relaysObj = await getHealthyRelays();
            const meta = await fetchNostrProfile(relaysObj.healthyRelays, pubkey);
            let username = meta?.name || pubkey?.slice(0, 6) + "..." + pubkey?.slice(-4);
            let displayName = meta?.display_name || meta?.name || username;
            let picture = meta?.picture || "/file.svg";
            if (meta) {
                setUserProfile({
                    displayName,
                    bio: meta.about,
                    picture,
                    username,
                    pubkey,
                });
                setEditDisplayName(displayName);
                setEditBio(meta.about || "");
            } else if (isSelf && profile) {
                setUserProfile({
                    displayName: profile.display_name || profile.name || pubkey?.slice(0, 6) + "..." + pubkey?.slice(-4),
                    bio: profile.about,
                    picture: profile.picture || "/file.svg",
                    username: profile.name || pubkey?.slice(0, 6) + "..." + pubkey?.slice(-4),
                    pubkey,
                });
                setEditDisplayName(profile.display_name || profile.name || "");
                setEditBio(profile.about || "");
            } else {
                setUserProfile({
                    displayName: pubkey?.slice(0, 6) + "..." + pubkey?.slice(-4),
                    bio: "",
                    picture: "/file.svg",
                    username: pubkey?.slice(0, 6) + "..." + pubkey?.slice(-4),
                    pubkey,
                });
            }
            setLoading(false);
        })();
    }, [pubkey, isSelf, profile]);

    useEffect(() => {
        if (userProfile) {
            setEditDisplayName(userProfile.displayName);
            setEditBio(userProfile.bio);
        }
    }, [userProfile]);

    if (!isOpen) return null;
    if (loading) {
        return (
            <div className="fixed inset-0 z-30 flex justify-end">
                <div className="w-full h-full bg-black/40 backdrop-blur-sm" onClick={onClose} />
                <div className="w-full max-w-md h-full bg-gray-950 border-l border-gray-800 shadow-2xl p-6 overflow-y-auto relative animate-slide-in-right">
                    <div className="text-center text-gray-400 py-12">Loading profile...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-30 flex justify-end">
            {/* Overlay */}
            <div className="w-full h-full bg-black/40 backdrop-blur-sm" onClick={onClose} />
            {/* Side Pane */}
            <div className="w-full max-w-md h-full bg-gray-950 border-l border-gray-800 shadow-2xl p-6 overflow-y-auto relative animate-slide-in-right">
                <button
                    className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl font-bold"
                    onClick={onClose}
                    aria-label="Close profile pane"
                >×</button>
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex-shrink-0 flex items-center justify-center">
                        {userProfile?.picture ? (
                            <img src={userProfile.picture} alt="avatar" className="w-full h-full rounded-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-blue-300 text-sm">
                                {userProfile?.pubkey?.slice(0, 2)}
                            </div>
                        )}
                    </div>
                    <div className="min-w-0 flex flex-col">
                        <span className="font-semibold text-white truncate text-lg">{userProfile?.displayName || userProfile?.username || userProfile?.pubkey?.slice(0, 8) + "..."}</span>
                        <span className="text-sm text-gray-400">@{userProfile?.username || userProfile?.pubkey?.slice(0, 8) + "..."}</span>
                        {isSelf && (
                            <button
                                className="mt-2 px-4 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 transition"
                                onClick={() => setEditing(true)}
                            >Edit Profile</button>
                        )}
                    </div>
                </div>
                {/* Profile stats */}
                <div className="flex gap-6 mb-6">
                    <div><span className="font-bold">{events.filter(ev => ev.pubkey === pubkey).length}</span> Posts</div>
                    <div><span className="font-bold">0</span> Likes</div>
                    <div><span className="font-bold">0</span> Retweets</div>
                </div>
                {/* Edit Profile Form */}
                {editing && isSelf && (
                    <form
                        className="mb-6 bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col gap-3"
                        onSubmit={e => {
                            e.preventDefault();
                            updateProfile({ display_name: editDisplayName, about: editBio });
                            setEditing(false);
                        }}
                    >
                        <label className="font-semibold">Display Name</label>
                        <input
                            className="px-3 py-2 rounded bg-gray-800 text-white border border-gray-700"
                            value={editDisplayName}
                            onChange={e => setEditDisplayName(e.target.value)}
                            placeholder="Enter display name"
                        />
                        <label className="font-semibold">Bio</label>
                        <textarea
                            className="px-3 py-2 rounded bg-gray-800 text-white border border-gray-700 min-h-[60px]"
                            value={editBio}
                            onChange={e => setEditBio(e.target.value)}
                            placeholder="Enter your bio"
                            title="Bio"
                        />
                        <div className="flex gap-2 mt-2">
                            <button type="submit" className="px-4 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 transition">Save</button>
                            <button type="button" className="px-4 py-1 rounded bg-gray-700 text-white hover:bg-gray-600 transition" onClick={() => setEditing(false)}>Cancel</button>
                        </div>
                    </form>
                )}
                <div className="mb-6">
                    <p className="text-gray-300">{userProfile?.bio || "No bio set."}</p>
                </div>
                <h3 className="text-xl font-semibold mb-4">Posts</h3>
                <div className="flex flex-col gap-4">
                    {events.filter(ev => ev.pubkey === userProfile?.pubkey).map(ev => (
                        <div key={ev.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5 shadow-lg">
                            <div className="text-lg text-white whitespace-pre-line break-words mb-1">{ev.content}</div>
                            {ev.media && ev.media.length > 0 && (
                                <div className="mt-2">
                                    {ev.media.map((url: string, idx: number) => (
                                        url.match(/\.(jpeg|jpg|gif|png)$/i) ? (
                                            <img key={idx} src={url} alt="media" className="rounded-xl object-cover border border-gray-800 bg-black w-full h-60 mb-2" style={{ objectFit: 'cover' }} />
                                        ) : url.match(/\.(mp4|webm)$/i) ? (
                                            <video key={idx} controls className="rounded-xl border border-gray-800 bg-black w-full max-h-96 shadow-lg mb-2" style={{ objectFit: 'cover' }}>
                                                <source src={url} />
                                            </video>
                                        ) : null
                                    ))}
                                </div>
                            )}
                            <p className="text-xs text-gray-500 mt-2">{new Date(ev.created_at * 1000 || ev.created_at).toLocaleString()}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
