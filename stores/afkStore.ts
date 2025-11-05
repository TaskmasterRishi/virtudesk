import { create } from 'zustand'

interface AFKState {
	lastActiveAt: number
	inactiveToastShown: boolean
	isAFK: boolean
	setActiveNow: () => void
	setInactiveToastShown: (shown: boolean) => void
	setAFK: (afk: boolean) => void
}

export const useAFKStore = create<AFKState>((set) => ({
	lastActiveAt: Date.now(),
	inactiveToastShown: false,
	isAFK: false,
	setActiveNow: () => set({ lastActiveAt: Date.now() }),
	setInactiveToastShown: (shown) => set({ inactiveToastShown: shown }),
	setAFK: (afk) => set({ isAFK: afk }),
}))
