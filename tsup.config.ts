// Builds the published package: ESM, CJS, and type definitions in dist/.
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  target: "node22",
  platform: "node",
  clean: true,
});
