
import { useState, useMemo, useEffect } from 'react';
import type { FC } from 'react';
import { TonConnectButton, useTonConnectUI, useTonAddress } from '@tonconnect/ui-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Participant, WalletChain } from '../types';
import { REGISTRATION_FEE_USDT } from '../constants';
import { sendTonUSDT, sendSolanaUSDT } from '../services/paymentService';
import { useToast } from '../contexts/ToastContext';
import { errorHandler } from '../services/errorHandler';
import { TonLogo, SolanaLogo } from './Icons';
import { storageService } from '../services/storageService';
import { apiService } from '../services/apiService';

interface RegistrationProps {
    onStart: (participants: Participant[]) => void;
    onOpenLogin?: () => void;
}

const Registration: FC<RegistrationProps> = ({ onStart, onOpenLogin }) => {
    const [selectedChain, setSelectedChain] = useState<WalletChain | null>(null);
    const [username, setUsername] = useState('');

    // Initialize from local storage (Private Roster)
    const [participants, setParticipants] = useState<Participant[]>(() =>
        storageService.loadParticipants()
    );

    type TxStatus = 'IDLE' | 'AWAITING_WALLET_APPROVAL' | 'CONFIRMING_TX' | 'REGISTERING_WITH_SERVER' | 'SUCCESS';
    const [txStatus, setTxStatus] = useState<TxStatus>('IDLE');

    const { showToast } = useToast();

    // Persist to local storage (Private Roster)
    useEffect(() => {
        storageService.saveParticipants(participants);
    }, [participants]);

    // TON hooks
    const [tonConnectUI] = useTonConnectUI();
    const tonAddress = useTonAddress(true);

    // Solana hooks
    const solWallet = useWallet();
    const { connection: solConnection } = useConnection();

    const walletAddress = useMemo(() => {
        if (selectedChain === 'TON') return tonAddress || '';
        if (selectedChain === 'SOL') return solWallet.publicKey?.toBase58() || '';
        return '';
    }, [selectedChain, tonAddress, solWallet.publicKey]);

    const isWalletConnected = walletAddress.length > 0;

    const canRegister = username.trim().length > 0 && isWalletConnected && (txStatus === 'IDLE' || txStatus === 'SUCCESS');

    const handlePayAndRegister = async () => {
        // Strict Race Condition Guard
        if (!canRegister || !selectedChain || txStatus !== 'IDLE' && txStatus !== 'SUCCESS') return;

        // Validation Checks
        const walletParticipants = participants.filter(p => p.walletAddress === walletAddress);
        if (walletParticipants.length >= 8) {
            showToast('Maximum of 8 players allowed per wallet.', 'error');
            return;
        }

        const trimmedUsername = username.trim();
        if (participants.some(p => p.username.toLowerCase() === trimmedUsername.toLowerCase())) {
            showToast('Username already taken. Please choose another.', 'error');
            return;
        }

        setTxStatus('AWAITING_WALLET_APPROVAL');

        try {
            let txHash: string;
            // Use username as the transaction comment/memo
            const comment = `Player: ${trimmedUsername}`;

            if (selectedChain === 'TON') {
                txHash = await sendTonUSDT(tonConnectUI, REGISTRATION_FEE_USDT, comment);
                // TON extension returns immediately on approval, latency happens on backend verification
                setTxStatus('REGISTERING_WITH_SERVER');
            } else {
                txHash = await sendSolanaUSDT(
                    solConnection,
                    solWallet,
                    REGISTRATION_FEE_USDT,
                    comment,
                    (status) => setTxStatus(status)
                );
                // Solana's wait finishes when the finality is 'confirmed'
                setTxStatus('REGISTERING_WITH_SERVER');
            }

            const newParticipant: Participant = {
                username: trimmedUsername,
                walletAddress,
                chain: selectedChain,
                paymentTxHash: txHash,
            };

            // Register with backend to ensure global visibility
            await apiService.registerParticipant(newParticipant);

            // Update local private roster
            setParticipants(prev => [...prev, newParticipant]);

            setUsername('');
            setTxStatus('SUCCESS');
            showToast('Registration complete! Sector access granted.', 'success');
        } catch (err: unknown) {
            setTxStatus('IDLE');
            errorHandler(err, (msg, type) => showToast(msg, type));
        }
    };

    const truncateAddress = (addr: string) => {
        if (addr.length <= 12) return addr;
        return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
    };

    const handleEnterArena = () => {
        onStart(participants);
    };



    return (
        <div className="relative flex flex-col items-center justify-center h-full w-full p-8 max-w-5xl mx-auto">
            <div className="w-full bg-black/80 border border-white/10 p-8 rounded-lg shadow-panel backdrop-blur-xl relative overflow-hidden">

                {/* Decorative elements */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary/10 rounded-full blur-[80px] pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-[80px] pointer-events-none"></div>

                <h1 className="text-4xl md:text-5xl font-display font-bold text-center mb-2 tracking-tight text-white drop-shadow-[0_2px_10px_rgba(255,255,255,0.1)]">
                    PLAYER REGISTRATION
                </h1>
                <p className="text-center text-gray-500 text-sm font-sans mb-8">
                    Entry Fee: <span className="text-emerald-400 font-semibold">{REGISTRATION_FEE_USDT} USDT</span> per player
                </p>

                <div className="flex flex-col lg:flex-row gap-8">
                    {/* Form Section */}
                    <div className="flex-1 space-y-6">

                        {/* Chain Selector */}
                        <div className="space-y-2">
                            <label className="text-gray-400 font-sans font-semibold text-xs tracking-widest uppercase">Select Blockchain</label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => setSelectedChain('TON')}
                                    className={`relative p-4 rounded border-2 transition-all duration-300 font-bold uppercase tracking-wider text-sm ${selectedChain === 'TON'
                                        ? 'border-[#0098EA] bg-[#0098EA]/15 text-[#0098EA] shadow-[0_0_20px_rgba(0,152,234,0.3)]'
                                        : 'border-gray-700 bg-black/30 text-gray-400 hover:border-gray-500 hover:bg-black/50'
                                        }`}
                                >
                                    <div className="flex flex-col items-center gap-2">
                                        <TonLogo width="32" height="32" className="text-current" />
                                        <span>TON</span>
                                    </div>
                                    {selectedChain === 'TON' && (
                                        <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#0098EA] animate-pulse" />
                                    )}
                                </button>
                                <button
                                    onClick={() => setSelectedChain('SOL')}
                                    className={`relative p-4 rounded border-2 transition-all duration-300 font-bold uppercase tracking-wider text-sm ${selectedChain === 'SOL'
                                        ? 'border-[#9945FF] bg-[#9945FF]/15 text-[#9945FF] shadow-[0_0_20px_rgba(153,69,255,0.3)]'
                                        : 'border-gray-700 bg-black/30 text-gray-400 hover:border-gray-500 hover:bg-black/50'
                                        }`}
                                >
                                    <div className="flex flex-col items-center gap-2">
                                        <SolanaLogo width="32" height="32" className="text-current" />
                                        <span>Solana</span>
                                    </div>
                                    {selectedChain === 'SOL' && (
                                        <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#9945FF] animate-pulse" />
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Wallet Connection */}
                        {selectedChain && (
                            <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <label className="text-gray-400 font-sans font-semibold text-xs tracking-widest uppercase">Connect Wallet</label>
                                <div className="flex items-center gap-3 p-3 bg-cyber-panel/50 border border-white/10 rounded-lg">
                                    {selectedChain === 'TON' ? (
                                        <TonConnectButton />
                                    ) : (
                                        <WalletMultiButton />
                                    )}
                                    {isWalletConnected && (
                                        <span className="text-emerald-400 text-xs font-mono flex items-center gap-1.5 ml-auto pr-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
                                            {truncateAddress(walletAddress)}
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Username */}
                        {selectedChain && (
                            <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <label className="text-gray-400 font-sans font-semibold text-xs tracking-widest uppercase">Username</label>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handlePayAndRegister()}
                                    className="w-full bg-cyber-panel/50 border border-white/10 text-white p-4 rounded-lg focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none transition-all font-sans placeholder-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                    placeholder="Enter your codename"
                                    disabled={txStatus !== 'IDLE' && txStatus !== 'SUCCESS'}
                                />
                            </div>
                        )}


                        {/* Pay & Register Button */}
                        {selectedChain && (
                            <button
                                onClick={handlePayAndRegister}
                                disabled={!canRegister}
                                className={`w-full py-4 font-sans font-bold text-sm uppercase tracking-wider rounded-lg transition-all relative overflow-hidden flex items-center justify-center gap-3 ${canRegister
                                    ? 'bg-white text-black hover:bg-gray-200 hover:scale-[1.02] shadow-[0_0_20px_rgba(255,255,255,0.1)] cursor-pointer'
                                    : 'bg-white/5 border border-white/10 text-gray-500 cursor-not-allowed'
                                    }`}
                            >
                                {txStatus !== 'IDLE' && txStatus !== 'SUCCESS' && (
                                    <svg className="animate-spin h-5 w-5 text-current" viewBox="0 0 24 24" fill="none">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                )}
                                <span>
                                    {txStatus === 'IDLE' || txStatus === 'SUCCESS' ? `Pay ${REGISTRATION_FEE_USDT} USDT & Register` :
                                        txStatus === 'AWAITING_WALLET_APPROVAL' ? 'Awaiting Wallet Signature…' :
                                            txStatus === 'CONFIRMING_TX' ? 'Confirming on Blockchain…' :
                                                'Verifying via Server Protocol…'}
                                </span>
                            </button>
                        )}
                    </div>

                    {/* Roster Section */}
                    <div className="flex-1 bg-cyber-panel/40 border border-white/10 rounded-lg p-5 flex flex-col h-[450px]">
                        <h3 className="text-gray-400 font-sans font-semibold text-xs uppercase tracking-widest mb-4 flex justify-between border-b border-white/10 pb-2">
                            <span>Roster</span>
                            <span>{participants.filter(p => p.walletAddress === walletAddress).length} / 8 Slots</span>
                        </h3>

                        <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-hide">
                            {participants.length === 0 && (
                                <div className="text-gray-600 text-center mt-20 italic">No participants registered.</div>
                            )}
                            {participants.map((p, i) => (
                                <div key={i} className="flex justify-between items-center bg-white/5 border-l-4 border-brand-primary p-4 rounded-r-lg animate-in fade-in group hover:bg-white/10 transition-colors">
                                    <div className="overflow-hidden flex-1">
                                        <div className="flex items-center gap-3">
                                            <span className="font-semibold font-sans text-white truncate text-lg">{p.username}</span>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-sans font-bold uppercase tracking-wider ${p.chain === 'TON'
                                                ? 'bg-[#0098EA]/20 text-[#0098EA]'
                                                : 'bg-[#9945FF]/20 text-[#9945FF]'
                                                }`}>
                                                {p.chain}
                                            </span>
                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-sans font-bold uppercase tracking-wider">
                                                Paid
                                            </span>
                                        </div>
                                        <div className="text-xs text-gray-400 font-mono truncate max-w-[220px] mt-1 opacity-70">
                                            {truncateAddress(p.walletAddress)}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="mt-8 flex justify-center">
                    <button
                        onClick={handleEnterArena}
                        disabled={participants.length === 0}
                        className={`px-12 py-4 font-sans font-bold text-lg rounded-lg transition-all duration-300 ${participants.length > 0
                            ? 'bg-brand-primary text-white hover:bg-brand-primary/90 hover:scale-[1.02] shadow-[0_4px_20px_rgba(249,115,22,0.4)]'
                            : 'bg-white/5 border border-white/10 text-gray-500 cursor-not-allowed'
                            }`}
                    >
                        Enter Arena
                    </button>
                </div>

                {onOpenLogin && (
                    <div className="mt-8 text-center flex items-center justify-center gap-4">
                        <span className="text-gray-400 font-sans text-sm">
                            Already registered?
                        </span>
                        <button
                            onClick={onOpenLogin}
                            className="text-white hover:text-brand-primary font-sans font-semibold text-sm transition-colors decoration-brand-primary hover:underline underline-offset-4"
                        >
                            Login To Arena
                        </button>
                    </div>
                )}

            </div>
        </div>
    );
};

export default Registration;
