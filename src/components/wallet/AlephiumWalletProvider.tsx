"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";

declare global {
    interface Window {
        alephium?: any;
    }
}

interface AlephiumWalletContextProps {
    extensionAvailable: boolean;
    address: string | null;
    isConnected: boolean;
    connect: () => Promise<void>;
    disconnect: () => void;
    error: string | null;
}

const AlephiumWalletContext = createContext<AlephiumWalletContextProps | undefined>(undefined);

export const AlephiumWalletProvider = ({ children }: { children: ReactNode }) => {
    const [extensionAvailable, setExtensionAvailable] = useState(false);
    const [address, setAddress] = useState<string | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let tries = 0;
        const maxTries = 20;
        const interval = setInterval(() => {
            if (window.alephium) {
                setExtensionAvailable(true);
                clearInterval(interval);
            } else if (tries > maxTries) {
                setExtensionAvailable(false);
                clearInterval(interval);
            }
            tries++;
        }, 200);
        return () => clearInterval(interval);
    }, []);

    const connect = async () => {
        setError(null);
        if (!window.alephium) {
            setExtensionAvailable(false);
            setError("Alephium Wallet extension not found. Please install it.");
            return;
        }
        try {
            const result = await window.alephium.requestAccounts();
            if (result && result.length > 0) {
                setAddress(result[0]);
                setIsConnected(true);
            } else {
                setError("No account found in Alephium extension.");
            }
        } catch (e: any) {
            setError(e?.message || "Failed to connect to Alephium extension.");
        }
    };

    const disconnect = () => {
        setAddress(null);
        setIsConnected(false);
        setError(null);
    };

    return (
        <AlephiumWalletContext.Provider value={{ extensionAvailable, address, isConnected, connect, disconnect, error }}>
            {children}
        </AlephiumWalletContext.Provider>
    );
};

export const useAlephiumWallet = () => {
    const ctx = useContext(AlephiumWalletContext);
    if (!ctx) throw new Error("useAlephiumWallet must be used within AlephiumWalletProvider");
    return ctx;
};
