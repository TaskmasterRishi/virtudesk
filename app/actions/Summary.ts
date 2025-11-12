"use server"

import { createClient } from '@/utils/supabase/server';
import { auth } from '@clerk/nextjs/server';

let globalStart:null | number=null;
export type participantDataType={
    id:string,
    offset:number
    chunks:BlobPart[],
    isFinished:boolean,
    endedAt?:number
}
const participants:Map<string,participantDataType>=new Map()
const transcriptions:Map<string,ParticipantTranscription>=new Map()

export type TranscriptionResult = {
    text: string;
    confidence: number;
    words?: Array<{
        word: string;
        start: number;
        end: number;
        confidence: number;
    }>;
}

export type ParticipantTranscription = {
    participantId: string;
    offset: number; // Time since meeting started (ms)
    endedAt?: number; // When recording ended (ms)
    transcription: TranscriptionResult | null;
}

export type MeetingSummary = {
    summary: string;
    keyPoints: string[];
    participants: string[];
    duration: number; // Meeting duration in ms
    transcriptions: ParticipantTranscription[];
    startTime?: number; // Meeting start timestamp
    endTime?: number; // Meeting end timestamp
}

export async function Init(a:number): Promise<void>{
    globalStart=a;
    participants.clear();
    transcriptions.clear();
}
export async function stopMeeting(roomId: string): Promise<MeetingSummary | null> {
    if (globalStart === null) {
        return null;
    }

    const meetingEndTime = Date.now();
    const meetingDuration = meetingEndTime - globalStart;

    // Step 1: Transcribe all participants who haven't been transcribed yet
    const transcriptionPromises: Promise<void>[] = [];
    
    for (const [id, participant] of participants.entries()) {
        if (!participant.isFinished && participant.chunks.length > 0) {
            // Mark as finished and transcribe
            participant.isFinished = true;
            participant.endedAt = meetingEndTime;
            
            const transcriptionPromise = (async () => {
                const blob = new Blob(participant.chunks, { type: 'audio/webm' });
                const transcription = await transcribeAudio(blob);
                
                transcriptions.set(id, {
                    participantId: id,
                    offset: participant.offset - globalStart, // Relative to meeting start
                    endedAt: participant.endedAt ? participant.endedAt - globalStart : undefined,
                    transcription: transcription,
                });
            })();
            
            transcriptionPromises.push(transcriptionPromise);
        } else if (participant.isFinished) {
            // Already transcribed, just store the metadata
            transcriptions.set(id, {
                participantId: id,
                offset: participant.offset - globalStart,
                endedAt: participant.endedAt ? participant.endedAt - globalStart : undefined,
                transcription: null, // Will be set if transcription was successful
            });
        }
    }

    // Wait for all transcriptions to complete
    await Promise.all(transcriptionPromises);

    // Step 2: Collect all transcriptions with their offsets
    const allTranscriptions: ParticipantTranscription[] = [];
    for (const [id, transcription] of transcriptions.entries()) {
        allTranscriptions.push(transcription);
    }

    // Sort by offset (time in meeting)
    allTranscriptions.sort((a, b) => a.offset - b.offset);

    // Step 3: Format transcriptions with timestamps for summary
    const formattedTranscript = formatTranscriptWithTimestamps(allTranscriptions, globalStart);

    // Step 4: Generate summary using free AI model
    const summary = await generateMeetingSummary(formattedTranscript, allTranscriptions, meetingDuration);

    // Store start time before clearing
    const meetingStartTime = globalStart;

    // Step 5: Clear data
    globalStart = null;
    participants.clear();
    transcriptions.clear();

    // Add start and end times to summary for storage
    if (summary && meetingStartTime) {
        summary.startTime = meetingStartTime;
        summary.endTime = meetingEndTime;
    }

    return summary;
}
export async function setNewParticipantServerAction(p:participantDataType): Promise<void>{
    if(p.id === "notSet"){
        console.warn("setNewParticipantServerAction called with 'notSet' ID");
        return;
    }
    console.log(`[${p.id}] Setting new participant at offset: ${p.offset}`);
    participants.set(p.id, p);
    console.log(`[${p.id}] Participant set. Total participants: ${participants.size}`);
}
export async function setParticipantOffset(a:number): Promise<void>{

}
export async function setParticipantBlobChunk(id:string,blob:BlobPart): Promise<void>{
    const p = participants.get(id);
    if (p) {
        const blobSize = (blob as Blob).size || 0;
        console.log(`[${id}] Chunk size received: ${blobSize} bytes`);
        p.chunks.push(blob);
    } else {
        console.warn(`[${id}] No participant found. Available participants:`, Array.from(participants.keys()));
    }
}



/**
 * Converts audio blob to text using AssemblyAI (Free tier: 5 hours/month)
 * @param audioBlob - The audio blob to transcribe
 * @returns Transcription result with text and confidence
 */
async function transcribeAudio(audioBlob: Blob): Promise<TranscriptionResult | null> {
    const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;
    
    if (!ASSEMBLYAI_API_KEY) {
        console.error("ASSEMBLYAI_API_KEY is not set in environment variables");
        return null;
    }

    try {
        // Step 1: Upload audio file to AssemblyAI
        const uploadResponse = await fetch("https://api.assemblyai.com/v2/upload", {
            method: "POST",
            headers: {
                authorization: ASSEMBLYAI_API_KEY,
            },
            body: audioBlob,
        });

        if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            const errorData = JSON.parse(errorText).error || errorText;
            console.error("Failed to upload audio:", errorData);
            
            // Check if it's a quota/limit error
            if (uploadResponse.status === 402 || errorText.includes("quota") || errorText.includes("limit")) {
                console.error("AssemblyAI free tier limit reached. You've used all 5 hours this month.");
            }
            return null;
        }

        const { upload_url } = await uploadResponse.json();

        // Step 2: Submit transcription request
        const transcriptResponse = await fetch("https://api.assemblyai.com/v2/transcript", {
            method: "POST",
            headers: {
                authorization: ASSEMBLYAI_API_KEY,
                "content-type": "application/json",
            },
            body: JSON.stringify({
                audio_url: upload_url,
                language_code: "en_us", // Change if needed
                punctuate: true,
                format_text: true,
            }),
        });

        if (!transcriptResponse.ok) {
            const errorText = await transcriptResponse.text();
            let errorData;
            try {
                errorData = JSON.parse(errorText).error || errorText;
            } catch {
                errorData = errorText;
            }
            console.error("Failed to submit transcription:", errorData);
            
            // Check if it's a quota/limit error
            if (transcriptResponse.status === 402 || errorText.includes("quota") || errorText.includes("limit")) {
                console.error("AssemblyAI free tier limit reached. You've used all 5 hours this month.");
            }
            return null;
        }

        const { id } = await transcriptResponse.json();

        // Step 3: Poll for transcription result
        let transcriptResult;
        let pollingAttempts = 0;
        const maxAttempts = 60; // 5 minutes max (5 seconds * 60)

        while (pollingAttempts < maxAttempts) {
            const pollingResponse = await fetch(
                `https://api.assemblyai.com/v2/transcript/${id}`,
                {
                    headers: {
                        authorization: ASSEMBLYAI_API_KEY,
                    },
                }
            );

            transcriptResult = await pollingResponse.json();

            if (transcriptResult.status === "completed") {
                return {
                    text: transcriptResult.text || "",
                    confidence: transcriptResult.confidence || 0,
                    words: transcriptResult.words,
                };
            } else if (transcriptResult.status === "error") {
                console.error("Transcription error:", transcriptResult.error);
                    console.log("✅ Transcript text:", transcriptResult.text);
                    console.log("🧠 Confidence:", transcriptResult.confidence);
                return null;
            }

            // Wait 5 seconds before polling again
            await new Promise((resolve) => setTimeout(resolve, 5000));
            pollingAttempts++;
        }

        console.error("Transcription timeout");
        return null;
    } catch (error) {
        console.error("Error in transcribeAudio:", error);
        return null;
    }
}

export async function stopRecorder(id:string,t:number): Promise<TranscriptionResult | null> {
    if(id === "notSet"){
        console.warn(`[${id}] stopRecorder called with "notSet" ID`);
        return null;
    }
    
    const p = participants.get(id);
    if(!p){
        console.error(`[${id}] Participant not found in stopRecorder. Available:`, Array.from(participants.keys()));
        return null;
    }
    
    if(p.chunks.length === 0){
        console.warn(`[${id}] No audio chunks recorded for participant`);
        return null;
    }
    
    console.log(`[${id}] Stopping recorder. Total chunks: ${p.chunks.length}`);
    p.isFinished = true;
    p.endedAt = t;
    
    const blob = new Blob(p.chunks, { type: 'audio/webm' });
    console.log(`[${id}] Created blob size: ${blob.size} bytes`);
    
    if(blob.size === 0){
        console.warn(`[${id}] Blob is empty, cannot transcribe`);
        return null;
    }
    
    // Convert audio to text
    const transcription = await transcribeAudio(blob);
    
    if(!transcription){
        console.error(`[${id}] Transcription failed`);
        return null;
    }
    
    console.log(`[${id}] Transcription successful: ${transcription.text.substring(0, 50)}...`);
    
    // Store transcription with offset
    if (globalStart !== null) {
        transcriptions.set(id, {
            participantId: id,
            offset: p.offset - globalStart, // Relative to meeting start
            endedAt: t - globalStart,
            transcription: transcription,
        });
    } else {
        console.warn(`[${id}] globalStart is null, cannot store transcription offset`);
    }
    
    return transcription;
}

/**
 * Formats transcriptions with timestamps for summary generation
 */
function formatTranscriptWithTimestamps(
    transcriptions: ParticipantTranscription[],
    meetingStart: number
): string {
    let formatted = "Meeting Transcript:\n\n";
    
    for (const trans of transcriptions) {
        if (!trans.transcription || !trans.transcription.text) continue;
        
        const timeInMinutes = Math.floor(trans.offset / 60000);
        const timeInSeconds = Math.floor((trans.offset % 60000) / 1000);
        const timeString = `${timeInMinutes}:${timeInSeconds.toString().padStart(2, '0')}`;
        
        formatted += `[${timeString}] Participant ${trans.participantId}:\n`;
        formatted += `${trans.transcription.text}\n\n`;
    }
    
    return formatted;
}

/**
 * Generates meeting summary using Hugging Face Inference API (Free, no credit card required)
 * Uses facebook/bart-large-cnn model for summarization
 */
async function generateMeetingSummary(
    formattedTranscript: string,
    transcriptions: ParticipantTranscription[],
    duration: number
): Promise<MeetingSummary | null> {
    // If no transcriptions, return empty summary
    if (transcriptions.length === 0 || formattedTranscript.trim().length === 0) {
        return {
            summary: "No transcriptions available for this meeting.",
            keyPoints: [],
            participants: [],
            duration: duration,
            transcriptions: transcriptions,
        };
    }

    // Extract participant IDs
    const participantIds = [...new Set(transcriptions.map(t => t.participantId))];

    try {
        // Use Hugging Face Inference API (completely free, no API key needed for public models)
        // Using facebook/bart-large-cnn which is a good summarization model
        const response = await fetch(
            "https://api-inference.huggingface.co/models/facebook/bart-large-cnn",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    inputs: formattedTranscript,
                    parameters: {
                        max_length: 200, // Summary length
                        min_length: 50,
                        do_sample: false,
                    },
                }),
            }
        );

        if (!response.ok) {
            // If model is loading, wait and retry
            if (response.status === 503) {
                console.log("Model is loading, waiting 10 seconds...");
                await new Promise(resolve => setTimeout(resolve, 10000));
                return generateMeetingSummary(formattedTranscript, transcriptions, duration);
            }
            
            const errorText = await response.text();
            console.error("Failed to generate summary:", errorText);
            
            // Fallback: Create a simple summary from transcript
            return createFallbackSummary(formattedTranscript, transcriptions, duration, participantIds);
        }

        const result = await response.json();
        const summaryText = Array.isArray(result) ? result[0]?.summary_text || result[0]?.generated_text : result.summary_text || result.generated_text || "";

        // Extract key points (simple extraction - can be improved)
        const keyPoints = extractKeyPoints(formattedTranscript, summaryText);

        return {
            summary: summaryText || "Summary generation failed.",
            keyPoints: keyPoints,
            participants: participantIds,
            duration: duration,
            transcriptions: transcriptions,
        };
    } catch (error) {
        console.error("Error generating summary:", error);
        return createFallbackSummary(formattedTranscript, transcriptions, duration, participantIds);
    }
}

/**
 * Creates a fallback summary if AI summarization fails
 */
function createFallbackSummary(
    transcript: string,
    transcriptions: ParticipantTranscription[],
    duration: number,
    participantIds: string[]
): MeetingSummary {
    const lines = transcript.split('\n').filter(line => line.trim().length > 0);
    const firstFewLines = lines.slice(0, 5).join(' ');
    
    return {
        summary: `Meeting transcript summary: ${firstFewLines.substring(0, 200)}...`,
        keyPoints: extractKeyPoints(transcript, ""),
        participants: participantIds,
        duration: duration,
        transcriptions: transcriptions,
    };
}

/**
 * Extracts key points from transcript (simple implementation)
 */
function extractKeyPoints(transcript: string, summary: string): string[] {
    const keyPoints: string[] = [];
    
    // Simple extraction: Look for sentences with action words or important phrases
    const sentences = transcript.split(/[.!?]+/).filter(s => s.trim().length > 20);
    
    // Look for sentences with action words
    const actionWords = ['decided', 'agreed', 'will', 'should', 'need', 'important', 'action', 'task', 'deadline'];
    
    for (const sentence of sentences) {
        const lowerSentence = sentence.toLowerCase();
        if (actionWords.some(word => lowerSentence.includes(word))) {
            const trimmed = sentence.trim().substring(0, 150);
            if (trimmed.length > 20 && !keyPoints.includes(trimmed)) {
                keyPoints.push(trimmed);
                if (keyPoints.length >= 5) break; // Limit to 5 key points
            }
        }
    }
    
    return keyPoints.length > 0 ? keyPoints : ["No specific key points identified."];
}

/**
 * Saves meeting summary to Supabase
 */
export async function saveMeetingSummary(summary: MeetingSummary, roomId: string): Promise<boolean> {
    try {
        const supabase = await createClient();
        const { userId, orgId } = await auth();

        if (!userId || !orgId) {
            console.error("User not authenticated");
            return false;
        }

        const meetingStartTime = summary.startTime 
            ? new Date(summary.startTime).toISOString()
            : new Date(Date.now() - summary.duration).toISOString();
        const meetingEndTime = summary.endTime
            ? new Date(summary.endTime).toISOString()
            : new Date().toISOString();

        const { error } = await supabase
            .from('meeting_summaries')
            .insert({
                room_id: roomId,
                org_id: orgId,
                created_by: userId,
                summary_text: summary.summary,
                key_points: summary.keyPoints,
                participants: summary.participants,
                duration_ms: summary.duration,
                start_time: meetingStartTime,
                end_time: meetingEndTime,
                transcriptions: summary.transcriptions.map(t => ({
                    participant_id: t.participantId,
                    offset: t.offset,
                    ended_at: t.endedAt,
                    transcription_text: t.transcription?.text || null,
                    confidence: t.transcription?.confidence || null,
                })),
            });

        if (error) {
            console.error("Error saving meeting summary:", error);
            return false;
        }

        return true;
    } catch (error) {
        console.error("Error in saveMeetingSummary:", error);
        return false;
    }
}

/**
 * Gets all meeting summaries for an organization
 */
export async function getMeetingSummaries(orgId: string): Promise<any[]> {
    try {
        const supabase = await createClient();
        const { userId } = await auth();

        if (!userId || !orgId) {
            return [];
        }

        const { data, error } = await supabase
            .from('meeting_summaries')
            .select('*')
            .eq('org_id', orgId)
            .order('start_time', { ascending: false });

        if (error) {
            console.error("Error fetching meeting summaries:", error);
            return [];
        }

        return data || [];
    } catch (error) {
        console.error("Error in getMeetingSummaries:", error);
        return [];
    }
}

/**
 * Gets meeting summaries for a specific room
 */
export async function getRoomMeetingSummaries(roomId: string): Promise<any[]> {
    try {
        const supabase = await createClient();
        const { userId } = await auth();

        if (!userId) {
            return [];
        }

        const { data, error } = await supabase
            .from('meeting_summaries')
            .select('*')
            .eq('room_id', roomId)
            .order('start_time', { ascending: false });

        if (error) {
            console.error("Error fetching room meeting summaries:", error);
            return [];
        }

        return data || [];
    } catch (error) {
        console.error("Error in getRoomMeetingSummaries:", error);
        return [];
    }
}

