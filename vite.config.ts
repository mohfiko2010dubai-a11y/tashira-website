import devServer from "@hono/vite-dev-server"
import path from "path"
const __dirname = import.meta.dirname
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'

const repositoryRoot = path.resolve(__dirname)
const isNativeStaging = repositoryRoot === '/var/www/tashira-staging'
if (isNativeStaging && !process.env.VITE_STRIPE_PUBLISHABLE_KEY?.startsWith('pk_test_')) {
  throw new Error('Native staging builds must use node staging/build-native.mjs')
}

// https://vite.dev/config/
export default defineConfig({
  define: {
    // STRIPE_MODE is a non-secret deployment setting. Expose only that mode so
    // the browser can fail closed when it does not match the publishable key.
    'import.meta.env.STRIPE_MODE': JSON.stringify(process.env.STRIPE_MODE ?? ''),
  },
  plugins: [
    devServer({ entry: "api/boot.ts", exclude: [/^\/(?!api\/).*$/] }),
    inspectAttr(), react()],
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@contracts": path.resolve(__dirname, "./contracts"),
      "@db": path.resolve(__dirname, "./db"),
      "db": path.resolve(__dirname, "./db"),
    },
  },
  envDir: path.resolve(__dirname),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    // Deployments build in place. Keep previously hashed chunks so browser
    // tabs opened before a deployment can finish their lazy imports safely.
    // A release-based deployment may replace this with atomic directory swaps.
    emptyOutDir: false,
    minify: false,
  },
  optimizeDeps: {
    include: ['react-router-dom', '@tanstack/react-query', '@trpc/client', '@trpc/react-query'],
  },
});
