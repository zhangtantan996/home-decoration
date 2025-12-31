import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'merchant-rewrite',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (req.url?.startsWith('/merchant')) {
            req.url = '/merchant.html'
          }
          next()
        })
      }
    }
  ],
  build: {
    rollupOptions: {
      input: {
        admin: resolve(__dirname, 'index.html'),
        merchant: resolve(__dirname, 'merchant.html'),
      },
    },
  },
  server: {
    host: true,
    port: 5173,
  },
})
