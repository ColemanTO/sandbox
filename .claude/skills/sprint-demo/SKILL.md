---
name: sprint-demo
description: Turn a sprint's user stories into a recorded demo video for the sprint review. Reads the sprint's stories file (demo/sprints/sprint-N.yaml), writes a Playwright demo (demo/sprint-N.demo.ts) that walks through each Done story's acceptance criteria in Storybook with on-screen captions and a pointer, runs it, and produces an MP4 (optionally narrated). Use this whenever someone wants a sprint demo, sprint review video, demo recording, stakeholder walkthrough, or "show what we built this sprint", or wants to update or re-record an existing sprint demo — even if they don't say "skill" or "video".
---

# Sprint demo

Builds the sprint-review demo video from the sprint's stories, with Playwright. The video is produced by a real
test run, so every acceptance criterion shown on screen is also asserted: if a story is broken, the demo fails
instead of recording a misleading video.

## How the pieces fit

- **Stories**: `demo/sprints/sprint-<N>.yaml` (format in `references/stories-format.md`). Written by hand for now.
- **Demo**: `demo/sprint-<N>.demo.ts`, built on `sprintDemo()` from `demo/toolkit/sprint-demo.ts`. One `test` per
  story. You write or update this from the stories.
- **Toolkit** (`demo/toolkit/`, read `references/toolkit.md` before writing a demo): `sprint-demo.ts` (browser and
  recording lifecycle), `demo.ts` (captions, title cards, pointer, pacing), `overlay.js` (the overlay styles and
  script, shared with the Selenium toolkit), `recorder.ts` (Chrome screencast), `narrator.ts` (spoken captions),
  `video.ts` + `encoder.mjs` (MP4 encoding with WebCodecs in Chrome).
- **Where it runs**: Storybook (`http://localhost:6006`), because it shows every ng-a11y component; the demo app
  on :4200 only has toasts and the error summary. A story's own page is `/iframe.html?id=<story-id>&viewMode=story`
  (ids look like `components-date-picker--min-and-max`); docs pages are `/?path=/docs/<component>--docs`.
- **Config**: `playwright.demo.config.ts`, separate from `playwright.config.ts` so the e2e run never plays demos.
  It starts Storybook if it isn't running, and uses installed Chrome.
- **Output**: `demo/output/Sprint<N>Demo/` (git-ignored): `Sprint<N>Demo.mp4`, `Sprint<N>Demo-720p.m4v`,
  `timeline.json`, `frames.txt` and the raw frames. Narration clips are cached in `demo/output/voice-cache`.

## Workflow

### 1. Pick the sprint and read its stories

Use the file the user names; otherwise the highest-numbered `demo/sprints/sprint-*.yaml`. Sort the stories:

- `status: Done` stories go in the demo, unless nothing on screen can show them (behaviour only app code
  triggers). Say so in the stories file's `notes` and in the demo file's header comment.
- Anything else is left out. List those for the user at the end so nothing silently disappears.

If a Done story has no acceptance criteria, ask for them rather than inventing behaviour: the captions present the
criteria to stakeholders as what was built.

### 2. Find where each step happens

For each criterion, find the Storybook story (`projects/ng-a11y/src/lib/<name>/<name>.stories.ts`) that shows it
and read the component's template for roles, labels and `data-*` attributes. Prefer locators that read like the UI
(`getByRole`, `getByLabel`) over CSS classes. If no story shows a criterion, consider adding one (it helps the
docs too) rather than leaving the criterion out; ask the user if that's more than a small change.

### 3. Write the demo

Create or update `demo/sprint-<N>.demo.ts`, following `references/toolkit.md`:

- `sprintDemo({ name: 'Sprint<N>Demo', title: 'Sprint N demo', goal, startUrl })`, with `goal` from the file.
- One `test('<ID> <short title>', async ({ demo }) => ...)` per story, in the file's order.
- Start each with `await demo.story(id, title)`. For each criterion: `await demo.step('...')`, then the action,
  then `expect` the outcome.
- Act through `demo.click / type / press / hover / goto`, never `locator.click()` directly: those add the pointer,
  the focus ring and human-speed typing, and put the caption back after a page load. `demo.press` points at the
  focused element first, which makes keyboard behaviour visible.
- Write captions for the audience: present tense, plain words, what the viewer is about to see, under about 80
  characters. Avoid symbols and abbreviations a voice would stumble over.
- After a result that needs a moment to sink in, add `await demo.pause(1200)` to `1500`.
- A wait the behaviour itself needs (e.g. outlasting a 5 s toast timer) must use `page.waitForTimeout`, not
  `demo.pause`, which is skipped in dry runs.
- Dates: compute "today" in the test (see `dayFromToday` in `sprint-5.demo.ts`) so the demo still passes next week.

### 4. Dry-run fast, then record

A recording plays at human speed, so first check the logic with recording off and no pauses:

```bash
DEMO_RECORD=0 DEMO_PACE=0 DEMO_VOICE="Zoe (Enhanced)" npx playwright test -c playwright.demo.config.ts sprint-<N>
```

With `DEMO_VOICE` set, the dry run also renders every caption's speech in the background and caches it, so the
recording doesn't stall about two seconds on each caption. Leave it out for a silent video.

Fix failures before recording. A failing assertion means either the demo doesn't match the app (fix the demo) or
the story doesn't work (stop and tell the user: that's a bug to fix before the review). Never delete an assertion
to get a green run.

Then record (same command without `DEMO_RECORD=0 DEMO_PACE=0`):

```bash
DEMO_VOICE="Zoe (Enhanced)" npx playwright test -c playwright.demo.config.ts sprint-<N>
```

Options: `DEMO_PACE=1.3` slows everything down, `DEMO_HEADED=1` shows the browser, `DEMO_RATE=170` slows speech.
Encoding takes well under a minute (hardware H.264 through WebCodecs), plus about as long again for the 720p copy.

### 5. Check the video before handing it over

Don't report success from the exit code alone:

```bash
python3 .claude/skills/sprint-demo/scripts/frames_at.py demo/output/Sprint<N>Demo
```

It prints the frame on screen at the start of each story and step (from `timeline.json`). Open three or four, at
least the opening card, a mid-demo step and the last story, and check that the caption matches what's on screen,
the pointer is on the element being used, and no overlay is stuck. If narrated, check in `timeline.json` that each
entry's gap to the next is at least its `audioSeconds`.

### 6. Report

- Where the video is: the full-quality MP4 and the 720p `.m4v` to share (files over 30 MB only show in the
  desktop app); its length.
- Which stories are in it, which were left out and why.
- Anything that failed, or that you changed.
- That it can be re-recorded any time with the command above.

Don't commit unless asked.

## Environment notes

- ffmpeg is not needed (and on this Intel Mac can't be installed from Homebrew). Encoding uses Chrome's WebCodecs
  (H.264 + AAC) and the `mediabunny` muxer, in a page served from `https://encoder.local` (a secure context is
  required). `/usr/bin/avconvert` makes the 720p copy.
- Narration needs macOS `say`; `say -v '?'` lists voices. Enhanced/Premium voices (System Settings → Accessibility
  → Spoken Content → Manage Voices) sound far better than the defaults.
