"use client";

import { useAFKStore } from "@/stores/afkStore";
import { Clock3 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const formatDuration = (ms: number) => {
	const totalSeconds = Math.floor(ms / 1000)
	const hours = Math.floor(totalSeconds / 3600)
	const minutes = Math.floor((totalSeconds % 3600) / 60)
	const seconds = totalSeconds % 60
	const HH = String(hours).padStart(2, "0")
	const MM = String(minutes).padStart(2, "0")
	const SS = String(seconds).padStart(2, "0")
	return `${HH}:${MM}:${SS}`
}

export default function WorkSessionTimer() {
	const isAFK = useAFKStore((s) => s.isAFK)
	const activeMsAccumulated = useAFKStore((s) => s.activeMsAccumulated)
	const timerStartedAt = useAFKStore((s) => s.timerStartedAt)
	const dailyGoalMs = useAFKStore((s) => s.dailyGoalMs)
	const trackingDay = useAFKStore((s) => s.trackingDay)

	const [now, setNow] = useState(() => Date.now())

	useEffect(() => {
		if (timerStartedAt === null) {
			return
		}
		const interval = window.setInterval(() => {
			setNow(Date.now())
		}, 1000)
		return () => window.clearInterval(interval)
	}, [timerStartedAt])

	const activeMs = useMemo(() => {
		const base = activeMsAccumulated
		if (timerStartedAt === null) {
			return base
		}
		return base + Math.max(0, now - timerStartedAt)
	}, [activeMsAccumulated, timerStartedAt, now])

	const remainingMs = Math.max(0, dailyGoalMs - activeMs)
	const displayRemaining = remainingMs === 0 ? "Complete" : formatDuration(remainingMs)
	const goalDisplay = formatDuration(dailyGoalMs)
	const percent = dailyGoalMs > 0 ? Math.min(100, Math.round((activeMs / dailyGoalMs) * 100)) : 0

	return (
		<div className="w-64 rounded-2xl border border-slate-700/60 bg-slate-900/90 p-4 text-slate-200 shadow-xl backdrop-blur-lg">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2 text-slate-300">
					<Clock3 className="size-4" />
					<span className="text-xs font-medium uppercase tracking-wide">Work Session</span>
				</div>
				<span className="text-[11px] font-medium text-slate-400">{trackingDay}</span>
			</div>
			<div className="mt-3 flex items-end justify-between gap-4">
				<div>
					<p className="text-3xl font-semibold text-white">{formatDuration(activeMs)}</p>
					<p className="text-xs text-slate-400">Active today</p>
				</div>
				<div className="text-right">
					<p className="text-xs text-slate-400">Goal ({goalDisplay})</p>
					<p className="text-sm font-medium text-slate-200">{displayRemaining}</p>
				</div>
			</div>
			<div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-800/80">
				<div
					className="h-full rounded-full bg-emerald-500 transition-all duration-500"
					style={{ width: `${percent}%` }}
				/>
			</div>
			<div className="mt-3 flex items-center justify-between text-xs">
				<span className="text-slate-400">
					Status:{" "}
					<span className={isAFK ? "text-amber-400" : "text-emerald-400"}>
						{isAFK ? "Paused (AFK)" : "Active"}
					</span>
				</span>
				<span className="text-slate-400">
					Progress {percent}%
				</span>
			</div>
		</div>
	)
}

