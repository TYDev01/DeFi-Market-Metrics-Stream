import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { mainnet, Chain } from 'wagmi/chains';

// Define Somnia Dream testnet
export const somniaDream = {
  id: 50312,
  name: 'Somnia Dream',
  nativeCurrency: {
    decimals: 18,
    name: 'STT',
    symbol: 'STT',
  },
  rpcUrls: {
    default: { http: ['https://dream-rpc.somnia.network'] },
    public: { http: ['https://dream-rpc.somnia.network'] },
  },
  blockExplorers: {
    default: { name: 'Somnia Explorer', url: 'https://somnia.network' },
  },
  testnet: true,
} as const satisfies Chain;

export const config = getDefaultConfig({
  appName: 'DeFi Market Metrics',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID',
  chains: [somniaDream, mainnet],
  ssr: true,
});
