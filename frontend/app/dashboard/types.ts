export type Connection = {
  id: string;
  user: { id: string; email: string; name: string | null; avatarUrl?: string | null };
};

export type Message = {
  id: string;
  text: string;
  senderId: string;
  recipientId?: string;
  createdAt: string;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  attachmentType?: string | null;
  readAt?: string | null;
  editedAt?: string | null;
  replyTo?: {
    id: string;
    text: string;
    senderId: string;
    attachmentName?: string | null;
  } | null;
};

export type ReplyPreview = {
  id: string;
  text: string;
  senderId: string;
  attachmentName?: string | null;
  senderName?: string;
};

export type Reaction = { emoji: string; count: number; userReacted: boolean };

export type SearchResult = {
  messageId: string;
  peerId: string;
  peerName: string | null;
  peerEmail: string;
  text: string;
  createdAt: string;
};

export type ThreadResponse = { messages: Message[]; hasMore: boolean; nextCursor?: string };

export type Grouped = { title: string; items: (Message | RoomMessage)[] };

export type AttachmentDraft = {
  type: 'media' | 'file';
  name: string;
  file: File;
  preview?: string;
  size: number;
};

export type InviteItem = {
  id: string;
  token: string;
  toEmail: string | null;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
  usedById: string | null;
  status: 'active' | 'expired' | 'used';
  link: string;
};

export type Room = {
  id: string;
  name: string;
  owner: { id: string; email: string; name: string | null; avatarUrl?: string | null };
  joinedAt: string;
  isOwner: boolean;
  expiresAt?: string;
};

export type RoomMessage = {
  id: string;
  text: string;
  senderId: string;
  createdAt: string;
  systemEventType?: string;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  attachmentType?: string | null;
  editedAt?: string | null;
  replyTo?: {
    id: string;
    text: string;
    senderId: string;
    attachmentName?: string | null;
  } | null;
  sender: { id: string; email: string; name: string | null; avatarUrl?: string | null };
};

export type RoomThreadResponse = {
  messages: RoomMessage[];
  hasMore: boolean;
  nextCursor?: string;
};

