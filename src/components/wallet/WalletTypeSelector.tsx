import { WalletType } from "@/types/wallet";

export default function WalletTypeSelector({ selectedWallet, onSelectWallet }: { selectedWallet: WalletType, onSelectWallet: (type: WalletType) => void }) {
    return (
        <select
            value={selectedWallet}
            onChange={e => onSelectWallet(e.target.value as WalletType)}
            className="ml-2 px-2 py-1 rounded border border-gray-700 bg-gray-900 text-white"
        >
            <option value="Alephium">Alephium</option>
            <option value="Bitcoin">Bitcoin</option>
            <option value="Ergo">Ergo</option>
        </select>
    );
}
