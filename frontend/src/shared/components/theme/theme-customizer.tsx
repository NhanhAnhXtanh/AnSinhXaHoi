"use client";

import { Check, Monitor, Moon, Paintbrush, RotateCcw, Sun } from "lucide-react";

import { useTheme } from "@/shared/components/theme/theme-provider";
import { Button } from "@/shared/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/shared/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/ui/tooltip";
import { cn } from "@/shared/lib/utils";
import {
  COLOR_PRESETS,
  DENSITY_OPTIONS,
  RADIUS_OPTIONS,
  type SidebarTone,
  type ThemeMode,
} from "@/shared/lib/theme";

const MODE_OPTIONS: Array<{
  value: ThemeMode;
  label: string;
  icon: typeof Sun;
}> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

const SIDEBAR_TONE_OPTIONS: Array<{ value: SidebarTone; label: string }> = [
  { value: "dark", label: "Dark rail" },
  { value: "light", label: "Match surface" },
];

/**
 * The "Customize theme" panel behind the brush icon in the header.
 *
 * Every control writes straight to `<html>` through the theme provider, so the
 * preview is the app itself — there is no separate preview surface to keep in
 * sync.
 */
export function ThemeCustomizer({ className }: { className?: string }) {
  const {
    mode,
    setMode,
    colorPreset,
    setColorPreset,
    radius,
    setRadius,
    sidebarTone,
    setSidebarTone,
    density,
    setDensity,
    resolvedMode,
    reset,
  } = useTheme();

  return (
    <Sheet>
      <Tooltip>
        <TooltipTrigger asChild>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Customize theme"
              className={cn(
                "size-9 rounded-lg text-muted-foreground",
                "hover:bg-accent hover:text-foreground",
                className
              )}
            >
              <Paintbrush className="size-[1.1rem]" />
            </Button>
          </SheetTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">Customize theme</TooltipContent>
      </Tooltip>

      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto scrollbar-fade sm:max-w-sm"
      >
        <SheetHeader className="gap-1">
          <SheetTitle>Customize</SheetTitle>
          <SheetDescription>
            Pick a tone for the interface. Choices are stored in this browser.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-7 px-4 pb-8">
          <Section label="Brand colour">
            <div className="grid grid-cols-2 gap-2">
              {COLOR_PRESETS.map((preset) => {
                const isActive = preset.key === colorPreset;
                const swatch =
                  resolvedMode === "dark" ? preset.dark : preset.light;

                return (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => setColorPreset(preset.key)}
                    aria-pressed={isActive}
                    className={cn(
                      "flex h-9 items-center gap-2 rounded-lg border px-2.5",
                      "text-xs font-medium transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isActive
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    <span
                      aria-hidden
                      className="size-4 shrink-0 rounded-full ring-1 ring-inset ring-black/10"
                      style={{ backgroundColor: swatch }}
                    />
                    <span className="flex-1 text-left">{preset.label}</span>
                    {isActive && <Check className="size-3.5 shrink-0 text-primary" />}
                  </button>
                );
              })}
            </div>
          </Section>

          <Section label="Appearance">
            <div className="grid grid-cols-3 gap-2">
              {MODE_OPTIONS.map(({ value, label, icon: Icon }) => (
                <OptionButton
                  key={value}
                  isActive={mode === value}
                  onClick={() => setMode(value)}
                >
                  <Icon className="size-4" />
                  {label}
                </OptionButton>
              ))}
            </div>
          </Section>

          <Section label="Sidebar">
            <div className="grid grid-cols-2 gap-2">
              {SIDEBAR_TONE_OPTIONS.map(({ value, label }) => (
                <OptionButton
                  key={value}
                  isActive={sidebarTone === value}
                  onClick={() => setSidebarTone(value)}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "size-4 shrink-0 rounded-[3px] border",
                      value === "dark"
                        ? "border-transparent bg-[oklch(0.32_0.117_262)]"
                        : "border-border bg-card"
                    )}
                  />
                  {label}
                </OptionButton>
              ))}
            </div>
          </Section>

          <Section label="Density">
            <div className="grid grid-cols-3 gap-2">
              {DENSITY_OPTIONS.map((option) => (
                <OptionButton
                  key={option.key}
                  isActive={density === option.key}
                  onClick={() => setDensity(option.key)}
                  className="h-auto flex-col gap-0.5 py-2"
                >
                  {option.label}
                  <span className="text-[10px] font-normal opacity-60">
                    {option.hint}
                  </span>
                </OptionButton>
              ))}
            </div>
          </Section>

          <Section label="Corner radius">
            <div className="grid grid-cols-5 gap-2">
              {RADIUS_OPTIONS.map((option) => (
                <OptionButton
                  key={option.key}
                  isActive={radius === option.key}
                  onClick={() => setRadius(option.key)}
                  className="justify-center"
                >
                  {option.label}
                </OptionButton>
              ))}
            </div>
          </Section>

          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={reset}
          >
            <RotateCcw className="size-4" />
            Reset to defaults
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}

function OptionButton({
  isActive,
  onClick,
  className,
  children,
}: {
  isActive: boolean;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      className={cn(
        "flex h-9 items-center justify-center gap-2 rounded-lg border px-2",
        "text-xs font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isActive
          ? "border-primary bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
        className
      )}
    >
      {children}
    </button>
  );
}

ThemeCustomizer.displayName = "ThemeCustomizer";
