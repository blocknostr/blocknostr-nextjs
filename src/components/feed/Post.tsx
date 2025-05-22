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

export function Post({ event, onChatOpen, onChatClose, isChatActive, isAnimating, chatCount }: PostProps) {
    const [financialAssets, setFinancialAssets] = useState<FinancialAsset[]>([]);

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

    return (
        <div className="relative bg-transparent backdrop-blur-md rounded-xl border border-white/10 overflow-hidden w-full max-w-xl mx-auto">
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
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/5 border border-white/10 flex-shrink-0">
                        {event.profile?.picture ? (
                            <img src={event.profile.picture} alt="" className="w-full h-full rounded-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-blue-300 text-sm">
                                {event.pubkey.slice(0, 2)}
                            </div>
                        )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium truncate">
                                {event.profile?.display_name || event.profile?.username || `${event.pubkey.slice(0, 6)}...${event.pubkey.slice(-4)}`}
                            </span>
                            <span className="text-gray-500 text-sm">
                                {new Date(event.created_at * 1000).toLocaleTimeString()}
                            </span>
                        </div>
                        <div className="whitespace-pre-line break-words text-gray-100">
                            {formatNostrAddresses(event.content)}
                        </div>

                        {/* Media */}
                        {event.media && event.media.length > 0 && (
                            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {event.media.map((url, i) => (
                                    <img
                                        key={i}
                                        src={url}
                                        alt=""
                                        className="rounded-lg w-full h-48 object-cover"
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="mt-4 flex items-center gap-4 sm:gap-6 text-sm">
                    <div
                        className="flex items-center gap-2 hover:text-blue-400 cursor-pointer transition"
                        onClick={() => (isChatActive ? onChatClose(event.id) : onChatOpen(event.id))}
                    >
                        <span>💬</span>
                        <span>Chat{chatCount > 0 ? ` (${chatCount})` : ''}</span>
                    </div>
                    <div className="flex items-center gap-2 hover:text-pink-400 cursor-pointer transition">
                        <span>❤️</span>
                        <span>Like</span>
                    </div>
                </div>
            </div>
        </div>
    );
}