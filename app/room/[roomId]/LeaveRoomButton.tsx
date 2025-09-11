'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { destroyRealtime } from '@/game/realtime/PlayerRealtime'

export default function LeaveRoomButton() {
	const router = useRouter()
	const [isLeaving, setIsLeaving] = useState(false)

	const handleLeave = useCallback(async () => {
		if (isLeaving) return
		setIsLeaving(true)
		try {
			await destroyRealtime()
		} catch {
			// ignore
		} finally {
			// Navigating away will unmount Phaser and trigger its cleanup
			router.replace('/dashboard')
		}
	}, [isLeaving, router])

	return (
		<div className="pointer-events-auto">
			<Button
				onClick={handleLeave}
				disabled={isLeaving}
				className="bg-red-500 hover:bg-red-600 text-white rounded-md px-4 py-2 shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-1 border-0 transition"
				size="sm"
			>
				Leave Room
			</Button>
		</div>
	)
}


