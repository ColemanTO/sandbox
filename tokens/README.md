# Design tokens

Source of truth for color, radius and size. Written in the
[W3C DTCG format](https://www.designtokens.org/) (`$type`, `$value`, `{group.token}` references).

```
tokens/
  primitives.json          Tier 1: raw values (color scales, radii, sizes)
  themes/
    light.json             Tier 2: semantic roles per theme
    dark.json              (every theme defines the same token names)
    high-contrast.json
  components/
    toast.json             Tier 3: component tokens -> --a11y-toast-* CSS variables
```

Components reference semantic roles, semantic roles reference primitives. A theme
only changes what the semantic tier points at, so a new theme needs no component changes.

## Rules

- Components never reference primitives directly.
- Every theme file defines exactly the same token names.
- Text pairs need 4.5:1 (7:1 in high-contrast); non-text pairs need 3:1 (4.5:1 in high-contrast).
- Colors are hex strings for compatibility with Figma plugins and Style Dictionary.

## Figma

Figma's free plan allows one mode per variable collection, so model each theme as its own
collection (Light, Dark, High contrast) until you upgrade, or use a plugin such as Tokens Studio.
The repo is the source of truth; treat Figma as a consumer.

## Build

```bash
npm run tokens        # writes tokens/build/css/ (gitignored)
```

| File | Contents |
| --- | --- |
| `primitives.css` | Raw values on `:root` |
| `theme-light.css` | Semantic roles; `:root, [data-theme="light"]` |
| `theme-dark.css` | `[data-theme="dark"]`, and `prefers-color-scheme: dark` when no `data-theme` is set |
| `theme-high-contrast.css` | `[data-theme="high-contrast"]`, and `prefers-contrast: more` when no `data-theme` is set |
| `components.css` | `--a11y-toast-*` etc., referencing the semantic roles with `var()` |
| `all.css` | All of the above in the correct order |

Load order: `primitives`, `theme-light`, `theme-dark`, `theme-high-contrast`, `components`.
The system-preference rules live in the dark and high-contrast files, so they must come after light,
and high-contrast must come after dark so `prefers-contrast: more` wins.

Set `data-theme` on `<html>` for an app-wide theme, or on any element to theme just that subtree.
Leave it unset to follow the operating system.

## Shipping

The build also copies the CSS to `projects/ng-a11y/themes/` (gitignored), because ng-packagr only packages
assets from inside the library folder. `ng-package.json` copies it to `themes/` in the package, and
`exports` in the library `package.json` exposes it as `@colemanto/ng-a11y/themes/*`.
Use `npm run build:lib` so tokens are rebuilt before the library.
