'use client'

import { useCallback, useRef } from 'react'

/**
 * Plays a subtle notification chime using the Web Audio API.
 * No external audio file needed — synthesized in-browser.
 */
export function useNotificationSound() {
  const ctxRef = useRef<AudioContext | null>(null)

  const play = useCallback(() => {
    try {
      if (!ctxRef.current) {
        ctxRef.current = new AudioContext()
      }
      const ctx = ctxRef.current
      if (ctx.state === 'suspended') ctx.resume()

      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)

      // Two-tone chime: C5 → E5
      osc.type = 'sine'
      osc.frequency.setValueAtTime(523, ctx.currentTime) // C5
      osc.frequency.setValueAtTime(659, ctx.currentTime + 0.1) // E5

      gain.gain.setValueAtTime(0.15, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)

      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.3)
    } catch {
      // Audio not available — silent fail
    }
  }, [])

  return play
}
