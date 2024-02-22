import { defineConfig, splitVendorChunkPlugin } from "vite";
import react from "@vitejs/plugin-react";
import eslint from 'vite-plugin-eslint2';

export default () => {
  return defineConfig({
    plugins: [
      react(),
      eslint(
        {
          // cache: false,
          lintOnStart: true,
          lintInWorker: true,
          include: ['src/**/*.js', 'src/**/*.jsx', 'src/**/*.ts', 'src/**/*.tsx'],
          exclude: []
        }
      ),
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
      hmr: {
        protocol: "ws",
        path: "/ws"
      }
    },
    define: {
      IPAM_VERSION: JSON.stringify(process.env.npm_package_version),
    },
    build: {
      chunkSizeWarningLimit: 5120
    },
    logLevel: 'warn'
  })
}
