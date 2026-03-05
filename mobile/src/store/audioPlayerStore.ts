import { create } from 'zustand';

interface AudioPlayerStore {
    currentPlayingId: string | null;
    play: (messageId: string) => void;
    stop: () => void;
}

export const useAudioPlayerStore = create<AudioPlayerStore>((set) => ({
    currentPlayingId: null,
    play: (messageId) => set({ currentPlayingId: messageId }),
    stop: () => set({ currentPlayingId: null }),
}));
