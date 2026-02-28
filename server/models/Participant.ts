import mongoose, { Document, Model } from 'mongoose';

// ---------------------------------------------------------------------------
// Registration status lifecycle: PENDING → CONFIRMED | FAILED
// ---------------------------------------------------------------------------
export type RegistrationStatus = 'PENDING' | 'CONFIRMED' | 'FAILED';

export interface IParticipant extends Document {
    username: string;
    walletAddress: string;
    chain: 'TON' | 'SOL';
    paymentTxHash: string;
    /** Chain-prefixed, lowercased tx identity (e.g. "SOL:abc123…") */
    normalizedTxId: string;
    /** Game round this registration belongs to */
    gameId: string;
    /** Registration lifecycle status */
    status: RegistrationStatus;
    /** Optional reason when status is FAILED */
    statusReason?: string;
    joinedAt: Date;
}

const participantSchema = new mongoose.Schema<IParticipant>({
    username: {
        type: String,
        required: true,
        trim: true,
    },
    walletAddress: {
        type: String,
        required: true,
    },
    chain: {
        type: String,
        enum: ['TON', 'SOL'],
        required: true,
    },
    paymentTxHash: {
        type: String,
        required: true,
        unique: true,          // kept for backwards compat
    },
    normalizedTxId: {
        type: String,
        required: true,
        unique: true,          // cross-chain replay prevention
    },
    gameId: {
        type: String,
        required: true,
        default: 'default',
    },
    status: {
        type: String,
        enum: ['PENDING', 'CONFIRMED', 'FAILED'],
        default: 'PENDING',
        required: true,
    },
    statusReason: {
        type: String,
    },
    joinedAt: {
        type: Date,
        default: Date.now,
    },
});

// ---------------------------------------------------------------------------
// Compound indexes
// ---------------------------------------------------------------------------

// Same username cannot register twice in the same game
participantSchema.index({ username: 1, gameId: 1 }, { unique: true });

// Efficient per-game wallet limit queries
participantSchema.index({ walletAddress: 1, gameId: 1 });

export const Participant: Model<IParticipant> = mongoose.model<IParticipant>('Participant', participantSchema);
