import { Participant } from '../types';

// Determine API Base URL dynamically
// 1. Check for explicit environment variable (VITE_API_URL)
// 2. If missing, assume API is hosted on the same origin under /api (production/staging)
// 3. Fallback to localhost:3001/api for local frontend-only dev server running without env vars
const API_Base_URL = import.meta.env.VITE_API_URL ||
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:3001/api'
        : `${window.location.origin}/api`);

export const apiService = {
    getParticipants: async (): Promise<Participant[]> => {
        const response = await fetch(`${API_Base_URL}/participants`);
        if (!response.ok) {
            throw new Error('Failed to fetch participants');
        }
        return response.json();
    },

    registerParticipant: async (participant: Participant): Promise<Participant> => {
        const response = await fetch(`${API_Base_URL}/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(participant),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Registration failed');
        }

        return response.json();
    },

    adminLogin: async (password: string): Promise<{ token: string; expiresIn: string }> => {
        const response = await fetch(`${API_Base_URL}/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password }),
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Admin login failed');
        }
        return response.json();
    },

    getAdminStats: async (token: string): Promise<{ activeConnections: number, networkLoad: number, uptime: number }> => {
        const response = await fetch(`${API_Base_URL}/admin/stats`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!response.ok) {
            throw new Error('Failed to fetch admin stats');
        }
        return response.json();
    },

    getSchedule: async (): Promise<{ nextGameTime: string, totalPlayers: number } | null> => {
        const response = await fetch(`${API_Base_URL}/schedule`);
        if (response.status === 404) return null;
        if (!response.ok) throw new Error('Failed to fetch schedule');
        return response.json();
    },

    updateSchedule: async (nextGameTime: Date, totalPlayers: number, token: string): Promise<any> => {
        const response = await fetch(`${API_Base_URL}/schedule`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ nextGameTime: nextGameTime.toISOString(), totalPlayers }),
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to update schedule');
        }
        return response.json();
    },

    refreshToken: async (currentToken: string): Promise<{ token: string; expiresIn: string }> => {
        const response = await fetch(`${API_Base_URL}/admin/refresh`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${currentToken}`,
            },
        });
        if (!response.ok) {
            throw new Error('Token refresh failed');
        }
        return response.json();
    },

    adminLogout: async (token: string): Promise<void> => {
        const response = await fetch(`${API_Base_URL}/admin/logout`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
            }
        });
        if (!response.ok) {
            console.warn('Backend logout rejection warning, proceeding with client purge regardless');
        }
    }
};
