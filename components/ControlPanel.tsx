import { useRef, useEffect } from 'react';
import type { FC } from 'react';
import { GameStatus, LogEntry, Sphere } from '../types';

interface ControlPanelProps {
    gameStatus: GameStatus;
    startGame: () => void;
    resetGame: () => void;
    logs: LogEntry[];
    spheres: Sphere[];
    isAdmin: boolean;
}

const ControlPanel: FC<ControlPanelProps> = ({
    gameStatus,
    startGame,
    resetGame,
    logs,
    spheres,
    isAdmin
}) => {
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll logs
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);

    const aliveCount = spheres.filter(s => !s.isEliminated).length;
    const eliminatedCount = spheres.length - aliveCount;

    return (
        <div className="w-full lg:w-[450px] flex flex-col gap-6 p-6 bg-[#07080a] border-l border-white/10 h-full overflow-hidden shadow-2xl relative z-20">
            {/* Header Section */}
            <div className="relative">
                <div className="absolute -left-6 top-0 bottom-0 w-1 bg-gradient-to-b from-brand-primary to-transparent opacity-50"></div>
                <h1 className="text-4xl font-display font-bold tracking-tight text-white mb-1">
                    SPHERE<span className="text-brand-primary">ROYALE</span>
                </h1>
                <div className="flex items-center gap-2 mt-2">
                    <div className={`w-2 h-2 rounded-full ${gameStatus === GameStatus.PLAYING ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`}></div>
                    <p className="text-xs font-sans font-semibold text-gray-400 tracking-widest uppercase">
                        Physics Engine v2.0
                    </p>
                </div>
            </div>

            {/* Stats HUD */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/5 border border-white/10 p-5 rounded-xl relative overflow-hidden group shadow-inner">
                    <div className="absolute top-0 right-0 p-3">
                        <div className="w-2 h-2 bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.8)]"></div>
                    </div>
                    <span className="text-gray-400 text-[10px] font-sans font-semibold uppercase tracking-widest">Active Units</span>
                    <div className="text-4xl font-display font-bold text-white mt-1">
                        {String(aliveCount).padStart(2, '0')}
                    </div>
                </div>

                <div className="bg-white/5 border border-white/10 p-5 rounded-xl relative overflow-hidden shadow-inner">
                    <div className="absolute top-0 right-0 p-3">
                        <div className="w-2 h-2 bg-rose-500 rounded-full shadow-[0_0_8px_rgba(244,63,94,0.8)]"></div>
                    </div>
                    <span className="text-gray-400 text-[10px] font-sans font-semibold uppercase tracking-widest">Casualties</span>
                    <div className="text-4xl font-display font-bold text-white mt-1">
                        {String(eliminatedCount).padStart(2, '0')}
                    </div>
                </div>
            </div>

            {/* Controls */}
            {isAdmin && (
                <div className="flex gap-4">
                    {gameStatus === GameStatus.IDLE || gameStatus === GameStatus.FINISHED ? (
                        <button
                            onClick={startGame}
                            className="flex-1 bg-brand-primary text-white font-sans font-bold py-4 px-6 rounded-xl uppercase tracking-wide hover:bg-brand-primary/90 hover:scale-[1.02] transition-all shadow-[0_4px_14px_rgba(249,115,22,0.3)]"
                        >
                            {gameStatus === GameStatus.IDLE ? 'Initialize' : 'Re-Deploy'}
                        </button>
                    ) : (
                        <button
                            disabled
                            className="flex-1 bg-white/5 border border-white/10 text-gray-400 font-sans font-bold py-4 px-6 rounded-xl uppercase tracking-wide cursor-not-allowed flex items-center justify-center gap-3 transition-colors"
                        >
                            {gameStatus === GameStatus.GENERATING ? (
                                <>
                                    <span className="block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                                    <span>Processing</span>
                                </>
                            ) : (
                                <>
                                    <span className="block w-2 h-2 bg-rose-500 rounded-full animate-ping"></span>
                                    <span>Combat Active</span>
                                </>
                            )}
                        </button>
                    )}
                    <button
                        onClick={resetGame}
                        className="px-6 bg-rose-500/10 border border-rose-500/30 text-rose-500 hover:bg-rose-500 hover:text-white rounded-xl font-sans font-bold uppercase transition-all hover:scale-[1.02]"
                    >
                        Abort
                    </button>
                </div>
            )}

            {!isAdmin && (
                <div className="p-4 bg-white/5 border border-white/10 rounded-xl text-center text-gray-400 font-sans font-semibold text-xs uppercase tracking-widest">
                    Spectator Mode Active
                </div>
            )}

            {/* Battle Log Terminal */}
            <div className="flex-1 bg-black/60 border border-white/10 rounded-xl relative flex flex-col overflow-hidden backdrop-blur-xl shadow-inner">
                {/* Terminal Header */}
                <div className="bg-white/5 p-3 border-b border-white/10 flex justify-between items-center">
                    <span className="text-[10px] font-sans font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                        <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>
                        Battle_Log_Stream
                    </span>
                    <div className="flex gap-1.5">
                        <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
                        <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
                        <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
                    </div>
                </div>

                {/* Log Content */}
                <div
                    ref={scrollRef}
                    className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-xs relative"
                >
                    {/* Scanline Effect */}
                    <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,6px_100%] z-0 opacity-20"></div>

                    {logs.length === 0 && (
                        <div className="text-gray-600 italic text-center mt-20 opacity-50">
                            &gt; WAITING FOR INPUT...
                        </div>
                    )}

                    {logs.map((log) => (
                        <div key={log.id} className={`relative z-10 pl-3 border-l-2 transition-all duration-300 animate-fade-in ${log.type === 'win' ? 'border-amber-400 text-amber-200 bg-amber-400/10 p-2 rounded-r' :
                            log.type === 'elimination' ? 'border-rose-500 text-rose-400' :
                                log.type === 'combat' ? 'border-orange-500 text-orange-200' :
                                    'border-gray-500 text-gray-300'
                            }`}>
                            <span className="text-[9px] opacity-50 block mb-0.5 font-sans tracking-widest">
                                [{new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}]
                            </span>
                            <span className="leading-relaxed">
                                {log.text.toUpperCase()}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="text-[10px] text-gray-500 font-sans font-medium text-center tracking-widest uppercase">
                System Ready • Waiting for Deployment
            </div>
        </div>
    );
};

export default ControlPanel;