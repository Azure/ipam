import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default () => {
  return defineConfig({
    plugins: [react()],
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
