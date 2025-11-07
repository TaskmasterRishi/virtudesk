import { useCallback, useEffect, useRef } from 'react'
import { useAFKStore } from '@/stores/afkStore'
import { setAFKStatus } from '@/game/realtime/PlayerRealtime'

const TWO_MIN = 2  * 60 * 1000
const FIVE_MIN = 5  * 60 * 1000

export function useAFK() {
	const setActiveNow = useAFKStore((s) => s.setActiveNow)
	const setToastShown = useAFKStore((s) => s.setInactiveToastShown)
	const setAFKLocal = useAFKStore((s) => s.setAFK)
  const isAFK = useAFKStore((s) => s.isAFK)
  const startTracking = useAFKStore((s) => s.startTracking)
  const pauseTracking = useAFKStore((s) => s.pauseTracking)
  const resumeTracking = useAFKStore((s) => s.resumeTracking)
  const stopTracking = useAFKStore((s) => s.stopTracking)
  // keep a ref for event handlers to avoid stale closures
  const isAFKRef = useRef(isAFK)
  useEffect(() => { isAFKRef.current = isAFK }, [isAFK])

	const toastTimer = useRef<number | null>(null)
	const afkTimer = useRef<number | null>(null)

	const clearTimers = useCallback(() => {
		if (toastTimer.current) {
			window.clearTimeout(toastTimer.current)
			toastTimer.current = null
		}
		if (afkTimer.current) {
			window.clearTimeout(afkTimer.current)
			afkTimer.current = null
		}
	}, [])

	const scheduleTimers = useCallback(() => {
		clearTimers()
		toastTimer.current = window.setTimeout(() => {
			setToastShown(true)
		}, TWO_MIN)
		afkTimer.current = window.setTimeout(() => {
			setAFKLocal(true)
			setAFKStatus(true)
			pauseTracking()
		}, FIVE_MIN)
	}, [clearTimers, setToastShown, setAFKLocal, pauseTracking])

	const markActive = useCallback(() => {
		setActiveNow()
		setToastShown(false)
		if (isAFK) {
			setAFKLocal(false)
			setAFKStatus(false)
		}
		resumeTracking()
		scheduleTimers()
	}, [isAFK, scheduleTimers, setActiveNow, setToastShown, setAFKLocal, resumeTracking])

  useEffect(() => {
    // User activity events
    const onMouseMove = () => {
      // Do not clear AFK on mere mouse movement when AFK
      if (isAFKRef.current) return
      markActive()
    }
    const onScroll = () => {
      if (isAFKRef.current) return
      markActive()
    }
    const onMouseDown = () => {
      // When AFK, ignore generic clicks; only banner button should resume
      if (isAFKRef.current) return
      markActive()
    }
    const onKeyDown = () => {
      if (isAFKRef.current) return
      markActive()
    }
    const onTouchStart = () => {
      if (isAFKRef.current) return
      markActive()
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        // Returning to tab does not auto-clear AFK; require an input
        if (!isAFKRef.current) markActive()
      } else if (document.visibilityState === 'hidden') {
        // Hidden tab -> pause timing immediately
        pauseTracking()
      }
    }
    const onBlur = () => { pauseTracking() }
    const onFocus = () => { if (!isAFKRef.current) resumeTracking() }

    window.addEventListener('mousemove', onMouseMove, { passive: true })
    window.addEventListener('mousedown', onMouseDown, { passive: true })
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', onFocus)

    startTracking()
    scheduleTimers()

    return () => {
      clearTimers()
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('scroll', onScroll)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('focus', onFocus)
      stopTracking()
    }
  }, [clearTimers, scheduleTimers, markActive, startTracking, stopTracking, pauseTracking, resumeTracking])

  // Keep timer exactly in sync with AFK status
  useEffect(() => {
    if (isAFK) {
      pauseTracking()
    } else {
      resumeTracking()
    }
  }, [isAFK, pauseTracking, resumeTracking])
}
