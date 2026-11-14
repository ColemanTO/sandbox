import type { StorybookConfig } from '@storybook/angular-vite';

const config: StorybookConfig = {
  // Stories sit next to the components they show, inside the library.
  stories: ['../projects/ng-a11y/src/**/*.mdx', '../projects/ng-a11y/src/**/*.stories.ts'],
  addons: ['@storybook/addon-a11y', '@storybook/addon-docs'],
  framework: '@storybook/angular-vite',
  core: { disableTelemetry: true },
};
export default config;
