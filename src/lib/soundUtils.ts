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

/**
 * Plays a pleasant, subtle two-tone ascending chime (D5 -> A5) for successful downloads.
 */
export function playSuccessChime(volume = 0.15): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    // Harmonic bell chime (D5: 587.33Hz -> A5: 880.00Hz)
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);
    osc1.frequency.exponentialRampToValueAtTime(880.00, now + 0.10);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(880.00, now + 0.08);
    osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.20); // D6

    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now + 0.08);
    osc1.stop(now + 0.55);
    osc2.stop(now + 0.55);
  } catch {
    // Autoplay or audio restrictions ignored gracefully
  }
}

/**
 * Plays a gentle, non-jarring low tone for errors/failures.
 */
export function playErrorChime(volume = 0.15): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(329.63, now); // E4
    osc.frequency.exponentialRampToValueAtTime(220.00, now + 0.16); // A3

    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.45);
  } catch {
    // Autoplay or audio restrictions ignored gracefully
  }
}
