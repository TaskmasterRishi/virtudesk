"use client";

import React from 'react'
import { useAFKStore } from '@/stores/afkStore'
import { setAFKStatus } from '@/game/realtime/PlayerRealtime'

export default function AFKBanner() {
	const isAFK = useAFKStore((s) => s.isAFK)
	const setAFK = useAFKStore((s) => s.setAFK)
	const setActiveNow = useAFKStore((s) => s.setActiveNow)
	if (!isAFK) return null
	return (
		<div className="fixed top-0 left-0 w-full z-[1100]">
			<div className="mx-auto max-w-screen-lg p-3">
				<div className="relative overflow-hidden rounded-lg border border-amber-300/60 bg-amber-50/90 text-amber-900 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-amber-50/70">
					<div className="flex items-center justify-between gap-3 px-4 py-3">
						<div className="flex items-center gap-3">
							<div className="h-6 w-6 rounded-full bg-amber-500/20 text-amber-600 flex items-center justify-center">
								<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
									<path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm10.5-4.125a.75.75 0 1 0-1.5 0v5.25a.75.75 0 0 0 1.5 0v-5.25Zm-.75 9.375a.938.938 0 1 0 0-1.875.938.938 0 0 0 0 1.875Z" clipRule="evenodd" />
								</svg>
							</div>
							<div>
								<p className="text-sm font-semibold">You are marked as Away</p>
								<p className="text-xs text-amber-800/80">We’ve reduced interactions until you’re active again.</p>
							</div>
						</div>
						<div className="flex items-center gap-2">
							<button
								onClick={() => { setActiveNow(); setAFK(false); setAFKStatus(false); }}
								className="inline-flex items-center rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white shadow hover:bg-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
							>
								I'm back
							</button>
						</div>
					</div>
					<div className="absolute inset-x-0 bottom-0 h-0.5 bg-amber-200">
						<div className="h-full w-full bg-amber-500 animate-[pulsebar_1.6s_ease-in-out_infinite]"></div>
					</div>
				</div>
			</div>
			<style jsx>{`
				@keyframes pulsebar { 0% { opacity: .3 } 50% { opacity: .9 } 100% { opacity: .3 } }
			`}</style>
		</div>
	)
}
