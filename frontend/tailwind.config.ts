import type { Config } from "tailwindcss";

// Design tokens taken from /design/dashboard.png
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans Variable"', "Inter", "system-ui", "sans-serif"],
      },
      colors: {
        navy: { 900: "#0E1030", 800: "#151847", 700: "#1E2160", 600: "#2A2E7A" },
        canvas: "#F5F6FC",
        line: "#E7E9F5",
        ink: { DEFAULT: "#16183A", soft: "#4B4F72", muted: "#7A7E9C" },
        violet: { DEFAULT: "#6C5CE7", soft: "#F0EDFF", ink: "#5B4BD6" },
        azure: { DEFAULT: "#4F7CFF", pill: "#E6F0FF", ink: "#2F5FE0" },
        tile: {
          blue: "#EAF2FF", blueInk: "#2F6BFF",
          teal: "#E5F8F3", tealInk: "#0FA88E",
          lav: "#F1EEFF", lavInk: "#6E56F5",
          amber: "#FFF4E2", amberInk: "#E88A00",
        },
        status: {
          green: "#E3F8EC", greenInk: "#14894A",
          amber: "#FFF3DC", amberInk: "#B26A00",
          red: "#FDE7E7", redInk: "#C62B2B",
        },
      },
      borderRadius: { card: "16px" },
      boxShadow: {
        card: "0 1px 2px rgba(22,24,58,0.04), 0 6px 20px -8px rgba(22,24,58,0.08)",
        glow: "0 8px 24px -6px rgba(108,92,231,0.55)",
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(90deg, #6C5CE7 0%, #4F7CFF 100%)",
        "sidebar-gradient": "linear-gradient(180deg, #0E1030 0%, #151847 100%)",
        "hero-gradient":
          "radial-gradient(120% 140% at 85% 30%, #2A2E8A 0%, #151847 45%, #0E1030 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
