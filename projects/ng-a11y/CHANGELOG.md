# Changelog

## 0.5.0

- **New: Storybook.** Live examples of every component, with docs, controls and theme switching, at
  <https://demos.coleman-creative.com/ng-a11y/>.
- **New: `<a11y-date-picker>`.** Adds a calendar dialog to a date field the user can also type in. It wraps your
  own `<input>`, so it works with any kind of form. Keyboard support follows the WAI-ARIA date picker dialog
  pattern. Supports `min` and `max`, a text `format`, locales, and translated labels. See "Date picker" in the
  README. Tested with unit tests and axe, and by hand with VoiceOver.
- **Fixed: a toast could time out while keyboard focus was inside it.** Moving the mouse over and off a toast
  restarted its timer even if focus was still in the toast. The timer now stays paused until both have left.
- **Fixed: focus was lost when the app removed a focused toast.** `dismiss(id)` and `dismissAll()` now move focus
  back to where the user came from (or to a toast that is staying) before the toast is removed, as the close
  button, Escape and actions already did.
  Focus that reached a toast from another toast goes back to the page, not to that other toast.
- **Fixed: error summary links could go to the wrong field.** In a `FormArray`, or anywhere a group name is bound
  (`[formGroupName]="i"`), every row's entry linked to the first field with that name. The summary now only links
  to a field it can identify. Mark fields whose names are bound with `data-a11y-field="<dotted path>"`; without
  it the entry is shown as text and a warning is logged in development. See "Limits" in the README.
  A group with no element of its own (`<ng-container formGroupName>`) still links, as it did in 0.4.0, unless
  another field there has the same name. Entries that are not links keep their place in the list.
- **Fixed: error summary and async validators.** A submit made while an async validator was still running showed
  nothing, even if validation then failed. The summary now appears, and takes focus, when that validator
  finishes. Editing another field in the meantime does not bring the summary up early.
- **Fixed: error summary and `updateOn: 'submit'`.** The form was judged on the values from before the submit.
  It is now judged on what the user typed.

## 0.4.0

- **Changed: how toasts are announced.** A success toast was reported to be read twice by VoiceOver. The visible
  toast used to be a live region whose content arrived in several DOM updates. Each toast is now announced once,
  as a single string, through hidden live regions that are always present, and announcements are queued so rapid
  toasts are not cut off. The visible toasts are no longer `role="status"`/`role="alert"`; they sit in a named
  "Notifications" landmark (`label` input) that exists only while toasts are showing. A toast with an action
  announces "Action available: Undo". `service.polite` and `service.assertive` are deprecated (no longer used).

- **New: `<a11y-error-summary>`.** Lists a form's errors after a failed submit, moves focus to the list, and links
  each entry to its field. Reactive forms; no dependency on `@angular/forms`. See "Error summary" in the README.
  Tested with unit tests and Playwright (Chromium and WebKit), including axe and theme contrast, and by hand with
  VoiceOver on Safari and Chrome.

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
