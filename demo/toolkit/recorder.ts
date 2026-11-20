import type { CDPSession, Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export interface Frame {
  file: string;
  /** Seconds since the epoch, when Chrome painted the frame. */
  timestamp: number;
}

/**
 * Records the page with Chrome's DevTools screencast: Chrome sends a JPEG each time it paints, with the time it was
 * painted. Works headless, captures only the page (not the browser UI) and keeps going across navigations.
 * Chromium only (Chrome or Edge).
 */
export class DemoRecorder {
  private session?: CDPSession;
  private readonly frames: Frame[] = [];
  private readonly writes: Promise<void>[] = [];

  constructor(
    private readonly page: Page,
    private readonly dir: string,
    private readonly size: { width: number; height: number },
  ) {}

  async start(): Promise<void> {
    mkdirSync(this.dir, { recursive: true });
    this.session = await this.page.context().newCDPSession(this.page);
    this.session.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
      const file = join(this.dir, `${String(this.frames.length).padStart(6, '0')}.jpg`);
      this.frames.push({ file, timestamp: metadata.timestamp ?? Date.now() / 1000 });
      writeFileSync(file, Buffer.from(data, 'base64'));
      // Chrome sends the next frame only after this one is acknowledged.
      this.writes.push(this.session!.send('Page.screencastFrameAck', { sessionId }).catch(() => {}));
    });
    await this.session.send('Page.startScreencast', {
      format: 'jpeg',
      quality: 92,
      maxWidth: this.size.width,
      maxHeight: this.size.height,
      everyNthFrame: 1,
    });
  }

  /** Stops recording and returns the frames in the order they were painted. */
  async stop(): Promise<Frame[]> {
    if (this.session) {
      await this.session.send('Page.stopScreencast').catch(() => {});
      await Promise.all(this.writes);
      await this.session.detach().catch(() => {});
    }
    return this.frames;
  }
}
