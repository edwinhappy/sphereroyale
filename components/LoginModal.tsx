import { FC, useState, useEffect, useRef } from 'react';
import { storageService } from '../services/storageService';
import { Participant } from '../types';
import { apiService } from '../services/apiService';

interface LoginModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLogin: (username: string, isAdmin: boolean, token?: string) => void;
    onSignup: () => void;
}

const LoginModal: FC<LoginModalProps> = ({ isOpen, onClose, onLogin, onSignup }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isAdminLogin, setIsAdminLogin] = useState(false);
    const [recentPlayers, setRecentPlayers] = useState<Participant[]>([]);
    const modalRef = useRef<HTMLDivElement>(null);
    const [isAuthenticating, setIsAuthenticating] = useState(false);

    useEffect(() => {
        const handleOutsideClick = (event: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleOutsideClick);
            // Load recent players
            setRecentPlayers(storageService.loadParticipants());
        }

        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
        };
    }, [isOpen, onClose]);

    // Check if username matches admin
    useEffect(() => {
        // We still use a string match to switch UI to password mode.
        // The actual validation is done on the backend.
        if (username.toLowerCase() === 'admin' || username.toLowerCase() === 'administrator') {
            setIsAdminLogin(true);
        } else {
            setIsAdminLogin(false);
            setPassword('');
        }
    }, [username]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (isAdminLogin) {
            setIsAuthenticating(true);
            try {
                const token = await apiService.adminLogin(password);
                onLogin(username, true, token);
                onClose();
            } catch (error: any) {
                alert(error.message || "Invalid Admin Password");
            } finally {
                setIsAuthenticating(false);
            }
            return;
        }

        if (username.trim()) {
            onLogin(username, false);
            onClose();
        }
    };

    const handleQuickLogin = (name: string) => {
        setUsername(name);
        // onLogin(name, false);
        // onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
            <div
                ref={modalRef}
                className="w-full max-w-xl bg-black/90 border border-white/10 rounded-2xl p-10 shadow-panel relative overflow-hidden transform scale-100 transition-all max-h-[90vh] overflow-y-auto scrollbar-hide"
            >
                {/* Decorative corner accents */}
                <div className="absolute top-0 left-0 w-8 h-8 border-t border-l border-white/20 rounded-tl-2xl"></div>
                <div className="absolute top-0 right-0 w-8 h-8 border-t border-r border-white/20 rounded-tr-2xl"></div>
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b border-l border-white/20 rounded-bl-2xl"></div>
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b border-r border-white/20 rounded-br-2xl"></div>

                <div className="text-center mb-10">
                    <h2 className="text-4xl font-display font-bold tracking-tight text-white mb-3">
                        TRACK <span className="text-brand-primary">SPHERE</span>
                    </h2>
                    <p className="text-gray-400 font-sans text-sm">Enter your username to highlight your sphere in the arena.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-3">
                        <label htmlFor="username" className="block text-xs font-sans font-semibold text-gray-400 uppercase tracking-widest pl-1">
                            Username / ID
                        </label>
                        <input
                            type="text"
                            id="username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full bg-cyber-panel/50 border border-white/10 rounded-xl px-6 py-4 text-lg text-white focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary transition-all font-sans placeholder-gray-600 shadow-inner"
                            placeholder="e.g. Unit-734"
                            autoFocus
                        />
                    </div>

                    {/* Quick Login Chips */}
                    {recentPlayers.length > 0 && !isAdminLogin && (
                        <div className="animate-in fade-in slide-in-from-bottom-2">
                            <label className="block text-[10px] font-sans font-bold text-gray-500 uppercase tracking-widest pl-1 mb-3">
                                Recent Players
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {recentPlayers.map((p, i) => (
                                    <button
                                        key={i}
                                        type="button"
                                        onClick={() => handleQuickLogin(p.username)}
                                        className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 font-sans font-medium hover:bg-white/10 hover:text-white hover:border-white/20 transition-all"
                                    >
                                        {p.username}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {isAdminLogin && (
                        <div className="space-y-3 animate-in slide-in-from-top-2 fade-in duration-300">
                            <label htmlFor="password" className="block text-xs font-sans font-semibold text-rose-500 uppercase tracking-widest pl-1">
                                Admin Password
                            </label>
                            <input
                                type="password"
                                id="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-cyber-panel/50 border border-rose-500/50 rounded-xl px-6 py-4 text-lg text-white focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500 transition-all font-sans placeholder-gray-600 shadow-inner"
                                placeholder="Enter Password"
                            />
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isAuthenticating}
                        className={`w-full ${isAdminLogin ? 'bg-rose-600 hover:bg-rose-500' : 'bg-brand-primary hover:bg-brand-primary/90'} text-white font-sans font-bold text-lg py-4 rounded-xl transition-all hover:scale-[1.02] uppercase tracking-wide shadow-[0_4px_14px_rgba(249,115,22,0.3)] mt-2 disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                        {isAuthenticating ? 'PROCESSING...' : (isAdminLogin ? 'AUTHENTICATE' : 'START TRACKING')}
                    </button>

                    <div className="flex items-center justify-center gap-3 pt-6 border-t border-white/10">
                        <span className="text-gray-400 font-sans text-sm">Not a player yet?</span>
                        <button
                            type="button"
                            onClick={onSignup}
                            className="text-white hover:text-brand-primary transition-colors font-sans font-semibold text-sm decoration-brand-primary hover:underline underline-offset-4"
                        >
                            Sign Up
                        </button>
                    </div>
                </form>

                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
        </div>
    );
};

export default LoginModal;
