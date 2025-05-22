"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

// Extend the Window interface to include alephium
declare global {
  interface Window {
    alephium?: any;
  }
}

export default function WalletPage() {
  const [connected, setConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");
  const [balance, setBalance] = useState(0);
  const [tokens, setTokens] = useState([]);
  const [activeTab, setActiveTab] = useState("portfolio");
  const [connectError, setConnectError] = useState("");
  const router = useRouter();

  // Explicit connect handler
  const handleConnect = async () => {
    setConnectError("");
    if (typeof window !== "undefined" && (window as any).alephium) {
      try {
        const accounts = await (window as any).alephium.request({ method: "wallet_getAccounts" });
        if (accounts && accounts.length > 0) {
          setWalletAddress(accounts[0]);
          setConnected(true);
        } else {
          setConnectError("No accounts found in Alephium wallet.");
        }
      } catch (err) {
        setConnectError("Failed to connect to Alephium wallet.");
        setConnected(false);
      }
    } else {
      setConnectError("Alephium Wallet extension not detected. ");
    }
  };

  // Dummy fetch for balance/tokens (replace with real API if needed)
  useEffect(() => {
    if (walletAddress) {
      setBalance(0); // Replace with real fetch
      setTokens([]); // Replace with real fetch
    }
  }, [walletAddress]);

  // Tab click handler
  const handleTabClick = (tab: string) => {
    if (tab === "games") {
      router.push("/games");
      return;
    }
    setActiveTab(tab);
  };

  return (
    <div className="min-h-screen bg-black text-white px-6 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Blockchain Wallet</h1>
        <div className="flex gap-2">
          {connected ? (
            <button
              className="px-4 py-2 bg-blue-500 rounded text-white"
              onClick={() => { setConnected(false); setWalletAddress(""); }}
              type="button"
            >
              Disconnect
            </button>
          ) : (
            <button
              className="px-4 py-2 bg-blue-500 rounded text-white"
              onClick={handleConnect}
              type="button"
            >
              Connect Alephium Wallet
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button className={`px-4 py-2 rounded ${activeTab === 'portfolio' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300'}`} onClick={() => handleTabClick('portfolio')} type="button">My Portfolio</button>
        <button className={`px-4 py-2 rounded ${activeTab === 'dapps' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300'}`} onClick={() => handleTabClick('dapps')} type="button">My dApps</button>
        <button className={`px-4 py-2 rounded ${activeTab === 'alephium' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300'}`} onClick={() => handleTabClick('alephium')} type="button">My Alephium</button>
        <button className={`px-4 py-2 rounded ${activeTab === 'games' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300'}`} onClick={() => handleTabClick('games')} type="button">Games</button>
      </div>

      {/* Main Content Grid */}
      {activeTab === 'games' ? null : (
        <>
          {/* Wallet Address Card */}
          <div className="mb-8">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col gap-2 shadow-lg">
              <div className="text-xs text-gray-400 mb-1">Current Wallet Address</div>
              <div className="font-mono text-lg text-blue-300 break-all flex items-center gap-2">
                {walletAddress ? (
                  <>
                    <span title={walletAddress} className="truncate max-w-[220px] inline-block align-middle">{walletAddress.slice(0, 8)}...{walletAddress.slice(-6)}</span>
                    <button
                      className="ml-2 px-2 py-1 rounded bg-gray-800 text-gray-300 hover:bg-gray-700 text-xs border border-gray-700"
                      onClick={() => {navigator.clipboard.writeText(walletAddress)}}
                      title="Copy address"
                    >Copy</button>
                  </>
                ) : (
                  <span className="text-gray-500">No wallet selected</span>
                )}
              </div>
              {connectError && (
                <div className="text-red-400 text-xs mt-2">{connectError} {!window.alephium && <a href="https://chrome.google.com/webstore/detail/alephium-wallet/" target="_blank" rel="noopener noreferrer" className="underline">Install Extension</a>}</div>
              )}
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Portfolio Overview */}
            <div className="md:col-span-2 bg-gray-900 rounded-xl p-6 mb-6 md:mb-0">
              <div className="font-semibold text-lg mb-2">Portfolio Overview</div>
              <div className="text-3xl font-bold text-blue-400 mb-1">{balance.toFixed(2)} ALPH</div>
              <div className="text-gray-400 text-sm mb-4">Tokens: {tokens.length}</div>
              <div className="h-32 flex items-center justify-center">
                <span className="text-gray-600">(Chart coming soon)</span>
              </div>
            </div>
            {/* Sidebar */}
            <div className="bg-gray-900 rounded-xl p-6">
              <div className="font-semibold text-lg mb-2">Tracked Wallets</div>
              <div className="text-gray-400 text-sm mb-2">(Add wallet management here if needed)</div>
              <div className="mt-2 text-gray-500">
                {walletAddress ? (
                  <div>{walletAddress}</div>
                ) : (
                  <div>No wallets tracked</div>
                )}
              </div>
            </div>
          </div>

          {/* Token Balances */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 shadow-lg mt-8">
            <div className="font-semibold text-lg text-white mb-2">Token Balances</div>
            <div className="text-gray-400 text-sm">Your token holdings</div>
            <div className="mt-2 text-gray-500">
              {tokens.length === 0 ? 'No tokens found in tracked wallets' : `${tokens.length} tokens`}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
