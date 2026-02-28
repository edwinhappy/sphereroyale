import mongoose, { Document, Model } from 'mongoose';

export interface ISchedule extends Document {
    type: string;
    nextGameTime: Date | null;
    totalPlayers: number;
    updatedAt: Date;
}

const scheduleSchema = new mongoose.Schema<ISchedule>({
    type: { type: String, required: true, unique: true, default: 'main' },
    nextGameTime: { type: Date, default: null },
    totalPlayers: { type: Number, required: true },
    updatedAt: { type: Date, default: Date.now }
});

export const Schedule: Model<ISchedule> = mongoose.model<ISchedule>('Schedule', scheduleSchema);
