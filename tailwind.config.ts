import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f2f2ff",
          100: "#e7e7ff",
          200: "#d3d4ff",
          300: "#b4b6ff",
          400: "#8c8ef5",
          500: "#5b5ce2",
          600: "#4c4dce",
          700: "#3f40b0",
          800: "#35368f",
          900: "#2f3074"
        }
      },
      boxShadow: {
        soft: "0 1px 2px rgba(16, 24, 40, 0.04), 0 8px 24px rgba(16, 24, 40, 0.04)",
        lift: "0 10px 30px rgba(16, 24, 40, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
