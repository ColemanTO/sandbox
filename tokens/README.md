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
