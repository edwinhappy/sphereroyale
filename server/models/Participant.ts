import mongoose, { Document, Model } from 'mongoose';

export interface IParticipant extends Document {
    username: string;
    walletAddress: string;
    chain: 'TON' | 'SOL';
    paymentTxHash: string;
    joinedAt: Date;
}

const participantSchema = new mongoose.Schema<IParticipant>({
    username: {
        type: String,
        required: true,
        trim: true,
        unique: true
    },
    walletAddress: {
        type: String,
        required: true,
        index: true
    },
    chain: {
        type: String,
        enum: ['TON', 'SOL'],
        required: true
    },
    paymentTxHash: {
        type: String,
        required: true,
        unique: true
    },
    joinedAt: {
        type: Date,
        default: Date.now
    }
});

export const Participant: Model<IParticipant> = mongoose.model<IParticipant>('Participant', participantSchema);
