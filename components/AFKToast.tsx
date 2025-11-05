"use client";

import React from 'react'
import { useAFKStore } from '@/stores/afkStore'

export default function AFKToast() {
	const shown = useAFKStore((s) => s.inactiveToastShown)

	if (!shown) return null

	return (
		<div className="fixed bottom-6 right-6 z-[1100] select-none">
			<div className="relative overflow-hidden rounded-xl border border-slate-700 bg-slate-900/95 shadow-2xl backdrop-blur supports-[backdrop-filter]:bg-slate-900/75 animate-[fadeIn_.2s_ease-out]">
				<div className="flex items-start gap-3 p-4 pr-10">
					<div className="mt-0.5 h-6 w-6 rounded-full bg-amber-400/20 text-amber-300 flex items-center justify-center">
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
							<path fillRule="evenodd" d="M9.401 1.713a2.25 2.25 0 0 1 3.198 0l8.688 8.688a2.25 2.25 0 0 1 0 3.198l-8.688 8.688a2.25 2.25 0 0 1-3.198 0L.713 13.599a2.25 2.25 0 0 1 0-3.198l8.688-8.688ZM12 7.5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0V8.25A.75.75 0 0 1 12 7.5Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
						</svg>
					</div>
					<div className="min-w-[16rem]">
						<p className="text-sm font-semibold text-white">You seem inactive</p>
						<p className="mt-1 text-xs text-slate-300">We’ll mark you AFK if inactivity continues.</p>
						{/* Buttons removed per request; toast is informational only */}
					</div>
				</div>
				{/* Progress bar */}
				<div className="absolute inset-x-0 bottom-0 h-0.5 bg-slate-700">
					<div className="h-full w-full origin-left bg-amber-400 animate-[shrink_2s_linear_forwards]"></div>
				</div>
			</div>
			<style jsx>{`
				@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
				@keyframes shrink { from { transform: scaleX(1); } to { transform: scaleX(0); } }
			`}</style>
		</div>
	)
}
