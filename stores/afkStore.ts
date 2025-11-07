import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

const DAILY_GOAL_MS = 8 * 60 * 60 * 1000

const getDayKey = (timestamp: number) => {
	const date = new Date(timestamp)
	const year = date.getFullYear()
	const month = String(date.getMonth() + 1).padStart(2, '0')
	const day = String(date.getDate()).padStart(2, '0')
	return `${year}-${month}-${day}`
}

interface AFKState {
	lastActiveAt: number
	inactiveToastShown: boolean
	isAFK: boolean
	timerStartedAt: number | null
	activeMsAccumulated: number
	trackingDay: string
	dailyGoalMs: number
	setActiveNow: () => void
	setInactiveToastShown: (shown: boolean) => void
	setAFK: (afk: boolean) => void
	startTracking: (timestamp?: number) => void
	resumeTracking: (timestamp?: number) => void
	pauseTracking: (timestamp?: number) => void
	stopTracking: (timestamp?: number) => void
	getActiveMs: (timestamp?: number) => number
	getRemainingMs: (timestamp?: number) => number
}

export const useAFKStore = create<AFKState>()(persist((set, get) => ({
	lastActiveAt: Date.now(),
	inactiveToastShown: false,
	isAFK: false,
	timerStartedAt: null,
	activeMsAccumulated: 0,
	trackingDay: getDayKey(Date.now()),
	dailyGoalMs: DAILY_GOAL_MS,
	setActiveNow: () => set({ lastActiveAt: Date.now() }),
	setInactiveToastShown: (shown) => set({ inactiveToastShown: shown }),
	setAFK: (afk) => set({ isAFK: afk }),
	startTracking: (timestamp) => {
		const resume = get().resumeTracking
		resume(timestamp)
	},
	resumeTracking: (timestamp) => {
		const now = timestamp ?? Date.now()
		set((state): Partial<AFKState> => {
			const dayKey = getDayKey(now)
			if (state.trackingDay !== dayKey) {
				return {
					trackingDay: dayKey,
					activeMsAccumulated: 0,
					timerStartedAt: now,
				}
			}
			if (state.timerStartedAt !== null) {
				return {}
			}
			return { timerStartedAt: now }
		})
	},
	pauseTracking: (timestamp) => {
		const now = timestamp ?? Date.now()
		set((state): Partial<AFKState> => {
			const dayKey = getDayKey(now)
			if (state.trackingDay !== dayKey) {
				return {
					trackingDay: dayKey,
					activeMsAccumulated: 0,
					timerStartedAt: null,
				}
			}
			if (state.timerStartedAt === null) {
				return {}
			}
			const elapsed = Math.max(0, now - state.timerStartedAt)
			return {
				activeMsAccumulated: state.activeMsAccumulated + elapsed,
				timerStartedAt: null,
			}
		})
	},
	stopTracking: (timestamp) => {
		const now = timestamp ?? Date.now()
		get().pauseTracking(now)
	},
	getActiveMs: (timestamp) => {
		const now = timestamp ?? Date.now()
		const state = get()
		const runningElapsed =
			state.timerStartedAt !== null ? Math.max(0, now - state.timerStartedAt) : 0
		return state.activeMsAccumulated + runningElapsed
	},
	getRemainingMs: (timestamp) => {
		const total = get().dailyGoalMs
		const active = get().getActiveMs(timestamp)
		return Math.max(0, total - active)
	},
}), {
	name: 'afk-work-session',
	storage: createJSONStorage(() => localStorage),
	partialize: (state) => ({
		// persist only what we need across reloads
		isAFK: state.isAFK,
		timerStartedAt: state.timerStartedAt,
		activeMsAccumulated: state.activeMsAccumulated,
		trackingDay: state.trackingDay,
		dailyGoalMs: state.dailyGoalMs,
	})
}))
