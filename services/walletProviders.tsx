import type { FC, ReactNode } from 'react';
import { TonConnectUIProvider } from '@tonconnect/ui-react';
import {
    ConnectionProvider,
    WalletProvider,
} from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';
import { SOL_RPC_ENDPOINT } from '../constants';

// Import Solana wallet adapter default styles
import '@solana/wallet-adapter-react-ui/styles.css';

const solanaWallets = [new PhantomWalletAdapter()];

interface Props {
    children: ReactNode;
}

const WalletProviders: FC<Props> = ({ children }) => {
    return (
        <TonConnectUIProvider manifestUrl="/tonconnect-manifest.json">
            <ConnectionProvider endpoint={SOL_RPC_ENDPOINT}>
                <WalletProvider wallets={solanaWallets} autoConnect={false}>
                    <WalletModalProvider>
                        {children}
                    </WalletModalProvider>
                </WalletProvider>
            </ConnectionProvider>
        </TonConnectUIProvider>
    );
};

export default WalletProviders;
