import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./utils/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // --- Finance System semantic tokens (coexisten con --ui-* legacy) ---
        surface: {
          0: "var(--ui-bg)",
          1: "var(--ui-panel)",
          2: "var(--ui-panel-strong)",
          3: "var(--ui-panel-soft)",
        },
        fg: {
          DEFAULT: "var(--ui-text)",
          secondary: "var(--ui-muted)",
          subtle: "var(--ui-subtle)",
        },
        brand: {
          DEFAULT: "var(--ui-accent)",
          soft: "var(--ui-accent-soft)",
        },
        positive: {
          DEFAULT: "var(--ui-positive)",
          soft: "var(--ui-positive-soft)",
        },
        warning: {
          DEFAULT: "var(--ui-warning)",
          soft: "var(--ui-warning-soft)",
        },
        danger: {
          DEFAULT: "var(--ui-danger)",
          soft: "var(--ui-danger-soft)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        "2xl": "1.25rem",
        "3xl": "1.75rem",
      },
      boxShadow: {
        card: "var(--ui-shadow)",
        soft: "0 18px 50px rgba(0, 0, 0, 0.18)",
      },
      transitionTimingFunction: {
        soft: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [],
};

export default config;

