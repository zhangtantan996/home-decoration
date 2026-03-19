import { defineConfig, loadEnv } from "vite"
import react from "@vitejs/plugin-react"
import { resolve } from "path"

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")

  return {
    plugins: [
      react(),
      {
        name: "merchant-rewrite",
        configureServer(server) {
          server.middlewares.use((req, _res, next) => {
            if (req.url?.startsWith("/merchant")) {
              req.url = "/merchant.html"
            }
            next()
          })
        }
      }
    ],
    build: {
      rollupOptions: {
        input: {
          admin: resolve(__dirname, "index.html"),
          merchant: resolve(__dirname, "merchant.html"),
        },
      },
    },
    server: {
      host: true,
      port: 5173,
    },
    define: {
      "import.meta.env.VITE_APP_ENV": JSON.stringify(env.VITE_APP_ENV ?? ""),
      "import.meta.env.VITE_API_URL": JSON.stringify(env.VITE_API_URL ?? ""),
    },
  }
})
