import { useToast } from '../contexts/ToastContext';
import { errorHandler } from '../services/errorHandler';
import { ToastType } from './Toast';

// Verified manual test component
const VerifyToasts = () => {
    const { showToast } = useToast();

    return (
        <div className="fixed top-24 right-4 z-50 flex flex-col gap-2 p-4 bg-black/80 border border-white/20 rounded">
            <h3 className="text-xs font-mono uppercase text-gray-400">Debug Toasts</h3>
            <button
                onClick={() => showToast('Operation Successful', 'success')}
                className="px-3 py-1 bg-green-900/50 text-green-400 border border-green-700 text-xs font-mono hover:bg-green-900"
            >
                Test Success
            </button>
            <button
                onClick={() => showToast('System Failure', 'error')}
                className="px-3 py-1 bg-red-900/50 text-red-400 border border-red-700 text-xs font-mono hover:bg-red-900"
            >
                Test Error
            </button>
            <button
                onClick={() => showToast('Warning Issued', 'warning')}
                className="px-3 py-1 bg-yellow-900/50 text-yellow-400 border border-yellow-700 text-xs font-mono hover:bg-yellow-900"
            >
                Test Warning
            </button>
            <button
                onClick={() => errorHandler(new Error('Simulated Crash'), (msg: string, type: ToastType) => showToast(msg, type))}
                className="px-3 py-1 bg-gray-800 text-gray-400 border border-gray-600 text-xs font-mono hover:bg-gray-700"
            >
                Test Handler
            </button>
        </div>
    );
};

export default VerifyToasts;
