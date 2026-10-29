import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// input() and time.sleep() pause Python using SharedArrayBuffer, which the
// browser only allows on "cross-origin isolated" pages. These headers turn
// that on. firebase.json sets the same headers for the deployed site.
const isolationHeaders = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
};

export default defineConfig({
  plugins: [react()],
  server: { headers: isolationHeaders },
  preview: { headers: isolationHeaders },
});
