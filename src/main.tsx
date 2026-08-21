import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { TRPCProvider } from '@/providers/trpc'
import './index.css'
import App from './App'
import { initializeGoogleAnalytics } from './lib/google-conversion'

initializeGoogleAnalytics()

const router = createBrowserRouter([
  { path: '*', element: <App /> }
], {
  future: {
    v7_relativeSplatPath: true,
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TRPCProvider>
      <RouterProvider router={router} />
    </TRPCProvider>
  </StrictMode>,
)
