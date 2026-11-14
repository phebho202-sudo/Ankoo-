import type { Config } from "tailwindcss";

// Brand palette: deep navy, warm gold, cream/white, charcoal.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: "#0B1F3A", 50: "#E8EDF5", 100: "#C9D4E6", 700: "#12305A", 900: "#071427" },
        gold: { DEFAULT: "#C9A227", 100: "#F5EBC8", 300: "#E0C463", 600: "#A8851A" },
        cream: { DEFAULT: "#FAF6EC", 50: "#FFFDF8" },
        charcoal: { DEFAULT: "#2B2B2B", 400: "#6B6B6B", 600: "#3A3A3A" },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};
export default config;
