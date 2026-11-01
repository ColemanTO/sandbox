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
  duration: 0,                                          // stays until dismissed
  action: { label: 'Undo', handler: () => restore() },
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
| `duration` | `5000` | Milliseconds before auto-dismiss. `0` keeps it until dismissed. |
| `action` | none | `{ label, handler }`. Running it also dismisses the toast. |
| `politeness` | `'assertive'` for errors, otherwise `'polite'` | Override how it is announced. |

### Accessibility

- Two live regions (`role="status"` and `role="alert"`) are always in the DOM,
  because screen readers only announce changes to regions that already exist.
- The type is announced as text ("Error: ...") and shown as an icon, never by color alone.
- The timer pauses on hover and while keyboard focus is inside the toast
  (WCAG 2.2.1 Timing Adjustable). Use `duration: 0` for messages people need time to act on.
- Escape or the close button dismisses a toast. Controls are at least 44x44px with a visible focus ring.
- When a keyboard user dismisses a toast (close button, Escape, or an action), focus returns to where they
  were before they tabbed into the toast. Otherwise focus would drop to the page and a screen reader would
  go silent. The dismissal is also announced ("Notification dismissed"). Toasts that time out are not
  announced again, since they were announced when they appeared.
- Honors `prefers-reduced-motion` and forced-colors mode.

Automated checks cannot replace testing with a screen reader. Please test with
the assistive technology your users rely on.

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

## Development

```bash
npm install
npm start                 # demo app on http://localhost:4200
ng test ng-a11y           # unit + axe tests
npm run e2e               # Playwright (Chromium + WebKit)
npm run build:lib         # tokens + library, output in dist/ng-a11y
```

## License

MIT
