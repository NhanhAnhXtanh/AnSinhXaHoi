"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";

import {
  applyColorPreset,
  applyDensity,
  applyMode,
  applyRadius,
  applySidebarTone,
  DEFAULTS,
  getStoredColorPreset,
  getStoredDensity,
  getStoredMode,
  getStoredRadius,
  getStoredSidebarTone,
  resolveMode,
  type ColorPreset,
  type Density,
  type Radius,
  type ResolvedMode,
  type SidebarTone,
  type ThemeMode,
} from "@/shared/lib/theme";

type ThemeProviderState = {
  /** Selected mode, including `system`. */
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  /** What `system` actually resolved to right now. */
  resolvedMode: ResolvedMode;

  colorPreset: ColorPreset;
  setColorPreset: (preset: ColorPreset) => void;

  radius: Radius;
  setRadius: (radius: Radius) => void;

  sidebarTone: SidebarTone;
  setSidebarTone: (tone: SidebarTone) => void;

  density: Density;
  setDensity: (density: Density) => void;

  /** Back to the shipped defaults (navy / system / md / dark rail / cozy). */
  reset: () => void;

  /**
   * Aliases kept for the components that shipped with refine-ui
   * (`ThemeToggle`, `ThemeSelect`) — same value as `mode`/`setMode`.
   */
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
};

const ThemeProviderContext = createContext<ThemeProviderState | undefined>(
  undefined
);

export type ThemeProviderProps = PropsWithChildren<{
  defaultMode?: ThemeMode;
  defaultColorPreset?: ColorPreset;
  defaultRadius?: Radius;
  defaultSidebarTone?: SidebarTone;
  defaultDensity?: Density;
}>;

export function ThemeProvider({
  children,
  defaultMode = DEFAULTS.mode,
  defaultColorPreset = DEFAULTS.colorPreset,
  defaultRadius = DEFAULTS.radius,
  defaultSidebarTone = DEFAULTS.sidebarTone,
  defaultDensity = DEFAULTS.density,
}: ThemeProviderProps) {
  // The inline bootstrap in index.html already put these on <html> before
  // first paint; we read the same storage so React starts in agreement with
  // the DOM and nothing flashes on hydration.
  const [mode, setModeState] = useState<ThemeMode>(
    () => getStoredMode(defaultMode)
  );
  const [colorPreset, setColorPresetState] = useState<ColorPreset>(
    () => getStoredColorPreset(defaultColorPreset)
  );
  const [radius, setRadiusState] = useState<Radius>(
    () => getStoredRadius(defaultRadius)
  );
  const [sidebarTone, setSidebarToneState] = useState<SidebarTone>(
    () => getStoredSidebarTone(defaultSidebarTone)
  );
  const [density, setDensityState] = useState<Density>(
    () => getStoredDensity(defaultDensity)
  );
  const [resolvedMode, setResolvedMode] = useState<ResolvedMode>(() =>
    resolveMode(mode)
  );

  // Re-assert the state on mount so a provider rendered without the bootstrap
  // script (tests, Storybook, SSR) still ends up correct.
  useEffect(() => {
    applyMode(mode);
    applyColorPreset(colorPreset);
    applyRadius(radius);
    applySidebarTone(sidebarTone);
    applyDensity(density);
    setResolvedMode(resolveMode(mode));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Follow the OS while the user is on `system`.
  useEffect(() => {
    if (mode !== "system" || !window.matchMedia) return;

    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      applyMode("system");
      setResolvedMode(resolveMode("system"));
    };

    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [mode]);

  const setMode = useCallback((next: ThemeMode) => {
    applyMode(next);
    setModeState(next);
    setResolvedMode(resolveMode(next));
  }, []);

  const setColorPreset = useCallback((next: ColorPreset) => {
    applyColorPreset(next);
    setColorPresetState(next);
  }, []);

  const setRadius = useCallback((next: Radius) => {
    applyRadius(next);
    setRadiusState(next);
  }, []);

  const setSidebarTone = useCallback((next: SidebarTone) => {
    applySidebarTone(next);
    setSidebarToneState(next);
  }, []);

  const setDensity = useCallback((next: Density) => {
    applyDensity(next);
    setDensityState(next);
  }, []);

  const reset = useCallback(() => {
    setMode(DEFAULTS.mode);
    setColorPreset(DEFAULTS.colorPreset);
    setRadius(DEFAULTS.radius);
    setSidebarTone(DEFAULTS.sidebarTone);
    setDensity(DEFAULTS.density);
  }, [setColorPreset, setDensity, setMode, setRadius, setSidebarTone]);

  const value = useMemo<ThemeProviderState>(
    () => ({
      mode,
      setMode,
      resolvedMode,
      colorPreset,
      setColorPreset,
      radius,
      setRadius,
      sidebarTone,
      setSidebarTone,
      density,
      setDensity,
      reset,
      theme: mode,
      setTheme: setMode,
    }),
    [
      mode,
      setMode,
      resolvedMode,
      colorPreset,
      setColorPreset,
      radius,
      setRadius,
      sidebarTone,
      setSidebarTone,
      density,
      setDensity,
      reset,
    ]
  );

  return (
    <ThemeProviderContext.Provider value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeProviderContext);

  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }

  return context;
}

ThemeProvider.displayName = "ThemeProvider";
