import { SavedWallet } from "@/types/wallet";

export default function WalletManager({ currentAddress, onSelectWallet }: { currentAddress: string, onSelectWallet: (addr: string) => void }) {
    // This is a stub. In a real app, you'd list and manage wallets.
    return (
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <div className="font-bold mb-2">Wallet Manager</div>
            <div>Current: <span className="text-blue-400">{currentAddress}</span></div>
            {/* Add wallet management UI here */}
        </div>
    );
}
