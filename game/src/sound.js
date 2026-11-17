// Synthesized sound only: every effect is a few oscillators through one gain, so the game
// ships no audio files. The AudioContext is created lazily on the first user gesture (never
// before one, so headless screenshot runs stay silent), and every call is guarded so a missing
// or blocked context can never break the game. M toggles the mute.
export function createSound() {
  let context = null;
  let master = null;
  let muted = false;

  function unlock() {
    if (context !== null) {
      if (context.state === 'suspended') context.resume().catch(() => {});
      return;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.25;
      master.connect(context.destination);
    } catch {
      context = null;
    }
  }

  function tone(freq, start, duration, type, volume) {
    if (context === null || master === null || muted) return;
    try {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = type;
      oscillator.frequency.value = freq;
      gain.gain.setValueAtTime(0, context.currentTime + start);
      gain.gain.linearRampToValueAtTime(volume, context.currentTime + start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + start + duration);
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(context.currentTime + start);
      oscillator.stop(context.currentTime + start + duration + 0.05);
    } catch {
      // Sound is decoration: never let it interrupt play.
    }
  }

  return {
    unlock,
    toggleMute() {
      muted = !muted;
      return muted;
    },
    isMuted() {
      return muted;
    },
    /** A chime that climbs with the combo: the higher the chain, the brighter the note. */
    collect(combo) {
      const base = 523 * 2 ** (Math.min(combo, 12) / 12);
      tone(base, 0, 0.18, 'sine', 0.5);
      tone(base * 1.5, 0.02, 0.22, 'sine', 0.3);
    },
    hit() {
      tone(140, 0, 0.3, 'sawtooth', 0.5);
      tone(70, 0.02, 0.35, 'triangle', 0.5);
    },
    burst() {
      tone(880, 0, 0.25, 'sine', 0.35);
      tone(1318, 0.06, 0.3, 'sine', 0.3);
      tone(1760, 0.12, 0.35, 'sine', 0.22);
    },
    levelUp() {
      tone(523, 0, 0.16, 'triangle', 0.4);
      tone(659, 0.09, 0.16, 'triangle', 0.4);
      tone(784, 0.18, 0.28, 'triangle', 0.45);
    },
    gameOver() {
      tone(392, 0, 0.3, 'triangle', 0.4);
      tone(311, 0.25, 0.3, 'triangle', 0.4);
      tone(233, 0.5, 0.55, 'triangle', 0.45);
    },
    start() {
      tone(440, 0, 0.14, 'sine', 0.35);
      tone(660, 0.08, 0.2, 'sine', 0.35);
    },
  };
}
