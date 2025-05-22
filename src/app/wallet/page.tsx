"use client";
import { useState, useEffect } from "react";
import { WalletType, SavedWallet } from "../../types/wallet";
import WalletConnectButton from "../../components/wallet/WalletConnectButton";
import { useLocalStorage } from "../../hooks/use-local-storage";
import WalletManager from "../../components/wallet/WalletManager";
import WalletTypeSelector from "../../components/wallet/WalletTypeSelector";
import AlephiumWalletLayout from "../../components/wallet/layouts/AlephiumWalletLayout";
import BitcoinWalletLayout from "../../components/wallet/layouts/BitcoinWalletLayout";
import ErgoWalletLayout from "../../components/wallet/layouts/ErgoWalletLayout";
import { getAddressTransactions, getAddressTokens } from "../../lib/api/alephiumApi";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface WalletStats {
    transactionCount: number;
    receivedAmount: number;
    sentAmount: number;
    tokenCount: number;
}

const WalletsPage = () => {
    // Simulate wallet connection with local state
    const [connected, setConnected] = useState(false);
    const [savedWallets, setSavedWallets] = useLocalStorage<SavedWallet[]>("blocknoster_saved_wallets", []);
    const [walletAddress, setWalletAddress] = useLocalStorage<string>("blocknoster_selected_wallet", "");
    const [refreshFlag, setRefreshFlag] = useState<number>(0);
    const [walletStats, setWalletStats] = useState<WalletStats>({
        transactionCount: 0,
        receivedAmount: 0,
        sentAmount: 0,
        tokenCount: 0
    });
    const [isStatsLoading, setIsStatsLoading] = useState<boolean>(true);
    const [activeTab, setActiveTab] = useState<string>("portfolio");
    const [selectedWalletType, setSelectedWalletType] = useLocalStorage<WalletType>("blocknoster_wallet_type", "Alephium");

    // Auto-refresh data every 5 minutes
    useEffect(() => {
        const refreshInterval = setInterval(() => {
            setRefreshFlag((prev: number) => prev + 1);
        }, 5 * 60 * 1000);
        return () => clearInterval(refreshInterval);
    }, []);

    // Initialize with first saved wallet or default
    useEffect(() => {
        if (connected && walletAddress) {
            if (!savedWallets.some((w: SavedWallet) => w.address === walletAddress)) {
                setSavedWallets([
                    ...savedWallets,
                    {
                        address: walletAddress,
                        label: "Connected Wallet",
                        dateAdded: Date.now()
                    }
                ]);
            }
        } else if (savedWallets.length > 0 && !walletAddress) {
            setWalletAddress(savedWallets[0].address);
        } else if (!walletAddress) {
            const defaultAddress = "raLUPHsewjm1iA2kBzRKXB2ntbj3j4puxbVvsZD8iK3r";
            setWalletAddress(defaultAddress);
            if (!savedWallets.some((w: SavedWallet) => w.address === defaultAddress)) {
                setSavedWallets([
                    ...savedWallets,
                    {
                        address: defaultAddress,
                        label: "Connected Wallet",
                        dateAdded: Date.now()
                    }
                ]);
            }
        }
    }, [connected, walletAddress, savedWallets, setSavedWallets, setWalletAddress]);

    // Effect to fetch wallet statistics
    useEffect(() => {
        const fetchWalletStats = async () => {
            if (!walletAddress || selectedWalletType !== "Alephium") {
                setIsStatsLoading(false);
                return;
            }
            setIsStatsLoading(true);
            try {
                const transactions = await getAddressTransactions(walletAddress, 50);
                const tokens = await getAddressTokens(walletAddress);
                let received = 0;
                let sent = 0;
                transactions.forEach((tx: any) => {
                    const type = getTransactionType(tx);
                    const amount = getTransactionAmount(tx);
                    if (type === 'received') {
                        received += amount;
                    } else if (type === 'sent') {
                        sent += amount;
                    }
                });
                setWalletStats({
                    transactionCount: transactions.length,
                    receivedAmount: received,
                    sentAmount: sent,
                    tokenCount: tokens.length
                });
            } catch (error) {
                console.error("Error fetching wallet stats:", error);
            } finally {
                setIsStatsLoading(false);
            }
        };
        fetchWalletStats();
    }, [walletAddress, refreshFlag, selectedWalletType]);

    const handleDisconnect = async () => {
        setConnected(false);
        if (savedWallets.length > 0) {
            setWalletAddress(savedWallets[0].address);
        }
    };

    // Helper to determine if transaction is incoming or outgoing
    const getTransactionType = (tx: any) => {
        const isIncoming = tx.outputs?.some((output: any) => output.address === walletAddress);
        const isOutgoing = tx.inputs?.some((input: any) => input.address === walletAddress);
        if (isIncoming && !isOutgoing) return 'received';
        if (isOutgoing) return 'sent';
        return 'unknown';
    };

    // Calculate amount transferred to/from this address
    const getTransactionAmount = (tx: any) => {
        const type = getTransactionType(tx);
        if (type === 'received') {
            const amount = tx.outputs
                .filter((output: any) => output.address === walletAddress)
                .reduce((sum: number, output: any) => sum + Number(output.amount), 0);
            return amount / 1e18;
        } else if (type === 'sent') {
            const amount = tx.outputs
                .filter((output: any) => output.address !== walletAddress)
                .reduce((sum: number, output: any) => sum + Number(output.amount), 0);
            return amount / 1e18;
        }
        return 0;
    };

    if (!connected && savedWallets.length === 0 && !walletAddress) {
        return (
            <div className="max-w-3xl mx-auto px-4 py-12">
                <div className="flex flex-col items-center justify-center space-y-6 text-center">
                    <h2 className="text-3xl font-bold tracking-tight">Blockchain Portfolio Manager</h2>
                    <p className="text-gray-400 max-w-md">
                        Connect your wallet to track balances, view transactions, send crypto, and interact with dApps.
                    </p>
                    <div className="w-full max-w-md my-8">
                        <WalletConnectButton />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-lg mt-8">
                        <div className="p-4 border rounded-lg bg-gray-900">
                            <h3 className="font-medium mb-2">Portfolio Tracking</h3>
                            <p className="text-sm text-gray-400">Monitor your crypto balances in real-time</p>
                        </div>
                        <div className="p-4 border rounded-lg bg-gray-900">
                            <h3 className="font-medium mb-2">Send & Receive</h3>
                            <p className="text-sm text-gray-400">Transfer tokens with ease</p>
                        </div>
                        <div className="p-4 border rounded-lg bg-gray-900">
                            <h3 className="font-medium mb-2">DApp Integration</h3>
                            <p className="text-sm text-gray-400">Interact with blockchain dApps directly</p>
                        </div>
                        <div className="p-4 border rounded-lg bg-gray-900">
                            <h3 className="font-medium mb-2">Transaction History</h3>
                            <p className="text-sm text-gray-400">Detailed history of all your activity</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-4 py-6">
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <h2 className="text-3xl font-bold tracking-tight">
                                Blockchain Wallet
                            </h2>
                            <WalletTypeSelector
                                selectedWallet={selectedWalletType}
                                onSelectWallet={setSelectedWalletType}
                            />
                        </div>
                        <p className="text-gray-400">
                            {connected
                                ? `Manage your ${selectedWalletType} assets and dApps`
                                : `Viewing portfolio data for all tracked ${selectedWalletType} wallets`}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button className="px-4 py-2 rounded bg-blue-500 text-white hover:bg-blue-600 transition" onClick={() => setConnected(true)}>
                            Connect Wallet
                        </button>
                        {connected && (
                            <button className="px-4 py-2 rounded border border-gray-700 text-gray-300 hover:bg-gray-900 transition h-9" onClick={handleDisconnect}>
                                Disconnect Wallet
                            </button>
                        )}
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2">
                        {selectedWalletType === "Alephium" && (
                            <div className="w-full">
                                <div className="grid grid-cols-3 max-w-md mb-6">
                                    <button className={`flex items-center gap-2 px-4 py-2 rounded ${activeTab === 'portfolio' ? 'bg-blue-500 text-white' : 'bg-gray-800 text-gray-300'}`} onClick={() => setActiveTab('portfolio')}>
                                        📊 <span>My Portfolio</span>
                                    </button>
                                    <button className={`flex items-center gap-2 px-4 py-2 rounded ${activeTab === 'dapps' ? 'bg-blue-500 text-white' : 'bg-gray-800 text-gray-300'}`} onClick={() => setActiveTab('dapps')}>
                                        🧩 <span>My dApps</span>
                                    </button>
                                    <button className={`flex items-center gap-2 px-4 py-2 rounded ${activeTab === 'alephium' ? 'bg-blue-500 text-white' : 'bg-gray-800 text-gray-300'}`} onClick={() => setActiveTab('alephium')}>
                                        🪙 <span>My Alephium</span>
                                    </button>
                                </div>
                                <AlephiumWalletLayout
                                    address={walletAddress}
                                    allWallets={savedWallets}
                                    isLoggedIn={connected}
                                    walletStats={walletStats}
                                    isStatsLoading={isStatsLoading}
                                    refreshFlag={refreshFlag}
                                    setRefreshFlag={setRefreshFlag}
                                    activeTab={activeTab}
                                />
                            </div>
                        )}
                        {selectedWalletType === "Bitcoin" && (
                            <BitcoinWalletLayout address={walletAddress} />
                        )}
                        {selectedWalletType === "Ergo" && (
                            <ErgoWalletLayout address={walletAddress} />
                        )}
                    </div>
                    <div>
                        <WalletManager
                            currentAddress={walletAddress}
                            onSelectWallet={setWalletAddress}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WalletsPage;
