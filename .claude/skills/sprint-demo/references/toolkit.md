# Demo toolkit reference

All in `demo/toolkit/`.

## sprintDemo (sprint-demo.ts)

`sprintDemo(options)` returns `{ test, expect }` for one demo file. Lifecycle, once per file: opens one page
(1280x720 at 1.5x device scale; the screencast still delivers 1280x720 frames, so the video is 720p), goes to `startUrl`, starts recording, shows the opening
card, runs the tests in file order (serial; a failure skips the rest), shows a closing card, stops recording,
writes `timeline.json` and the videos.

| Option | Required | Purpose |
|---|---|---|
| `name` | yes | Output folder and file name, e.g. `Sprint5Demo` |
| `title` | yes | Opening card title, e.g. "Sprint 5 demo" |
| `goal` | no | Opening card subtitle (the sprint goal) |
| `startUrl` | yes | First page, relative to `http://localhost:6006` |

Each test gets the `demo` fixture.

## Demo (demo.ts)

| Call | Effect |
|---|---|
| `demo.story(id, title)` | Caption bar shows the story badge and title; ~1.5 s pause (or the narration) |
| `demo.step(text)` | Caption shows the step after the title; ~1.2 s pause (or the narration) |
| `demo.click(locator)` | Scrolls it to the middle, moves the pointer to it, pulses a ring, clicks |
| `demo.type(locator, text, { clear })` | Same, then types at about 18 characters a second |
| `demo.press(key)` | Points at the focused element, then presses the key |
| `demo.hover(locator)` / `demo.mouseAway()` | Moves the pointer and the real mouse |
| `demo.goto(url)` | Opens a page and restores the caption |
| `demo.pause(ms)` | Waits, scaled by `DEMO_PACE` (skipped when 0) |
| `demo.titleCard(title, subtitle, ms)` | Full-screen card |
| `demo.page` | The Playwright page, for locators and `expect` |

Overlays (caption, card, pointer, ring) are popovers in the browser's top layer, so they show above modal dialogs.
A page load wipes them; `goto` and every interaction put the caption back. Their look lives in `overlay.js`, copied
from the Selenium toolkit's `Demo.java`; keep the two in step.

## Settings (environment variables)

| Variable | Default | Meaning |
|---|---|---|
| `DEMO_RECORD` | `1` | `0` runs without recording |
| `DEMO_PACE` | `1` | Multiplies every pause; `0` = no pauses (dry runs) |
| `DEMO_VOICE` | (empty: silent) | Narration voice from `say -v '?'`, e.g. `Zoe (Enhanced)` |
| `DEMO_RATE` | `185` | Narration speed, words per minute |
| `DEMO_HEADED` | (off) | `1` shows the browser |

## Narration (narrator.ts)

With `DEMO_VOICE` set, `titleCard`, `story` and `step` speak their text (macOS `say`, 48 kHz WAV) and wait until
the clip has finished. Clips are cached in `demo/output/voice-cache` by voice, rate and text; a dry run pre-renders
them, four at a time. If `say` or the voice fails, the demo continues silently and says so in the log.

## Recording and encoding (recorder.ts, video.ts, encoder.mjs)

- `DemoRecorder` uses Chrome's DevTools screencast (`Page.startScreencast` over a Playwright CDP session): a JPEG
  each time Chrome paints, with its paint time. Headless, page only, survives navigations. Chromium only.
- `renderVideo` holds each frame until the next paint and encodes `<name>.mp4` (H.264, plus AAC narration mixed
  from the clips at their timeline offsets) with WebCodecs and the `mediabunny` muxer in a Chrome page.
- On macOS it also makes `<name>-720p.m4v` with `/usr/bin/avconvert`, for sharing.
- `frames.txt` lists each frame and how long it is held; `scripts/frames_at.py` reads it.

## Example

```ts
import { sprintDemo } from './toolkit/sprint-demo';

const { test, expect } = sprintDemo({
  name: 'Sprint6Demo',
  title: 'Sprint 6 demo',
  goal: 'Toasts can be grouped',
  startUrl: '/iframe.html?id=components-toast--success&viewMode=story',
});

test('NGA-9 dismiss a toast with Escape', async ({ demo }) => {
  const page = demo.page;
  await demo.story('NGA-9', 'Dismiss a toast with Escape');
  await demo.step('Showing a toast');
  await demo.click(page.getByRole('button', { name: 'Show toast' }));
  await expect(page.locator('a11y-toast-item')).toBeVisible();
  await demo.pause(1200);
});
```

`demo/sprint-5.demo.ts` is a complete, working example.
