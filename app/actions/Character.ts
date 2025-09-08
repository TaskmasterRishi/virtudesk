"use server";

import { createClient } from '@/utils/supabase/server';

export const getUserCharacter = async (user_id: string) => {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('user_characters')
    .select('*')
    .eq('user_id', user_id)
    .single();

  if (error) {
    console.error('Error fetching user character:', error);
    return null;
  }
  return data;
};

export const setUserCharacter = async (user_id: string, character_id: string) => {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('user_characters')
    .upsert([{ user_id, character_id }], { onConflict: 'user_id' })
    .select()
    .single();

  if (error) {
    console.error('Error upserting user character:', error);
    throw error;
  }
  return data;
};
export const createCharacter = async (user_id: string, character_name: string) => {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('characters')
    .insert([{ user_id, character_name }])
    .select()
    .single();

  if (error) {
    console.error('Error creating character:', error);
    throw error;
  }
  return data;
};

