import type { Preview } from '@storybook/angular-vite';

/** The themes the tokens define. "system" leaves the choice to the OS settings. */
const THEMES = [
  { value: 'system', title: 'System' },
  { value: 'light', title: 'Light' },
  { value: 'dark', title: 'Dark' },
  { value: 'high-contrast', title: 'High contrast' },
];

const preview: Preview = {
  parameters: {
    layout: 'padded',
    options: { storySort: { order: ['Introduction', 'Components'] } },
    // Fail loudly in the accessibility panel rather than only listing violations.
    a11y: {
      test: 'error',
      // A story is a fragment, not a page, so the page-level rules do not apply to it.
      config: {
        rules: [
          { id: 'landmark-one-main', enabled: false },
          { id: 'page-has-heading-one', enabled: false },
          { id: 'region', enabled: false },
        ],
      },
    },
  },
  globalTypes: {
    theme: {
      description: 'Theme',
      toolbar: { title: 'Theme', icon: 'paintbrush', items: THEMES, dynamicTitle: true },
    },
  },
  initialGlobals: { theme: 'system' },
  decorators: [
    (story, context) => {
      // Same switch the tokens use in an app: data-theme on <html>, or no attribute for the OS setting.
      const theme = context.globals['theme'];
      const root = document.documentElement;
      if (!theme || theme === 'system') root.removeAttribute('data-theme');
      else root.setAttribute('data-theme', theme);
      return story();
    },
  ],
};

export default preview;
