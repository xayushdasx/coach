// Sarvam's speech-to-text REST API accepts at most 30 s per request. These helpers decode any
// recording, downmix to 16 kHz mono, and cut it into WAV chunks at quiet points under that limit.

const RATE = 16000
const MAX_SEC = 28
const MIN_SEC = 18

export async function toWavChunks(blob: Blob): Promise<Blob[]> {
  const ctx = new OfflineAudioContext(1, 1, RATE)
  const decoded = await ctx.decodeAudioData(await blob.arrayBuffer())
  const mono = await resampleMono(decoded)
  const chunks: Blob[] = []
  let start = 0
  while (start < mono.length) {
    let end = Math.min(mono.length, start + MAX_SEC * RATE)
    if (end < mono.length) end = quietestPoint(mono, start + MIN_SEC * RATE, end)
    chunks.push(encodeWav(mono.subarray(start, end)))
    start = end
  }
  return chunks
}

export async function durationSec(blob: Blob): Promise<number> {
  const ctx = new OfflineAudioContext(1, 1, RATE)
  const decoded = await ctx.decodeAudioData(await blob.arrayBuffer())
  return decoded.duration
}

async function resampleMono(buf: AudioBuffer): Promise<Float32Array> {
  const ctx = new OfflineAudioContext(1, Math.ceil(buf.duration * RATE), RATE)
  const src = ctx.createBufferSource()
  src.buffer = buf
  src.connect(ctx.destination)
  src.start()
  return (await ctx.startRendering()).getChannelData(0)
}

// The start of the 200 ms window with the least energy between `from` and `to`.
function quietestPoint(s: Float32Array, from: number, to: number): number {
  const win = Math.floor(RATE * 0.2)
  let best = to
  let bestE = Infinity
  for (let i = from; i + win <= to; i += Math.floor(win / 2)) {
    let e = 0
    for (let k = i; k < i + win; k++) e += s[k] * s[k]
    if (e < bestE) {
      bestE = e
      best = i + Math.floor(win / 2)
    }
  }
  return best
}

function encodeWav(samples: Float32Array): Blob {
  const buf = new ArrayBuffer(44 + samples.length * 2)
  const v = new DataView(buf)
  const str = (o: number, t: string) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)))
  str(0, 'RIFF')
  v.setUint32(4, 36 + samples.length * 2, true)
  str(8, 'WAVE')
  str(12, 'fmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true)
  v.setUint16(22, 1, true)
  v.setUint32(24, RATE, true)
  v.setUint32(28, RATE * 2, true)
  v.setUint16(32, 2, true)
  v.setUint16(34, 16, true)
  str(36, 'data')
  v.setUint32(40, samples.length * 2, true)
  for (let i = 0; i < samples.length; i++) {
    const x = Math.max(-1, Math.min(1, samples[i]))
    v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true)
  }
  return new Blob([buf], { type: 'audio/wav' })
}
