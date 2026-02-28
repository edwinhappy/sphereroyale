import React, { useEffect } from 'react';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastProps {
    id: string;
    message: string;
    type: ToastType;
    duration?: number;
    onClose: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({ id, message, type, duration = 3000, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose(id);
        }, duration);

        return () => clearTimeout(timer);
    }, [id, duration, onClose]);

    const getStyles = () => {
        switch (type) {
            case 'success':
                return 'border-cyber-green text-cyber-green bg-cyber-green/10 shadow-[0_0_10px_rgba(0,255,157,0.3)]';
            case 'error':
                return 'border-cyber-red text-cyber-red bg-cyber-red/10 shadow-[0_0_10px_rgba(255,42,42,0.3)]';
            case 'warning':
                return 'border-yellow-400 text-yellow-400 bg-yellow-400/10 shadow-[0_0_10px_rgba(250,204,21,0.3)]';
            default:
                return 'border-cyber-cyan text-cyber-cyan bg-cyber-cyan/10 shadow-[0_0_10px_rgba(0,243,255,0.3)]';
        }
    };

    const getIcon = () => {
        switch (type) {
            case 'success': return '✓';
            case 'error': return '⚠';
            case 'warning': return '!';
            default: return 'i';
        }
    };

    return (
        <div className={`
            flex items-center gap-3 p-4 min-w-[300px] max-w-md
            border-l-4 ${getStyles()}
            backdrop-blur-md bg-black/80
            animate-slide-in-right transition-all duration-300
            font-mono text-sm uppercase tracking-wider
            group hover:scale-[1.02]
        `}>
            <div className={`
                flex items-center justify-center w-6 h-6 rounded-sm border
                ${type === 'success' ? 'border-cyber-green' : type === 'error' ? 'border-cyber-red' : type === 'warning' ? 'border-yellow-400' : 'border-cyber-cyan'}
            `}>
                <span className="text-xs font-bold">{getIcon()}</span>
            </div>

            <div className="flex-1">
                <span className="font-bold block text-xs opacity-50 mb-1">
                    SYSTEM_MSG // {type.toUpperCase()}
                </span>
                <p className="leading-tight">{message}</p>
            </div>

            <button
                onClick={() => onClose(id)}
                className="opacity-50 hover:opacity-100 transition-opacity p-1"
            >
                ×
            </button>

            {/* Scanline effect overlay */}
            <div className="absolute inset-0 pointer-events-none opacity-10 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,6px_100%]" />
        </div>
    );
};

export default Toast;
