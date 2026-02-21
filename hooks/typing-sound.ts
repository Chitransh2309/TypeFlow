let ctx: AudioContext | null = null;
let buffer: AudioBuffer | null = null;

export async function initTypingSound() {
  if (ctx) return; // prevent re-init

  ctx = new AudioContext();

  const res = await fetch("/type.mp3");
  const arr = await res.arrayBuffer();
  buffer = await ctx.decodeAudioData(arr);

  document.addEventListener("click", () => ctx?.resume(), { once: true });
}

export function playTypingSound(volume: number) {
  if (!ctx || !buffer || volume <= 0) return;

  const src = ctx.createBufferSource();
  const gain = ctx.createGain();

  src.buffer = buffer;
  gain.gain.value = volume;

  src.connect(gain);
  gain.connect(ctx.destination);
  src.start();
}