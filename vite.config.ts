import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" makes the build work on Vercel, Netlify and GitHub Pages alike.
export default defineConfig({
  plugins: [react()],
  base: "./",
});
