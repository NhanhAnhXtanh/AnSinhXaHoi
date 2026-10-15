# dth-framework

<div align="center" style="margin: 30px;">
    <a href="https://refine.dev">
    <img alt="refine logo" src="https://refine.ams3.cdn.digitaloceanspaces.com/readme/refine-readme-banner.png">
    </a>
</div>
<br/>

This [Refine](https://github.com/refinedev/refine) project was generated with [create refine-app](https://github.com/refinedev/refine/tree/master/packages/create-refine-app).

## Getting Started

A React Framework for building internal tools, admin panels, dashboards & B2B apps with unmatched flexibility ✨

Refine's hooks and components simplifies the development process and eliminates the repetitive tasks by providing industry-standard solutions for crucial aspects of a project, including authentication, access control, routing, networking, state management, and i18n.

## Available Scripts

### Running the development server.

```bash
    npm run dev
```

### Building for production.

```bash
    npm run build
```

### Running the production server.

```bash
    npm run start
```

## Theming & layout

The shell follows the [Apex](https://apex-shadcn.dashboardpack.com/) dashboard
pattern: a dark rail on the left, a frosted sticky header, and a light content
surface. Everything is driven by CSS custom properties, so no component holds a
colour of its own.

### Where things live

| File | Role |
| --- | --- |
| `src/styles/theme.css` | Every design token. Brand presets at the top, semantic tokens derived from them below. |
| `src/App.css` | Maps the tokens onto Tailwind (`bg-primary`, `text-success`, `shadow-e3`, …), base layer and custom utilities. |
| `src/lib/theme.ts` | Theme state: types, presets, storage keys, and the `apply*` helpers. |
| `src/components/refine-ui/theme/theme-provider.tsx` | React binding for that state. |
| `src/components/refine-ui/theme/theme-customizer.tsx` | The "Customize" panel behind the brush icon. |
| `src/components/refine-ui/layout/` | `layout.tsx` (shell), `sidebar.tsx`, `header.tsx`. |
| `index.html` | Inline bootstrap that replays the saved theme before first paint. |

### The four knobs

All four are state on `<html>`, persisted to `localStorage`:

| Setting | Attribute | Values | Default |
| --- | --- | --- | --- |
| Mode | `class="dark"` | light / dark / system | system |
| Brand colour | `data-color-preset` | navy, blue, indigo, violet, emerald, teal, rose, orange, amber, slate | **navy** |
| Corner radius | `data-radius` | none / sm / md / lg / xl | md |
| Sidebar tone | `data-sidebar-tone` | dark / light | dark |

Read or change them from anywhere with `useTheme()`:

```tsx
const { mode, setMode, colorPreset, setColorPreset, reset } = useTheme();
```

### Adding a brand colour

Presets are pure OKLCH numbers — hue, chroma and lightness — and every semantic
token is derived from them, so a new colour is one block in `theme.css` plus one
row in `COLOR_PRESETS`:

```css
/* src/styles/theme.css */
:root[data-color-preset="crimson"] {
  --preset-h: 20;            /* hue angle                        */
  --preset-c: 0.19;          /* chroma, light mode               */
  --preset-c-dark: 0.2;      /* chroma, dark mode                */
  --preset-l: 0.52;          /* brand lightness, light mode      */
  --preset-l-dark: 0.72;     /* brand lightness, dark mode       */
  --preset-sidebar-c: 0.025; /* how much the dark rail is tinted */
}
```

```ts
// src/lib/theme.ts — add "crimson" to ColorPreset, then:
{ key: "crimson", label: "Crimson",
  light: "oklch(0.52 0.19 20)", dark: "oklch(0.72 0.2 20)" },
```

Also add the key to the allow-list in the `index.html` bootstrap script, so the
preset survives a reload.

### Extra tokens beyond stock shadcn

`success`, `warning` and `info` (each with a `-foreground`), a `destructive-foreground`,
a five-step chart ramp rotated off the brand hue, and four elevation levels
exposed as `shadow-e1` … `shadow-e4`.

## Learn More

To learn more about **Refine**, please check out the [Documentation](https://refine.dev/docs)

- **REST Data Provider** [Docs](https://refine.dev/docs/core/providers/data-provider/#overview)
- **shadcn/ui** [Docs](https://refine.dev/docs/guides-concepts/general-concepts/#headless-concept)
- **React Router** [Docs](https://refine.dev/docs/core/providers/router-provider/)

## License

MIT
