export type WalletType = "Alephium" | "Bitcoin" | "Ergo";

export interface SavedWallet {
    address: string;
    label: string;
    dateAdded: number;
}
