import { useAlephiumWallet } from "../AlephiumWalletProvider";
import { SavedWallet } from "@/types/wallet";

// Alephium wallet extension global object
const ALEPHIUM_EXTENSION_KEY = "alephium";

export interface WalletStats {
    transactionCount: number;
    receivedAmount: number;
    sentAmount: number;
    tokenCount: number;
}

export default function AlephiumWalletLayout({ address, allWallets, isLoggedIn, walletStats, isStatsLoading, refreshFlag, setRefreshFlag, activeTab }: {
    address: string;
    allWallets: SavedWallet[];
    isLoggedIn: boolean;
    walletStats: WalletStats;
    isStatsLoading: boolean;
    refreshFlag: number;
    setRefreshFlag: (n: number) => void;
    activeTab: string;
}) {
    const { extensionAvailable, address: extAddress, isConnected, connect, disconnect, error } = useAlephiumWallet();

    return (
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <div className="font-bold mb-2">Alephium Wallet</div>
            {!extensionAvailable ? (
                <div className="mb-2 text-red-400">Alephium Wallet extension not detected. <a href="https://chrome.google.com/webstore/detail/alephium-wallet/" className="underline text-blue-400" target="_blank" rel="noopener noreferrer">Install Extension</a></div>
            ) : (
                <>
                    <button
                        className="mb-2 px-3 py-1 rounded bg-blue-500 text-white text-sm font-semibold"
                        onClick={connect}
                        disabled={isConnected}
                    >
                        {isConnected ? "Connected" : "Connect Alephium Extension"}
                    </button>
                    {isConnected && extAddress && (
                        <div className="mb-2 text-green-400">Connected: <span className="break-all">{extAddress}</span></div>
                    )}
                </>
            )}
            {error && <div className="mb-2 text-red-400">{error}</div>}
            <div>Address: <span className="text-blue-400">{address}</span></div>
            <div>Transactions: {walletStats.transactionCount}</div>
            <div>Received: {walletStats.receivedAmount}</div>
            <div>Sent: {walletStats.sentAmount}</div>
            <div>Tokens: {walletStats.tokenCount}</div>
            <div>Active Tab: {activeTab}</div>
        </div>
    );
}
