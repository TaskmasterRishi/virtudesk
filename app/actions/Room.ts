"use server";

import { createClient } from '@/utils/supabase/server';

// Define the type for the room data
export type RoomData = {
  name: string;
  org_id: string;
  thumbnail: string;
};

export const createRoom = async ({ name, org_id }: { name: string; org_id: string }) => {
  const supabase = await createClient();

  const thumbnailNumber = Math.floor(Math.random() * 10) + 1;
  const thumbnailUrl = `/thumbnails/${thumbnailNumber}.jpeg`;

  const { data, error } = await supabase
    .from('rooms')
    .insert([{
      name,
      org_id, // Use the passed org_id
      thumbnail: thumbnailUrl,
    }])
    .select();

  if (error) throw error;
  return data;
};

export const getRooms = async (org_id: string) => {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('org_id', org_id);

  if (error) throw error;
  return data;
};
