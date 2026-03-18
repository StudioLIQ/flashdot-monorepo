import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/providers/**/*.{ts,tsx}",
    "./src/hooks/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#10211f",
        mint: "#def8ec",
        // primary = FlashDot brand mint green (main CTA)
        primary: "#42db8d",
        "primary-hover": "#3bc87f",
        "primary-fg": "#10211f",
        // secondary = orange accent (informational, not destructive)
        secondary: "#f5ad32",
        "secondary-hover": "#e09a2a",
        "secondary-fg": "#10211f",
        // semantic aliases
        success: "#42db8d",
        warning: "#f5ad32",
        danger: "#ef4444",
        "danger-hover": "#dc2626",
        info: "#60a5fa",
        surface: "#f8fff6",
        "surface-dark": "#0d1f1d",
        // CSS-var based token colors (theme-aware, no dark: prefix needed)
        token: {
          bg: "var(--fd-bg)",
          surface: "var(--fd-surface)",
          "surface-alt": "var(--fd-surface-alt)",
          text: "var(--fd-text)",
          "text-2": "var(--fd-text-2)",
          "text-3": "var(--fd-text-3)",
          "text-4": "var(--fd-text-4)",
          border: "var(--fd-border)",
          "border-2": "var(--fd-border-2)",
        },
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(66, 219, 141, 0.24), 0 12px 40px rgba(16, 33, 31, 0.18)",
        // Token-based shadows (swap in dark mode via CSS vars)
        token: {
          sm: "var(--fd-shadow-sm)",
          md: "var(--fd-shadow-md)",
          lg: "var(--fd-shadow-lg)",
          xl: "var(--fd-shadow-xl)",
        },
      },
      borderRadius: {
        // Token-based radii
        "token-sm": "var(--fd-radius-sm)",
        "token-md": "var(--fd-radius-md)",
        "token-lg": "var(--fd-radius-lg)",
        "token-xl": "var(--fd-radius-xl)",
        "token-2xl": "var(--fd-radius-2xl)",
      },
      backgroundImage: {
        mesh: "radial-gradient(circle at 20% 20%, rgba(66,219,141,0.22), transparent 45%), radial-gradient(circle at 80% 0%, rgba(245,173,50,0.2), transparent 40%), linear-gradient(160deg, #f8fff6 0%, #effcf7 50%, #def8ec 100%)",
        "mesh-dark": "radial-gradient(circle at 20% 20%, rgba(66,219,141,0.16), transparent 40%), radial-gradient(circle at 80% 0%, rgba(245,173,50,0.14), transparent 38%), linear-gradient(160deg, #07110f 0%, #0d1f1d 45%, #132a27 100%)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
