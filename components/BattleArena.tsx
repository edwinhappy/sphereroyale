
import { useEffect, useRef, useCallback } from 'react';
import type { FC, Dispatch, SetStateAction } from 'react';
import { Sphere, Particle, GameStatus } from '../types';
import { ARENA_WIDTH, ARENA_HEIGHT } from '../constants';
import { useSocket } from '../contexts/SocketContext';
import { generateSpeech } from '../services/localService';
import { Address } from '@ton/core';

const formatWalletAddress = (address: string): string => {
    try {
        if (address.includes(':')) {
            // TON Raw address format, convert to standard user-friendly base64 format (non-bounceable)
            return Address.parse(address).toString({ bounceable: false });
        }
    } catch {
        // Fallback to original if parsing fails
    }
    return address;
};

interface BattleArenaProps {
    spheres: Sphere[];
    setSpheres: Dispatch<SetStateAction<Sphere[]>>;
    gameStatus: GameStatus;
    setGameStatus: (status: GameStatus) => void;
    onLog: (text: string, type: 'info' | 'combat' | 'elimination' | 'win') => void;
    activeUser?: string | null;
    nextGameTime?: Date | null;
}

const BattleArena: FC<BattleArenaProps> = ({
    spheres,
    setSpheres,
    gameStatus,
    setGameStatus,
    onLog,
    activeUser,
    nextGameTime
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const particlesRef = useRef<Particle[]>([]);
    const requestRef = useRef<number>(0);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const physicsSpheresRef = useRef<Sphere[]>([]);



    // Speech Queue Refs
    const speechQueueRef = useRef<string[]>([]);
    const isSpeakingRef = useRef<boolean>(false);

    useEffect(() => {
        if (!audioCtxRef.current) {
            audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }

        // Global click listener to resume AudioContext
        const resumeAudio = () => {
            if (audioCtxRef.current?.state === 'suspended') {
                audioCtxRef.current.resume();
            }
        };
        document.addEventListener('click', resumeAudio);
        return () => document.removeEventListener('click', resumeAudio);
    }, []);

    const playCollisionSound = useCallback((intensity: number) => {
        if (!audioCtxRef.current) return;
        const ctx = audioCtxRef.current;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle'; // rougher sound
        osc.frequency.setValueAtTime(50 + Math.random() * 100, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(10, ctx.currentTime + 0.15);

        const vol = Math.min(intensity * 0.05, 0.4);
        gain.gain.setValueAtTime(vol, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
    }, []);

    const processSpeechQueue = useCallback(async () => {
        if (isSpeakingRef.current || speechQueueRef.current.length === 0) return;

        isSpeakingRef.current = true;
        const text = speechQueueRef.current.shift();

        if (text) {
            try {
                // generateSpeech now handles actual browser TTS internally and returns a promise that resolves when done
                await generateSpeech(text);
            } catch (err) {
                console.error("Voice error", err);
            }
        }

        isSpeakingRef.current = false;
        // Trigger next item in queue
        if (speechQueueRef.current.length > 0) {
            processSpeechQueue();
        }
    }, []);

    const speak = useCallback((text: string) => {
        speechQueueRef.current.push(text);
        processSpeechQueue();
    }, [processSpeechQueue]);

    const spawnParticles = (x: number, y: number, color: string, count: number) => {
        for (let i = 0; i < count; i++) {
            particlesRef.current.push({
                x,
                y,
                vx: (Math.random() - 0.5) * 12,
                vy: (Math.random() - 0.5) * 12,
                life: 1.0,
                maxLife: 1.0,
                color,
                size: Math.random() * 4 + 1
            });
        }
    };

    const { socket } = useSocket();

    useEffect(() => {
        if (!socket) return;

        const handleEvent = (ev: any) => {
            if (ev.type === 'collision') {
                playCollisionSound(ev.force);
                spawnParticles(ev.location.x, ev.location.y, '#ffffff', 5);
            } else if (ev.type === 'eliminated') {
                onLog(`[ELIMINATED] ${ev.target} destroyed!`, 'elimination');
                speak(`${ev.target} has been eliminated!`);
            } else if (ev.type === 'win') {
                speak(`${ev.winner} is the champion!`);
                onLog(`>>> ${ev.winner} WINS THE BATTLE ROYALE <<<`, 'win');
            } else if (ev.type === 'info') {
                onLog(ev.text, 'info');
            } else if (ev.type === 'draw') {
                onLog(`>>> DRAW: MUTUAL DESTRUCTION <<<`, 'info');
            }
        };

        const handleState = (data: any) => {
            physicsSpheresRef.current = data.spheres;
            setSpheres(data.spheres);
            if (gameStatus !== data.status) {
                setGameStatus(data.status);
            }
        };

        socket.on('gameEvent', handleEvent);
        socket.on('gameStateUpdate', handleState);

        return () => {
            socket.off('gameEvent', handleEvent);
            socket.off('gameStateUpdate', handleState);
        };
    }, [socket, onLog, playCollisionSound, speak, spawnParticles, setSpheres, setGameStatus, gameStatus]);

    const render = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.fillStyle = '#050505';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw Techno Grid
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 0; x < canvas.width; x += 60) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
        }
        for (let y = 0; y < canvas.height; y += 60) {
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
        }
        ctx.strokeStyle = 'rgba(0, 243, 255, 0.05)';
        ctx.stroke();

        // Rectangular Arena Boundary Glow
        ctx.strokeStyle = '#00f3ff';
        ctx.lineWidth = 3;
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#00f3ff';
        ctx.strokeRect(0, 0, canvas.width, canvas.height);
        ctx.shadowBlur = 0;

        // Draw Spheres
        physicsSpheresRef.current.forEach((sphere: Sphere) => {
            if (sphere.isEliminated) return;

            // Draw shadow
            ctx.beginPath();
            ctx.arc(sphere.x + 5, sphere.y + 5, sphere.radius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0,0,0,0.8)';
            ctx.fill();

            // Core
            ctx.beginPath();
            ctx.arc(sphere.x, sphere.y, sphere.radius, 0, Math.PI * 2);
            ctx.fillStyle = sphere.color;
            ctx.fill();

            // Glossy shine
            const grad = ctx.createRadialGradient(
                sphere.x - sphere.radius * 0.3,
                sphere.y - sphere.radius * 0.3,
                2,
                sphere.x,
                sphere.y,
                sphere.radius
            );
            grad.addColorStop(0, 'rgba(255,255,255,0.9)');
            grad.addColorStop(0.5, 'rgba(255,255,255,0)');
            ctx.fillStyle = grad;
            ctx.fill();

            // Inner glow/tech ring
            ctx.beginPath();
            ctx.arc(sphere.x, sphere.y, sphere.radius * 0.8, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255,255,255,0.3)';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Health Ring
            const hpPercent = Math.max(0, sphere.health / sphere.maxHealth);
            ctx.beginPath();
            ctx.arc(sphere.x, sphere.y, sphere.radius + 6, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * hpPercent));
            ctx.strokeStyle = hpPercent > 0.5 ? '#00ff9d' : hpPercent > 0.2 ? '#eab308' : '#ff2a2a';
            ctx.lineWidth = 3;
            ctx.stroke();

            // Name Tag
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 12px "Courier New", monospace';
            ctx.textAlign = 'center';
            ctx.shadowColor = 'black';
            ctx.shadowBlur = 4;
            ctx.fillText(sphere.name.toUpperCase(), sphere.x, sphere.y - sphere.radius - 12);
            ctx.shadowBlur = 0;

            // Active User Highlight (Asterisk)
            if (activeUser && sphere.name.toLowerCase() === activeUser.toLowerCase()) {
                ctx.save();
                ctx.fillStyle = '#ffff00'; // Yellow/Gold for visibility
                ctx.font = 'bold 40px "Courier New", monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.shadowColor = '#ffff00';
                ctx.shadowBlur = 10;
                // Draw * on top of the sphere
                ctx.fillText('*', sphere.x, sphere.y);

                // Reset context
                ctx.restore();
            }
        });

        // Draw Particles
        particlesRef.current.forEach((p, index) => {
            p.life -= 0.02;
            p.x += p.vx;
            p.y += p.vy;

            if (p.life > 0) {
                ctx.globalAlpha = p.life;
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.rect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
                ctx.fill();
                ctx.globalAlpha = 1.0;
            } else {
                particlesRef.current.splice(index, 1);
            }
        });

    }, []);

    const loop = useCallback((_time: number) => {
        if (gameStatus === GameStatus.PLAYING || gameStatus === GameStatus.FINISHED) {
            render();
        }
        requestRef.current = requestAnimationFrame(loop);
    }, [render, gameStatus]);

    useEffect(() => {
        requestRef.current = requestAnimationFrame(loop);
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [loop]);

    return (
        <div className="relative h-full w-full flex items-center justify-center p-4">
            <div className="relative border border-white/10 rounded-xl overflow-hidden shadow-panel bg-[#07080a] w-full h-full flex items-center justify-center backdrop-blur-sm">
                <div className="absolute top-0 left-0 w-8 h-8 border-t border-l border-white/20 rounded-tl-xl z-10"></div>
                <div className="absolute top-0 right-0 w-8 h-8 border-t border-r border-white/20 rounded-tr-xl z-10"></div>
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b border-l border-white/20 rounded-bl-xl z-10"></div>
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b border-r border-white/20 rounded-br-xl z-10"></div>

                <canvas
                    ref={canvasRef}
                    width={ARENA_WIDTH}
                    height={ARENA_HEIGHT}
                    className="w-full h-full object-contain block"
                />

                {/* Overlay for Standby / Pre-game (IDLE or GENERATING) */}
                {(gameStatus === GameStatus.IDLE || gameStatus === GameStatus.GENERATING) && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/85 z-20 backdrop-blur-xl">
                        <div className="text-center px-8">
                            <div className="flex items-center justify-center gap-3 mb-6">
                                <span className={`inline-block w-3 h-3 rounded-full ${gameStatus === GameStatus.GENERATING ? 'bg-amber-400 animate-pulse' : 'bg-brand-primary animate-pulse'}`}></span>
                                <span className={`font-sans text-xs font-semibold uppercase tracking-widest ${gameStatus === GameStatus.GENERATING ? 'text-amber-400' : 'text-brand-primary'}`}>
                                    {gameStatus === GameStatus.GENERATING ? 'Initializing Battle Protocol...' : 'Awaiting Admin Signal'}
                                </span>
                            </div>
                            <h2 className="text-5xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-gray-100 to-gray-400 mb-4 tracking-tight">
                                STANDBY
                            </h2>
                            <p className="text-white/30 font-sans text-sm max-w-xs mx-auto leading-relaxed">
                                {gameStatus === GameStatus.GENERATING
                                    ? 'Deploying combatants to the arena. The battle begins momentarily.'
                                    : 'You are connected. The arena will activate when the administrator initiates the game.'}
                            </p>
                            <div className="mt-8 flex justify-center gap-1.5">
                                {[0, 1, 2].map(i => (
                                    <div
                                        key={i}
                                        className="w-1.5 h-1.5 rounded-full bg-brand-primary/60 animate-pulse"
                                        style={{ animationDelay: `${i * 0.2}s` }}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Overlay for Waiting / Countdown */}
                {gameStatus === GameStatus.WAITING && nextGameTime && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20 backdrop-blur-xl">
                        <div className="text-center">
                            <h2 className="text-5xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-gray-100 to-gray-400 mb-4 tracking-tight">
                                NEXT GAME IN
                            </h2>
                            <p className="text-brand-primary font-sans font-medium tracking-widest text-sm mb-10 uppercase">Awaiting Sequence Start</p>

                            <div className="flex gap-4 justify-center font-display text-7xl font-bold text-white tracking-tighter">
                                {(() => {
                                    const now = new Date();
                                    const diff = Math.max(0, nextGameTime.getTime() - now.getTime());
                                    const minutes = Math.floor(diff / 60000);
                                    const seconds = Math.floor((diff % 60000) / 1000);
                                    return (
                                        <>
                                            <div className="bg-white/5 border border-white/10 p-6 rounded-xl min-w-[120px] shadow-inner">
                                                {minutes.toString().padStart(2, '0')}
                                                <div className="text-xs text-gray-500 mt-2 tracking-widest font-sans font-medium uppercase">MIN</div>
                                            </div>
                                            <div className="self-center pb-8 text-gray-600 font-light">:</div>
                                            <div className="bg-white/5 border border-white/10 p-6 rounded-xl min-w-[120px] shadow-inner">
                                                <span className="text-brand-primary">{seconds.toString().padStart(2, '0')}</span>
                                                <div className="text-xs text-brand-primary/70 mt-2 tracking-widest font-sans font-medium uppercase">SEC</div>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                )}

                {/* Overlay for Game Over */}
                {gameStatus === GameStatus.FINISHED && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20 backdrop-blur-xl">
                        <div className="text-center p-12 bg-black/60 border border-amber-500/30 rounded-2xl shadow-[0_8px_32px_rgba(245,158,11,0.15)] transform scale-110">
                            {(() => {
                                const winner = spheres.find(s => !s.isEliminated);
                                if (winner) {
                                    return (
                                        <>
                                            <h2 className="text-6xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-b from-amber-300 to-amber-600 mb-3 tracking-tight">
                                                VICTORY
                                            </h2>
                                            <p className="text-amber-500/80 font-sans font-medium tracking-widest text-sm uppercase">Champion Detected</p>
                                            <h3 className="text-5xl text-white mt-8 font-bold font-display tracking-tight">
                                                {winner.name.toUpperCase()}
                                            </h3>
                                            {winner.walletAddress && (
                                                <div className="mt-8 p-4 bg-amber-900/10 border border-amber-500/20 rounded-xl">
                                                    <p className="text-amber-600 font-sans font-semibold text-xs uppercase tracking-widest mb-1.5">Winning Wallet</p>
                                                    <p className="text-amber-200/90 font-mono text-xs break-all">{formatWalletAddress(winner.walletAddress)}</p>
                                                </div>
                                            )}
                                        </>
                                    );
                                } else {
                                    return (
                                        <>
                                            <h2 className="text-6xl font-display font-bold text-gray-300 mb-4 tracking-tight">
                                                DRAW
                                            </h2>
                                            <p className="text-rose-500 font-sans font-medium tracking-widest text-sm uppercase">Mutual Destruction</p>
                                        </>
                                    );
                                }
                            })()}
                            <div className="mt-10 flex justify-center">
                                <div className="h-[2px] w-16 bg-amber-500/50 rounded-full"></div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BattleArena;
