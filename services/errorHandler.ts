import { ToastType } from '../components/Toast';

export class AppError extends Error {
    constructor(message: string, public type: ToastType = 'error') {
        super(message);
        this.name = 'AppError';
    }
}

export const errorHandler = (
    error: unknown,
    showToast: (msg: string, type: ToastType) => void
) => {
    console.error('Global Error Handler:', error);

    let message = 'An unexpected error occurred.';
    let type: ToastType = 'error';

    if (error instanceof AppError) {
        message = error.message;
        type = error.type;
    } else if (error instanceof Error) {
        message = error.message;
    } else if (typeof error === 'string') {
        message = error;
    }

    // Specific handling for common blockchain/wallet errors could go here
    if (message.toLowerCase().includes('user rejected')) {
        message = 'Transaction cancelled by user.';
        type = 'warning';
    }

    showToast(message, type);
};
