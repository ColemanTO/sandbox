# Changelog

## Unreleased

- **Changed: how toasts are announced.** A success toast was reported to be read twice by VoiceOver. The visible
  toast used to be a live region whose content arrived in several DOM updates. Each toast is now announced once,
  as a single string, through hidden live regions that are always present, and announcements are queued so rapid
  toasts are not cut off. The visible toasts are no longer `role="status"`/`role="alert"`; they sit in a named
  "Notifications" landmark (`label` input) that exists only while toasts are showing. A toast with an action
  announces "Action available: Undo". `service.polite` and `service.assertive` are deprecated (no longer used).

- **New: `<a11y-error-summary>`.** Lists a form's errors after a failed submit, moves focus to the list, and links
  each entry to its field. Reactive forms; no dependency on `@angular/forms`. See "Error summary" in the README.
  Tested with unit tests and Playwright (Chromium and WebKit), including axe and theme contrast. Not yet tested by
  hand with a screen reader.

## 0.3.0

**Behavior change.** A toast with an `action` (such as Undo) now stays until the user dismisses it, instead of
disappearing after 5 seconds. An action on a timer can vanish before a keyboard or screen reader user can reach
it (WCAG 2.1.1, 2.2.1). To keep the old behavior, set `duration: 5000` on those toasts. Toasts without an
action are unchanged. See "How long toasts stay" in the README.

Also adds the MIT `LICENSE` file to the package (earlier versions only declared the license in `package.json`)
and an "Accessibility notes and limitations" section to the README.

## 0.2.0

- Dismissing a toast with the keyboard (close button, Escape or an action) now returns focus to where the user
  came from, or to another toast, instead of dropping it to the page. Screen readers announce
  "Notification dismissed". Toasts that time out are not announced again.

## 0.1.1

- Package `repository` metadata now points at the correct repo. First release published from GitHub Actions
  with npm provenance.

## 0.1.0

- Ships light, dark and high-contrast themes: `@colemanto/ng-a11y/themes/all.css`.
- Documents theming and customizing with `--a11y-toast-*` custom properties.

## 0.0.1

- First release: accessible toast / snackbar with polite and assertive live regions, pause on hover and focus,
  keyboard dismissal and an optional action.
