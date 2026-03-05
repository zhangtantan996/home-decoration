import { create } from 'zustand';

export interface ConversationPreview {
  topic: string;
  name: string;
  avatar?: string;
  lastMessage: string;
  touchedAt: number;
  unread: number;
}

interface ChatState {
  conversations: ConversationPreview[];
  loading: boolean;
  initialized: boolean;
  error: string | null;
  setConversations: (conversations: ConversationPreview[]) => void;
  setLoading: (loading: boolean) => void;
  setInitialized: (initialized: boolean) => void;
  setError: (error: string | null) => void;
  clear: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  conversations: [],
  loading: false,
  initialized: false,
  error: null,
  setConversations: (conversations) => set({ conversations }),
  setLoading: (loading) => set({ loading }),
  setInitialized: (initialized) => set({ initialized }),
  setError: (error) => set({ error }),
  clear: () =>
    set({
      conversations: [],
      loading: false,
      initialized: false,
      error: null,
    }),
}));

