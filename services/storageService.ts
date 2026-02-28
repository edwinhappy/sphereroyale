import { Participant } from '../types';

const STORAGE_KEY = 'sphere_royale_participants';

export const storageService = {
    saveParticipants: (participants: Participant[]) => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(participants));
        } catch (error) {
            console.error('Failed to save participants to local storage:', error);
        }
    },

    loadParticipants: (): Participant[] => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('Failed to load participants from local storage:', error);
            return [];
        }
    },

    clearParticipants: () => {
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (error) {
            console.error('Failed to clear participants from local storage:', error);
        }
    }
};
