// Browser-side turn-taking for the voice call: mic level metering, voice-activity
// detection to end the rep's turn, buyer playback, and barge-in (rep cuts the buyer off).

export type Phase = 'idle' | 'connecting' | 'buyer' | 'listening' | 'rep' | 'thinking' | 'ended'

export interface RepCapture {
  blob: Blob
  startMs: number
  endMs: number
  interrupted: boolean
}

interface Pending {
  recorder: MediaRecorder
  chunks: Blob[]
  speechStart: number | null
  lastVoice: number
  interrupted: boolean
}

export class CallEngine {
  silenceMs = 1400
  bargeIn = true
  onLevel: (level: number, speaking: boolean) => void = () => {}

  private stream: MediaStream | null = null
  private ctx: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private raf = 0
  private t0 = 0
  private level = 0
  private threshold = 0.03
  private pending: Pending | null = null
  private finishRequested = false
  private interruptRequested = false
  private audio: HTMLAudioElement | null = null
  private stopped = false

  async init() {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    })
    this.ctx = new AudioContext()
    const src = this.ctx.createMediaStreamSource(this.stream)
    this.analyser = this.ctx.createAnalyser()
    this.analyser.fftSize = 1024
    src.connect(this.analyser)
    this.t0 = performance.now()
    this.meter()
    await this.calibrate()
  }

  now() {
    return performance.now() - this.t0
  }

  private meter = () => {
    if (!this.analyser) return
    const buf = new Float32Array(this.analyser.fftSize)
    this.analyser.getFloatTimeDomainData(buf)
    let sum = 0
    for (const v of buf) sum += v * v
    this.level = Math.sqrt(sum / buf.length)
    this.onLevel(Math.min(1, this.level / (this.threshold * 4)), this.level > this.threshold)
    this.raf = requestAnimationFrame(this.meter)
  }

  // Measure room noise for a moment and set the speech threshold above it.
  private async calibrate() {
    const samples: number[] = []
    const end = performance.now() + 600
    while (performance.now() < end) {
      samples.push(this.level)
      await new Promise((r) => setTimeout(r, 30))
    }
    const floor = samples.sort((a, b) => a - b)[Math.floor(samples.length / 2)] ?? 0.01
    this.threshold = Math.max(0.02, floor * 3)
  }

  private newRecorder(): Pending {
    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : ''
    const recorder = new MediaRecorder(this.stream!, mime ? { mimeType: mime } : undefined)
    const p: Pending = { recorder, chunks: [], speechStart: null, lastVoice: 0, interrupted: false }
    recorder.ondataavailable = (e) => e.data.size && p.chunks.push(e.data)
    recorder.start(100)
    return p
  }

  private stopRecorder(p: Pending): Promise<Blob> {
    return new Promise((resolve) => {
      p.recorder.onstop = () => resolve(new Blob(p.chunks, { type: p.recorder.mimeType || 'audio/webm' }))
      if (p.recorder.state !== 'inactive') p.recorder.stop()
      else resolve(new Blob(p.chunks))
    })
  }

  /** Play the buyer's line. Resolves when it ends or the rep barges in. */
  playBuyer(audio: HTMLAudioElement): Promise<{ startMs: number; endMs: number; bargedIn: boolean }> {
    this.audio = audio
    this.interruptRequested = false
    return new Promise((resolve) => {
      let startMs = this.now()
      let done = false
      let loudSince: number | null = null
      const watch = this.bargeIn ? this.newRecorder() : null

      const finish = async (bargedIn: boolean) => {
        if (done) return
        done = true
        clearInterval(timer)
        const endMs = this.now()
        if (bargedIn) {
          audio.pause()
          if (watch) {
            watch.speechStart = loudSince ?? endMs
            watch.lastVoice = this.now()
            watch.interrupted = true
            this.pending = watch
          }
        } else if (watch) {
          await this.stopRecorder(watch)
        }
        this.audio = null
        resolve({ startMs, endMs, bargedIn })
      }

      const timer = setInterval(() => {
        if (this.stopped) return finish(false)
        if (this.interruptRequested) return finish(true)
        if (!watch) return
        // Sustained loud input while the buyer talks = the rep is cutting in.
        if (this.level > this.threshold * 2.2) {
          loudSince ??= this.now()
          if (this.now() - loudSince > 450) finish(true)
        } else {
          loudSince = null
        }
      }, 40)

      audio.onplaying = () => {
        startMs = this.now()
      }
      audio.onended = () => finish(false)
      audio.onerror = () => finish(false)
      audio.play().catch(() => finish(false))
    })
  }

  /** Record the rep until they stop talking (or press "Done"). */
  captureRep(onSpeechStart?: () => void): Promise<RepCapture | null> {
    this.finishRequested = false
    const p = this.pending ?? this.newRecorder()
    this.pending = null
    if (p.speechStart != null) onSpeechStart?.()
    const recStart = this.now()
    return new Promise((resolve) => {
      const timer = setInterval(async () => {
        const t = this.now()
        if (this.level > this.threshold) {
          if (p.speechStart == null) {
            p.speechStart = t
            onSpeechStart?.()
          }
          p.lastVoice = t
        }
        const silent = p.speechStart != null && t - p.lastVoice > this.silenceMs
        if (silent || this.finishRequested || this.stopped) {
          clearInterval(timer)
          const blob = await this.stopRecorder(p)
          // "Done" pressed without the meter catching speech: still send it, it may just be quiet.
          if (p.speechStart == null) {
            return resolve(this.finishRequested && !this.stopped ? { blob, startMs: recStart, endMs: t, interrupted: false } : null)
          }
          resolve({ blob, startMs: p.speechStart, endMs: Math.max(p.lastVoice, p.speechStart + 300), interrupted: p.interrupted })
        }
      }, 40)
    })
  }

  finishTurn() {
    this.finishRequested = true
  }

  interruptBuyer() {
    this.interruptRequested = true
  }

  stop() {
    this.stopped = true
    this.finishRequested = true
    this.audio?.pause()
    cancelAnimationFrame(this.raf)
    this.stream?.getTracks().forEach((t) => t.stop())
    this.ctx?.close()
  }
}
