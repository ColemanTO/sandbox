/** Plain styles for the buttons and fields that surround a component in its stories. Not part of the package. */
export const STORY_STYLES = `
  :host { display: block; max-width: 640px; }
  button, select {
    min-height: 44px;
    padding: 0 16px;
    font: inherit;
    color: var(--a11y-color-on-surface);
    background: var(--a11y-color-surface);
    border: 2px solid var(--a11y-color-border);
    border-radius: var(--a11y-radius-sm);
    cursor: pointer;
  }
  .row { display: flex; flex-wrap: wrap; gap: 8px; }
  .field { margin-block-end: 16px; }
  .field label { display: block; margin-block-end: 4px; font-weight: 600; }
  .field input:not([type='checkbox']) {
    box-sizing: border-box;
    width: 100%;
    min-height: 44px;
    padding: 0 12px;
    font: inherit;
    color: var(--a11y-color-on-surface);
    background: var(--a11y-color-surface);
    border: 2px solid var(--a11y-color-border);
    border-radius: var(--a11y-radius-sm);
  }
  .field--checkbox { display: flex; align-items: center; gap: 8px; }
  .field--checkbox input { width: 24px; height: 24px; margin: 0; }
  .field--checkbox label { margin: 0; font-weight: 400; }
`;
