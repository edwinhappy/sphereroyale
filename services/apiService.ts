import { Participant } from '../types';

const API_Base_URL = 'http://localhost:3001/api';

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

    adminLogin: async (password: string): Promise<string> => {
        const response = await fetch(`${API_Base_URL}/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password }),
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Admin login failed');
        }
        const data = await response.json();
        return data.token;
    },

    getAdminStats: async (token: string): Promise<{ activeConnections: number, networkLoad: number, uptime: number }> => {
        const response = await fetch(`${API_Base_URL}/admin/stats?token=${token}`);
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
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nextGameTime: nextGameTime.toISOString(), totalPlayers, token }),
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to update schedule');
        }
        return response.json();
    }
};
