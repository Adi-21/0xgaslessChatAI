'use client';

import { useState, useEffect, useCallback } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import ChatInterface from '../components/ChatInterface';
import Wallet from '../components/Wallet';
import type { AgentConfig } from '../components/AgentIntialize';

export default function Home() {
    const [isWalletConnected, setIsWalletConnected] = useState(false);
    const [isAgentInitialized, setIsAgentInitialized] = useState(false);
    const [isInitializing, setIsInitializing] = useState(false);
    const [config, setConfig] = useState<AgentConfig | null>(null);
    const [privateKey, setPrivateKey] = useState<`0x${string}` | null>(null);

    const initializeAgent = useCallback(async () => {
        if (!privateKey) return;

        try {
            setIsInitializing(true);
            const response = await fetch('/api/agent', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ privateKey })
            });

            const data = await response.json();
            if (!data.success) throw new Error(data.error);

            setConfig(data.config);
            setIsAgentInitialized(true);
            toast.success('Agent initialized successfully!');
        } catch (error) {
            console.error('Agent initialization error:', error);
            toast.error(`Failed to initialize agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsInitializing(false);
        }
    }, [privateKey]);

    useEffect(() => {
        if (isWalletConnected && !isAgentInitialized && !isInitializing) {
            initializeAgent();
        }
    }, [isWalletConnected, isAgentInitialized, isInitializing, initializeAgent]);

    const handleWalletConnect = (_address: `0x${string}`, walletPrivateKey: `0x${string}`) => {
        console.log('Wallet Connected:', { address: _address });
        setPrivateKey(walletPrivateKey);
        setIsWalletConnected(true);
    };

    return (
        <main className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-purple-900/60 p-4">
            <Toaster position="top-right" />
            <div className="max-w-4xl mx-auto">
                <h1 className="text-5xl font-bold text-center mb-8 text-white font-quantico shadow-lg tracking-tighter leading-tight mt-10">
                    0xGasless AgentKit Chat Interface
                </h1>

                {!isWalletConnected ? (
                    <Wallet onConnect={handleWalletConnect} />
                ) : !isAgentInitialized ? (
                    <div className="text-center p-4 bg-white rounded-lg shadow-md">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
                        <p className="mt-2 text-gray-600">Initializing Agent...</p>
                    </div>
                ) : (
                    <ChatInterface
                        config={config as AgentConfig}
                        privateKey={privateKey as `0x${string}`}
                    />
                )}
            </div>
        </main>
    );
} 