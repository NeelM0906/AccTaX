import type { Config } from "tailwindcss";
import forms from "@tailwindcss/forms";

const config: Config = {
  content: [
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-geist-sans)", "Inter", "system-ui", "sans-serif"]
      },
      colors: {
        ink: "#18181b",
        paper: "#fbfbfa",
        moss: "#2f6f55",
        copper: "#a14f2a"
      }
    }
  },
  plugins: [forms]
};

export default config;
