import type { Browser, Route } from '@playwright/test';
import { execFile } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import type { PlacedClip } from './demo';
import { SAMPLE_RATE, wavSamples } from './narrator';
import type { Frame } from './recorder';

const run = promisify(execFile);
const ORIGIN = 'https://encoder.local';
const AVCONVERT = '/usr/bin/avconvert';

/**
 * Turns recorded frames (and narration clips, if any) into `<name>.mp4`: H.264 video, with the narration as AAC
 * audio. Encoding runs in Chrome with WebCodecs (hardware H.264 and AAC on macOS) and the mediabunny muxer, so it
 * needs neither ffmpeg nor Java, and takes seconds rather than minutes.
 *
 * On macOS it also makes `<name>-720p.m4v`, a small copy for chat and email, with the built-in `avconvert`.
 * Also writes `frames.txt` (each frame and how long it is held), which `frames_at.py` reads.
 */
export async function renderVideo(
  browser: Browser,
  frames: Frame[],
  endTimestamp: number,
  outDir: string,
  name: string,
  narration: PlacedClip[],
): Promise<{ video: string; shareable?: string }> {
  const start = frames[0].timestamp;
  writeFrameList(frames, endTimestamp, `${outDir}/frames.txt`);
  const timing = frames.map((f, i) => ({
    at: f.timestamp - start,
    duration: Math.max((i + 1 < frames.length ? frames[i + 1].timestamp : endTimestamp) - f.timestamp, 0.001),
  }));
  const audio = narration.length ? mix(narration, endTimestamp - start) : undefined;

  const video = `${outDir}/${name}.mp4`;
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    page.on('console', (msg) => console.log(`  [encoder] ${msg.text()}`));
    // The package's exports map hides the browser bundle, so find it next to the Node bundle it does export.
    const bundle = readFileSync(join(dirname(require.resolve('mediabunny')), 'mediabunny.min.mjs'));
    let output: Buffer | undefined;
    await page.route(`${ORIGIN}/**`, async (route: Route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Encoder</title>' });
      if (path === '/mediabunny.mjs') return route.fulfill({ contentType: 'text/javascript', body: bundle });
      if (path === '/encoder.mjs') return route.fulfill({ contentType: 'text/javascript', body: readFileSync(join(__dirname, 'encoder.mjs')) });
      if (path === '/audio') return route.fulfill({ contentType: 'application/octet-stream', body: Buffer.from(audio!.buffer) });
      if (path.startsWith('/frame/')) return route.fulfill({ contentType: 'image/jpeg', body: readFileSync(frames[Number(path.slice(7))].file) });
      if (path === '/out') {
        output = route.request().postDataBuffer() ?? undefined;
        return route.fulfill({ status: 204 });
      }
      return route.fulfill({ status: 404 });
    });
    // WebCodecs needs a secure context, hence an https origin served by the route above.
    await page.goto(`${ORIGIN}/`);
    // A string, so the test runner's TypeScript transform never rewrites the browser-side import().
    const args = JSON.stringify({ timing, hasAudio: !!audio, sampleRate: SAMPLE_RATE });
    await page.evaluate(`import('${ORIGIN}/encoder.mjs').then((m) => m.encode(${args}))`);
    if (!output?.length) throw new Error('The encoder produced no video');
    writeFileSync(video, output);
  } finally {
    await context.close();
  }

  return { video, shareable: await shareableCopy(video, `${outDir}/${name}-720p.m4v`) };
}

/** Mixes the clips (16-bit mono WAVs) into one track of `seconds`, as floats for the AAC encoder. */
function mix(clips: PlacedClip[], seconds: number): Float32Array {
  const track = new Float32Array(Math.ceil(seconds * SAMPLE_RATE));
  for (const clip of clips) {
    const samples = wavSamples(clip.file);
    const offset = Math.round(clip.at * SAMPLE_RATE);
    for (let i = 0; i < samples.length && offset + i < track.length; i++) {
      track[offset + i] = Math.max(-1, Math.min(1, track[offset + i] + samples[i] / 32768));
    }
  }
  return track;
}

/** ffmpeg-style concat list: each frame and how long it stays on screen (read by frames_at.py). */
function writeFrameList(frames: Frame[], endTimestamp: number, file: string): void {
  const lines: string[] = [];
  frames.forEach((f, i) => {
    const next = i + 1 < frames.length ? frames[i + 1].timestamp : endTimestamp;
    lines.push(`file '${f.file}'`, `duration ${Math.max(next - f.timestamp, 0.001).toFixed(3)}`);
  });
  lines.push(`file '${frames[frames.length - 1].file}'`);
  writeFileSync(file, lines.join('\n') + '\n');
}

/**
 * A small 720p H.264/AAC copy for chat, email and phones, made with macOS's built-in `avconvert`. Undefined
 * elsewhere or on failure; the full-quality video is unaffected either way.
 */
async function shareableCopy(video: string, out: string): Promise<string | undefined> {
  if (!existsSync(AVCONVERT)) return undefined;
  rmSync(out, { force: true });
  try {
    await run(AVCONVERT, ['--source', video, '--preset', 'PresetAppleM4V720pHD', '--output', out], { timeout: 600_000 });
    return existsSync(out) ? out : undefined;
  } catch (e) {
    console.warn(`Couldn't make the shareable copy: ${(e as Error).message}`);
    return undefined;
  }
}
