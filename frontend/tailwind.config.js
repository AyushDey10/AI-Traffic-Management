/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        base: "#080D18",
        panel: "#101827",
        card: "#151F32",
        border: "#263750",
        cyan: "#00D5FF",
        blue: "#3987FF",
        violet: "#8B5CF6",
        ink: "#F1F5F9",
        muted: "#94A3B8",
        success: "#22C55E",
        warning: "#F59E0B",
        danger: "#EF4444",
      },
      fontFamily: {
        sans: ["Inter", "Segoe UI", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Consolas", "monospace"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(0,213,255,0.18), 0 18px 45px -25px rgba(0,213,255,0.45)",
      },
      keyframes: {
        rise: {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: { rise: "rise 0.4s ease-out both" },
    },
  },
  plugins: [],
};
