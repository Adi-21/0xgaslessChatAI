'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { AgentConfig } from './AgentIntialize';

interface Message {
    role: 'user' | 'agent' | 'system' | 'tool';
    content: string;
    type?: 'loading' | 'transaction' | 'error' | 'success';
}

interface Props {
    config: AgentConfig;
    privateKey: `0x${string}`;
}

export default function ChatInterface({ config, privateKey }: Props) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Add initial welcome message when component mounts
    useEffect(() => {
        setMessages([
            {
                role: 'agent',
                content: 'Hello! I am your AI assistant. How may I help you today? I can help you with:\n\n' +
                    '• Checking token balances\n' +
                    '• Transferring tokens\n' +
                    '• Interacting with smart contracts',
            }
        ]);
    }, []);

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [scrollToBottom]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage = input.trim();
        setInput('');

        // Initial thinking state
        setMessages(prev => [
            ...prev,
            { role: 'user', content: userMessage },
            { role: 'system', content: '🤔 Agent is analyzing your request...', type: 'loading' }
        ]);
        setIsLoading(true);

        try {
            const response = await fetch('/api/agent', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-action': 'chat'
                },
                body: JSON.stringify({ 
                    messages: [{ role: 'user', content: userMessage }],
                    privateKey
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to get response');
            }

            // Remove the thinking message
            setMessages(prev => prev.slice(0, -1));

            const reader = response.body?.getReader();
            if (!reader) throw new Error('No reader available');

            const decoder = new TextDecoder('utf-8');
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                buffer += decoder.decode(value, { stream: true });
                
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                
                for (const line of lines) {
                    if (!line.trim()) continue;
                    
                    try {
                        const chunk = JSON.parse(line);
                        
                        if ('agent' in chunk && chunk.agent?.messages[0]?.kwargs?.content) {
                            setMessages(prev => [...prev, {
                                role: 'agent',
                                content: chunk.agent.messages[0].kwargs.content
                            }]);
                        } else if ('tools' in chunk && chunk.tools?.messages[0]?.kwargs?.content) {
                            const toolMessage = chunk.tools.messages[0].kwargs;

                            if (toolMessage.error) {
                                setMessages(prev => [...prev, {
                                    role: 'tool',
                                    content: `Tool Error: ${toolMessage.error}`,
                                    type: 'error'
                                }]);
                            }
                        } else if ('error' in chunk) {
                            throw new Error(chunk.error);
                        }
                    } catch (error) {
                        throw new Error(`Error parsing chunk: ${line}`, { cause: error });
                    }
                }
            }
        } catch (error) {
            setMessages(prev => {
                const messages = prev.filter(msg => 
                    !(msg.type === 'loading' || msg.type === 'transaction')
                );
                return [...messages, {
                    role: 'system',
                    type: 'error',
                    content: error instanceof Error
                        ? `❌ Error: ${error.message}`
                        : '❌ Error: Failed to get response from agent.'
                }];
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-gray-900/50 backdrop-blur-sm rounded-lg shadow-lg border border-purple-600/80 h-[600px] flex flex-col">
            <div className="flex-1 overflow-y-auto p-4">
                {messages.map((message, index) => (
                    <div
                        key={`${index + 1}`}
                        className={`mb-4 ${message.role === 'user' ? 'text-right' : 'text-left'}`}
                    >
                        <div
                            className={`inline-block p-3 rounded-lg ${
                                message.role === 'user'
                                    ? 'bg-gray-700 text-white'
                                    : message.role === 'tool'
                                        ? 'bg-blue-800/40 text-white border border-blue-500/30'
                                        : message.type === 'loading'
                                            ? 'bg-gray-800 text-white animate-pulse'
                                            : message.type === 'transaction'
                                                ? 'bg-blue-900/50 text-white border border-blue-500/30'
                                                : message.type === 'error'
                                                    ? 'bg-red-900/50 text-white border border-red-500/30'
                                                    : 'bg-purple-800/40 text-white'
                            }`}
                        >
                            {message.role === 'tool' && (
                                <div className="text-xs text-blue-300 mb-1 font-mono">🛠️ Tool Output</div>
                            )}
                            {message.role === 'agent' && (
                                <div className="text-xs text-purple-300 mb-1 font-mono">🤖 Agent Response</div>
                            )}
                            {message.content}
                            {message.type === 'transaction' && (
                                <div className="mt-2">
                                    <div className="animate-pulse bg-blue-600/50 h-1 rounded-full" />
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSubmit} className="p-4 border-t-2 border-purple-600/50">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        disabled={isLoading}
                        placeholder="Type your message..."
                        className="flex-1 p-2 rounded-md bg-gray-800 text-white border-2 border-purple-500/20 focus:outline-none focus:ring-2 focus:ring-purple-500/50 placeholder-gray-400"
                    />
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="px-4 py-2 rounded-md text-white bg-gradient-to-r from-gray-800 to-gray-900 hover:from-gray-700 hover:to-gray-800 disabled:opacity-50 disabled:cursor-not-allowed relative group overflow-hidden"
                    >
                        <span className="relative z-10">
                            {isLoading ? 'Sending...' : 'Send'}
                        </span>
                        <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-purple-800/20 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
                        <div className="absolute inset-0 border-2 border-purple-600 rounded-md animate-pulse-border" />
                    </button>
                </div>
            </form>
        </div>
    );
} 