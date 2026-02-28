
import { useState, useCallback, useEffect } from 'react';
import type { FC } from 'react';
import BattleArena from './components/BattleArena';
import Background from './components/Background';
import ControlPanel from './components/ControlPanel';
import Registration from './components/Registration.tsx';
import LandingPage from './components/LandingPage';
import LoginModal from './components/LoginModal';
import AdminDashboard from './components/AdminDashboard';
import WalletProviders from './services/walletProviders';
import { ToastProvider } from './contexts/ToastContext';
import { GameStatus, Sphere, LogEntry, Participant } from './types';
import { SocketProvider, useSocket, globalSocket } from './contexts/SocketContext';
import { apiService } from './services/apiService';

const ScheduleSync: FC<{ setNext: (d: Date) => void, setPlayers: (n: number) => void }> = ({ setNext, setPlayers }) => {
    const { socket } = useSocket();
    useEffect(() => {
        if (!socket) return;
        const handleUpdate = (data: any) => {
            setNext(new Date(data.nextGameTime));
            setPlayers(data.totalPlayers);
        };
        socket.on('scheduleUpdated', handleUpdate);
        return () => { socket.off('scheduleUpdated', handleUpdate); };
    }, [socket, setNext, setPlayers]);
    return null;
};

const GameStartSync: FC<{
    loggedInUser: string | null;
    isAdmin: boolean;
    setView: (v: 'LANDING' | 'REGISTRATION' | 'GAME' | 'ADMIN_DASHBOARD') => void;
    setGameStatus: (s: GameStatus) => void;
}> = ({ loggedInUser, isAdmin, setView, setGameStatus }) => {
    const { socket } = useSocket();
    useEffect(() => {
        if (!socket) return;
        const handleGameStarted = () => {
            // Auto-navigate any logged-in participant (not admin dashboard) to the battle
            if (loggedInUser && !isAdmin) {
                setGameStatus(GameStatus.PLAYING);
                setView('GAME');
            }
        };
        socket.on('gameStarted', handleGameStarted);
        return () => { socket.off('gameStarted', handleGameStarted); };
    }, [socket, loggedInUser, isAdmin, setView, setGameStatus]);
    return null;
};

const App: FC = () => {
    const [view, setView] = useState<'LANDING' | 'REGISTRATION' | 'GAME' | 'ADMIN_DASHBOARD'>(() => {
        return (localStorage.getItem('app_view') as any) || 'LANDING';
    });
    const [gameStatus, setGameStatus] = useState<GameStatus>(GameStatus.IDLE);
    const [spheres, setSpheres] = useState<Sphere[]>([]);
    const [logs, setLogs] = useState<LogEntry[]>([]);

    const [loggedInUser, setLoggedInUser] = useState<string | null>(() => {
        return localStorage.getItem('app_loggedInUser');
    });
    const [isAdmin, setIsAdmin] = useState(() => {
        return localStorage.getItem('app_isAdmin') === 'true';
    });
    const [nextGameTime, setNextGameTime] = useState<Date | null>(null);
    const [isLoginOpen, setIsLoginOpen] = useState(false);
    const [adminToken, setAdminToken] = useState<string | null>(() => {
        return localStorage.getItem('app_adminToken');
    });

    useEffect(() => {
        localStorage.setItem('app_view', view);
    }, [view]);

    useEffect(() => {
        if (loggedInUser) localStorage.setItem('app_loggedInUser', loggedInUser);
        else localStorage.removeItem('app_loggedInUser');
    }, [loggedInUser]);

    useEffect(() => {
        localStorage.setItem('app_isAdmin', String(isAdmin));
    }, [isAdmin]);

    useEffect(() => {
        if (adminToken) localStorage.setItem('app_adminToken', adminToken);
        else localStorage.removeItem('app_adminToken');
    }, [adminToken]);

    const [, setTotalPlayers] = useState<number>(8); // Default 8

    // Init schedule
    useEffect(() => {
        apiService.getSchedule().then(data => {
            if (data) {
                setNextGameTime(new Date(data.nextGameTime));
                setTotalPlayers(data.totalPlayers);
            }
        }).catch(err => console.error("Initial schedule fetch failed", err));
    }, []);

    const addLog = useCallback((text: string, type: 'info' | 'combat' | 'elimination' | 'win') => {
        setLogs(prev => [...prev, {
            id: Math.random().toString(36).substr(2, 9),
            text,
            type,
            timestamp: Date.now()
        }]);
    }, []);

    const [timerId, setTimerId] = useState<number | null>(null);

    const enterGame = (username: string) => {
        setLoggedInUser(username);

        if (nextGameTime && new Date() < nextGameTime) {
            setGameStatus(GameStatus.WAITING);
            addLog(`STANDING BY FOR SCHEDULED START: ${nextGameTime.toLocaleTimeString()}`, "info");
        } else {
            // If no schedule, just go to IDLE? Or do nothing special.
            // Existing flow was just setView('GAME').
        }

        setView('GAME');
    };

    const handleRegistrationComplete = (registered: Participant[]) => {
        if (registered.length > 0) {
            // Use the first registered participant as the active user
            enterGame(registered[0].username);
        } else {
            // Fallback if empty registration? Should not happen based on button disable logic.
            setView('GAME');
        }
    };

    const handleLogin = (username: string, isAdminUser: boolean = false, token?: string) => {
        setIsAdmin(isAdminUser);
        if (isAdminUser && token) {
            setAdminToken(token);
            setLoggedInUser(username);
            setView('ADMIN_DASHBOARD');
        } else {
            enterGame(username);
        }
        setIsLoginOpen(false);
    };

    const resetGame = useCallback(() => {
        if (adminToken && globalSocket) {
            globalSocket.emit('adminResetGame', adminToken);
        }
    }, [adminToken]);

    const backToLobby = useCallback(() => {
        setGameStatus(GameStatus.IDLE);
        setSpheres([]);
        setLogs([]);
        setView('REGISTRATION');
    }, []);

    const backToDashboard = useCallback(() => {
        setGameStatus(GameStatus.IDLE);
        setSpheres([]);
        setLogs([]);
        setView('ADMIN_DASHBOARD');
    }, []);

    const startGame = useCallback(() => {
        if (adminToken && globalSocket) {
            globalSocket.emit('adminStartGame', adminToken);
        }
    }, [adminToken]);

    // Auto-start timer effect
    useEffect(() => {
        if (gameStatus === GameStatus.WAITING && nextGameTime) {
            const checkTime = () => {
                const now = new Date();
                if (now >= nextGameTime) {
                    startGame();
                }
            };

            const id = window.setInterval(checkTime, 1000);
            setTimerId(id);

            return () => {
                window.clearInterval(id);
            };
        } else if (gameStatus !== GameStatus.WAITING && timerId) {
            clearInterval(timerId);
            setTimerId(null);
        }
    }, [gameStatus, nextGameTime, startGame, timerId]);

    return (
        <WalletProviders>
            <SocketProvider>
                <ToastProvider>
                    <div className="flex flex-col lg:flex-row h-screen w-screen bg-[#07080a] text-white overflow-hidden selection:bg-brand-primary/30 selection:text-white">
                        <Background />

                        <LoginModal
                            isOpen={isLoginOpen}
                            onClose={() => setIsLoginOpen(false)}
                            onLogin={handleLogin}
                            onSignup={() => {
                                setIsLoginOpen(false);
                                setView('REGISTRATION');
                            }}
                        />

                        {view === 'ADMIN_DASHBOARD' ? (
                            <AdminDashboard
                                adminToken={adminToken}
                                onLogout={() => {
                                    setLoggedInUser(null);
                                    setAdminToken(null);
                                    setView('LANDING');
                                }}
                                onNavigateToArena={() => setView('GAME')}
                                onScheduleGame={(date, _count) => {
                                    setNextGameTime(date);
                                }}
                            />
                        ) : view === 'LANDING' ? (
                            <div className="relative z-10 w-full h-full">
                                <LandingPage
                                    onEnter={() => setView('REGISTRATION')}
                                    onOpenLogin={() => setIsLoginOpen(true)}
                                    nextGameTime={nextGameTime}
                                />
                            </div>
                        ) : view === 'REGISTRATION' ? (
                            <div className="relative z-10 w-full h-full">
                                <button
                                    onClick={() => setView('LANDING')}
                                    className="absolute top-8 left-8 z-50 flex items-center gap-3 px-6 py-3 bg-black/60 border border-white/10 rounded-lg hover:border-brand-primary hover:text-brand-primary hover:bg-black/80 transition-all font-sans text-sm font-semibold uppercase tracking-widest backdrop-blur-xl shadow-panel group"
                                >
                                    <span className="text-xl leading-none group-hover:-translate-x-1 transition-transform">←</span>
                                    <span>Back</span>
                                </button>
                                <Registration
                                    onStart={handleRegistrationComplete}
                                    onOpenLogin={() => setIsLoginOpen(true)}
                                />
                            </div>
                        ) : (
                            <>
                                {/* Main Content */}
                                <div className="flex-1 flex flex-col p-6 overflow-hidden relative z-10">
                                    <div className="absolute top-8 left-8 z-50 flex gap-4">
                                        <button
                                            onClick={backToLobby}
                                            className="px-5 py-2.5 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 text-xs text-white font-sans font-semibold uppercase tracking-widest backdrop-blur-md transition-all"
                                            disabled={gameStatus === GameStatus.PLAYING}
                                        >
                                            ← Back to Lobby
                                        </button>
                                        {isAdmin && (
                                            <button
                                                onClick={backToDashboard}
                                                className="px-5 py-2.5 bg-brand-primary/10 border border-brand-primary/30 rounded-lg hover:bg-brand-primary/20 text-xs text-brand-primary font-sans font-semibold uppercase tracking-widest backdrop-blur-md transition-all"
                                                disabled={gameStatus === GameStatus.PLAYING}
                                            >
                                                ⚙ Dashboard
                                            </button>
                                        )}
                                    </div>
                                    <BattleArena
                                        spheres={spheres}
                                        setSpheres={setSpheres}
                                        gameStatus={gameStatus}
                                        setGameStatus={setGameStatus}
                                        onLog={addLog}
                                        activeUser={loggedInUser}
                                        nextGameTime={nextGameTime}
                                    />
                                </div>

                                {/* Sidebar */}
                                <ControlPanel
                                    gameStatus={gameStatus}
                                    startGame={startGame}
                                    resetGame={resetGame}
                                    logs={logs}
                                    spheres={spheres}
                                    isAdmin={isAdmin}
                                />
                            </>
                        )}
                    </div>
                    <ScheduleSync setNext={setNextGameTime} setPlayers={setTotalPlayers} />
                    <GameStartSync
                        loggedInUser={loggedInUser}
                        isAdmin={isAdmin}
                        setView={setView}
                        setGameStatus={setGameStatus}
                    />
                </ToastProvider>
            </SocketProvider>
        </WalletProviders>
    );
};

export default App;
