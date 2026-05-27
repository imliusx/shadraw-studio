import type { Metadata } from "next"
import "@chinese-fonts/jhlst/dist/京華老宋体v2_002/result.css"
import "./globals.css"
import "react-photo-album/masonry.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AppStateProvider } from "@/app/providers/app-state-provider"
import { AuthProvider } from "@/app/providers/auth-provider"
import { LightboxDialog } from "@/components/lightbox/lightbox-dialog"

export const metadata: Metadata = {
  title: "shadraw",
  description: "AI image generation workspace for creative teams.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AuthProvider>
            <AppStateProvider>
              <TooltipProvider delayDuration={250}>
                {children}
                <LightboxDialog />
              </TooltipProvider>
              <Toaster richColors closeButton position="top-center" />
            </AppStateProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
