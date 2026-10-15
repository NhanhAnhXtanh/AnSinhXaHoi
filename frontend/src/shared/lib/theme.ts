/**
 * Theme state for the DTH shell.
 *
 * Five orthogonal settings live as state on `<html>`; `src/styles/theme.css`
 * derives every semantic colour and spacing token from them:
 *
 *   mode         -> `.dark` class          light | dark | system
 *   colorPreset  -> `data-color-preset`    navy | blue | …
 *   radius       -> `data-radius`          none | sm | md | lg | xl
 *   sidebarTone  -> `data-sidebar-tone`    dark | light
 *   density      -> `data-density`         compact | comfortable | spacious
 *
 * The same values are written to localStorage and replayed by the inline
 * bootstrap script in `index.html`, which runs before first paint so the shell
 * never flashes the wrong theme.
 *
 * Keep the storage keys and the preset key list in sync with that script.
 */

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedMode = "light" | "dark";
export type ColorPreset =
  | "navy"
  | "blue"
  | "indigo"
  | "violet"
  | "emerald"
  | "teal"
  | "rose"
  | "orange"
  | "amber"
  | "slate";
export type Radius = "none" | "sm" | "md" | "lg" | "xl";
export type SidebarTone = "dark" | "light";
export type Density = "compact" | "comfortable" | "spacious";

export const STORAGE_KEYS = {
  mode: "dth-ui-mode",
  colorPreset: "dth-ui-color",
  radius: "dth-ui-radius",
  sidebarTone: "dth-ui-sidebar-tone",
  density: "dth-ui-density",
} as const;

export const DEFAULTS = {
  mode: "system" as ThemeMode,
  colorPreset: "navy" as ColorPreset,
  radius: "md" as Radius,
  sidebarTone: "dark" as SidebarTone,
  density: "comfortable" as Density,
};

/**
 * Swatch metadata for the customizer.
 *
 * `light`/`dark` mirror the `--preset-l|c|h` triplets declared in
 * `styles/theme.css`, so a swatch always shows the colour the preset will
 * actually produce. Change one, change the other.
 */
export const COLOR_PRESETS: Array<{
  key: ColorPreset;
  label: string;
  light: string;
  dark: string;
}> = [
  { key: "navy", label: "Navy", light: "oklch(0.306 0.091 257)", dark: "oklch(0.72 0.13 257)" },
  { key: "blue", label: "Blue", light: "oklch(0.49 0.175 250)", dark: "oklch(0.7 0.18 250)" },
  { key: "indigo", label: "Indigo", light: "oklch(0.46 0.175 277)", dark: "oklch(0.68 0.18 277)" },
  { key: "violet", label: "Violet", light: "oklch(0.47 0.185 300)", dark: "oklch(0.7 0.19 300)" },
  { key: "emerald", label: "Emerald", light: "oklch(0.48 0.155 162)", dark: "oklch(0.72 0.17 162)" },
  { key: "teal", label: "Teal", light: "oklch(0.48 0.13 195)", dark: "oklch(0.74 0.14 195)" },
  { key: "rose", label: "Rose", light: "oklch(0.51 0.2 12)", dark: "oklch(0.71 0.2 12)" },
  { key: "orange", label: "Orange", light: "oklch(0.55 0.18 45)", dark: "oklch(0.75 0.18 45)" },
  { key: "amber", label: "Amber", light: "oklch(0.64 0.15 82)", dark: "oklch(0.84 0.16 82)" },
  { key: "slate", label: "Slate", light: "oklch(0.34 0.025 258)", dark: "oklch(0.82 0.02 258)" },
];

/**
 * Density presets for the customizer.
 *
 * Density is a single number: `--density-spacing`, wired to Tailwind's base
 * spacing unit in `styles/index.css`. Every `p-*`, `gap-*`, `h-*` and `size-*` utility
 * compiles to `calc(var(--spacing) * n)`, so rescaling that one unit tightens
 * or loosens the whole shell — control heights, table rows, card padding,
 * header height, nav rows — without a single per-component override.
 *
 * `hint` is what the customizer shows underneath the label.
 */
export const DENSITY_OPTIONS: Array<{
  key: Density;
  label: string;
  hint: string;
}> = [
  { key: "compact", label: "Compact", hint: "85%" },
  { key: "comfortable", label: "Cozy", hint: "100%" },
  { key: "spacious", label: "Roomy", hint: "115%" },
];

export const RADIUS_OPTIONS: Array<{ key: Radius; label: string }> = [
  { key: "none", label: "0" },
  { key: "sm", label: "sm" },
  { key: "md", label: "md" },
  { key: "lg", label: "lg" },
  { key: "xl", label: "xl" },
];

const COLOR_PRESET_KEYS = COLOR_PRESETS.map((preset) => preset.key);
const RADIUS_KEYS = RADIUS_OPTIONS.map((option) => option.key);

function readStored<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return allowed.includes(value as T) ? (value as T) : fallback;
  } catch {
    // Private mode / disabled storage — fall back rather than break the app.
    return fallback;
  }
}

function writeStored(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export function getStoredMode(fallback: ThemeMode = DEFAULTS.mode): ThemeMode {
  return readStored(STORAGE_KEYS.mode, ["light", "dark", "system"] as const, fallback);
}

export function getStoredColorPreset(
  fallback: ColorPreset = DEFAULTS.colorPreset
): ColorPreset {
  return readStored(STORAGE_KEYS.colorPreset, COLOR_PRESET_KEYS, fallback);
}

export function getStoredRadius(fallback: Radius = DEFAULTS.radius): Radius {
  return readStored(STORAGE_KEYS.radius, RADIUS_KEYS, fallback);
}

export function getStoredSidebarTone(
  fallback: SidebarTone = DEFAULTS.sidebarTone
): SidebarTone {
  return readStored(STORAGE_KEYS.sidebarTone, ["dark", "light"] as const, fallback);
}

export function getStoredDensity(fallback: Density = DEFAULTS.density): Density {
  return readStored(
    STORAGE_KEYS.density,
    ["compact", "comfortable", "spacious"] as const,
    fallback
  );
}

export function prefersDark(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function resolveMode(mode: ThemeMode): ResolvedMode {
  if (mode === "system") return prefersDark() ? "dark" : "light";
  return mode;
}

/**
 * Suppress transitions for one frame so flipping the mode repaints instantly
 * instead of cross-fading every element on the page.
 */
function withoutTransitions(apply: () => void) {
  const root = document.documentElement;
  root.classList.add("theme-transition-suppressed");
  apply();
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      root.classList.remove("theme-transition-suppressed");
    });
  });
}

export function applyMode(mode: ThemeMode) {
  const resolved = resolveMode(mode);
  withoutTransitions(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", resolved === "dark");
    root.style.colorScheme = resolved;
  });
  writeStored(STORAGE_KEYS.mode, mode);
}

export function applyColorPreset(preset: ColorPreset) {
  document.documentElement.setAttribute("data-color-preset", preset);
  writeStored(STORAGE_KEYS.colorPreset, preset);
}

export function applyRadius(radius: Radius) {
  document.documentElement.setAttribute("data-radius", radius);
  writeStored(STORAGE_KEYS.radius, radius);
}

export function applySidebarTone(tone: SidebarTone) {
  document.documentElement.setAttribute("data-sidebar-tone", tone);
  writeStored(STORAGE_KEYS.sidebarTone, tone);
}

export function applyDensity(density: Density) {
  document.documentElement.setAttribute("data-density", density);
  writeStored(STORAGE_KEYS.density, density);
}
