import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";

import { workflowCatalogDataPlugin } from "./scripts/workflow-catalog-plugin";

function workflowRoutePages() {
  return {
    name: "workflow-route-pages",
    apply: "build" as const,
    closeBundle() {
      const rootDir = import.meta.dirname;
      const workflowsDir = path.resolve(rootDir, ".github/workflows");
      const distDir = path.resolve(rootDir, "dist");
      const indexPath = path.join(distDir, "index.html");

      if (!fs.existsSync(indexPath) || !fs.existsSync(workflowsDir)) {
        return;
      }

      const nestedIndexHtml = fs
        .readFileSync(indexPath, "utf8")
        .replaceAll("./assets/", "../assets/");
      const slugs = fs
        .readdirSync(workflowsDir)
        .filter((file) => /\.ya?ml$/.test(file))
        .map((file) => file.replace(/\.ya?ml$/, ""));
      const routeSlugs = [...slugs, "adoption", "metrics"];

      for (const slug of routeSlugs) {
        const routeDir = path.join(distDir, slug);
        fs.mkdirSync(routeDir, { recursive: true });
        fs.writeFileSync(path.join(routeDir, "index.html"), nestedIndexHtml);
      }
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [
    workflowCatalogDataPlugin(import.meta.dirname),
    react(),
    tailwindcss(),
    workflowRoutePages(),
  ],
  resolve: {
    alias: [
      {
        find: /^react$/,
        replacement: path.resolve(import.meta.dirname, "node_modules/react/index.js"),
      },
      {
        find: /^react\/jsx-runtime$/,
        replacement: path.resolve(import.meta.dirname, "node_modules/react/jsx-runtime.js"),
      },
      {
        find: /^lucide-react$/,
        replacement: path.resolve(
          import.meta.dirname,
          "node_modules/lucide-react/dist/esm/lucide-react.mjs",
        ),
      },
    ],
  },
});
