import { Agenda } from 'agenda';
import { config } from '../config.js';
import { startGameSequence, serverGameState } from '../index.js';
import { GameStatus } from '../../types.js';

// Initialize Agenda using the documented config object syntax for the installed version.
// If types complain about `db`, we cast to `any` because @types/agenda is often out of sync
// with the actual Agenda instance config options.
export const agenda = new Agenda({
    // @ts-ignore - types are outdated for modern Agenda
    db: { address: config.MONGODB_URI, collection: 'agendaJobs' },
    defaultLockLifetime: 10000,
});

// ---------------------------------------------------------------------------
// Job Definitions
// ---------------------------------------------------------------------------

agenda.define('start-game', async (_job) => {
    console.log(`[Agenda] Executing scheduled job: 'start-game'`);

    // Explicit State Machine Guard
    // If the game is not IDLE, we must not start a new game.
    // This prevents duplicate starts if an admin manually triggers the game 
    // right before the scheduled job runs.
    if (serverGameState.status !== GameStatus.IDLE) {
        console.warn(`[Agenda] ⚠️ Aborting 'start-game': Server is currently in state '${serverGameState.status}', expected '${GameStatus.IDLE}'`);
        return;
    }

    try {
        await startGameSequence();
        console.log(`[Agenda] Successfully initiated 'start-game' sequence.`);
    } catch (error) {
        console.error(`[Agenda] ❌ Error in 'start-game' sequence:`, error);
        throw error; // Agenda will mark the job as failed
    }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Schedule a game start at the specified date.
 * Replaces any existing 'start-game' jobs to ensure only one is scheduled.
 */
export async function scheduleGameStart(date: Date) {
    if (!agenda) return;

    // Remove any pending start games
    await agenda.cancel({ name: 'start-game' });

    // Schedule the new one
    await agenda.schedule(date, 'start-game');
    console.log(`[Agenda] Scheduled new 'start-game' job for ${date.toISOString()}`);
}

/**
 * Cancel all scheduled game starts.
 */
export async function cancelScheduledGames() {
    if (!agenda) return;
    await agenda.cancel({ name: 'start-game' });
    console.log(`[Agenda] Cancelled all pending 'start-game' jobs.`);
}
