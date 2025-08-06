import { create } from 'zustand';
import { getRooms } from '@/app/actions/Room';

export interface Room {
  id: string;
  org_id: string;
  title: string;
  imageUrl: string;
  author_id: string;
  author_name: string;
  created_at: string;
}

interface RoomStore {
  rooms: Room[];
  isLoading: boolean;
  fetchRooms: (orgId: string) => Promise<void>;
}

export const useRoomStore = create<RoomStore>((set) => ({
  rooms: [],
  isLoading: false,
  fetchRooms: async (orgId: string) => {
    set({ isLoading: true });
    try {
      const rooms = await getRooms(orgId); // Use the existing `getRooms` action
      set({ rooms });
    } catch (error) {
      console.error('Failed to fetch rooms:', error);
    } finally {
      set({ isLoading: false });
    }
  },
})); 