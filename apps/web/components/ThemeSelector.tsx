import { useEffect, useMemo, useState, type ComponentType } from "react";
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
  panel?: boolean;
  onThemeChange?: (theme: string) => void;
  onBackgroundChange?: (mode: BackgroundMode) => void;
}

type ThemeId = "light" | "dark" | "sand" | "lavender" | "mint" | "graphite" | "midnight" | "ocean" | "forest" | "ember" | "neon";
type BackgroundMode = "auto" | "plain" | "grid" | "aurora";

type ThemeOption = {
  value: ThemeId;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  swatch: string;
};

const THEME_OPTIONS: ThemeOption[] = [
  {
    value: "light",
    label: "Claro",
    description: "Limpio, luminoso y más editorial",
    icon: Sun,
    swatch: "from-white via-slate-200 to-amber-200",
  },
  {
    value: "dark",
    label: "Oscuro",
    description: "Neutro, limpio y sin distracciones",
    icon: Moon,
    swatch: "from-zinc-300 via-zinc-500 to-zinc-700",
  },
  {
    value: "sand",
    label: "Arena",
    description: "Claro calido y suave para uso diario",
    icon: Sun,
    swatch: "from-amber-100 via-orange-100 to-rose-200",
  },
  {
    value: "lavender",
    label: "Lavanda",
    description: "Claro con acento violeta discreto",
    icon: Sparkles,
    swatch: "from-violet-100 via-indigo-100 to-sky-200",
  },
  {
    value: "mint",
    label: "Menta",
    description: "Claro fresco con acentos verdes",
    icon: Leaf,
    swatch: "from-emerald-100 via-teal-100 to-cyan-200",
  },
  {
    value: "graphite",
    label: "Grafito",
    description: "Oscuro mate sin fondo animado",
    icon: CircleOff,
    swatch: "from-zinc-200 via-zinc-700 to-zinc-950",
  },
  {
    value: "midnight",
    label: "Medianoche",
    description: "Azules profundos con brillo sutil",
    icon: Sparkles,
    swatch: "from-sky-300 via-indigo-400 to-violet-600",
  },
  {
    value: "ocean",
    label: "Oceano",
    description: "Cian y azul para un look mas fresco",
    icon: Waves,
    swatch: "from-cyan-300 via-sky-400 to-blue-600",
  },
  {
    value: "forest",
    label: "Bosque",
    description: "Verde elegante con sensacion organica",
    icon: Leaf,
    swatch: "from-emerald-300 via-green-400 to-lime-500",
  },
  {
    value: "ember",
    label: "Ascua",
    description: "Calido, ambar y con mas energia visual",
    icon: Flame,
    swatch: "from-orange-300 via-amber-400 to-rose-500",
  },
  {
    value: "neon",
    label: "Neon",
    description: "El estilo mas intenso y vibrante",
    icon: Palette,
    swatch: "from-fuchsia-300 via-cyan-300 to-violet-500",
  },
];

const THEME_CLASS_NAMES = THEME_OPTIONS.map((option) => "theme-" + option.value);

export function ThemeSelector({ collapsed, panel = false, onThemeChange, onBackgroundChange }: ThemeSelectorProps) {
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
      root.classList.add("dark");
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
  }, []);

  const handleThemeChange = (newTheme: string) => {
    const nextTheme = THEME_OPTIONS.some((option) => option.value === newTheme)
      ? (newTheme as ThemeId)
      : "dark";
    setTheme(nextTheme);
    localStorage.setItem("theme", nextTheme);
    applyTheme(nextTheme);
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
                  "flex items-center gap-3 rounded-2xl border p-3 text-left transition-all",
                  active
                    ? "border-primary bg-primary/10 shadow-sm"
                    : "border-border bg-card/60 hover:border-primary/50 hover:bg-accent"
                )}
              >
                <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br shadow-sm", option.swatch)}>
                  <Icon className="h-4 w-4 text-white drop-shadow" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground">{option.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">{option.description}</span>
                </span>
                <span className={cn("ml-auto text-xs", active ? "text-primary" : "text-muted-foreground")}>{active ? "Activo" : ""}</span>
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "default"}
          className={cn("h-9", collapsed ? "w-9" : "w-full justify-start px-2")}
        >
          <Palette className={cn("h-4 w-4", collapsed ? "" : "mr-2 text-zinc-500")} />
          {!collapsed && (
            <span className="flex min-w-0 items-center gap-2 text-zinc-500">
              <span>Tema</span>
              <span className="truncate text-zinc-400">- {currentTheme.label}</span>
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={collapsed ? "center" : "start"}
        side={collapsed ? "right" : "top"}
        className="theme-menu w-80 max-h-[min(72vh,44rem)] overflow-y-auto finance-scrollbar p-2"
      >
        <DropdownMenuLabel className="px-2 pb-2 text-xs uppercase tracking-[0.24em] text-zinc-500">
          Temas
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {THEME_OPTIONS.map((option) => {
          const Icon = option.icon;

          return (
            <DropdownMenuItem
              key={option.value}
              onPointerDown={() => handleThemeChange(option.value)}
              onClick={() => handleThemeChange(option.value)}
              className="my-0.5 flex items-start gap-3 rounded-lg px-2 py-2.5"
            >
              <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center text-cyan-300">
                {theme === option.value ? "●" : "○"}
              </span>
              <span
                className={cn(
                  "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br shadow-lg",
                  option.swatch
                )}
              >
                <Icon className="h-4 w-4 text-white drop-shadow" />
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
}
