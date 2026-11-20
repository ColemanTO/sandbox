import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
const SAY = '/usr/bin/say';

/** Sample rate for narration clips; 48 kHz so the AAC encoder takes them as they are. */
export const SAMPLE_RATE = 48_000;

export interface Clip {
  file: string;
  seconds: number;
}

/**
 * Speaks demo captions into WAV clips with the macOS `say` command, using any installed system voice (the same
 * voices VoiceOver and Spoken Content use, e.g. "Zoe (Enhanced)").
 *
 * Clips are cached by voice, rate and text in `demo/output/voice-cache`. Rendering one takes about two seconds,
 * which would otherwise show up as dead air in the video, so a dry run (DEMO_RECORD=0) renders every caption in the
 * background ahead of time and the recording then plays each clip with no delay. Uncached clips are still rendered
 * on demand.
 */
export class Narrator {
  private failed = false;
  private readonly pending = new Map<string, Promise<Clip | undefined>>();
  private running = 0;
  private readonly queue: (() => void)[] = [];

  private constructor(
    private readonly voice: string,
    private readonly rate: number,
    private readonly cache: string,
  ) {}

  /** A narrator if DEMO_VOICE is set and `say` is available; otherwise undefined. */
  static fromEnv(cache: string): Narrator | undefined {
    const voice = process.env['DEMO_VOICE']?.trim();
    if (!voice) return undefined;
    if (!existsSync(SAY)) {
      console.warn('DEMO_VOICE is set, but narration needs the macOS `say` command; continuing without it.');
      return undefined;
    }
    mkdirSync(cache, { recursive: true });
    return new Narrator(voice, Number(process.env['DEMO_RATE'] ?? 185), cache);
  }

  /** The clip for `text`, rendering it now if it isn't cached. Undefined if speech fails. */
  render(text: string): Promise<Clip | undefined> {
    if (this.failed || !text.trim()) return Promise.resolve(undefined);
    const file = join(this.cache, this.key(text) + '.wav');
    let clip = this.pending.get(file);
    if (!clip) {
      clip = this.limited(async () => {
        try {
          if (!existsSync(file)) await this.synthesize(text, file);
          return { file, seconds: wavSeconds(file) };
        } catch (e) {
          this.failed = true;
          console.warn(`Narration failed: ${(e as Error).message} (check the voice name with: say -v '?'). Continuing without narration.`);
          return undefined;
        }
      });
      this.pending.set(file, clip);
    }
    return clip;
  }

  /** Renders `text` into the cache in the background (used by dry runs). */
  prepare(text: string): void {
    void this.render(text);
  }

  /** Waits for background rendering to finish. */
  async awaitPrepared(): Promise<void> {
    await Promise.all(this.pending.values());
  }

  /** At most four `say` processes at once. */
  private async limited<T>(task: () => Promise<T>): Promise<T> {
    if (this.running >= 4) await new Promise<void>((resolve) => this.queue.push(resolve));
    this.running++;
    try {
      return await task();
    } finally {
      this.running--;
      this.queue.shift()?.();
    }
  }

  private async synthesize(text: string, file: string): Promise<void> {
    // Render to a temp name and move into place, so a half-written clip is never cached.
    const tmp = `${file}.${process.pid}.tmp.wav`;
    try {
      await run(SAY, ['-v', this.voice, '-r', String(this.rate), `--data-format=LEI16@${SAMPLE_RATE}`, '-o', tmp, text], {
        timeout: 60_000,
      });
      if (statSync(tmp).size === 0) throw new Error('empty clip');
      renameSync(tmp, file);
    } catch (e) {
      rmSync(tmp, { force: true });
      const err = e as { stderr?: string; message: string };
      throw new Error(`\`say\` failed for voice "${this.voice}": ${err.stderr?.trim() || err.message}`);
    }
  }

  private key(text: string): string {
    return createHash('sha1').update(`${this.voice}|${this.rate}|${SAMPLE_RATE}|${text}`).digest('hex');
  }
}

/** 16-bit mono PCM samples of a WAV file written by `say`. */
export function wavSamples(file: string): Int16Array {
  const buf = readFileSync(file);
  const { offset, size } = dataChunk(buf);
  const samples = new Int16Array(size / 2);
  for (let i = 0; i < samples.length; i++) samples[i] = buf.readInt16LE(offset + i * 2);
  return samples;
}

function wavSeconds(file: string): number {
  return dataChunk(readFileSync(file)).size / 2 / SAMPLE_RATE;
}

/** Finds the `data` chunk; `say` may write other chunks (e.g. FLLR padding) before it. */
function dataChunk(buf: Buffer): { offset: number; size: number } {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') throw new Error('not a WAV file');
  for (let pos = 12; pos + 8 <= buf.length; ) {
    const id = buf.toString('ascii', pos, pos + 4);
    const size = buf.readUInt32LE(pos + 4);
    if (id === 'data') return { offset: pos + 8, size: Math.min(size, buf.length - pos - 8) & ~1 };
    pos += 8 + size + (size & 1);
  }
  throw new Error('WAV file has no data chunk');
}
