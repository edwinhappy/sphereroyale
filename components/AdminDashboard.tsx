import { FC, useState, useEffect, useRef } from 'react';
import { Participant } from '../types';
import { apiService } from '../services/apiService';
import { useSocket } from '../contexts/SocketContext';

interface AdminDashboardProps {
    adminToken: string | null;
    onLogout: () => void;
    onNavigateToArena: () => void;
    onScheduleGame: (date: Date, playerCount: number) => void;
}

const AdminDashboard: FC<AdminDashboardProps> = ({ adminToken, onLogout, onNavigateToArena, onScheduleGame }) => {
    const [day, setDay] = useState('');
    const [month, setMonth] = useState('');
    const [year, setYear] = useState('');
    const [hour, setHour] = useState('');
    const [minute, setMinute] = useState('');
    const [playerCount, setPlayerCount] = useState('8');
    const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'PLAYERS'>('OVERVIEW');
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [isLoadingPlayers, setIsLoadingPlayers] = useState(false);

    const [adminStats, setAdminStats] = useState({ activeConnections: 0, networkLoad: 0, uptime: 0 });
    const [systemLogs, setSystemLogs] = useState<{ id: string, text: string, timestamp: number }[]>([]);
    const logsEndRef = useRef<HTMLDivElement>(null);

    const { socket } = useSocket();

    useEffect(() => {
        if (activeTab === 'OVERVIEW' && adminToken) {
            const fetchStats = () => {
                apiService.getAdminStats(adminToken)
                    .then(data => setAdminStats(data))
                    .catch(err => console.error('Failed to load admin stats:', err));
            };
            fetchStats();
            const interval = setInterval(fetchStats, 5000);
            return () => clearInterval(interval);
        }

        return undefined;
    }, [activeTab, adminToken]);

    // Format uptime
    const formatUptime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        return { h, m };
    };

    const uptimeFormatted = formatUptime(adminStats.uptime);

    useEffect(() => {
        if (logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [systemLogs]);

    useEffect(() => {
        if (activeTab === 'PLAYERS') {
            setIsLoadingPlayers(true);
            apiService.getParticipants()
                .then(data => setParticipants(data))
                .catch(err => console.error("Failed to load participants:", err))
                .finally(() => setIsLoadingPlayers(false));
        }
    }, [activeTab]);

    useEffect(() => {
        if (!socket) return;

        const handlePlayerJoined = (newParticipant: Participant) => {
            setParticipants(prev => {
                // Prevent duplicate just in case
                if (prev.some(p => p.username === newParticipant.username)) return prev;
                return [...prev, newParticipant];
            });
        };

        const handleSystemLog = (logText: string) => {
            setSystemLogs(prev => [...prev.slice(-49), { id: Math.random().toString(36).substr(2, 9), text: logText, timestamp: Date.now() }]);
        };

        socket.on('playerJoined', handlePlayerJoined);
        socket.on('systemLog', handleSystemLog);
        return () => {
            socket.off('playerJoined', handlePlayerJoined);
            socket.off('systemLog', handleSystemLog);
        };
    }, [socket]);

    const handleScheduleSubmit = () => {
        if (!day || !month || !year || !hour || !minute || !playerCount) {
            alert("Please fill in all fields");
            return;
        }

        // Validate numeric input
        const d = parseInt(day);
        const m = parseInt(month);
        const y = parseInt(year);
        const h = parseInt(hour);
        const min = parseInt(minute);
        const count = parseInt(playerCount);

        if (isNaN(d) || isNaN(m) || isNaN(y) || isNaN(h) || isNaN(min) || isNaN(count)) {
            alert("Invalid numeric values");
            return;
        }

        if (count < 2) {
            alert("Minimum 2 players required");
            return;
        }

        const date = new Date(y, m - 1, d, h, min, 0, 0);

        if (!isNaN(date.getTime()) && adminToken) {
            apiService.updateSchedule(date, count, adminToken)
                .then(() => {
                    onScheduleGame(date, count);
                    alert(`Game scheduled for: ${date.toUTCString()} with ${count} players`);
                    // Clear inputs
                    setDay(''); setMonth(''); setYear(''); setHour(''); setMinute(''); setPlayerCount('8');
                })
                .catch(err => alert("Failed to schedule: " + err.message));
        } else if (!adminToken) {
            alert("Unauthorized: No admin token");
        } else {
            alert("Invalid date value");
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex h-screen w-screen bg-[#07080a] text-white overflow-hidden font-sans">
            {/* Sidebar */}
            <div className="w-64 border-r border-white/10 bg-black/90 flex flex-col p-6 backdrop-blur-md">
                <div className="text-2xl font-display font-bold text-white mb-10 tracking-tight flex items-center gap-2">
                    <span className="text-3xl text-brand-primary">🛡️</span>
                    <span>ADMIN<br /><span className="text-gray-400">NEXUS</span></span>
                </div>

                <nav className="flex-1 space-y-3">
                    <button
                        onClick={() => setActiveTab('OVERVIEW')}
                        className={`w-full text-left px-4 py-3 rounded-lg transition-all font-semibold tracking-wide border ${activeTab === 'OVERVIEW' ? 'bg-brand-primary/10 text-brand-primary border-brand-primary/50' : 'text-gray-400 hover:text-white hover:bg-white/5 border-transparent hover:border-white/10'}`}
                    >
                        Overview
                    </button>
                    <button
                        onClick={onNavigateToArena}
                        className="w-full text-left px-4 py-3 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all border border-transparent hover:border-white/10"
                    >
                        ARENA
                    </button>
                    <button
                        onClick={() => setActiveTab('PLAYERS')}
                        className={`w-full text-left px-4 py-3 rounded-lg transition-all font-semibold tracking-wide border ${activeTab === 'PLAYERS' ? 'bg-brand-primary/10 text-brand-primary border-brand-primary/50' : 'text-gray-400 hover:text-white hover:bg-white/5 border-transparent hover:border-white/10'}`}
                    >
                        Player Management
                    </button>
                    <button className="w-full text-left px-4 py-3 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all border border-transparent hover:border-white/10">
                        System Logs
                    </button>
                </nav>

                <div className="mt-auto pt-6 border-t border-white/10">
                    <div className="flex items-center gap-3 mb-4 px-2">
                        <div className="w-8 h-8 rounded-full bg-brand-primary/20 flex items-center justify-center text-brand-primary font-bold">A</div>
                        <div className="text-xs">
                            <div className="text-white font-semibold">Administrator</div>
                            <div className="text-gray-500">Super User</div>
                        </div>
                    </div>
                    <button
                        onClick={onLogout}
                        className="w-full px-4 py-3 border border-red-500/50 text-red-500 hover:bg-red-500/10 rounded-lg transition-all uppercase tracking-wider font-bold text-sm flex items-center justify-center gap-2"
                    >
                        <span>Logout</span>
                        <span>→</span>
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden relative bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-gray-900 via-[#07080a] to-black">
                {/* Header */}
                <header className="h-20 border-b border-white/10 flex items-center justify-between px-8 bg-black/20 backdrop-blur-sm">
                    <div>
                        <h1 className="text-xl font-display font-bold tracking-widest text-white uppercase">
                            {activeTab === 'OVERVIEW' ? 'System Overview' : 'Player Management'}
                        </h1>
                        <p className="text-xs text-gray-500 font-sans mt-1">
                            {activeTab === 'OVERVIEW' ? 'Real-time monitoring protocol initiated' : 'Manage registered combatants'}
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="px-3 py-1 bg-green-500/10 border border-green-500/30 rounded-full flex items-center gap-2">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                            <span className="text-xs text-green-500 uppercase tracking-widest font-bold">System Online</span>
                        </div>
                    </div>
                </header>

                {/* Dashboard Grid */}
                <main className="flex-1 p-8 overflow-y-auto">
                    {activeTab === 'OVERVIEW' && (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                                {/* Schedule Game Card */}
                                <div className="p-6 bg-black/40 border border-white/10 rounded-xl hover:border-brand-primary/40 transition-colors group shadow-inner">
                                    <div className="flex justify-between items-start mb-4">
                                        <h3 className="text-gray-400 text-xs uppercase tracking-widest font-bold">Schedule Game</h3>
                                        <span className="text-brand-primary text-lg group-hover:scale-110 transition-transform">📅</span>
                                    </div>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-2">Date (DD / MM / YYYY)</label>
                                            <div className="flex gap-2 mb-4">
                                                <input
                                                    type="text"
                                                    value={day}
                                                    onChange={(e) => setDay(e.target.value)}
                                                    placeholder="DD"
                                                    maxLength={2}
                                                    className="w-12 bg-black/50 border border-gray-700 rounded-lg px-2 py-2 text-white font-mono text-center text-sm focus:border-cyber-cyan focus:outline-none placeholder-gray-700"
                                                />
                                                <span className="text-gray-600 self-center">/</span>
                                                <input
                                                    type="text"
                                                    value={month}
                                                    onChange={(e) => setMonth(e.target.value)}
                                                    placeholder="MM"
                                                    maxLength={2}
                                                    className="w-12 bg-black/50 border border-gray-700 rounded-lg px-2 py-2 text-white font-mono text-center text-sm focus:border-cyber-cyan focus:outline-none placeholder-gray-700"
                                                />
                                                <span className="text-gray-600 self-center">/</span>
                                                <input
                                                    type="text"
                                                    value={year}
                                                    onChange={(e) => setYear(e.target.value)}
                                                    placeholder="YYYY"
                                                    maxLength={4}
                                                    className="w-16 bg-black/50 border border-gray-700 rounded-lg px-2 py-2 text-white font-mono text-center text-sm focus:border-cyber-cyan focus:outline-none placeholder-gray-700"
                                                />
                                            </div>

                                            <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-2">Time (HH : MM)</label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={hour}
                                                    onChange={(e) => setHour(e.target.value)}
                                                    placeholder="HH"
                                                    maxLength={2}
                                                    className="w-12 bg-black/50 border border-gray-700 rounded-lg px-2 py-2 text-white font-mono text-center text-sm focus:border-cyber-cyan focus:outline-none placeholder-gray-700"
                                                />
                                                <span className="text-gray-600 self-center">:</span>
                                                <input
                                                    type="text"
                                                    value={minute}
                                                    onChange={(e) => setMinute(e.target.value)}
                                                    placeholder="MM"
                                                    maxLength={2}
                                                    className="w-12 bg-black/50 border border-gray-700 rounded-lg px-2 py-2 text-white font-mono text-center text-sm focus:border-cyber-cyan focus:outline-none placeholder-gray-700"
                                                />
                                            </div>
                                        </div>
                                        <div className="mb-4">
                                            <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-2">Max Players (Total)</label>
                                            <input
                                                type="number"
                                                value={playerCount}
                                                onChange={(e) => setPlayerCount(e.target.value)}
                                                placeholder="8"
                                                min="2"
                                                max="50"
                                                className="w-full bg-black/50 border border-gray-700 rounded-lg px-2 py-2 text-white font-mono text-sm focus:border-cyber-cyan focus:outline-none placeholder-gray-700"
                                            />
                                        </div>
                                        <button
                                            onClick={handleScheduleSubmit}
                                            className="w-full bg-brand-primary/10 border border-brand-primary/50 text-brand-primary hover:bg-brand-primary hover:text-white font-bold py-2 rounded-lg transition-all uppercase text-xs tracking-widest"
                                        >
                                            Set Schedule
                                        </button>
                                    </div>
                                </div>

                                {/* Stats Card 1 */}
                                <div className="p-6 bg-black/40 border border-white/10 rounded-xl hover:border-white/20 transition-colors group shadow-inner">
                                    <div className="flex justify-between items-start mb-4">
                                        <h3 className="text-gray-400 text-xs uppercase tracking-widest font-bold">Active Connections</h3>
                                        <span className="text-emerald-400 text-lg group-hover:scale-110 transition-transform">👥</span>
                                    </div>
                                    <div className="text-4xl font-display font-bold text-white mb-2">{adminStats.activeConnections}</div>
                                    <div className="text-xs text-gray-500">Currently in arena or lobby</div>
                                </div>

                                {/* Stats Card 2 */}
                                <div className="p-6 bg-black/40 border border-purple-500/20 rounded-xl hover:border-purple-500/40 transition-colors group shadow-inner">
                                    <div className="flex justify-between items-start mb-4">
                                        <h3 className="text-gray-400 text-xs uppercase tracking-widest font-bold">Memory Load</h3>
                                        <span className="text-purple-500 text-lg group-hover:scale-110 transition-transform">⚡</span>
                                    </div>
                                    <div className="text-4xl font-display font-bold text-white mb-2">{adminStats.networkLoad}<span className="text-lg text-gray-500 font-normal">%</span></div>
                                    <div className="text-xs text-gray-500">Heap usage / Total</div>
                                </div>

                                {/* Stats Card 3 */}
                                <div className="p-6 bg-black/40 border border-amber-500/20 rounded-xl hover:border-amber-500/40 transition-colors group shadow-inner">
                                    <div className="flex justify-between items-start mb-4">
                                        <h3 className="text-gray-400 text-xs uppercase tracking-widest font-bold">Uptime</h3>
                                        <span className="text-amber-500 text-lg group-hover:scale-110 transition-transform">⏱️</span>
                                    </div>
                                    <div className="text-4xl font-display font-bold text-white mb-2">{uptimeFormatted.h}<span className="text-lg text-gray-500 font-normal">h</span> {uptimeFormatted.m}<span className="text-lg text-gray-500 font-normal">m</span></div>
                                    <div className="text-xs text-gray-500">Since last reboot</div>
                                </div>
                            </div>

                            {/* Recent Activity */}
                            <div className="bg-black/40 border border-white/10 rounded-xl p-6 h-96 flex flex-col shadow-inner">
                                <h3 className="text-white text-sm uppercase tracking-widest font-semibold mb-6 border-b border-white/10 pb-4">
                                    Live System Logs
                                </h3>
                                <div className="flex-1 overflow-y-auto text-gray-400 font-mono text-xs border border-white/10 rounded-lg bg-black/60 p-4 space-y-2">
                                    {systemLogs.length === 0 ? (
                                        <div className="flex h-full items-center justify-center text-gray-600 border-2 border-dashed border-white/5 rounded-lg">
                                            [AWAITING DATA STREAM...]
                                        </div>
                                    ) : (
                                        systemLogs.map(log => {
                                            const time = new Date(log.timestamp).toISOString().split('T')[1].slice(0, 8);
                                            return (
                                                <div key={log.id} className="flex gap-4">
                                                    <span className="text-gray-600 shrink-0">[{time}]</span>
                                                    <span className="text-emerald-400/80">{log.text}</span>
                                                </div>
                                            );
                                        })
                                    )}
                                    <div ref={logsEndRef} />
                                </div>
                            </div>
                        </>
                    )}

                    {activeTab === 'PLAYERS' && (
                        <div className="bg-black/40 border border-white/10 rounded-xl p-6 shadow-inner animate-in fade-in zoom-in-95 duration-200">
                            <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
                                <h3 className="text-white text-sm uppercase tracking-widest font-semibold flex items-center gap-2">
                                    <span>Registered Roster</span>
                                    <span className="bg-brand-primary/20 text-brand-primary px-2 py-0.5 rounded-full text-[10px] font-bold">
                                        {participants.length}
                                    </span>
                                </h3>
                                <button
                                    onClick={() => {
                                        setIsLoadingPlayers(true);
                                        apiService.getParticipants().then(setParticipants).finally(() => setIsLoadingPlayers(false));
                                    }}
                                    className="text-xs text-gray-400 hover:text-white transition-colors flex items-center gap-1"
                                >
                                    <span>↻ Refresh</span>
                                </button>
                            </div>

                            {isLoadingPlayers ? (
                                <div className="text-center py-12 text-gray-500 font-mono text-sm">LOADING COMBATANTS...</div>
                            ) : participants.length === 0 ? (
                                <div className="text-center py-12 text-gray-500 font-mono text-sm border-2 border-dashed border-white/5 rounded-xl">NO PLAYERS REGISTERED</div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b border-white/10">
                                                <th className="p-4 text-[10px] font-sans text-gray-500 uppercase tracking-widest">Codename</th>
                                                <th className="p-4 text-[10px] font-sans text-gray-500 uppercase tracking-widest">Network</th>
                                                <th className="p-4 text-[10px] font-sans text-gray-500 uppercase tracking-widest">Wallet</th>
                                                <th className="p-4 text-[10px] font-sans text-gray-500 uppercase tracking-widest text-right">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {participants.map((p, idx) => (
                                                <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                                    <td className="p-4">
                                                        <div className="font-semibold text-white tracking-wide">{p.username}</div>
                                                    </td>
                                                    <td className="p-4">
                                                        <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wider ${p.chain === 'TON' ? 'bg-[#0098EA]/20 text-[#0098EA]' : 'bg-[#9945FF]/20 text-[#9945FF]'}`}>
                                                            {p.chain}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 font-mono text-xs text-gray-400">
                                                        {p.walletAddress.substring(0, 6)}...{p.walletAddress.substring(p.walletAddress.length - 4)}
                                                    </td>
                                                    <td className="p-4 text-right">
                                                        <span className="text-[10px] px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 font-bold uppercase tracking-wider">
                                                            Paid
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default AdminDashboard;
