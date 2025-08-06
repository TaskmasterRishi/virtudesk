"use server";

import { createClient } from '@/utils/supabase/server';
import type { Rooms } from '@/app/dashboard/page';

export const getRooms = async (org_id: string) => {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('org_id', org_id);

  if (error) throw error;
  return data;
};

export const createRoom = async (roomData: Omit<Rooms, 'id' | 'created_at'>) => {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('rooms')
    .insert([roomData])
    .select();

  if (error) throw error;
  return data;
};
