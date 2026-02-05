import { defineConfig } from "tsup";

export default defineConfig([
  {
    name: "main",
    entry: ["electron/main/index.ts"],
    outDir: "electron/dist/main",
    format: ["cjs"],
    platform: "node",
    sourcemap: true,
    clean: true,
    target: "node18",
    external: ["electron"]
  },
  {
    name: "preload",
    entry: ["electron/preload/index.ts"],
    outDir: "electron/dist/preload",
    format: ["cjs"],
    platform: "node",
    sourcemap: true,
    clean: false,
    target: "node18",
    external: ["electron"]
  }
]);