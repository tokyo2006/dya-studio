/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Cybernetic color palette
        electric: {
          DEFAULT: "#00d4ff",
          50: "#e6faff",
          100: "#b3f0ff",
          200: "#80e6ff",
          300: "#4ddbff",
          400: "#1ad1ff",
          500: "#00d4ff",
          600: "#00a8cc",
          700: "#007d99",
          800: "#005266",
          900: "#002633",
        },
        neon: {
          DEFAULT: "#00ffcc",
          50: "#e6fff9",
          100: "#b3ffee",
          200: "#80ffe3",
          300: "#4dffd9",
          400: "#1affce",
          500: "#00ffcc",
          600: "#00cca3",
          700: "#00997a",
          800: "#006652",
          900: "#003329",
        },
        cyber: {
          DEFAULT: "#8b5cf6",
          50: "#f3f0ff",
          100: "#e0d9ff",
          200: "#c4b5fd",
          300: "#a78bfa",
          400: "#8b5cf6",
          500: "#7c3aed",
          600: "#6d28d9",
          700: "#5b21b6",
          800: "#4c1d95",
          900: "#3b0764",
        },
        dark: {
          DEFAULT: "#0a0a0a",
          50: "#363636",
          100: "#2a2a2a",
          200: "#1c1c1c",
          300: "#141414",
          400: "#0a0a0a",
          500: "#050505",
        },
        surface: {
          DEFAULT: "#2a2a2a",
          elevated: "#363636",
          overlay: "rgba(42, 42, 42, 0.90)",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      fontSize: {
        display: ["3.5rem", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
        headline: ["2rem", { lineHeight: "1.2", letterSpacing: "-0.01em" }],
      },
      boxShadow: {
        "glow-electric":
          "0 0 20px rgba(0, 212, 255, 0.4), 0 0 40px rgba(0, 212, 255, 0.2)",
        "glow-electric-sm": "0 0 10px rgba(0, 212, 255, 0.3)",
        "glow-neon":
          "0 0 20px rgba(0, 255, 204, 0.4), 0 0 40px rgba(0, 255, 204, 0.2)",
        "glow-neon-sm": "0 0 10px rgba(0, 255, 204, 0.3)",
        "glow-cyber":
          "0 0 20px rgba(139, 92, 246, 0.4), 0 0 40px rgba(139, 92, 246, 0.2)",
        glass: "0 8px 32px rgba(0, 0, 0, 0.4)",
      },
      backdropBlur: {
        glass: "12px",
      },
      animation: {
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "fade-in": "fade-in 0.3s ease-out",
        "slide-up": "slide-up 0.3s ease-out",
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
      },
      keyframes: {
        "pulse-glow": {
          "0%, 100%": { opacity: "1", filter: "brightness(1)" },
          "50%": { opacity: "0.8", filter: "brightness(1.2)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "glow-pulse": {
          "0%, 100%": {
            boxShadow:
              "0 0 20px rgba(0, 212, 255, 0.4), 0 0 40px rgba(0, 212, 255, 0.2)",
          },
          "50%": {
            boxShadow:
              "0 0 30px rgba(0, 212, 255, 0.6), 0 0 60px rgba(0, 212, 255, 0.3)",
          },
        },
      },
      screens: {
        tablet: "768px",
        desktop: "1024px",
      },
    },
  },
  plugins: [],
};
