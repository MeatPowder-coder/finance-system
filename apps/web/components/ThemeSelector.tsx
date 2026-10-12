import { useEffect, useMemo, useState, type ComponentType, type CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { CircleOff, Flame, Grid3X3, Leaf, Moon, Palette, Sparkles, Sun, Waves } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface ThemeSelectorProps {
  collapsed?: boolean;
  showCurrentTheme?: boolean;
  showSwatches?: boolean;
  panel?: boolean;
  onThemeChange?: (theme: string) => void;
  onBackgroundChange?: (mode: BackgroundMode) => void;
}

type ThemeId = "light" | "dark" | "sand" | "lavender" | "mint" | "graphite" | "midnight" | "ocean" | "forest" | "ember" | "neon";
type BackgroundMode = "auto" | "plain" | "grid" | "aurora";

type ThemeOption = {
  value: ThemeId;
  label: string;
  shortLabel: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  swatch: string;
  preview: {
    base: string;
    hero: string;
    flow: string;
    ledger: string;
    account: string;
  };
};

const THEME_OPTIONS: ThemeOption[] = [
  {
    value: "dark",
    label: "Cuaderno nocturno",
    shortLabel: "Noche",
    description: "Tinta verde, lima y coral · referencia Bento",
    icon: Moon,
    swatch: "from-[#122019] via-[#d8ff63] to-[#df5a43]",
    preview: { base: "#121713", hero: "#214735", flow: "#d8ff63", ledger: "#df5a43", account: "#afd3dc" },
  },
  {
    value: "light",
    label: "Papel editorial",
    shortLabel: "Papel",
    description: "Papel cálido, verde botánico, coral y azul",
    icon: Sun,
    swatch: "from-[#f2f0e4] via-[#9dbf67] to-[#e98765]",
    preview: { base: "#f2f0e4", hero: "#214735", flow: "#d8ff63", ledger: "#df5a43", account: "#bbd4e0" },
  },
  {
    value: "sand",
    label: "Arena",
    shortLabel: "Arena",
    description: "Claro calido y suave para uso diario",
    icon: Sun,
    swatch: "from-amber-100 via-orange-100 to-rose-200",
    preview: { base: "#f4ead9", hero: "#3d5044", flow: "#edd674", ledger: "#db7654", account: "#bbd4cc" },
  },
  {
    value: "lavender",
    label: "Lavanda",
    shortLabel: "Lavanda",
    description: "Claro con acento violeta discreto",
    icon: Sparkles,
    swatch: "from-violet-100 via-indigo-100 to-sky-200",
    preview: { base: "#f5f1fa", hero: "#36305e", flow: "#d6ec83", ledger: "#dd6477", account: "#b6c9ef" },
  },
  {
    value: "mint",
    label: "Menta",
    shortLabel: "Menta",
    description: "Claro fresco con acentos verdes",
    icon: Leaf,
    swatch: "from-emerald-100 via-teal-100 to-cyan-200",
    preview: { base: "#edf6ef", hero: "#244e46", flow: "#d6ee83", ledger: "#d66a5b", account: "#a6d8d2" },
  },
  {
    value: "graphite",
    label: "Grafito",
    shortLabel: "Grafito",
    description: "Oscuro mate sin fondo animado",
    icon: CircleOff,
    swatch: "from-zinc-200 via-zinc-700 to-zinc-950",
    preview: { base: "#191b1c", hero: "#1b3030", flow: "#c9e66c", ledger: "#e77861", account: "#acd1da" },
  },
  {
    value: "midnight",
    label: "Medianoche",
    shortLabel: "Medianoche",
    description: "Azules profundos con brillo sutil",
    icon: Sparkles,
    swatch: "from-sky-300 via-indigo-400 to-violet-600",
    preview: { base: "#11121f", hero: "#232346", flow: "#b8e7ff", ledger: "#f17d67", account: "#a8c8f3" },
  },
  {
    value: "ocean",
    label: "Oceano",
    shortLabel: "Océano",
    description: "Cian y azul para un look mas fresco",
    icon: Waves,
    swatch: "from-cyan-300 via-sky-400 to-blue-600",
    preview: { base: "#09282c", hero: "#154d4e", flow: "#8fe8dc", ledger: "#f07b61", account: "#9fd8ed" },
  },
  {
    value: "forest",
    label: "Bosque",
    shortLabel: "Bosque",
    description: "Verde elegante con sensacion organica",
    icon: Leaf,
    swatch: "from-emerald-300 via-green-400 to-lime-500",
    preview: { base: "#12221a", hero: "#244c37", flow: "#d1ee6e", ledger: "#e47b5d", account: "#a9d5c9" },
  },
  {
    value: "ember",
    label: "Ascua",
    shortLabel: "Ascua",
    description: "Calido, ambar y con mas energia visual",
    icon: Flame,
    swatch: "from-orange-300 via-amber-400 to-rose-500",
    preview: { base: "#291810", hero: "#5c3020", flow: "#f4d46c", ledger: "#ed7951", account: "#a9d7d4" },
  },
  {
    value: "neon",
    label: "Neon",
    shortLabel: "Neón",
    description: "El estilo mas intenso y vibrante",
    icon: Palette,
    swatch: "from-fuchsia-300 via-cyan-300 to-violet-500",
    preview: { base: "#17121e", hero: "#3a1d4a", flow: "#dcff43", ledger: "#ff6177", account: "#83dfe9" },
  },
];

const THEME_CLASS_NAMES = THEME_OPTIONS.map((option) => "theme-" + option.value);
const THEME_CHANGE_EVENT = "finance-theme-change";

export function ThemeSelector({ collapsed, showCurrentTheme = false, showSwatches = false, panel = false, onThemeChange, onBackgroundChange }: ThemeSelectorProps) {
  const [theme, setTheme] = useState<ThemeId>("dark");
  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>("auto");

  const currentTheme = useMemo(
    () => THEME_OPTIONS.find((option) => option.value === theme) ?? THEME_OPTIONS[0],
    [theme]
  );

  const applyTheme = (nextTheme: ThemeId) => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark", ...THEME_CLASS_NAMES);

    if (["light", "sand", "lavender", "mint"].includes(nextTheme)) {
      root.classList.add("light", "theme-" + nextTheme);
      return;
    }

    if (nextTheme === "dark") {
      root.classList.add("dark", "theme-dark");
      return;
    }

    root.classList.add("dark", "theme-" + nextTheme);
  };

  const applyBackgroundMode = (nextMode: BackgroundMode) => {
    localStorage.setItem("backgroundMode", nextMode);
    window.dispatchEvent(new CustomEvent("finance-background-mode", { detail: nextMode }));
    setBackgroundMode(nextMode);
    onBackgroundChange?.(nextMode);
  };

  useEffect(() => {
    const savedThemeRaw = localStorage.getItem("theme") || "dark";
    const savedTheme = THEME_OPTIONS.some((option) => option.value === savedThemeRaw)
      ? (savedThemeRaw as ThemeId)
      : "dark";

    if (savedThemeRaw !== savedTheme) {
      localStorage.setItem("theme", savedTheme);
    }

    setTheme(savedTheme);
    applyTheme(savedTheme);
    const savedBackground = localStorage.getItem("backgroundMode");
    const nextBackground: BackgroundMode = savedBackground === "plain" || savedBackground === "grid" || savedBackground === "aurora" ? savedBackground : "auto";
    setBackgroundMode(nextBackground);
    window.dispatchEvent(new CustomEvent("finance-background-mode", { detail: nextBackground }));

    const syncTheme = (event: Event) => {
      const nextTheme = event instanceof StorageEvent
        ? event.newValue
        : (event as CustomEvent<string>).detail;
      if (!THEME_OPTIONS.some((option) => option.value === nextTheme)) return;
      setTheme(nextTheme as ThemeId);
      applyTheme(nextTheme as ThemeId);
    };
    window.addEventListener(THEME_CHANGE_EVENT, syncTheme);
    window.addEventListener("storage", syncTheme);
    return () => {
      window.removeEventListener(THEME_CHANGE_EVENT, syncTheme);
      window.removeEventListener("storage", syncTheme);
    };
  }, []);

  const handleThemeChange = (newTheme: string) => {
    const nextTheme = THEME_OPTIONS.some((option) => option.value === newTheme)
      ? (newTheme as ThemeId)
      : "dark";
    setTheme(nextTheme);
    localStorage.setItem("theme", nextTheme);
    applyTheme(nextTheme);
    window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: nextTheme }));
    onThemeChange?.(nextTheme);
  };

  if (panel) {
    return (
      <div className="w-full space-y-5">
        <div>
          <p className="text-sm font-semibold text-foreground">Tema de la aplicación</p>
          <p className="mt-1 text-xs text-muted-foreground">Elige una base visual. Los textos, controles y paneles se adaptan al instante.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {THEME_OPTIONS.map((option) => {
            const Icon = option.icon;
            const active = theme === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => handleThemeChange(option.value)}
                className={cn(
                  "theme-palette-choice flex items-center gap-3 rounded-2xl border p-3 text-left transition-all",
                  active
                    ? "border-primary bg-primary/10 shadow-sm"
                    : "border-border bg-card/60 hover:border-primary/50 hover:bg-accent"
                )}
                aria-pressed={active}
                aria-label={`${option.label}: ${option.description}${active ? ", paleta activa" : ""}`}
              >
                <span className="theme-option-preview" style={{ "--preview-base": option.preview.base, "--preview-hero": option.preview.hero, "--preview-flow": option.preview.flow, "--preview-ledger": option.preview.ledger, "--preview-account": option.preview.account } as CSSProperties} aria-hidden="true">
                  <i className="theme-option-preview-hero" />
                  <i className="theme-option-preview-flow" />
                  <i className="theme-option-preview-ledger" />
                  <i className="theme-option-preview-account" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground">{option.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">{option.description}</span>
                </span>
                <span className={cn("theme-palette-choice-state ml-auto text-xs", active ? "text-primary" : "text-muted-foreground")}>
                  {active ? "Activa" : ""}
                </span>
              </button>
            );
          })}
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Fondo</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-4">
            {[
              ["auto", "Automático", Palette],
              ["plain", "Sin animación", CircleOff],
              ["grid", "Cuadrícula", Grid3X3],
              ["aurora", "Aurora", Sparkles],
            ].map(([value, label, Icon]) => {
              const mode = value as BackgroundMode;
              const ModeIcon = Icon as ComponentType<{ className?: string }>;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => applyBackgroundMode(mode)}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs transition-colors",
                    backgroundMode === mode ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-accent"
                  )}
                >
                  <ModeIcon className="h-3.5 w-3.5" />
                  {label as string}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  const selectorMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={collapsed && !showCurrentTheme ? "icon" : "default"}
          className={cn("theme-selector-trigger h-9 gap-2", collapsed && !showCurrentTheme ? "w-9" : showCurrentTheme ? "w-auto px-2" : "w-full justify-start px-2")}
          aria-label={`Paleta activa: ${currentTheme.label}. Cambiar paleta de colores.`}
        >
          <Palette className="h-4 w-4 shrink-0 text-current opacity-75" />
          {(!collapsed || showCurrentTheme) && (
            <span className="flex min-w-0 items-center gap-2 text-zinc-500">
              {showCurrentTheme ? <span className="truncate text-current">{THEME_OPTIONS.length} paletas · {currentTheme.shortLabel}</span> : <>
                <span>Tema</span>
                <span className="truncate text-zinc-400">- {currentTheme.label}</span>
              </>}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={collapsed && !showCurrentTheme ? "center" : "start"}
        side={collapsed && !showCurrentTheme ? "right" : "top"}
        className="theme-menu w-80 max-h-[min(72vh,44rem)] overflow-y-auto finance-scrollbar p-2"
      >
        <DropdownMenuLabel className="px-2 pb-2 text-xs uppercase tracking-[0.24em] text-zinc-500">
          Temas
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {THEME_OPTIONS.map((option) => {
          return (
            <DropdownMenuItem
              key={option.value}
              onClick={() => handleThemeChange(option.value)}
              className="theme-menu-option my-0.5 flex items-center gap-3 rounded-lg px-2 py-2.5"
              role="menuitemradio"
              aria-checked={theme === option.value}
              aria-label={`${option.label}: ${option.description}`}
            >
              <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center text-cyan-300">
                {theme === option.value ? "●" : "○"}
              </span>
              <span className="theme-option-preview" style={{ "--preview-base": option.preview.base, "--preview-hero": option.preview.hero, "--preview-flow": option.preview.flow, "--preview-ledger": option.preview.ledger, "--preview-account": option.preview.account } as CSSProperties} aria-hidden="true">
                <i className="theme-option-preview-hero" />
                <i className="theme-option-preview-flow" />
                <i className="theme-option-preview-ledger" />
                <i className="theme-option-preview-account" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium text-zinc-100">{option.label}</span>
                <span className="text-xs leading-snug text-zinc-500">{option.description}</span>
              </span>
            </DropdownMenuItem>
          );
        })}
          <DropdownMenuSeparator className="my-2" />
          <DropdownMenuLabel className="px-2 pb-2 text-xs uppercase tracking-[0.24em] text-zinc-500">
            Fondo
          </DropdownMenuLabel>
          {[
            ["auto", "Automatico", Palette],
            ["plain", "Sin animacion", CircleOff],
            ["grid", "Cuadricula", Grid3X3],
            ["aurora", "Aurora", Sparkles],
          ].map(([value, label, Icon]) => {
            const mode = value as BackgroundMode;
            const ModeIcon = Icon as ComponentType<{ className?: string }>;
            return (
              <DropdownMenuItem
                key={mode}
                onPointerDown={() => applyBackgroundMode(mode)}
                onClick={() => applyBackgroundMode(mode)}
                className="rounded-lg px-2 py-2"
              >
                <span className="mr-2 flex h-4 w-4 items-center justify-center text-cyan-300">
                  {backgroundMode === mode ? "●" : "○"}
                </span>
                <ModeIcon className="mr-2 h-4 w-4" />
                {label as string}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
    </DropdownMenu>
  );

  // Keep the complete palette set visible in the editorial masthead so the
  // choices are discoverable without opening a secondary menu.
  if (!showSwatches) return selectorMenu;

  return (
    <div className="theme-palette-control">
      <div className="theme-palette-gallery-heading">
        <span>{THEME_OPTIONS.length} PALETAS DE COLOR</span>
        <strong>{currentTheme.label}</strong>
        <small>{currentTheme.description}</small>
      </div>
      <div className="theme-palette-gallery" role="group" aria-label={`Elegir paleta de colores. ${THEME_OPTIONS.length} opciones disponibles.`}>
        {THEME_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            title={`${option.label} — ${option.description}`}
            aria-label={`Usar paleta ${option.label}. ${option.description}`}
            aria-pressed={theme === option.value}
            onClick={() => handleThemeChange(option.value)}
            className={cn("theme-palette-chip", theme === option.value && "is-active")}
          >
            <span className="theme-palette-chip-preview" style={{ "--palette-base": option.preview.base, "--palette-hero": option.preview.hero, "--palette-flow": option.preview.flow, "--palette-ledger": option.preview.ledger, "--palette-account": option.preview.account } as CSSProperties} aria-hidden="true">
              <i className="theme-palette-chip-hero" />
              <i className="theme-palette-chip-flow" />
              <i className="theme-palette-chip-ledger" />
              <i className="theme-palette-chip-account" />
            </span>
            <span className="theme-palette-chip-copy">
              <strong className="theme-palette-chip-name">{option.shortLabel}</strong>
              <small>{option.description}</small>
            </span>
            <span className="theme-palette-chip-selected" aria-hidden="true">{theme === option.value ? "ACTIVA" : ""}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
