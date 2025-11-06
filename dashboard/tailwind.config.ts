import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        somnia: {
          primary: "#4731ff",
          surface: "#ffffff",
          muted: "#f5f5ff"
        }
      },
      boxShadow: {
        soft: "0 10px 30px rgba(71, 49, 255, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;
