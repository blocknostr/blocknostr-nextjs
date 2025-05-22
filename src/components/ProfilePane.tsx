import { useEffect, useState } from "react";
import { useNostr } from "@/hooks/useNostr";
import { fetchNostrProfile, getHealthyRelays } from "@/lib/nostr/relay";
import { nip19 } from "nostr-tools";

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
    const [editUsername, setEditUsername] = useState("");
    const [editPicture, setEditPicture] = useState("");
    const [editBanner, setEditBanner] = useState("");
    const [editWebsite, setEditWebsite] = useState("");
    const [editNip05, setEditNip05] = useState("");

    useEffect(() => {
        if (!pubkey) return;
        setLoading(true);
        (async () => {
            const relaysObj = await getHealthyRelays();
            const meta = await fetchNostrProfile(relaysObj.healthyRelays, pubkey);
            let username = meta?.name || pubkey;
            let displayName = meta?.display_name || username;
            let picture = meta?.picture || "/file.svg";
            if (meta) {
                setUserProfile({
                    display_name: displayName,
                    bio: meta.about,
                    picture,
                    username,
                    pubkey,
                });
                setEditDisplayName(displayName);
                setEditBio(meta.about || "");
            } else if (isSelf && profile) {
                setUserProfile({
                    display_name: profile.display_name || profile.username || pubkey,
                    bio: profile.about,
                    picture: profile.picture || "/file.svg",
                    username: profile.username || pubkey,
                    pubkey,
                });
                setEditDisplayName(profile.display_name || profile.username || "");
                setEditBio(profile.about || "");
            } else {
                setUserProfile({
                    display_name: pubkey,
                    bio: "",
                    picture: "/file.svg",
                    username: pubkey,
                    pubkey,
                });
            }
            setLoading(false);
        })();
    }, [pubkey, isSelf, profile]);

    useEffect(() => {
        if (userProfile) {
            setEditDisplayName(userProfile.display_name);
            setEditBio(userProfile.bio);
            setEditUsername(userProfile.username || "");
            setEditPicture(userProfile.picture || "");
            setEditBanner(userProfile.banner || "");
            setEditWebsite(userProfile.website || "");
            setEditNip05(userProfile.nip05 || "");
        }
    }, [userProfile]);

    const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                setEditPicture(reader.result);
            }
        };
        reader.readAsDataURL(file);
    };

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

                {/* Wallet address and npub display */}
                <div className="mb-4 text-xs text-gray-400 break-all">
                    {userProfile?.pubkey && (
                        <>
                            <div><span className="font-semibold">Wallet:</span> {userProfile.pubkey}</div>
                            <div><span className="font-semibold">npub:</span> {nip19.npubEncode(userProfile.pubkey)}</div>
                        </>
                    )}
                </div>

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
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-white truncate text-lg">{userProfile?.display_name || userProfile?.username || userProfile?.pubkey?.slice(0, 8) + "..."}</span>
                            {/* NIP-05 Verification Badge */}
                            {userProfile?.nip05 && (
                                <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ml-1 ${userProfile.nip05_verified ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-300'}`}
                                    title={userProfile.nip05_verified ? `NIP-05 Verified: ${userProfile.nip05}` : `NIP-05: ${userProfile.nip05}`}
                                >
                                    {userProfile.nip05_verified ? '✔' : '✖'} {userProfile.nip05}
                                </span>
                            )}
                        </div>
                        <span className="text-sm text-gray-400 truncate">@{userProfile?.username || userProfile?.pubkey?.slice(0, 8) + "..."}</span>
                        {/* Website link if present */}
                        {userProfile?.website && (
                            <a
                                href={userProfile.website.startsWith('http') ? userProfile.website : `https://${userProfile.website}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-400 hover:underline mt-1 truncate"
                            >
                                {userProfile.website.replace(/^https?:\/\//, '')}
                            </a>
                        )}
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
                            updateProfile({
                                display_name: editDisplayName,
                                username: editUsername,
                                about: editBio,
                                picture: editPicture,
                                banner: editBanner,
                                website: editWebsite,
                                nip05: editNip05,
                            });
                            setUserProfile({
                                ...userProfile,
                                display_name: editDisplayName,
                                username: editUsername,
                                bio: editBio,
                                picture: editPicture,
                                banner: editBanner,
                                website: editWebsite,
                                nip05: editNip05,
                            });
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
                        <label className="font-semibold">Username</label>
                        <input
                            className="px-3 py-2 rounded bg-gray-800 text-white border border-gray-700"
                            value={editUsername}
                            onChange={e => setEditUsername(e.target.value)}
                            placeholder="Enter username (e.g. alice)"
                        />
                        <label className="font-semibold">Bio</label>
                        <textarea
                            className="px-3 py-2 rounded bg-gray-800 text-white border border-gray-700 min-h-[60px]"
                            value={editBio}
                            onChange={e => setEditBio(e.target.value)}
                            placeholder="Enter your bio"
                            title="Bio"
                        />
                        <label className="font-semibold">Picture URL</label>
                        <input
                            className="px-3 py-2 rounded bg-gray-800 text-white border border-gray-700 mb-1"
                            value={editPicture}
                            onChange={e => setEditPicture(e.target.value)}
                            placeholder="https://example.com/avatar.png or base64"
                        />
                        <input
                            type="file"
                            accept="image/*"
                            className="mb-2"
                            onChange={handleAvatarUpload}
                            title="Upload avatar image"
                            placeholder="Choose an image file"
                        />
                        {editPicture && (
                            <img src={editPicture} alt="avatar preview" className="w-20 h-20 rounded-full object-cover border border-white/20 mb-2" />
                        )}
                        <label className="font-semibold">Banner URL</label>
                        <input
                            className="px-3 py-2 rounded bg-gray-800 text-white border border-gray-700"
                            value={editBanner}
                            onChange={e => setEditBanner(e.target.value)}
                            placeholder="https://example.com/banner.jpg"
                        />
                        <label className="font-semibold">Website</label>
                        <input
                            className="px-3 py-2 rounded bg-gray-800 text-white border border-gray-700"
                            value={editWebsite}
                            onChange={e => setEditWebsite(e.target.value)}
                            placeholder="https://yourwebsite.com"
                        />
                        <label className="font-semibold">NIP-05 Verification</label>
                        <input
                            className="px-3 py-2 rounded bg-gray-800 text-white border border-gray-700"
                            value={editNip05}
                            onChange={e => setEditNip05(e.target.value)}
                            placeholder="username@domain.com"
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
                                            <img key={idx} src={url} alt="media" className="rounded-xl object-cover border border-gray-800 bg-black w-full h-60 mb-2" />
                                        ) : url.match(/\.(mp4|webm)$/i) ? (
                                            <video key={idx} controls className="rounded-xl border border-gray-800 bg-black w-full max-h-96 shadow-lg mb-2 object-cover">
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
