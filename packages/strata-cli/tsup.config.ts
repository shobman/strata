import { defineConfig } from "tsup";
import { cpSync } from "node:fs";

export default defineConfig({
  entry: ["src/index.ts", "src/cli.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  onSuccess: async () => {
    cpSync("src/architect-ui", "dist/architect-ui", { recursive: true });
  },
});
