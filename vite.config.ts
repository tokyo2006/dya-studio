import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";
import tailwindcss from "@tailwindcss/vite";

function htmlEnvVarReplacePlugin(env: Record<string, string>): Plugin {
  return {
    name: "html-transform",
    transformIndexHtml: {
      order: "pre",
      handler: (html: string): string =>
        html.replace(/%(.*?)%/g, (match, p1) => env[p1] ?? match),
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  return {
    plugins: [
      tailwindcss(),
      react({
        babel: {
          plugins: [["babel-plugin-react-compiler"]],
        },
      }),
      svgr(),
      htmlEnvVarReplacePlugin({
        VITE_GOOGLE_ANALYTICS_ID:
          env.VITE_GOOGLE_ANALYTICS_ID || "G-32NGG9Y4BQ",
      }),
    ],
  };
});
