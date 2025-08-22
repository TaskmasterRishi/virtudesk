import { create } from 'zustand';
import { getRooms, deleteRoom as deleteRoomAction, renameRoom as renameRoomAction } from '@/app/actions/Room';

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
  deleteRoom: (roomId: string) => Promise<void>;
  renameRoom: (roomId: string, title: string) => Promise<void>;
}

export const useRoomStore = create<RoomStore>((set, get) => ({
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
  deleteRoom: async (roomId: string) => {
    try {
      await deleteRoomAction(roomId);
      const { rooms } = get();
      set({ rooms: rooms.filter(r => r.id !== roomId) });
    } catch (error) {
      console.error('Failed to delete room:', error);
    }
  },
  renameRoom: async (roomId: string, title: string) => {
    try {
      await renameRoomAction(roomId, title);
      const { rooms } = get();
      set({
        rooms: rooms.map(r => (r.id === roomId ? { ...r, title } : r)),
      });
    } catch (error) {
      console.error('Failed to rename room:', error);
    }
  },
}));