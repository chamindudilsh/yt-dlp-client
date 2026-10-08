/**
 * Web Audio API synthesizer for clean, zero-dependency, zero-AV-risk audio chimes.
 * Works natively in both WebView2 desktop mode and standard browser web mode.
 */

let audioCtxInstance: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!audioCtxInstance || audioCtxInstance.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        audioCtxInstance = new AudioCtx();
      }
    }
    if (audioCtxInstance && audioCtxInstance.state === 'suspended') {
      audioCtxInstance.resume().catch(() => {});
    }
    return audioCtxInstance;
  } catch {
    return null;
  }
}

export type ChimePreset = 'modern' | 'marimba' | 'subtle';

/**
 * Plays a pleasant synthesizer chime for successful downloads with configurable tone profile and volume.
 * @param volume Value from 0.0 to 1.0 (defaults to 0.6)
 * @param preset 'modern' (harmonic bell), 'marimba' (warm triple-tap), or 'subtle' (minimal bubble blip)
 */
export function playSuccessChime(volume = 0.6, preset: ChimePreset = 'modern'): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const masterGain = Math.max(0, Math.min(1, volume)) * 0.25;
    if (masterGain <= 0.0001) return;

    if (preset === 'marimba') {
      // Warm, melodic wooden triple chime (C5, E5, G5)
      const freqs = [523.25, 659.25, 783.99];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.07);

        gain.gain.setValueAtTime(masterGain * 0.9, now + idx * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.07 + 0.32);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.07);
        osc.stop(now + idx * 0.07 + 0.32);
      });
    } else if (preset === 'subtle') {
      // Soft, minimal bubble blip
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, now); // E5
      osc.frequency.exponentialRampToValueAtTime(880.00, now + 0.12); // A5

      gain.gain.setValueAtTime(masterGain * 0.6, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.28);
    } else {
      // Modern: Harmonic ascending bell chime (D5: 587.33Hz -> A5: 880.00Hz -> D6: 1174.66Hz)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now);
      osc1.frequency.exponentialRampToValueAtTime(880.00, now + 0.10);

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(880.00, now + 0.08);
      osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.20);

      gain.gain.setValueAtTime(masterGain, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now + 0.08);
      osc1.stop(now + 0.55);
      osc2.stop(now + 0.55);
    }
  } catch {
    // Autoplay or audio restrictions ignored gracefully
  }
}

/**
 * Plays a gentle, non-jarring low tone for errors/failures.
 * @param volume Value from 0.0 to 1.0 (defaults to 0.6)
 */
export function playErrorChime(volume = 0.6): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const masterGain = Math.max(0, Math.min(1, volume)) * 0.25;
    if (masterGain <= 0.0001) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(329.63, now); // E4
    osc.frequency.exponentialRampToValueAtTime(220.00, now + 0.16); // A3

    gain.gain.setValueAtTime(masterGain, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.45);
  } catch {
    // Autoplay or audio restrictions ignored gracefully
  }
}
