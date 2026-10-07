/**
 * lib/scannerAudio.ts
 *
 * Lightweight Web Audio API synthesizer for instant gate ticket feedback.
 * Synthesizes crisp chimes directly in the browser with zero external audio assets,
 * zero network latency, and full offline/airplane mode reliability.
 */

class ScannerAudioSynthesizer {
  private ctx: AudioContext | null = null

  private getContext(): AudioContext | null {
    if (typeof window === "undefined") return null
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (AudioCtx) {
        this.ctx = new AudioCtx()
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {})
    }
    return this.ctx
  }

  /**
   * Unlock AudioContext on initial user gesture (tap/click/camera grant).
   */
  public resume(): void {
    if (typeof window === "undefined") return
    try {
      const ctx = this.getContext()
      if (ctx && ctx.state === "suspended") {
        ctx.resume().catch(() => {})
      }
    } catch {
      // Ignore
    }
  }

  /**
   * Crisp, pleasant two-tone ascending chime for valid ticket entry.
   * Tone 1: 587.33 Hz (D5)
   * Tone 2: 880.00 Hz (A5)
   */
  public playSuccess(): void {
    try {
      const ctx = this.getContext()
      if (!ctx) return
      const now = ctx.currentTime

      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = "sine"
      osc.frequency.setValueAtTime(587.33, now)
      osc.frequency.setValueAtTime(880, now + 0.08)

      gain.gain.setValueAtTime(0.28, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now)
      osc.stop(now + 0.32)
    } catch {
      // Audio playback prevented by browser policy
    }
  }

  /**
   * Distinct low warning buzz for duplicate/already used ticket, wrong event, or invalid QR.
   * Tone: 220 Hz sawtooth dropping to 140 Hz with quick decay.
   */
  public playWarning(): void {
    try {
      const ctx = this.getContext()
      if (!ctx) return
      const now = ctx.currentTime

      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = "sawtooth"
      osc.frequency.setValueAtTime(220, now)
      osc.frequency.setValueAtTime(140, now + 0.12)

      gain.gain.setValueAtTime(0.32, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now)
      osc.stop(now + 0.38)
    } catch {
      // Audio playback prevented by browser policy
    }
  }
}

export const scannerAudio = new ScannerAudioSynthesizer()
