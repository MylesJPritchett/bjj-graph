import { defineConfig } from "vitest/config";
import { annotationApi } from "./server/plugin";

export default defineConfig({
  plugins: [annotationApi()],
  test: {
    include: ["test/**/*.test.ts"],
  },
});
