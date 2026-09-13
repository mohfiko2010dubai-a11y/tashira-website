import { hydrate } from "@tanstack/react-query";
import superjson from "superjson";
import { queryClient } from "./providers/trpc-client";
import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { TRPCProvider } from '@/providers/trpc'
import './index.css'
import App from './App'
import { initializeGoogleAnalytics } from './lib/google-conversion'

if (location.pathname !== "/recover") initializeGoogleAnalytics()

const router = createBrowserRouter([
  { path: '*', element: <App /> }
], {
  future: {
    v7_relativeSplatPath: true,
  },
})

const root = document.getElementById('root')!;
const payload = document.getElementById('__SSR_DATA');
if (payload?.textContent) hydrate(queryClient, superjson.deserialize(JSON.parse(payload.textContent)));
const app = (
  <StrictMode>
    <TRPCProvider>
      <RouterProvider router={router} />
    </TRPCProvider>
  </StrictMode>
)

if (root.dataset.ssr === "true") hydrateRoot(root, app);
else createRoot(root).render(app);
