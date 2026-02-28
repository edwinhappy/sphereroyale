import mongoose, { Document, Model } from 'mongoose';

// ---------------------------------------------------------------------------
// Match lifecycle: SCHEDULED → GENERATING → PLAYING → FINISHED | CANCELLED
// ---------------------------------------------------------------------------
export type MatchStatus = 'SCHEDULED' | 'GENERATING' | 'PLAYING' | 'FINISHED' | 'CANCELLED';

export interface IMatchParticipant {
    name: string;
    walletAddress?: string;
    chain?: string;
    isBot: boolean;
}

export interface IMatchEvent {
    type: string;
    text: string;
    timestamp: Date;
}

export interface IMatchWinner {
    name: string;
    walletAddress?: string;
}

export interface IMatch extends Document {
    gameId: string;
    status: MatchStatus;
    scheduledAt?: Date;
    startedAt?: Date;
    endedAt?: Date;
    totalPlayers: number;
    participants: IMatchParticipant[];
    winner?: IMatchWinner;
    isDraw: boolean;
    events: IMatchEvent[];
    cancelReason?: string;
    createdAt: Date;
}

const matchParticipantSchema = new mongoose.Schema<IMatchParticipant>({
    name: { type: String, required: true },
    walletAddress: { type: String },
    chain: { type: String },
    isBot: { type: Boolean, required: true, default: false },
}, { _id: false });

const matchEventSchema = new mongoose.Schema<IMatchEvent>({
    type: { type: String, required: true },
    text: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
}, { _id: false });

const matchWinnerSchema = new mongoose.Schema<IMatchWinner>({
    name: { type: String, required: true },
    walletAddress: { type: String },
}, { _id: false });

const matchSchema = new mongoose.Schema<IMatch>({
    gameId: {
        type: String,
        required: true,
        unique: true,
    },
    status: {
        type: String,
        enum: ['SCHEDULED', 'GENERATING', 'PLAYING', 'FINISHED', 'CANCELLED'],
        required: true,
        default: 'SCHEDULED',
    },
    scheduledAt: { type: Date },
    startedAt: { type: Date },
    endedAt: { type: Date },
    totalPlayers: { type: Number, required: true },
    participants: { type: [matchParticipantSchema], default: [] },
    winner: { type: matchWinnerSchema },
    isDraw: { type: Boolean, default: false },
    events: { type: [matchEventSchema], default: [] },
    cancelReason: { type: String },
    createdAt: { type: Date, default: Date.now },
});

// Index for listing recent matches
matchSchema.index({ createdAt: -1 });

export const Match: Model<IMatch> = mongoose.model<IMatch>('Match', matchSchema);
