'use server'

import { createClient } from '@/utils/supabase/server';
import { auth } from '@clerk/nextjs/server';

type SaveWorkSessionInput = {
  org_id: string
  work_time_ms: number
  is_afk: boolean
  afk_count: number
}

type SaveWorkSessionResult = {
  success: boolean
  error?: string
}

/**
 * Persist the current work session snapshot to Supabase.
 */
export async function saveWorkSession(input: SaveWorkSessionInput): Promise<SaveWorkSessionResult> {
  try {
    const supabase = await createClient();
    const { userId } = await auth();
    
    if (!userId) {
      return { success: false, error: 'Unauthorized' };
    }

    // Get today's date in YYYY-MM-DD format
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];

    // Upsert work session data (update if exists, insert if not)
    const { error } = await supabase
      .from('work_sessions')
      .upsert({
        user_id: userId,
        org_id: input.org_id,
        date: dateStr,
        work_time_ms: input.work_time_ms, // Use work_time_ms to match database column
        is_afk: input.is_afk,
        afk_count: input.afk_count,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,org_id,date', // Assuming unique constraint on these columns
      });

    if (error) {
      // Check if table doesn't exist
      if (error.message?.includes('does not exist') || error.code === '42P01') {
        return { 
          success: false, 
          error: 'work_sessions table does not exist. Please run the database migration.' 
        };
      }
      return { success: false, error: error.message || 'Failed to save work session' };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message ?? 'Unknown error' };
  }
}
