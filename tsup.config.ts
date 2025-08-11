import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/rbste.ts"],
  format: ["cjs"],
  outDir: "dist",
  target: "es2024",
  minify: true,
  clean: true,
});
