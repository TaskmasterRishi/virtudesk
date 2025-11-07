"use client";

import { supabase } from "@/utils/supabase/client";

export const STORAGE_BUCKET = process.env.NEXT_PUBLIC_TASK_ATTACHMENTS_BUCKET || 'task-attachments'

export type UploadedAttachment = {
	file_name: string
	storage_path: string
	mime_type?: string
	size?: number
}

export async function uploadTaskAttachments(orgId: string, files: File[]): Promise<UploadedAttachment[]> {
	const results: UploadedAttachment[] = []
	if (!files || files.length === 0) return results

	for (const file of files) {
		const key = buildStorageKey('tasks', orgId, undefined, file.name)
		const { error } = await supabase.storage
			.from(STORAGE_BUCKET)
			.upload(key, file, { cacheControl: '3600', upsert: false, contentType: file.type || undefined })
		if (error) {
			if ((error as any)?.message?.toLowerCase?.().includes('bucket') && (error as any)?.message?.toLowerCase?.().includes('not found')) {
				throw new Error(`Storage bucket "${STORAGE_BUCKET}" not found. Create it in Supabase Storage or set NEXT_PUBLIC_TASK_ATTACHMENTS_BUCKET`)
			}
			throw error
		}
		results.push({
			file_name: file.name,
			storage_path: key,
			mime_type: file.type,
			size: file.size,
		})
	}
	return results
}

export function getTaskAttachmentPublicUrl(path: string) {
	if (!path) return ''
	const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path)
	return data?.publicUrl ?? ''
}

function buildStorageKey(prefix: 'tasks' | 'reports', orgId: string, taskId: string | undefined, originalName: string) {
	const ext = originalName.split('.').pop()
	const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext || 'bin'}`
	if (taskId) {
		return `${prefix}/${orgId}/${taskId}/${filename}`
	}
	return `${prefix}/${orgId}/${filename}`
}

export async function uploadReportAttachments(orgId: string, taskId: string, files: File[]): Promise<UploadedAttachment[]> {
	const results: UploadedAttachment[] = []
	if (!files || files.length === 0) return results

	for (const file of files) {
		const key = buildStorageKey('reports', orgId, taskId, file.name)
		const { error } = await supabase.storage
			.from(STORAGE_BUCKET)
			.upload(key, file, { cacheControl: '3600', upsert: false, contentType: file.type || undefined })
		if (error) {
			if ((error as any)?.message?.toLowerCase?.().includes('bucket') && (error as any)?.message?.toLowerCase?.().includes('not found')) {
				throw new Error(`Storage bucket "${STORAGE_BUCKET}" not found. Create it in Supabase Storage or set NEXT_PUBLIC_TASK_ATTACHMENTS_BUCKET`)
			}
			throw error
		}
		results.push({
			file_name: file.name,
			storage_path: key,
			mime_type: file.type,
			size: file.size,
		})
	}
	return results
}


