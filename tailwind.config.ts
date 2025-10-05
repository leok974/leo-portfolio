import type { Config } from "tailwindcss";

const config = {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(214 32% 91%)",
        ring: "hsl(222 84% 5%)",
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem',
      },
      boxShadow: {
        soft: '0 10px 30px rgba(0,0,0,0.08)',
        glow: '0 0 24px rgba(99,102,241,0.35)',
      },
      keyframes: {
        enter: {
          "0%": { opacity: "0", transform: "translateY(2px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        // Gentle pulse for RouteBadge dot
        "rb-pulse": {
          "0%, 100%": { transform: "scale(1)", opacity: "1" },
          "50%": { transform: "scale(1.12)", opacity: "0.9" },
        },
      },
      animation: {
        enter: "enter .15s ease-out",
        // RouteBadge dot pulse
        "rb-pulse": "rb-pulse .9s ease-in-out infinite",
      },
    },
  },
  plugins: [
    require("@tailwindcss/typography"), // eslint-disable-line @typescript-eslint/no-require-imports
    require("@tailwindcss/aspect-ratio"), // eslint-disable-line @typescript-eslint/no-require-imports
    require("@tailwindcss/forms"), // eslint-disable-line @typescript-eslint/no-require-imports
  ],
} satisfies Config;

export default config;
