"use client";

import { useState } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';

interface AddPairModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddPairModal({ isOpen, onClose, onSuccess }: AddPairModalProps) {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  
  const [baseToken, setBaseToken] = useState('');
  const [quoteToken, setQuoteToken] = useState('');
  const [feedAddress, setFeedAddress] = useState('');
  const [network, setNetwork] = useState<'somnia' | 'ethereum'>('ethereum');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [remainingPairs, setRemainingPairs] = useState<number | null>(null);

  // Fetch remaining pairs when connected
  useState(() => {
    if (isConnected && address) {
      fetch(`/api/pairs?address=${address}`)
        .then(res => res.json())
        .then(data => setRemainingPairs(data.remainingToday))
        .catch(console.error);
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!isConnected || !address) {
      setError('Please connect your wallet first');
      return;
    }

    if (!baseToken || !quoteToken || !feedAddress) {
      setError('Please fill in all fields');
      return;
    }

    // Validate feed address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(feedAddress)) {
      setError('Invalid Chainlink feed address format');
      return;
    }

    setIsSubmitting(true);

    try {
      // Create message to sign
      const message = `Add pair ${baseToken}/${quoteToken} at ${new Date().toISOString()}`;
      
      // Sign message
      const signature = await signMessageAsync({ message });

      // Submit to API
      const response = await fetch('/api/pairs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: address,
          baseToken: baseToken.toUpperCase(),
          quoteToken: quoteToken.toUpperCase(),
          feed: feedAddress,
          network,
          signature,
          message,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add pair');
      }

      setSuccess(data.message);
      setBaseToken('');
      setQuoteToken('');
      setFeedAddress('');
      
      // Update remaining pairs
      if (remainingPairs !== null) {
        setRemainingPairs(remainingPairs - 1);
      }

      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to add pair');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-2xl mx-4">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold text-white">Add Custom Pair</h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition"
            >
              ✕
            </button>
          </div>

          {!isConnected ? (
            <div className="text-center py-8">
              <p className="text-slate-300 mb-4">Connect your wallet to add custom pairs</p>
              <ConnectButton />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="bg-somnia-primary/10 border border-somnia-primary/30 rounded-lg p-4 mb-4">
                <p className="text-sm text-slate-300">
                  <span className="font-semibold text-somnia-primary">Wallet:</span> {address?.slice(0, 6)}...{address?.slice(-4)}
                </p>
                {remainingPairs !== null && (
                  <p className="text-sm text-slate-300 mt-2">
                    <span className="font-semibold text-somnia-primary">Remaining today:</span> {remainingPairs} / 2 pairs
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Base Token Symbol
                </label>
                <input
                  type="text"
                  value={baseToken}
                  onChange={(e) => setBaseToken(e.target.value.toUpperCase())}
                  placeholder="e.g., BTC"
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-somnia-primary"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Quote Token Symbol
                </label>
                <input
                  type="text"
                  value={quoteToken}
                  onChange={(e) => setQuoteToken(e.target.value.toUpperCase())}
                  placeholder="e.g., USD"
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-somnia-primary"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Chainlink Feed Address
                </label>
                <input
                  type="text"
                  value={feedAddress}
                  onChange={(e) => setFeedAddress(e.target.value)}
                  placeholder="0x..."
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-somnia-primary font-mono text-sm"
                  required
                />
                <p className="text-xs text-slate-400 mt-1">
                  Find Chainlink price feeds at{' '}
                  <a
                    href="https://docs.chain.link/data-feeds/price-feeds/addresses"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-somnia-primary hover:underline"
                  >
                    docs.chain.link
                  </a>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Network
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setNetwork('ethereum')}
                    className={`px-4 py-3 rounded-lg border-2 transition ${
                      network === 'ethereum'
                        ? 'border-somnia-primary bg-somnia-primary/20 text-white'
                        : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    Ethereum Mainnet
                  </button>
                  <button
                    type="button"
                    onClick={() => setNetwork('somnia')}
                    className={`px-4 py-3 rounded-lg border-2 transition ${
                      network === 'somnia'
                        ? 'border-somnia-primary bg-somnia-primary/20 text-white'
                        : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    Somnia Dream
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              )}

              {success && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                  <p className="text-sm text-green-300">{success}</p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button
                  type="submit"
                  disabled={isSubmitting || (remainingPairs !== null && remainingPairs <= 0)}
                  className="flex-1"
                >
                  {isSubmitting ? 'Adding Pair...' : 'Add Pair'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
