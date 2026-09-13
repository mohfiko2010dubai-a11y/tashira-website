import { hydrate } from "@tanstack/react-query";
import superjson from "superjson";
import { queryClient } from "./providers/trpc-client";
import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { LocalizedApp } from './language-navigation'
import { createLanguageNavigation } from './language-navigation-state'
import { languageRoute } from '@contracts/language-routes'
import { TRPCProvider } from '@/providers/trpc'
import './index.css'
import App from './App'
import { initializeGoogleAnalytics } from './lib/google-conversion'

if (languageRoute(location.pathname).pathname !== "/recover") initializeGoogleAnalytics()

const navigation = createLanguageNavigation()

const root = document.getElementById('root')!;
const payload = document.getElementById('__SSR_DATA');
if (payload?.textContent) hydrate(queryClient, superjson.deserialize(JSON.parse(payload.textContent)));
const app = (
  <StrictMode>
    <TRPCProvider>
      <LocalizedApp navigation={navigation}><App /></LocalizedApp>
    </TRPCProvider>
  </StrictMode>
)

if (root.dataset.ssr === "true") hydrateRoot(root, app);
else createRoot(root).render(app);
