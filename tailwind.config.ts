import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          900: "#111418",
          700: "#2b3038",
          500: "#5b6270",
          300: "#9aa1ad",
          100: "#e7e9ec",
        },
        drop: {
          major: "#b3261e",
          minor: "#c96b3f",
        },
        improve: "#1a7f4e",
        stable: "#5b6270",
        warn: "#a8710a",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
