import { useEffect, useState } from 'react';

interface FinancialTickerProps {
    assetId: string; // e.g., 'bitcoin', 'ethereum', 'aapl', 'usd-eur'
    assetType: 'crypto' | 'stock' | 'forex'; // Type of financial asset
    refreshInterval?: number; // Refresh interval in seconds (default: 300)
    currency?: string; // Display currency (e.g., 'usd', 'eur')
    decimals?: number; // Number of decimal places for price
    showVolume?: boolean; // Toggle volume display
    showMarketCap?: boolean; // Toggle market cap display
    className?: string; // Optional CSS class for styling
    symbol?: string; // Original symbol from post (e.g., '$BTC', '$AAPL')
}

interface TickerData {
    price: number;
    change24h: number;
    volume24h: number;
    marketCap?: number;
    high24h?: number;
    low24h?: number;
}

export function FinancialTicker({
    assetId,
    assetType,
    refreshInterval = 300, // Default: 5 minutes
    currency = 'usd',
    decimals = 2,
    showVolume = true,
    showMarketCap = false,
    className,
    symbol,
}: FinancialTickerProps) {
    const [tickerData, setTickerData] = useState<TickerData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastSuccessfulData, setLastSuccessfulData] = useState<TickerData | null>(null);
    const [retryCount, setRetryCount] = useState(0);
    const maxRetries = 3;

    useEffect(() => {
        const fetchFinancialData = async () => {
            try {
                setLoading(true);
                let apiUrl = '';
                let apiKey = process.env.NEXT_PUBLIC_ALPHA_VANTAGE_API_KEY || 'YOUR_API_KEY'; // Replace with your API key

                // Determine API based on asset type
                if (assetType === 'crypto') {
                    apiUrl = `https://api.coingecko.com/api/v3/coins/${assetId}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false`;
                } else if (assetType === 'stock') {
                    // Alpha Vantage API for stock data
                    apiUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${assetId}&apikey=${apiKey}`;
                } else if (assetType === 'forex') {
                    // ExchangeRate-API for forex data
                    apiUrl = `https://api.exchangerate-api.com/v4/latest/${assetId.split('-')[0]}`; // e.g., 'usd' from 'usd-eur'
                }

                const response = await fetch(apiUrl);

                if (!response.ok) {
                    throw new Error(`Failed to fetch ${assetType} data: ${response.statusText}`);
                }

                const data = await response.json();

                // Normalize data based on asset type
                let newData: TickerData;
                if (assetType === 'crypto') {
                    newData = {
                        price: data.market_data.current_price[currency.toLowerCase()] || 0,
                        change24h: data.market_data.price_change_percentage_24h || 0,
                        volume24h: data.market_data.total_volume[currency.toLowerCase()] || 0,
                        marketCap: data.market_data.market_cap[currency.toLowerCase()],
                        high24h: data.market_data.high_24h[currency.toLowerCase()],
                        low24h: data.market_data.low_24h[currency.toLowerCase()],
                    };
                } else if (assetType === 'stock') {
                    const quote = data['Global Quote'] || {};
                    newData = {
                        price: parseFloat(quote['05. price']) || 0,
                        change24h: parseFloat(quote['10. change percent']?.replace('%', '')) || 0,
                        volume24h: parseFloat(quote['06. volume']) || 0,
                        marketCap: undefined, // Alpha Vantage free tier doesn't provide market cap
                        high24h: parseFloat(quote['03. high']) || 0,
                        low24h: parseFloat(quote['04. low']) || 0,
                    };
                } else if (assetType === 'forex') {
                    const targetCurrency = assetId.split('-')[1]; // e.g., 'eur' from 'usd-eur'
                    newData = {
                        price: data.rates[targetCurrency] || 0,
                        change24h: 0, // ExchangeRate-API free tier doesn't provide 24h change
                        volume24h: 0, // Not available in this API
                        marketCap: undefined,
                        high24h: undefined,
                        low24h: undefined,
                    };
                } else {
                    throw new Error('Unsupported asset type');
                }

                setTickerData(newData);
                setLastSuccessfulData(newData); // Cache successful data
                setError(null);
                setLoading(false);
                setRetryCount(0); // Reset retry count on success
            } catch (err) {
                console.error(`Error fetching ${assetType} data for ${assetId}:`, err);
                if (retryCount < maxRetries) {
                    setTimeout(() => {
                        setRetryCount(retryCount + 1);
                    }, 2000 * (retryCount + 1)); // Exponential backoff
                } else {
                    setError(`Failed to load ${assetType} data for ${symbol || assetId}. Showing last known data.`);
                    setLoading(false);
                }
            }
        };

        fetchFinancialData();

        // Set up interval for periodic updates
        const intervalId = setInterval(fetchFinancialData, refreshInterval * 1000);

        // Cleanup interval on component unmount
        return () => clearInterval(intervalId);
    }, [assetId, assetType, currency, refreshInterval, retryCount, symbol]);

    // Loading state (no cached data)
    if (loading && !lastSuccessfulData) {
        return (
            <div
                className={`flex items-center p-2 bg-transparent backdrop-blur-md rounded-md border border-white/10 shadow-md ${className}`}
                role="status"
                aria-live="polite"
            >
                <div className="animate-pulse w-24 h-6 bg-white/5 rounded"></div>
            </div>
        );
    }

    // Use last successful data if current fetch fails
    const displayData = tickerData || lastSuccessfulData;

    // No data available (initial load failed and no cached data)
    if (!displayData) {
        return (
            <div
                className={`p-2 bg-transparent backdrop-blur-md rounded-md border border-red-800/50 ${className}`}
                role="alert"
                aria-live="assertive"
            >
                <span className="text-red-400">No data available for {symbol || assetId}</span>
            </div>
        );
    }

    const isPositive = displayData.change24h >= 0;

    return (
        <div
            className={`flex flex-col p-2 bg-transparent backdrop-blur-md rounded-md border border-white/10 shadow-md transition-all hover:scale-105 hover:border-yellow-400/50 group ${className}`}
            role="region"
            aria-label={`${symbol || assetId} financial ticker`}
        >
            <div className="flex items-center gap-2">
                <span className="text-yellow-400 text-lg font-bold mr-1">
                    {symbol || (assetType === 'crypto' ? '₿' : assetType === 'stock' ? '📈' : '💱')}
                </span>
                <span className="text-gray-100 font-mono">
                    {currency.toUpperCase()} {displayData.price.toLocaleString(undefined, { maximumFractionDigits: decimals })}
                </span>
                <div className={`text-xs font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                    {isPositive ? '▲' : '▼'} {Math.abs(displayData.change24h).toFixed(2)}%
                </div>
            </div>
            {showVolume && displayData.volume24h > 0 && (
                <div className="text-xs text-gray-400 mt-1">
                    Volume (24h): {displayData.volume24h.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
            )}
            {showMarketCap && displayData.marketCap && (
                <div className="text-xs text-gray-400 mt-1">
                    Market Cap: {displayData.marketCap.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
            )}
            {displayData.high24h && displayData.low24h && (
                <div className="text-xs text-gray-400 mt-1">
                    24h Range: {displayData.low24h.toLocaleString(undefined, { maximumFractionDigits: decimals })} -{' '}
                    {displayData.high24h.toLocaleString(undefined, { maximumFractionDigits: decimals })}
                </div>
            )}
            {error && (
                <div className="text-xs text-red-400 mt-1" role="alert">
                    {error}
                </div>
            )}
        </div>
    );
}