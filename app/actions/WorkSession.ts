'use server'

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
 * Persist the current work session snapshot.
 * NOTE: This is a stub implementation to unblock runtime; integrate with your DB later.
 */
export async function saveWorkSession(input: SaveWorkSessionInput): Promise<SaveWorkSessionResult> {
  try {
    // TODO: Replace with real persistence (e.g., Prisma/SQL/REST)
    // Intentionally a no-op to avoid runtime errors until migrations exist.
    void input
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err?.message ?? 'Unknown error' }
  }
}
