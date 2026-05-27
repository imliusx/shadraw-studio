import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "@chinese-fonts/jhlst/dist/京華老宋体v2_002/result.css"
import "./index.css"
import "react-photo-album/masonry.css"

import { App } from "@/App"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AppStateProvider } from "@/providers/app-state-provider"
import { AuthProvider } from "@/providers/auth-provider"
import { LightboxDialog } from "@/components/lightbox/lightbox-dialog"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
        <AppStateProvider>
          <TooltipProvider delayDuration={250}>
            <App />
            <LightboxDialog />
          </TooltipProvider>
          <Toaster richColors closeButton position="top-center" />
        </AppStateProvider>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
)
