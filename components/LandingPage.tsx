import { type FC, useEffect, useRef, useState } from 'react';
import { TonLogo, SolanaLogo } from './Icons';



const fmt = (n: number) => String(n).padStart(2, '0');

interface LandingPageProps {
    onEnter: () => void;
    onOpenLogin: () => void;
    nextGameTime?: Date | null;
}

// ── Real brand logos (inline SVG) ──────────────────────────────────────────
// OKX: each letter O, K, X is drawn as a 3×3 dot-matrix of squares (official brand style)
const OKXLogo = () => {
    const sq = (x: number, y: number) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={9} height={9} rx={1.5} fill="white" />
    );
    // Grid coords for O (ring), K (left col + diagonals), X (diagonals)
    // Each letter occupies an 11px-wide column with 2px gap between letters
    // Viewbox: 0 0 120 40, letters start at y=4
    const O = [[4, 4], [14, 4], [24, 4], [4, 14], [24, 14], [4, 24], [14, 24], [24, 24]];
    // K: left col + top-right diagonal + bottom-right diagonal
    const K = [[38, 4], [38, 14], [38, 24], [48, 4], [43, 14], [48, 24]];
    // X: two diagonals
    const X = [[72, 4], [82, 4], [77, 14], [72, 24], [82, 24]];
    return (
        <svg viewBox="0 0 96 34" width="96" height="34" aria-label="OKX" xmlns="http://www.w3.org/2000/svg">
            <rect width="96" height="34" rx="6" fill="#000" />
            {[...O.map(([x, y]) => sq(x, y)), ...K.map(([x, y]) => sq(x, y)), ...X.map(([x, y]) => sq(x, y))]}
        </svg>
    );
};

// MoonPay: crescent moon circle + wordmark in brand violet #7D00FF
const MoonPayLogo = () => (
    <svg viewBox="0 0 200 50" width="180" height="45" aria-label="MoonPay" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="mpGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#7D00FF" />
                <stop offset="100%" stopColor="#4FCEE8" />
            </linearGradient>
        </defs>
        {/* Outer full circle */}
        <circle cx="25" cy="25" r="22" fill="url(#mpGrad)" />
        {/* Inner cutout circle offset to create crescent */}
        <circle cx="32" cy="20" r="17" fill="#0d0d0d" />
        {/* Wordmark */}
        <text x="55" y="33" fontFamily="'Inter','SF Pro Display',Arial,sans-serif" fontWeight="800" fontSize="22" fill="white" letterSpacing="-0.5">MoonPay</text>
    </svg>
);

const paymentCards = [
    {
        id: 'okx',
        label: 'BUY USDT ON OKX',
        subtext: 'Fast · Secure · Low fees',
        href: 'https://www.okx.com/buy-crypto',
        borderColor: 'border-white/20',
        glowColor: 'rgba(255,255,255,0.12)',
        textColor: 'text-white',
        subColor: 'text-gray-400',
        bg: 'from-zinc-800/60 to-black/70',
        Logo: OKXLogo,
    },
    {
        id: 'moonpay',
        label: 'BUY USDT WITH MOONPAY',
        subtext: 'Card · Bank · Apple Pay',
        href: 'https://www.moonpay.com/buy/usdt',
        borderColor: 'border-purple-400/30',
        glowColor: 'rgba(124,97,255,0.30)',
        textColor: 'text-white',
        subColor: 'text-purple-300',
        bg: 'from-purple-900/40 to-black/70',
        Logo: MoonPayLogo,
    },
];

const InstagramLogo = () => (
    <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="text-pink-500">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
    </svg>
);

const YouTubeLogo = () => (
    <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="text-red-500">
        <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"></path>
        <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" fill="currentColor"></polygon>
    </svg>
);




const LandingPage: FC<LandingPageProps> = ({ onEnter, onOpenLogin, nextGameTime }) => {
    const trackRef = useRef<HTMLDivElement>(null);

    const calculateSeconds = () => {
        const now = new Date();
        let target: Date;

        if (nextGameTime) {
            target = nextGameTime;
            return Math.max(0, Math.floor((target.getTime() - now.getTime()) / 1000));
        } else {
            return 0;
        }
    };

    const [secs, setSecs] = useState(calculateSeconds);
    const [openDropdown, setOpenDropdown] = useState<'socials' | 'menu' | null>(null);

    const toggleDropdown = (menu: 'socials' | 'menu') => {
        setOpenDropdown(curr => (curr === menu ? null : menu));
    };

    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (!target.closest('.dropdown-container')) {
                setOpenDropdown(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        setSecs(calculateSeconds());
        const id = setInterval(() => setSecs(calculateSeconds()), 1000);
        return () => clearInterval(id);
    }, [nextGameTime]);

    const hh = fmt(Math.floor(secs / 3600));
    const mm = fmt(Math.floor((secs % 3600) / 60));
    const ss = fmt(secs % 60);

    const handleMouseEnter = () => {
        if (trackRef.current) trackRef.current.style.animationPlayState = 'paused';
    };
    const handleMouseLeave = () => {
        if (trackRef.current) trackRef.current.style.animationPlayState = 'running';
    };

    return (
        <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden">
            {/* Ambient Background Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-cyber-cyan/5 rounded-full blur-[100px] animate-pulse-fast pointer-events-none"></div>

            {/* ── Countdown Timer (top-left) ── */}
            <div className="absolute top-6 left-6 z-20 p-8 rounded-lg border border-white/10 bg-black/80 backdrop-blur-xl shadow-panel">
                {secs > 0 && (
                    <p className="text-xs font-mono text-gray-400 tracking-widest uppercase mb-4 flex items-center gap-2">
                        <span>🔥</span> Countdown to Next Game
                    </p>
                )}
                <div className="flex items-center gap-3">
                    {secs > 0 ? (
                        <>
                            {/* Hours */}
                            <div className="flex flex-col items-center min-w-[90px]">
                                <span className="text-8xl font-display font-bold text-white tabular-nums leading-none tracking-tight">{hh}</span>
                                <span className="text-xs font-sans font-semibold text-gray-500 tracking-widest mt-3">HRS</span>
                            </div>
                            <span className="text-6xl font-light text-gray-600 mb-6 mx-2">:</span>
                            {/* Minutes */}
                            <div className="flex flex-col items-center min-w-[90px]">
                                <span className="text-8xl font-display font-bold text-white tabular-nums leading-none tracking-tight">{mm}</span>
                                <span className="text-xs font-sans font-semibold text-gray-500 tracking-widest mt-3">MIN</span>
                            </div>
                            <span className="text-6xl font-light text-gray-600 mb-6 mx-2">:</span>
                            {/* Seconds */}
                            <div className="flex flex-col items-center min-w-[90px]">
                                <span className="text-8xl font-display font-bold text-brand-primary tabular-nums leading-none tracking-tight">{ss}</span>
                                <span className="text-xs font-sans font-semibold text-gray-500 tracking-widest mt-3">SEC</span>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-start">
                            <span className="text-2xl md:text-3xl font-display font-bold text-white leading-tight tracking-wider">
                                Next Game To Be<br />
                                <span className="text-brand-primary">Scheduled Soon</span>
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Top-Right Navigation (Socials & Hamburger) ── */}
            <div className="absolute top-8 right-8 z-50 flex items-center gap-6 dropdown-container">
                {/* Socials Dropdown */}
                <div className="relative">
                    <button
                        onClick={() => toggleDropdown('socials')}
                        className={`group relative px-6 py-3 bg-black/80 border ${openDropdown === 'socials' ? 'border-brand-primary' : 'border-white/10'} rounded-lg backdrop-blur-xl overflow-hidden transition-all duration-300 hover:border-white/30`}
                    >
                        <div className="absolute inset-0 bg-white/5 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                        <span className="relative font-sans font-semibold text-sm tracking-wide text-gray-300 group-hover:text-white transition-colors">
                            Socials
                        </span>
                    </button>

                    {/* Dropdown Menu */}
                    {openDropdown === 'socials' && (
                        <div className="absolute top-full right-0 mt-3 w-48 flex flex-col gap-1 p-2 bg-black/90 border border-white/10 rounded-lg backdrop-blur-xl shadow-panel animate-in fade-in zoom-in-95 duration-200">
                            <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 p-3 rounded-lg hover:bg-white/5 transition-colors group/item">
                                <InstagramLogo />
                                <span className="font-mono text-sm text-gray-300 group-hover/item:text-white group-hover/item:tracking-wider transition-all">Instagram</span>
                            </a>
                            <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 p-3 rounded-lg hover:bg-white/5 transition-colors group/item">
                                <YouTubeLogo />
                                <span className="font-mono text-sm text-gray-300 group-hover/item:text-white group-hover/item:tracking-wider transition-all">YouTube</span>
                            </a>
                        </div>
                    )}
                </div>

                {/* Hamburger Menu */}
                <div className="relative">
                    <button
                        onClick={() => toggleDropdown('menu')}
                        className={`group relative p-4 bg-black/80 border ${openDropdown === 'menu' ? 'border-brand-primary' : 'border-white/10'} rounded-lg backdrop-blur-xl transition-all duration-300 hover:border-white/30`}
                    >
                        <div className="flex flex-col gap-1.5 w-6">
                            <span className={`w-full h-0.5 bg-gray-300 group-hover:bg-white transition-all duration-300 ${openDropdown === 'menu' ? 'rotate-45 translate-y-2' : ''}`} />
                            <span className={`w-full h-0.5 bg-gray-300 group-hover:bg-white transition-all duration-300 ${openDropdown === 'menu' ? 'opacity-0' : ''}`} />
                            <span className={`w-full h-0.5 bg-gray-300 group-hover:bg-white transition-all duration-300 ${openDropdown === 'menu' ? '-rotate-45 -translate-y-2' : ''}`} />
                        </div>
                    </button>

                    {/* Menu Dropdown */}
                    {openDropdown === 'menu' && (
                        <div className="absolute top-full right-0 mt-3 w-48 flex flex-col gap-1 p-2 bg-black/90 border border-white/10 rounded-lg backdrop-blur-xl shadow-panel animate-in fade-in zoom-in-95 duration-200">
                            <button
                                onClick={() => {
                                    toggleDropdown('menu'); // Close menu
                                    onOpenLogin();
                                }}
                                className="text-left px-4 py-2.5 rounded hover:bg-white/5 transition-colors font-sans font-medium text-sm text-gray-300 tracking-wide"
                            >
                                Login
                            </button>
                            <button className="text-left px-4 py-2.5 rounded hover:bg-white/5 transition-colors font-sans font-medium text-sm text-gray-300 tracking-wide">
                                Donate
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="z-10 flex flex-col items-center space-y-8 p-6 text-center mt-12">
                {/* Title Section */}
                <div className="space-y-4 relative">
                    <h1 className="text-6xl md:text-8xl font-display font-bold tracking-tight text-white drop-shadow-[0_4px_24px_rgba(255,255,255,0.1)]">
                        SPHERE<br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-primary to-rose-500">ROYALE</span>
                    </h1>
                    <div className="text-sm md:text-base font-sans font-medium tracking-widest text-gray-400 uppercase opacity-90">
                        PvP Physics Combat Protocol
                    </div>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl mt-16">
                    <div className="p-8 bg-cyber-panel/80 border border-white/5 rounded-lg backdrop-blur-xl transition-all duration-300 hover:border-white/10 relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="text-3xl mb-4">⚡</div>
                        <h3 className="text-white font-display font-semibold text-lg mb-2">High Velocity</h3>
                        <p className="text-gray-400 text-sm font-sans">Physics-based combat where momentum is your weapon.</p>
                    </div>
                    <div className="p-8 bg-cyber-panel/80 border border-white/5 rounded-lg backdrop-blur-xl transition-all duration-300 hover:border-white/10 relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="h-8 mb-4 flex items-center justify-center gap-4">
                            <SolanaLogo />
                            <TonLogo width="56" height="20" className="text-white" />
                        </div>
                        <h3 className="text-white font-display font-semibold text-lg mb-2">Multi-Chain</h3>
                        <p className="text-gray-400 text-sm font-sans">Seamless integration with Solana and TON networks.</p>
                    </div>
                    <div className="p-8 bg-cyber-panel/80 border border-white/5 rounded-lg backdrop-blur-xl transition-all duration-300 hover:border-white/10 relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="text-3xl mb-4">💀</div>
                        <h3 className="text-white font-display font-semibold text-lg mb-2">Last One Standing</h3>
                        <p className="text-gray-400 text-sm font-sans">Survive the shrinking arena and eliminations.</p>
                    </div>
                </div>

                {/* Call to Action */}
                <div className="mt-16 group relative inline-block">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-brand-primary to-rose-500 rounded-lg blur opacity-40 group-hover:opacity-100 transition duration-500"></div>
                    <button
                        onClick={onEnter}
                        className="relative px-10 py-5 bg-white rounded-lg flex items-center transition-all duration-300 text-black hover:scale-[1.02]"
                    >
                        <span className="font-sans font-bold text-lg tracking-wide pl-2 pr-6">Enter Arena</span>
                        <span className="pl-6 border-l border-black/20 text-black font-medium text-xl">→</span>
                    </button>
                </div>
            </div>

            {/* ── Payment Card Slideshow ── */}
            <div className="absolute bottom-0 left-0 w-full z-20 pb-5">
                <div
                    className="relative overflow-hidden"
                    style={{ perspective: '1000px', perspectiveOrigin: '50% 50%' }}
                >
                    {/* Edge fades */}
                    <div className="pointer-events-none absolute left-0 top-0 h-full w-40 bg-gradient-to-r from-black to-transparent z-10" />
                    <div className="pointer-events-none absolute right-0 top-0 h-full w-40 bg-gradient-to-l from-black to-transparent z-10" />

                    {/* Marquee track — 2 identical copies, CSS moves it */}
                    <div
                        ref={trackRef}
                        className="flex gap-6 py-4 w-max"
                        style={{ animation: 'marquee 18s linear infinite' }}
                        onMouseEnter={handleMouseEnter}
                        onMouseLeave={handleMouseLeave}
                    >
                        {Array.from({ length: 8 }, (_, si) =>
                            paymentCards.map((card, ci) => (
                                <a
                                    key={`${si}-${ci}`}
                                    href={card.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`flex items-center gap-6 px-12 py-8 rounded-2xl border bg-cyber-panel/60 ${card.borderColor} backdrop-blur-xl cursor-pointer select-none hover:bg-white/5 hover:border-white/20 transition-all duration-300`}
                                    style={{
                                        minWidth: '400px',
                                    }}
                                >
                                    <div className="scale-90 opacity-90 grayscale group-hover:grayscale-0 transition-all"><card.Logo /></div>
                                    <div className="text-left border-l border-white/10 pl-6 ml-2">
                                        <div className={`font-sans font-semibold text-sm tracking-wide ${card.textColor}`}>
                                            {card.label}
                                        </div>
                                        <div className={`text-xs font-sans mt-0.5 ${card.subColor}`}>{card.subtext}</div>
                                    </div>
                                    <span className={`ml-auto text-xl ${card.textColor} opacity-40 group-hover:opacity-100 transition-opacity`}>↗</span>
                                </a>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Keyframes: move exactly 1/8 of track (= 1 set of cards) for seamless loop */}
            <style>{`
                @keyframes marquee {
                    0%   { transform: translateX(0); }
                    100% { transform: translateX(-12.5%); }
                }
            `}</style>
            {/* Decor lines */}
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
            <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
        </div>
    );
};

export default LandingPage;
