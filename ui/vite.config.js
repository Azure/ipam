import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default () => {
  return defineConfig({
    // resolve: {
    //   dedupe: ['react', 'react-dom']
    // },
    plugins: [
      react(),
      {
        name: "build-ui-html",
        apply: "build",
        transformIndexHtml: (html) => {
          return {
            html,
            tags: [
              {
                tag: "script",
                attrs: {
                  type: "text/javascript",
                  src: "/env.js",
                },
                injectTo: "head",
              },
            ],
          };
        },
      },
    ],
    server: {
      hmr: {
        protocol: "ws",
        path: "/ws",
      },
    },
    define: {
      IPAM_VERSION: JSON.stringify(process.env.npm_package_version),
    },
    build: {
      chunkSizeWarningLimit: 5120,
    },
    logLevel: "warn",
  });
};
