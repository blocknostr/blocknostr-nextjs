export default function ErgoWalletLayout({ address }: { address: string }) {
    return (
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <div className="font-bold mb-2">Ergo Wallet</div>
            <div>Address: <span className="text-blue-400">{address}</span></div>
            {/* Add more Ergo wallet info here */}
        </div>
    );
}
