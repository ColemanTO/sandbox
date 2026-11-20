import { test as base, expect, type BrowserContext } from '@playwright/test';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { Demo } from './demo';
import { Narrator } from './narrator';
import { DemoRecorder } from './recorder';
import { renderVideo } from './video';

export { expect };

export interface SprintDemoOptions {
  /** File and folder name, e.g. "Sprint5Demo". */
  name: string;
  /** Opening card title, e.g. "Sprint 5 demo". */
  title: string;
  /** Opening card subtitle: the sprint goal. */
  goal?: string;
  /** The page the video opens on (relative to the config's baseURL). */
  startUrl: string;
}

/** CSS pixels of the page. The 1.5x scale sharpens text, though the screencast still sends 1280x720 frames. */
const VIEWPORT = { width: 1280, height: 720 };
const SCALE = 1.5;

/**
 * Sets up a sprint demo: one browser page and one video for the whole file. Each `test` demos one story, in file
 * order (serial), and still asserts the acceptance criteria, so a broken story fails the demo instead of being
 * recorded silently.
 *
 * Settings (environment variables):
 *   DEMO_RECORD=0       run without recording (dry run)
 *   DEMO_PACE=1.0       multiplies every pause; 0 = no pauses
 *   DEMO_VOICE=...      narrate with this macOS voice, e.g. "Zoe (Enhanced)"; DEMO_RATE=185 words per minute
 *
 * Output goes to demo/output/<name>/: the MP4, the 720p .m4v, timeline.json, frames.txt and the raw frames.
 */
export function sprintDemo(options: SprintDemoOptions) {
  const record = process.env['DEMO_RECORD'] !== '0';
  const pace = Number(process.env['DEMO_PACE'] ?? 1);
  let context: BrowserContext;
  let demo: Demo;
  let recorder: DemoRecorder | undefined;
  let narrator: Narrator | undefined;
  let outDir: string;

  const test = base.extend<{ demo: Demo }>({
    demo: async ({}, use) => use(demo),
  });
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(120_000);
    const output = join(testInfo.project.testDir, 'output');
    outDir = join(output, options.name);
    // Only a recording replaces the previous output; dry runs leave it alone, and only pre-render narration clips
    // in the background, so they stay fast.
    if (record) {
      rmSync(outDir, { recursive: true, force: true });
      mkdirSync(outDir, { recursive: true });
    }
    narrator = Narrator.fromEnv(join(output, 'voice-cache'));
    context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: SCALE, colorScheme: 'light' });
    const page = await context.newPage();
    demo = new Demo(page, pace, narrator, record);
    await page.goto(options.startUrl);
    if (record) {
      recorder = new DemoRecorder(page, join(outDir, 'frames'), {
        width: VIEWPORT.width * SCALE,
        height: VIEWPORT.height * SCALE,
      });
      await recorder.start();
    }
    await demo.titleCard(options.title, options.goal ?? '', 3500);
  });

  test.afterAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(15 * 60_000);
    try {
      await demo?.titleCard('Thank you', options.title, 2500);
    } catch (e) {
      console.warn(`Could not show the closing card: ${(e as Error).message}`);
    }
    try {
      if (recorder) {
        const end = Date.now() / 1000;
        const frames = await recorder.stop();
        if (!frames.length) throw new Error('No video frames were captured.');
        const videoStart = frames[0].timestamp;
        demo.writeTimeline(join(outDir, 'timeline.json'), videoStart);
        console.log(`Encoding ${frames.length} frames (${(end - videoStart).toFixed(0)} s of demo)...`);
        const { video, shareable } = await renderVideo(browser, frames, end, outDir, options.name, demo.narrationClips(videoStart));
        console.log(`Demo video: ${video}`);
        if (shareable) console.log(`Shareable copy: ${shareable}`);
      } else {
        await narrator?.awaitPrepared();
      }
    } finally {
      await context?.close();
    }
  });

  return { test, expect };
}
