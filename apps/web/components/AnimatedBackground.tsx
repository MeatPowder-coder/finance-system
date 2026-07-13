"use client";

import { useEffect, useState } from "react";

type ThemeName = "light" | "dark" | "sand" | "lavender" | "mint" | "graphite" | "neon" | "midnight" | "ocean" | "forest" | "ember";
type BackgroundMode = "auto" | "plain" | "grid" | "aurora";

const BACKGROUNDS: Record<ThemeName, {
  backgroundColor: string;
  gridColor: string;
  auraOne: string;
  auraTwo: string;
}> = {
  dark: {
    backgroundColor: "#05070b",
    gridColor: "rgba(34, 211, 238, 0.10)",
    auraOne: "rgba(34, 211, 238, 0.10)",
    auraTwo: "rgba(129, 140, 248, 0.08)",
  },
  light: {
    backgroundColor: "#f8fafc",
    gridColor: "rgba(148, 163, 184, 0.16)",
    auraOne: "rgba(56, 189, 248, 0.08)",
    auraTwo: "rgba(168, 85, 247, 0.06)",
  },
  sand: {
    backgroundColor: "#fffaf2",
    gridColor: "rgba(180, 120, 50, 0.12)",
    auraOne: "rgba(251, 191, 36, 0.12)",
    auraTwo: "rgba(251, 113, 133, 0.08)",
  },
  lavender: {
    backgroundColor: "#f8f7ff",
    gridColor: "rgba(124, 58, 237, 0.10)",
    auraOne: "rgba(129, 140, 248, 0.12)",
    auraTwo: "rgba(192, 132, 252, 0.10)",
  },
  mint: {
    backgroundColor: "#f3fbf8",
    gridColor: "rgba(13, 148, 136, 0.10)",
    auraOne: "rgba(45, 212, 191, 0.12)",
    auraTwo: "rgba(74, 222, 128, 0.08)",
  },
  graphite: {
    backgroundColor: "#0b0d10",
    gridColor: "rgba(148, 163, 184, 0.08)",
    auraOne: "rgba(100, 116, 139, 0.08)",
    auraTwo: "rgba(71, 85, 105, 0.06)",
  },
  neon: {
    backgroundColor: "#000005",
    gridColor: "rgba(168, 85, 247, 0.25)",
    auraOne: "rgba(6, 182, 212, 0.2)",
    auraTwo: "rgba(168, 85, 247, 0.2)",
  },
  midnight: {
    backgroundColor: "#02040f",
    gridColor: "rgba(96, 165, 250, 0.2)",
    auraOne: "rgba(96, 165, 250, 0.18)",
    auraTwo: "rgba(129, 140, 248, 0.18)",
  },
  ocean: {
    backgroundColor: "#01070d",
    gridColor: "rgba(34, 211, 238, 0.18)",
    auraOne: "rgba(34, 211, 238, 0.2)",
    auraTwo: "rgba(59, 130, 246, 0.18)",
  },
  forest: {
    backgroundColor: "#010703",
    gridColor: "rgba(74, 222, 128, 0.18)",
    auraOne: "rgba(74, 222, 128, 0.2)",
    auraTwo: "rgba(34, 197, 94, 0.18)",
  },
  ember: {
    backgroundColor: "#070301",
    gridColor: "rgba(251, 146, 60, 0.18)",
    auraOne: "rgba(251, 146, 60, 0.2)",
    auraTwo: "rgba(244, 63, 94, 0.16)",
  },
};

export function AnimatedBackground() {
  const [theme, setTheme] = useState<ThemeName>("dark");
  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>("auto");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    const checkTheme = () => {
      const root = document.documentElement;
      if (root.classList.contains("light") || root.classList.contains("theme-light")) {
        setTheme("light");
        return;
      }
      const activeTheme = (Object.keys(BACKGROUNDS) as Array<keyof typeof BACKGROUNDS>).find((name) =>
        root.classList.contains("theme-" + name)
      );

      setTheme(activeTheme ? (activeTheme as ThemeName) : "dark");
    };

    checkTheme();
    const savedMode = localStorage.getItem("backgroundMode");
    if (savedMode === "plain" || savedMode === "grid" || savedMode === "aurora") setBackgroundMode(savedMode);
    const onBackgroundMode = (event: Event) => {
      const nextMode = (event as CustomEvent<BackgroundMode>).detail;
      if (nextMode === "auto" || nextMode === "plain" || nextMode === "grid" || nextMode === "aurora") setBackgroundMode(nextMode);
    };
    window.addEventListener("finance-background-mode", onBackgroundMode);

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === "class") {
          checkTheme();
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("finance-background-mode", onBackgroundMode);
    };
  }, []);

  if (!mounted) return null;
  if (backgroundMode === "plain") return null;
  if (backgroundMode === "auto" && (theme === "dark" || theme === "light" || theme === "graphite")) return null;

  const palette = BACKGROUNDS[theme];
   const showGrid = backgroundMode !== "aurora";
   const showAura = backgroundMode !== "grid";
   const gridLayer = "linear-gradient(" + palette.gridColor + " 1px, transparent 1px), linear-gradient(90deg, " + palette.gridColor + " 1px, transparent 1px)";
   const auraLayer = "radial-gradient(circle at 50% 50%, " + palette.auraOne + ", transparent 60%), radial-gradient(circle at 80% 20%, " + palette.auraTwo + ", transparent 50%)";
  const keyframes = "@keyframes gridMove { 0% { transform: translateY(0); } 100% { transform: translateY(60px); } } @keyframes pulseAura { 0% { opacity: 0.5; transform: scale(1); } 50% { opacity: 1; transform: scale(1.1); } 100% { opacity: 0.5; transform: scale(1); } }";

  return (
    <>
      <div
        className="fixed inset-0 z-[-2] pointer-events-none"
        style={{
          backgroundColor: palette.backgroundColor,
          backgroundImage: showGrid ? gridLayer : "none",
          backgroundSize: "60px 60px",
          animation: "gridMove 10s linear infinite",
        }}
      />
      <div
        className="fixed inset-0 z-[-1] pointer-events-none"
        style={{
          background: showAura ? auraLayer : "none",
          animation: "pulseAura 8s ease-in-out infinite alternate",
        }}
      />

      <style dangerouslySetInnerHTML={{ __html: keyframes }} />
    </>
  );
}
