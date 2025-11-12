'use server'

import fs from 'fs'
import os from 'os'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'

// ──────────────────────────────────────────────
// FIX: Allow duplex for fetch (Node.js limitation)
// ──────────────────────────────────────────────
declare global {
  interface RequestInit {
    duplex?: 'half'
  }
}

// ──────────────────────────────────────────────
// ENVIRONMENT VARIABLES
// ──────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY!
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY!

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)
  throw new Error('❌ Missing Supabase keys.')
if (!ASSEMBLYAI_API_KEY)
  throw new Error('❌ Missing AssemblyAI key.')
if (!HUGGINGFACE_API_KEY)
  throw new Error('❌ Missing Hugging Face key.')

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// ──────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────
export type participantDataType = {
  id: string
  name?: string
  offset: number
  chunks: Blob[]
  isFinished: boolean
}

export type MeetingSummary = {
  summary: string
  keyPoints: string[]
  participants: string[]
  participantNames: Record<string, string>
  transcriptions: { id: string; name?: string; text: string }[]
  duration: number
  startTime: string
  endTime: string
}

// ──────────────────────────────────────────────
// IN-MEMORY STORAGE
// ──────────────────────────────────────────────
const participantData: Record<string, participantDataType> = {}
let meetingStartTime: number | null = null

// ──────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────
async function blobToTempFile(blob: Blob, prefix = 'audio'): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const tmpPath = path.join(os.tmpdir(), `${prefix}-${Date.now()}.webm`)
  await fs.promises.writeFile(tmpPath, buffer)
  return tmpPath
}
async function removeFile(p: string) {
  try {
    await fs.promises.unlink(p)
  } catch {}
}

// ──────────────────────────────────────────────
// 1️⃣ TRANSCRIBE WITH ASSEMBLYAI
// ──────────────────────────────────────────────
async function transcribeWithAssemblyAI(blob: Blob): Promise<string> {
  const tmpPath = await blobToTempFile(blob)
  try {
    console.log('🎙️ Uploading audio to AssemblyAI...')

    const uploadResp = await fetch('https://api.assemblyai.com/v2/upload', {
      method: 'POST',
      headers: { authorization: ASSEMBLYAI_API_KEY },
      body: fs.createReadStream(tmpPath) as any,
      duplex: 'half',
    })
    const { upload_url } = await uploadResp.json()

    console.log('🔗 Uploaded. Starting transcription job...')
    const transcriptReq = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        authorization: ASSEMBLYAI_API_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ audio_url: upload_url }),
      duplex: 'half',
    })
    const job = await transcriptReq.json()

    // Poll until finished
    let status = job.status
    let result: any = null
    while (status !== 'completed' && status !== 'error') {
      await new Promise((r) => setTimeout(r, 3000))
      const poll = await fetch(`https://api.assemblyai.com/v2/transcript/${job.id}`, {
        headers: { authorization: ASSEMBLYAI_API_KEY },
      })
      result = await poll.json()
      status = result.status
    }

    if (status === 'completed') {
      console.log('✅ Transcription complete. Length:', result.text?.length || 0)
      return result.text || ''
    }
    console.error('❌ AssemblyAI error:', result?.error)
    return ''
  } catch (err) {
    console.error('⚠️ AssemblyAI failed:', err)
    return ''
  } finally {
    await removeFile(tmpPath)
  }
}

// ──────────────────────────────────────────────
// 2️⃣ SUMMARIZE WITH HUGGINGFACE (UPDATED ENDPOINT)
// ──────────────────────────────────────────────
async function summarizeWithHuggingFace(transcript: string) {
  try {
    const model = 'facebook/bart-large-cnn'
    const apiUrl = `https://router.huggingface.co/hf-inference/models/${model}`

    console.log('🧾 Full transcript being summarized:', transcript.slice(0, 500))

    const resp = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${HUGGINGFACE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: transcript.slice(0, 4000) }),
    })
    const data = await resp.json()

    if (data?.error?.includes('loading')) {
      console.log('⚙️ Model loading... retrying in 15s')
      await new Promise((r) => setTimeout(r, 15000))
      return await summarizeWithHuggingFace(transcript)
    }

    if (data?.error) {
      console.error('❌ Hugging Face API error:', data.error)
      return { summary: `Hugging Face API error: ${data.error}`, keyPoints: [] }
    }

    const text =
      Array.isArray(data) && data[0]?.summary_text
        ? data[0].summary_text
        : typeof data === 'string'
        ? data
        : ''

    if (!text) {
      console.warn('⚠️ No summary returned:', data)
      return { summary: 'No summary returned.', keyPoints: ['No summary returned'] }
    }

    const keyPoints = text
      .split(/[.?!]/)
      .map((t: string) => t.trim())
      .filter((t: string) => t.length > 4)
      .slice(0, 5)

    console.log('🧠 Hugging Face summary generated successfully.')
    console.log('📝 Summary Preview:', text.slice(0, 200))
    return { summary: text, keyPoints }
  } catch (err) {
    console.error('❌ Hugging Face summarization failed:', err)
    return { summary: '', keyPoints: [] }
  }
}

// ──────────────────────────────────────────────
// 3️⃣ MEETING ACTIONS
// ──────────────────────────────────────────────
export async function Init(startTime: number) {
  meetingStartTime = startTime
  for (const k of Object.keys(participantData)) delete participantData[k]
  console.log('🟢 Meeting initialized at', new Date(startTime).toISOString())
  return true
}

export async function setNewParticipantServerAction(p: participantDataType) {
  participantData[p.id] = { ...p, chunks: [], isFinished: false }
  console.log(`👤 Added participant ${p.id} (${p.name ?? 'Unnamed'})`)
  return true
}

export async function setParticipantBlobChunk(id: string, blob: Blob, timestamp: number) {
  const p = participantData[id]
  if (!p) {
    console.warn(`⚠️ setParticipantBlobChunk: no participant for ID ${id}`)
    return false
  }
  p.chunks.push(blob)
  p.offset = timestamp
  console.log(`📦 Received blob from ${p.name || id} (${blob.size} bytes)`)
  return true
}

export async function stopRecorder(id: string, stopTime: number) {
  const p = participantData[id]
  if (!p || p.chunks.length === 0) {
    console.warn(`⚠️ No data to stopRecorder for ID ${id}`)
    return null
  }

  p.isFinished = true
  const combined = new Blob(p.chunks, { type: 'audio/webm;codecs=opus' })
  console.log(`🎧 Stopping recorder for ${p.name || id}. Blob size: ${combined.size} bytes`)
  const text = await transcribeWithAssemblyAI(combined)
  console.log(`📝 Transcript for ${p.name || id}: ${text.slice(0, 200)}`)
  return { id, name: p.name ?? id, text }
}

export async function stopMeeting(roomId: string): Promise<MeetingSummary | null> {
  if (!meetingStartTime) {
    console.error('⚠️ Meeting start time not set.')
    return null
  }

  const participants = Object.values(participantData)
  const endTime = Date.now()
  const duration = endTime - meetingStartTime

  console.log('\n===============================')
  console.log('🛑 Meeting Ended')
  console.log(`🕒 Duration: ${(duration / 60000).toFixed(2)} minutes`)
  console.log(`📦 Participants: ${participants.length}`)
  console.log('===============================\n')

  const transcriptions: { id: string; name?: string; text: string }[] = []

  for (const p of participants) {
    console.log(`🎤 [${p.name || p.id}] Processing ${p.chunks.length} chunks...`)
    if (p.chunks.length === 0) {
      transcriptions.push({ id: p.id, name: p.name, text: '' })
      continue
    }
    const combined = new Blob(p.chunks, { type: 'audio/webm;codecs=opus' })
    console.log(`📀 [${p.name || p.id}] Combined blob size: ${(combined.size / 1024).toFixed(2)} KB`)
    const text = await transcribeWithAssemblyAI(combined)
    console.log(`📝 [${p.name || p.id}] Transcript:\n${text.slice(0, 200)}${text.length > 200 ? '...' : ''}`)
    transcriptions.push({ id: p.id, name: p.name, text })
  }

  const fullTranscript = transcriptions.map((t) => `${t.name ?? t.id}: ${t.text}`).join('\n')
  const { summary, keyPoints } = await summarizeWithHuggingFace(fullTranscript)
  const participantNames = Object.fromEntries(participants.map((p) => [p.id, p.name ?? 'Unknown']))

  const result: MeetingSummary = {
    summary,
    keyPoints,
    participants: participants.map((p) => p.id),
    participantNames,
    transcriptions,
    duration,
    startTime: new Date(meetingStartTime).toISOString(),
    endTime: new Date(endTime).toISOString(),
  }

  console.log('\n✅ Meeting summarized successfully!')
  console.log('📋 Summary:', summary.slice(0, 200))
  console.log('📌 Key Points:', keyPoints)

  await saveMeetingSummary(result, roomId)
  return result
}

export async function saveMeetingSummary(summary: MeetingSummary, roomId: string) {
  console.log('💾 Attempting to save meeting summary to Supabase...')
  try {
    const orgId = process.env.DEFAULT_ORG_ID ?? 'org_default'
    const createdBy = process.env.SYSTEM_USER_ID ?? 'system'

    const { data, error } = await supabase
      .from('meeting_summaries')
      .insert({
        room_id: roomId,
        org_id: orgId,
        created_by: createdBy,
        summary_text: summary.summary,
        key_points: summary.keyPoints,
        participants: summary.participants,
        participant_names: summary.participantNames,
        duration_ms: summary.duration,
        start_time: summary.startTime,
        end_time: summary.endTime,
        transcriptions: summary.transcriptions,
      })
      .select()

    if (error) {
      console.error('❌ Supabase insert error:', error)
      return null
    }

    console.log('✅ Saved meeting summary to Supabase successfully:', data)
    return data
  } catch (err) {
    console.error('⚠️ Error saving summary:', err)
    return null
  }
}

/**
 * Gets meeting summaries for a specific room
 */




// ✅ Create Supabase client once

export async function getMeetingSummaries(roomId: string): Promise<any[]> {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  try {
    const { userId } = await auth();

    if (!userId) {
      console.warn('⚠️ No logged-in user found.');
      return [];
    }

    const { data, error } = await supabase
      .from('meeting_summaries')
      .select('*')
      .eq('room_id', roomId)
      .order('start_time', { ascending: false });

    if (error) {
      console.error('❌ Error fetching meeting summaries:', error);
      return [];
    }

    console.log(`✅ Fetched ${data?.length || 0} summaries for room:`, roomId);
    return data || [];
  } catch (err) {
    console.error('⚠️ Error in getMeetingSummaries():', err);
    return [];
  }
}


