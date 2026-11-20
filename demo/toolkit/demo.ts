import type { Locator, Page } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Clip, Narrator } from './narrator';

/** Installs window.__demo (caption bar, title card, pointer, ring). Shared with the Selenium toolkit's Demo.java. */
const OVERLAY_JS = readFileSync(join(__dirname, 'overlay.js'), 'utf8');

/** A narration clip placed at a time in the video. */
export interface PlacedClip {
  at: number;
  file: string;
}

interface TimelineEntry {
  type: 'title' | 'story' | 'step';
  [field: string]: unknown;
  epoch: number;
}

/**
 * Presents a demo in the browser: title cards, a caption bar naming the story and step, a pointer that moves to
 * each element before it's used, and human-speed typing.
 *
 * Use its `click`, `type`, `press` and `hover` instead of calling the locator directly, so viewers see the pointer
 * and the typing. Every check still goes through Playwright's `expect`.
 *
 * With a Narrator, each title, story and step is also spoken, and the demo waits for the speech to finish, so the
 * video is paced to the voice. Every story and step is logged with its time (and narration clip) to timeline.json.
 */
export class Demo {
  private readonly timeline: TimelineEntry[] = [];
  private storyId = '';
  private storyTitle = '';
  private stepText = '';

  /**
   * @param recording false for a dry run: captions are then only pre-rendered for narration (in the background), so
   *                  the run doesn't wait for speech
   */
  constructor(
    readonly page: Page,
    private readonly pace: number,
    private readonly narrator: Narrator | undefined,
    private readonly recording: boolean,
  ) {}

  // ---- Narrative ---------------------------------------------------------------------------------------------

  /** Full-screen card, e.g. the sprint name at the start and a closing card at the end. */
  async titleCard(title: string, subtitle: string, millis: number): Promise<void> {
    const clip = await this.speak(subtitle ? `${title}. ${subtitle}.` : `${title}.`);
    this.log('title', { title, subtitle }, clip);
    await this.overlay('__demo.card(a[0], a[1]);', [title, subtitle]);
    await this.waitFor(millis, clip);
    await this.overlay('__demo.hideCard();');
    await this.pause(300);
  }

  /** Starts a story: shows its ID and title in the caption bar. */
  async story(id: string, title: string): Promise<void> {
    this.storyId = id;
    this.storyTitle = title;
    this.stepText = '';
    // "NGA-1" reads as "N G A minus 1"; a space reads naturally.
    const clip = await this.speak(`${id.replace(/-/g, ' ')}. ${title}.`);
    this.log('story', { id, title }, clip);
    await this.showCaption();
    await this.waitFor(1500, clip);
  }

  /** Describes what is about to happen; typically one acceptance criterion. */
  async step(text: string): Promise<void> {
    this.stepText = text;
    const clip = await this.speak(text);
    this.log('step', { id: this.storyId, text }, clip);
    await this.showCaption();
    await this.waitFor(1200, clip);
  }

  // ---- Interaction -------------------------------------------------------------------------------------------

  /** Opens a page and puts the caption back (a page load wipes the overlays). */
  async goto(url: string): Promise<void> {
    await this.page.goto(url);
    await this.restoreCaption();
  }

  /** `force` clicks even if Playwright sees it as disabled, e.g. to show that a disabled control does nothing. */
  async click(target: Locator, { force = false } = {}): Promise<void> {
    await this.beforeInteract(target);
    await target.click({ force });
    await this.afterInteract();
  }

  /** Types at about 18 characters a second. */
  async type(target: Locator, text: string, { clear = false } = {}): Promise<void> {
    await this.beforeInteract(target);
    await target.click();
    if (clear) await target.clear();
    await target.pressSequentially(text, { delay: Math.round(55 * this.pace) });
    await this.pause(300);
  }

  /** Presses a key where focus is, pointing at the focused element first so viewers see where focus is. */
  async press(key: string): Promise<void> {
    await this.pointAtFocus();
    await this.page.keyboard.press(key);
    await this.pause(650);
  }

  /** Moves the pointer (and the real mouse) over an element. */
  async hover(target: Locator): Promise<void> {
    await this.beforeInteract(target);
    await target.hover();
    await this.pause(500);
  }

  /** Moves the real mouse away from everything, to the page's top-left corner. */
  async mouseAway(): Promise<void> {
    await this.page.mouse.move(5, 5, { steps: 8 });
    await this.pause(500);
  }

  /** Waits `millis` scaled by the pace (DEMO_PACE=0 skips all pauses). */
  async pause(millis: number): Promise<void> {
    const ms = Math.round(millis * this.pace);
    if (ms > 0) await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async beforeInteract(target: Locator): Promise<void> {
    await this.restoreCaption();
    await target.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'smooth' }));
    await this.pause(400);
    await this.overlay('');
    await target.evaluate((el) => (window as unknown as { __demo: { point(el: Element): void } }).__demo.point(el));
    await this.pause(700);
  }

  private async afterInteract(): Promise<void> {
    await this.pause(500);
  }

  private async pointAtFocus(): Promise<void> {
    await this.restoreCaption();
    await this.overlay('if (document.activeElement && document.activeElement !== document.body) __demo.point(document.activeElement);');
    await this.pause(250);
  }

  // ---- Captions and narration ---------------------------------------------------------------------------------

  /** Re-shows the caption, e.g. after a page load wiped the overlays. */
  async restoreCaption(): Promise<void> {
    if (this.storyId) {
      await this.overlay("if (!document.getElementById('__demo-caption')) __demo.caption(a[0], a[1], a[2]);", [
        this.storyId,
        this.storyTitle,
        this.stepText,
      ]);
    }
  }

  private async showCaption(): Promise<void> {
    await this.overlay('__demo.caption(a[0], a[1], a[2]);', [this.storyId, this.storyTitle, this.stepText]);
  }

  /**
   * Runs `script` after installing the overlays; `a` holds `args`. Sent as an expression string (not through
   * `new Function` in the page), so a page's Content Security Policy can't block it.
   */
  private async overlay(script: string, args: unknown[] = []): Promise<void> {
    await this.page.evaluate(`(() => {\n${OVERLAY_JS}\nconst a = ${JSON.stringify(args)};\n${script}\n})()`);
  }

  /** Renders the clip before the caption appears, so the logged time is when speech starts. */
  private async speak(text: string): Promise<Clip | undefined> {
    if (!this.narrator) return undefined;
    if (!this.recording) {
      this.narrator.prepare(text);
      return undefined;
    }
    return this.narrator.render(text);
  }

  /** Waits the paced default, or until the narration has finished if that is longer. */
  private async waitFor(defaultMillis: number, clip: Clip | undefined): Promise<void> {
    let ms = Math.round(defaultMillis * this.pace);
    if (clip) ms = Math.max(ms, Math.round(clip.seconds * 1000) + 350);
    if (ms > 0) await new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ---- Timeline ----------------------------------------------------------------------------------------------

  private log(type: TimelineEntry['type'], fields: Record<string, unknown>, clip: Clip | undefined): void {
    const entry: TimelineEntry = { type, ...fields, epoch: Date.now() / 1000 };
    if (clip) {
      entry['audio'] = clip.file;
      entry['audioSeconds'] = Math.round(clip.seconds * 1000) / 1000;
    }
    this.timeline.push(entry);
  }

  isNarrated(): boolean {
    return this.timeline.some((e) => 'audio' in e);
  }

  /** Narration clips with their offsets in seconds from `videoStart` (epoch seconds). */
  narrationClips(videoStart: number): PlacedClip[] {
    return this.timeline
      .filter((e) => typeof e['audio'] === 'string')
      .map((e) => ({ at: Math.max(0, e.epoch - videoStart), file: e['audio'] as string }));
  }

  /** Writes timeline.json with each entry's offset in seconds (`at`) from `videoStart` (epoch seconds). */
  writeTimeline(file: string, videoStart: number): void {
    const out = this.timeline.map(({ epoch, ...rest }) => {
      const { type, ...fields } = rest;
      return { type, ...fields, at: Math.max(0, Math.round((epoch - videoStart) * 1000) / 1000) };
    });
    writeFileSync(file, JSON.stringify(out, null, 2));
  }
}
