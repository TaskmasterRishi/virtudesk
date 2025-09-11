'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { getAllPlayers, getSelfId, requestCall } from '@/game/realtime/PlayerRealtime'

type PlayerInfo = { id: string; name?: string; character?: string }

export default function PlayersPanel() {
	const [open, setOpen] = useState(false)
	const [players, setPlayers] = useState<PlayerInfo[]>([])
	const [busy, setBusy] = useState<string | null>(null)
	const selfId = getSelfId()

	const refresh = useCallback(() => {
		const all = getAllPlayers()
		const filtered = all.filter((p) => p.id && p.id !== selfId)
		setPlayers(filtered)
	}, [selfId])

	useEffect(() => {
		if (!open) return
		refresh()
		const t = setInterval(refresh, 1000)
		return () => clearInterval(t)
	}, [open, refresh])

	const handleVideoRequest = useCallback(async (id: string) => {
		if (busy) return
		setBusy(id)
		try {
			await requestCall(id)
		} finally {
			setBusy(null)
		}
	}, [busy])

	return (
		<>
			{/* Bottom-right toggle button (just above Leave Room) */}
			<div className="absolute bottom-16 right-4 z-50 pointer-events-auto">
				<Button
					onClick={() => setOpen((v) => !v)}
					className="bg-slate-800 hover:bg-slate-700 text-white rounded-md px-4 py-2 shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 transition"
					size="sm"
				>
					{open ? 'Hide Players' : 'Show Players'}
				</Button>
			</div>

			{/* Right-middle players list panel */}
			{open && (
				<div className="absolute right-4 top-1/2 -translate-y-1/2 z-50 pointer-events-auto">
					<div className="w-72 max-h-96 overflow-y-auto rounded-md bg-white/95 backdrop-blur border border-slate-200 shadow-xl p-3">
						<div className="text-sm font-semibold text-slate-700 mb-2">Players in Room</div>
						<div className="flex flex-col gap-2">
							{players.length === 0 && (
								<div className="text-slate-500 text-sm">No players found.</div>
							)}
							{players.map((p) => (
								<div key={p.id} className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
									<div className="min-w-0">
										<div className="text-slate-800 text-sm truncate">{p.name || p.id}</div>
										<div className="text-slate-500 text-xs truncate">{p.character || 'Unknown'}</div>
									</div>
									<Button
										className="bg-indigo-600 hover:bg-indigo-700 text-white rounded px-3 py-1 text-xs"
										disabled={busy === p.id}
										onClick={() => handleVideoRequest(p.id)}
									>
										Video Call
									</Button>
								</div>
							))}
						</div>
					</div>
				</div>
				)}
		</>
	)
}