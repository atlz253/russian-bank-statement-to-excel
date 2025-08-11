import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/rbste.ts"],
  format: ["cjs"],
  outDir: "dist",
  target: "node22",
  minify: true,
  clean: true,
  banner: { js: "#!/usr/bin/env node" },
});
