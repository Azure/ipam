import { defineConfig, splitVendorChunkPlugin } from "vite";
import react from "@vitejs/plugin-react";

export default () => {
  return defineConfig({
    plugins: [
      react(),
      splitVendorChunkPlugin(),
      {
        name: 'build-ui-html',
        apply: 'build',
        transformIndexHtml: (html) => {
          return {
            html,
            tags: [
              {
                tag: 'script',
                attrs: {
                  type: 'text/javascript',
                  src: '/env.js',
                },
                injectTo: 'head',
              },
            ],
          };
        },
      }
    ],
    server: {
      // host: "0.0.0.0",
      // port: 8080,
      hmr: {
        protocol: "ws",
        path: "/ws"
      }
    },
    define: {
      IPAM_VERSION: JSON.stringify(process.env.npm_package_version),
    }
  })
}
