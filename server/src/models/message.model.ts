import mongoose, { Document, Schema } from 'mongoose';

export interface IMessage extends Document {
  roomName: string;
  senderIdentity: string;
  senderName: string;
  message: string;
  timestamp: Date;
}

const messageSchema = new Schema<IMessage>({
  roomName: { type: String, required: true, index: true },
  senderIdentity: { type: String, required: true },
  senderName: { type: String, required: true },
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

messageSchema.index({ roomName: 1, timestamp: 1 });

export const Message = mongoose.model<IMessage>('Message', messageSchema);
