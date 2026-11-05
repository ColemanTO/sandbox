# @colemanto/ng-a11y

Accessible Angular components. Currently: a toast / snackbar.

- Standalone components, signals, `OnPush`. Angular 22+.
- Tested with unit tests, axe-core, and Playwright in Chromium and WebKit.
- No dependencies beyond Angular.

## Install

```bash
npm install @colemanto/ng-a11y
```

## Toast

Add the container once, near the root of your app:

```ts
import { Component } from '@angular/core';
import { A11yToastContainer } from '@colemanto/ng-a11y';

@Component({
  selector: 'app-root',
  imports: [A11yToastContainer],
  template: `<router-outlet /><a11y-toast-container />`,
})
export class App {}
```

Then show toasts from anywhere:

```ts
import { inject } from '@angular/core';
import { A11yToastService } from '@colemanto/ng-a11y';

const toast = inject(A11yToastService);

toast.success('Your changes were saved.');
toast.error('Could not save your changes.');           // announced assertively
toast.info('Item deleted.', {
  action: { label: 'Undo', handler: () => restore() },  // has an action, so it stays until dismissed
});
```

### API

`A11yToastService`

| Method | Description |
| --- | --- |
| `show(config \| message)` | Show a toast. Returns its id. |
| `info` / `success` / `warning` / `error(message, options?)` | Shortcuts for `show` with a type. |
| `dismiss(id)` / `dismissAll()` | Remove toasts. |
| `toasts` | Read-only signal of the toasts currently showing. |

`ToastConfig`

| Option | Default | Description |
| --- | --- | --- |
| `message` | required | Text shown and announced. |
| `type` | `'info'` | `'info' \| 'success' \| 'warning' \| 'error'` |
| `duration` | `5000`, or `0` if the toast has an `action` | Milliseconds before auto-dismiss. `0` keeps it until dismissed. See [How long toasts stay](#how-long-toasts-stay). |
| `action` | none | `{ label, handler }`. Running it also dismisses the toast. |
| `politeness` | `'assertive'` for errors, otherwise `'polite'` | Override how it is announced. |

### Accessibility

- Two live regions (`role="status"` and `role="alert"`) are always in the DOM,
  because screen readers only announce changes to regions that already exist.
- The type is announced as text ("Error: ...") and shown as an icon, never by color alone.
- The timer pauses on hover and while keyboard focus is inside the toast
  (WCAG 2.2.1 Timing Adjustable). Toasts with an action stay until dismissed; see below.
- Escape or the close button dismisses a toast. Controls are at least 44x44px with a visible focus ring.
- When a keyboard user dismisses a toast (close button, Escape, or an action), focus returns to where they
  were before they tabbed into the toast. Otherwise focus would drop to the page and a screen reader would
  go silent. The dismissal is also announced ("Notification dismissed"). Toasts that time out are not
  announced again, since they were announced when they appeared.
- Honors `prefers-reduced-motion` and forced-colors mode.

Automated checks cannot replace testing with a screen reader. Please test with
the assistive technology your users rely on.

### How long toasts stay

| Toast | Default | Why |
| --- | --- | --- |
| No action | Disappears after 5 seconds | It was announced when it appeared, so nothing is lost. |
| Has an `action` (such as Undo) | **Stays until dismissed** | An action that vanishes on a timer may be gone before a keyboard or screen reader user can reach it (WCAG 2.1.1 Keyboard, 2.2.1 Timing Adjustable). |

You can override either default with `duration`:

```ts
toast.success('Saved', { duration: 0 });                    // keep a plain toast until dismissed
toast.info('Deleted', { duration: 8000, action: undoAction }); // give an action toast a timer
```

If you change a toast with an action to time out, keep the time generous and make sure the same action
is available somewhere else in your UI. **A toast should never be the only way to do something.**
Toasts are easy to miss: a keyboard user has to Tab to reach them, and a screen reader user may be
reading something else when one appears.

> **Upgrading from 0.2.x:** toasts that have an `action` used to disappear after 5 seconds and now stay
> until dismissed. Set `duration: 5000` on them to keep the old behavior. See the [changelog](CHANGELOG.md).

### Themes

Ready-made light, dark and high-contrast themes ship in the package. Add them once
(Angular `styles` array, or `@import` in your global stylesheet):

```css
@import '@colemanto/ng-a11y/themes/all.css';
```

Then choose a theme with `data-theme` on `<html>` or on any element:

```html
<html data-theme="dark">
```

- `light`, `dark`, `high-contrast` set the theme explicitly.
- With no `data-theme`, the theme follows the operating system: dark mode gives the
  dark theme and increased contrast gives high-contrast.
- A theme on a subtree themes just that subtree. Put `<a11y-toast-container />` inside
  it if the toasts should match.

`all.css` includes everything in the right order. If you want only some files, load them in this
order: `primitives`, `theme-light`, `theme-dark`, `theme-high-contrast`, `components`
(all under `@colemanto/ng-a11y/themes/`). The high-contrast file must come last so
`prefers-contrast: more` wins.

The themes also define semantic variables you can use for your own UI, such as
`--a11y-color-surface`, `--a11y-color-on-surface`, `--a11y-color-border` and
`--a11y-color-focus-ring`. Text pairs meet WCAG AA contrast (AAA in high-contrast).

### Customizing

Without the themes, or on top of them, override these CSS custom properties anywhere above the toast
(for example on `:root`):

| Variable | Default |
| --- | --- |
| `--a11y-toast-bg` | `#1f2933` |
| `--a11y-toast-fg` | `#ffffff` |
| `--a11y-toast-radius` | `8px` |
| `--a11y-toast-focus` | `#ffd24d` |
| `--a11y-toast-info` / `-success` / `-warning` / `-error` | accent colors for each type |

If you change colors, keep text contrast at 4.5:1 or better.

## Accessibility notes and limitations

This package is built to support accessible use, and it is not a guarantee of conformance. WCAG
conformance is judged for a whole page or application, so using this component does not by itself make an
app conformant. It also does not constitute legal advice or a statement of compliance with any law.

**What has been tested**

- Automated: unit tests, [axe-core](https://github.com/dequelabs/axe-core) (in jsdom and in real browsers,
  including color contrast), and Playwright end-to-end tests in Chromium and WebKit. The shipped themes are
  checked for WCAG contrast on every build.
- Manual: the author has tested with VoiceOver on macOS in Safari and Chrome.

**What has not been tested:** Windows screen readers (NVDA, JAWS, Narrator), mobile screen readers
(VoiceOver on iOS, TalkBack), and Firefox. Screen reader and browser combinations behave differently, so please
test with the assistive technology your users rely on.

Found a problem? Please [open an issue](https://github.com/ColemanTO/sandbox/issues) and say which
screen reader, browser and operating system you used.

## Development

```bash
npm install
npm start                 # demo app on http://localhost:4200
ng test ng-a11y           # unit + axe tests
npm run e2e               # Playwright (Chromium + WebKit)
npm run build:lib         # tokens + library, output in dist/ng-a11y
```

## License

[MIT](LICENSE). The software is provided "as is", without warranty of any kind; see the license for the full terms.
