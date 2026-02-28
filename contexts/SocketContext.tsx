import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface SocketContextType {
    socket: Socket | null;
    isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
    socket: null,
    isConnected: false,
});

export const useSocket = () => useContext(SocketContext);

export let globalSocket: Socket | null = null;

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        // 1. Explicit VITE_WS_URL environment variable
        // 2. Localhost fallback for standard vite dev server
        // 3. Current host with ws:// or wss:// depending on protocol
        const socketUrl = import.meta.env.VITE_WS_URL ||
            (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
                ? 'http://localhost:3001'
                : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`);

        const newSocket = io(socketUrl, {
            transports: ['websocket'], // force websocket for performance
        });

        setSocket(newSocket);
        globalSocket = newSocket;

        newSocket.on('connect', () => {
            console.log('Socket connected');
            setIsConnected(true);
        });

        newSocket.on('disconnect', () => {
            console.log('Socket disconnected');
            setIsConnected(false);
        });

        return () => {
            newSocket.disconnect();
        };
    }, []);

    return (
        <SocketContext.Provider value={{ socket, isConnected }}>
            {children}
        </SocketContext.Provider>
    );
};
