import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "sp-black":    "#000000",
        "sp-bg":       "#121212",
        "sp-surface":  "#181818",
        "sp-elevated": "#282828",
        "sp-hover":    "#2a2a2a",
        "sp-border":   "#333333",
        "sp-green":    "#1DB954",
        "sp-green-h":  "#1ed760",
        "sp-text":     "#ffffff",
        "sp-subtext":  "#b3b3b3",
        "sp-muted":    "#535353",
      },
      animation: {
        "fade-in": "fadeIn 0.4s ease-out forwards",
      },
      keyframes: {
        fadeIn: {
          "0%":   { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;