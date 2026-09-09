/**
 * Minimal 16-bit PCM WAV encoder plus a small procedural synthesiser.
 *
 * The mock music provider uses this to produce *audible* background beds so the
 * demo export contains a real, correctly mixed audio track - no external asset
 * downloads and no licensing questions.
 */

const SAMPLE_RATE = 44_100;

export interface PcmBuffer {
  sampleRate: number;
  /** Mono float samples in -1..1. */
  samples: Float32Array;
}

/** Wraps mono float samples into a RIFF/WAVE container. */
export function encodeWav(pcm: PcmBuffer): Uint8Array {
  const { samples, sampleRate } = pcm;
  const bytesPerSample = 2;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeAscii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) {
      view.setUint8(offset + i, text.charCodeAt(i));
    }
  };

  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // format = PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true); // byte rate
  view.setUint16(32, bytesPerSample, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeAscii(36, "data");
  view.setUint32(40, dataSize, true);

  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * bytesPerSample, Math.round(clamped * 32_767), true);
  }

  return new Uint8Array(buffer);
}

/** Digital silence of the requested length - used for demo voice-over tracks. */
export function silentWav(durationMs: number, sampleRate = SAMPLE_RATE): Uint8Array {
  const length = Math.max(1, Math.round((durationMs / 1000) * sampleRate));
  return encodeWav({ sampleRate, samples: new Float32Array(length) });
}

/** Deterministic PRNG so the same seed always yields the same track. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export interface SynthOptions {
  durationMs: number;
  /** 0..1 - drives tempo, brightness and whether drums are layered in. */
  energy: number;
  seed: number;
  sampleRate?: number;
}

const SCALE_MINOR = [0, 3, 5, 7, 10];
const PROGRESSIONS: number[][] = [
  [0, -3, -5, -7],
  [0, 5, 3, 7],
  [0, 2, 5, 3],
  [0, -5, 3, -3],
];

function midiToFreq(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

/**
 * Synthesises a short loopable music bed: a filtered saw pad playing a four
 * chord progression, a sine sub bass, plus kick and hat when energy is high.
 */
export function synthesiseMusic(options: SynthOptions): PcmBuffer {
  const sampleRate = options.sampleRate ?? SAMPLE_RATE;
  const totalSamples = Math.max(1, Math.round((options.durationMs / 1000) * sampleRate));
  const samples = new Float32Array(totalSamples);
  const random = mulberry32(options.seed);

  const energy = Math.max(0, Math.min(1, options.energy));
  const bpm = Math.round(78 + energy * 62); // 78..140
  const beatSamples = (60 / bpm) * sampleRate;
  const barSamples = beatSamples * 4;
  const progression = PROGRESSIONS[Math.floor(random() * PROGRESSIONS.length)];
  const rootMidi = 45 + Math.floor(random() * 5); // A2..C#3

  const padGain = 0.24;
  const bassGain = 0.3;
  const drumGain = 0.35 * energy;

  for (let i = 0; i < totalSamples; i += 1) {
    const t = i / sampleRate;
    const bar = Math.floor(i / barSamples);
    const chordRoot = rootMidi + progression[bar % progression.length];

    // --- pad: three-note chord, slightly detuned saws, soft attack per bar ---
    const barPhase = (i % barSamples) / barSamples;
    const padEnv = Math.min(1, barPhase * 8) * (1 - 0.25 * barPhase);
    let pad = 0;
    for (const step of [SCALE_MINOR[0], SCALE_MINOR[2], SCALE_MINOR[4]]) {
      const freq = midiToFreq(chordRoot + 12 + step);
      for (const detune of [-0.15, 0.15]) {
        const phase = ((freq + detune) * t) % 1;
        pad += (2 * phase - 1) * 0.16; // saw
      }
    }
    // brighter with more energy, shaped by the per-bar envelope
    pad *= (0.35 + energy * 0.35) * padEnv;

    // --- sub bass on the root, retriggered every beat ---
    const beatPhase = (i % beatSamples) / beatSamples;
    const bassEnv = Math.exp(-beatPhase * 3.2);
    const bass = Math.sin(2 * Math.PI * midiToFreq(chordRoot - 12) * t) * bassEnv;

    // --- drums ---
    let drums = 0;
    if (energy > 0.25) {
      const beatIndex = Math.floor(i / beatSamples) % 4;
      if (beatIndex === 0 || beatIndex === 2) {
        // kick: pitch-swept sine
        const kickFreq = 120 * Math.exp(-beatPhase * 12) + 45;
        drums += Math.sin(2 * Math.PI * kickFreq * beatPhase * (beatSamples / sampleRate) * 12)
          * Math.exp(-beatPhase * 9);
      }
      const eighthPhase = (i % (beatSamples / 2)) / (beatSamples / 2);
      drums += (random() * 2 - 1) * Math.exp(-eighthPhase * 45) * 0.28;
    }

    let value = pad * padGain + bass * bassGain + drums * drumGain;

    // fade in / out so the bed never clicks at the edges
    const fadeSamples = Math.min(sampleRate * 0.75, totalSamples / 4);
    if (i < fadeSamples) value *= i / fadeSamples;
    const tail = totalSamples - i;
    if (tail < fadeSamples) value *= tail / fadeSamples;

    samples[i] = Math.tanh(value * 1.1) * 0.85; // soft clip
  }

  return { sampleRate, samples };
}

export function synthesiseMusicWav(options: SynthOptions): Uint8Array {
  return encodeWav(synthesiseMusic(options));
}
