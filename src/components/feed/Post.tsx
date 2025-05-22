import { useEffect, useState } from 'react';
import Link from 'next/link';
import { NostrEvent } from '@/types/nostr';
import { formatNostrAddresses } from '@/app/page';
import { FinancialTicker } from "@/components/shared/BitcoinTicker";

interface PostProps {
    event: NostrEvent;
    onChatOpen: (id: string) => void;
    onChatClose: (id: string) => void;
    isChatActive: boolean;
    isAnimating: boolean;
    chatCount: number;
}

interface FinancialAsset {
    assetId: string;
    assetType: 'crypto' | 'stock' | 'forex';
    symbol: string;
}

// Map of common financial symbols to asset details
const assetMap: Record<string, FinancialAsset> = {
    // Cryptocurrencies
    '$BTC': { assetId: 'bitcoin', assetType: 'crypto', symbol: '$BTC' },
    '$ETH': { assetId: 'ethereum', assetType: 'crypto', symbol: '$ETH' },
    '$XRP': { assetId: 'ripple', assetType: 'crypto', symbol: '$XRP' },
    // Stocks
    '$AAPL': { assetId: 'aapl', assetType: 'stock', symbol: '$AAPL' },
    '$TSLA': { assetId: 'tsla', assetType: 'stock', symbol: '$TSLA' },
    '$GOOGL': { assetId: 'googl', assetType: 'stock', symbol: '$GOOGL' },
    // Forex
    'USD/EUR': { assetId: 'usd-eur', assetType: 'forex', symbol: 'USD/EUR' },
    'EUR/USD': { assetId: 'eur-usd', assetType: 'forex', symbol: 'EUR/USD' },
};

// Helper: highlight hashtags, mentions, and links
function highlightContent(content: string) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return content.split(/(#[\w-]+|@[\w-]+|https?:\/\/[^\s]+)/g).map((part, i) => {
        if (/^#[\w-]+$/.test(part)) {
            return <span key={i} className="text-blue-400 hover:underline cursor-pointer">{part}</span>;
        }
        if (/^@[\w-]+$/.test(part)) {
            return <span key={i} className="text-pink-400 hover:underline cursor-pointer">{part}</span>;
        }
        if (urlRegex.test(part)) {
            return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-green-400 underline break-all">{part}</a>;
        }
        return part;
    });
}

export function Post({ event, onChatOpen, onChatClose, isChatActive, isAnimating, chatCount }: PostProps) {
    const [financialAssets, setFinancialAssets] = useState<FinancialAsset[]>([]);
    const [liked, setLiked] = useState(false);
    const [likeCount, setLikeCount] = useState(Math.floor(Math.random() * 100)); // Placeholder, replace with real count
    const [showMenu, setShowMenu] = useState(false);
    const [lightboxImg, setLightboxImg] = useState<string | null>(null);

    // Function to detect financial assets in content
    const detectFinancialAssets = (content: string): FinancialAsset[] => {
        const assets: FinancialAsset[] = [];
        // Match $SYMBOL or #SYMBOL or forex pairs
        const regex = /[$#][A-Z]+|(?:USD|EUR|GBP|JPY)\/(?:USD|EUR|GBP|JPY)/g;
        const matches = content.match(regex) || [];

        matches.forEach((symbol) => {
            // Normalize to $SYMBOL for assetMap lookup
            let lookup = symbol;
            if (symbol.startsWith('#')) lookup = '$' + symbol.slice(1);
            if (assetMap[lookup] && !assets.some((asset) => asset.symbol === lookup)) {
                assets.push(assetMap[lookup]);
            }
        });

        return assets;
    };

    useEffect(() => {
        // Detect financial assets in the post content
        const detectedAssets = detectFinancialAssets(event.content);
        setFinancialAssets(detectedAssets);
    }, [event.content]);

    function renderPostContent(content: string) {
        const financialSymbolRegex = /\$(\w+)/g; // Matches $SYMBOL
        const matches = content.match(financialSymbolRegex);

        return (
            <div>
                {matches && matches.length > 0 && (
                    <div className="mb-2">
                        {matches.map((symbol, index) => (
                            <FinancialTicker
                                key={index}
                                assetId={symbol.slice(1).toLowerCase()} // Remove $ and convert to lowercase
                                assetType="crypto" // Default to crypto; can be extended to detect other types
                                symbol={symbol}
                                className="mb-2"
                            />
                        ))}
                    </div>
                )}
                <p>{content}</p>
            </div>
        );
    }

    // User badge logic (example: verified if pubkey ends with 'a')
    const isVerified = event.profile?.pubkey?.endsWith('a');

    return (
        <div className="relative bg-gradient-to-br from-gray-950/80 to-gray-900/60 backdrop-blur-md rounded-2xl border border-white/10 overflow-hidden w-full max-w-xl mx-auto shadow-lg hover:shadow-2xl transition-shadow group">
            {/* Financial Ticker(s) - show compact, subtle, and visually distinct at top left if present */}
            {financialAssets.length > 0 && (
                <div className="absolute top-3 left-3 z-20 flex flex-col gap-2 pointer-events-none">
                    {financialAssets.map((asset, index) => (
                        <FinancialTicker
                            key={`${asset.assetId}-${index}`}
                            assetId={asset.assetId}
                            assetType={asset.assetType}
                            currency="usd"
                            decimals={asset.assetType === 'forex' ? 4 : 2}
                            showVolume={false}
                            showMarketCap={false}
                            className="w-32 sm:w-40 shadow-lg border-2 border-yellow-400/40 bg-black/80 opacity-90 rounded-lg"
                            symbol={asset.symbol}
                        />
                    ))}
                </div>
            )}

            <div className="p-4 sm:p-6">
                <div className="flex items-start gap-3 sm:gap-4">
                    {/* Profile Picture */}
                    <button
                        className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/5 border border-white/10 flex-shrink-0 overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-500"
                        onClick={() => {/* open profile pane logic here */}}
                        aria-label="Open user profile"
                    >
                        {event.profile?.picture ? (
                            <img src={event.profile.picture} alt="avatar" className="w-full h-full rounded-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-blue-300 text-sm">
                                {event.pubkey.slice(0, 2)}
                            </div>
                        )}
                    </button>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <button
                                className="font-medium truncate hover:underline focus:outline-none bg-transparent border-0 p-0 m-0 text-white"
                                onClick={() => {/* open profile pane logic here */}}
                                tabIndex={0}
                                aria-label={`Open profile for ${event.profile?.display_name || event.profile?.username || event.pubkey}`}
                            >
                                {event.profile?.display_name || event.profile?.username || `${event.pubkey.slice(0, 6)}...${event.pubkey.slice(-4)}`}
                            </button>
                            {isVerified && <span className="ml-1 text-blue-400" title="Verified">✔️</span>}
                            <span
                                className="text-gray-500 text-xs cursor-pointer hover:underline"
                                title={new Date(event.created_at * 1000).toLocaleString()}
                            >
                                {new Date(event.created_at * 1000).toLocaleTimeString()}
                            </span>
                            <div className="relative ml-auto">
                                <button
                                    className="text-gray-400 hover:text-white px-2 py-1 rounded-full focus:outline-none"
                                    onClick={() => setShowMenu(v => !v)}
                                    aria-label="Post actions"
                                >
                                    ⋯
                                </button>
                                {showMenu && (
                                    <div className="absolute right-0 mt-2 z-30 bg-gray-900 border border-gray-800 rounded-xl shadow-lg min-w-[120px] p-2 flex flex-col animate-fade-in">
                                        <button className="text-left px-3 py-1 hover:bg-gray-800 rounded" onClick={() => {navigator.clipboard.writeText(window.location.href); setShowMenu(false);}}>Copy Link</button>
                                        <button className="text-left px-3 py-1 hover:bg-gray-800 rounded" onClick={() => setShowMenu(false)}>Report</button>
                                        <button className="text-left px-3 py-1 hover:bg-gray-800 rounded" onClick={() => setShowMenu(false)}>Mute</button>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="whitespace-pre-line break-words text-gray-100 text-base leading-relaxed">
                            {highlightContent(event.content)}
                        </div>

                        {/* Media */}
                        {event.media && event.media.length > 0 && (
                            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {event.media.map((url, i) => (
                                    <>
                                        <img
                                            key={i}
                                            src={url}
                                            alt="Post media"
                                            className="rounded-lg w-full h-48 object-cover cursor-pointer hover:scale-105 transition-transform border border-white/10"
                                            onClick={() => setLightboxImg(url)}
                                        />
                                        {lightboxImg === url && (
                                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl" onClick={() => setLightboxImg(null)}>
                                                <img src={url} alt="Enlarged media" className="max-h-[80vh] max-w-[90vw] rounded-2xl shadow-2xl border border-white/20" />
                                                <button className="absolute top-4 right-4 text-white text-2xl bg-black/60 rounded-full px-3 py-1" onClick={() => setLightboxImg(null)} aria-label="Close image">✕</button>
                                            </div>
                                        )}
                                    </>
                                ))}
                            </div>
                        )}
                        {/* Thread/Reply preview (placeholder) */}
                        <div className="mt-2 text-xs text-gray-400">
                            {/* Example: "Replying to @user" or thread context */}
                            {/* Thread preview not available */}
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="mt-4 flex items-center gap-4 sm:gap-6 text-sm select-none">
                    <div
                        className={`flex items-center gap-2 hover:text-blue-400 cursor-pointer transition ${isChatActive ? 'font-bold text-blue-400' : ''}`}
                        onClick={() => (isChatActive ? onChatClose(event.id) : onChatOpen(event.id))}
                        tabIndex={0}
                        aria-label="Open chat"
                    >
                        <span>💬</span>
                        <span>Chat{chatCount > 0 ? ` (${chatCount})` : ''}</span>
                    </div>
                    <div
                        className={`flex items-center gap-2 hover:text-pink-400 cursor-pointer transition ${liked ? 'font-bold text-pink-400 scale-110' : ''}`}
                        onClick={() => { setLiked(v => !v); setLikeCount(c => c + (liked ? -1 : 1)); }}
                        tabIndex={0}
                        aria-label="Like post"
                    >
                        <span className={`transition-transform ${liked ? 'animate-pulse' : ''}`}>❤️</span>
                        <span>Like{likeCount > 0 ? ` (${likeCount})` : ''}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}