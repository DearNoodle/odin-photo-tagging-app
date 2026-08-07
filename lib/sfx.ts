let wrongAudio: HTMLAudioElement | null = null;
let correctAudio: HTMLAudioElement | null = null;
let wrongFallback = false;
let correctFallback = false;
let ctx: AudioContext | null = null;
let soundMuted = false;

/** Global mute — guards both file playback and the synth fallbacks. */
export function setSoundMuted(muted: boolean) {
  soundMuted = muted;
}

function ensureCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  ctx ??= new Ctor();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Short synthesized thud — stand-in until the real sound is dropped in. */
function synthThud() {
  const audioCtx = ensureCtx();
  if (!audioCtx) return;

  const now = audioCtx.currentTime;

  const osc = audioCtx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(150, now);
  osc.frequency.exponentialRampToValueAtTime(55, now + 0.28);
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.25, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + 0.35);

  const noise = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.05, audioCtx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = audioCtx.createBufferSource();
  src.buffer = noise;
  const filter = audioCtx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 900;
  const nGain = audioCtx.createGain();
  nGain.gain.setValueAtTime(0.175, now);
  nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
  src.connect(filter);
  filter.connect(nGain);
  nGain.connect(audioCtx.destination);
  src.start(now);
}

/** Wrong-click sound — plays /sfx/wrong.wav, falls back to the synth thud. */
export function playWrongSound() {
  if (typeof window === "undefined" || soundMuted) return;
  if (wrongFallback) {
    synthThud();
    return;
  }
  if (!wrongAudio) {
    wrongAudio = new Audio("/sfx/wrong.wav");
    wrongAudio.volume = 0.225;
    wrongAudio.addEventListener("error", () => {
      wrongAudio = null;
      wrongFallback = true;
    });
  }
  wrongAudio.currentTime = 0;
  void wrongAudio.play().catch(() => {
    wrongFallback = true;
    synthThud();
  });
}

/**
 * Correct-click sound — plays /sfx/correct.wav, falls back to a synthesized
 * two-note chime (E5 → A5) when the file is missing.
 */
export function playCorrectSound() {
  if (typeof window === "undefined" || soundMuted) return;
  if (correctFallback) {
    synthChime();
    return;
  }
  if (!correctAudio) {
    correctAudio = new Audio("/sfx/correct.wav");
    correctAudio.volume = 0.225;
    correctAudio.addEventListener("error", () => {
      correctAudio = null;
      correctFallback = true;
    });
  }
  correctAudio.currentTime = 0;
  void correctAudio.play().catch(() => {
    correctFallback = true;
    synthChime();
  });
}

function synthChime() {
  const audioCtx = ensureCtx();
  if (!audioCtx) return;

  const now = audioCtx.currentTime;
  const notes = [659.25, 880];

  notes.forEach((freq, i) => {
    const t = now + i * 0.09;

    const osc = audioCtx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = freq;

    const sparkle = audioCtx.createOscillator();
    sparkle.type = "sine";
    sparkle.frequency.value = freq * 2;

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.19, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

    const sGain = audioCtx.createGain();
    sGain.gain.setValueAtTime(0.0001, t);
    sGain.gain.exponentialRampToValueAtTime(0.06, t + 0.02);
    sGain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    sparkle.connect(sGain);
    sGain.connect(audioCtx.destination);

    osc.start(t);
    osc.stop(t + 0.55);
    sparkle.start(t);
    sparkle.stop(t + 0.4);
  });
}
