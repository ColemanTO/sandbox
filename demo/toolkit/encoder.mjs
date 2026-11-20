// Runs in the encoder page that video.ts opens in Chrome: encodes the recorded frames (and the mixed narration)
// into an MP4 with WebCodecs, using the mediabunny muxer, and POSTs the file back to /out.
import * as mb from './mediabunny.mjs';

/**
 * @param {{ timing: { at: number, duration: number }[], hasAudio: boolean, sampleRate: number }} args
 *   timing: each frame's start and how long it stays on screen, in seconds
 */
export async function encode({ timing, hasAudio, sampleRate }) {
  const load = async (i) => createImageBitmap(await (await fetch(`/frame/${i}`)).blob());
  const first = await load(0);
  const width = first.width & ~1; // H.264 needs even dimensions
  const height = first.height & ~1;
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const output = new mb.Output({ format: new mb.Mp4OutputFormat({ fastStart: 'in-memory' }), target: new mb.BufferTarget() });
  const video = new mb.CanvasSource(canvas, { codec: 'avc', bitrate: mb.QUALITY_HIGH, keyFrameInterval: 2 });
  output.addVideoTrack(video, { frameRate: 30 });
  let audio;
  if (hasAudio) {
    audio = new mb.AudioBufferSource({ codec: 'aac', bitrate: 160_000 });
    output.addAudioTrack(audio);
  }
  await output.start();

  for (let i = 0; i < timing.length; i++) {
    const bitmap = i === 0 ? first : await load(i);
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    // Each frame is held until the next was painted; long holds are split into 0.5 s pieces so seeking stays quick.
    const { at, duration } = timing[i];
    for (let t = 0; t < duration - 1e-6; t += 0.5) await video.add(at + t, Math.min(0.5, duration - t));
    if (i % 250 === 0) console.log(`video: frame ${i} of ${timing.length}`);
  }
  if (audio) {
    const samples = new Float32Array(await (await fetch('/audio')).arrayBuffer());
    const buffer = new AudioBuffer({ length: samples.length, numberOfChannels: 1, sampleRate });
    buffer.copyToChannel(samples, 0);
    await audio.add(buffer);
  }
  await output.finalize();
  const response = await fetch('/out', { method: 'POST', body: output.target.buffer });
  if (!response.ok) throw new Error(`Could not hand the video back (${response.status})`);
  console.log(`done: ${width}x${height}, ${(output.target.buffer.byteLength / 1e6).toFixed(1)} MB`);
}
