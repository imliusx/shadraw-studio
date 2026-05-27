import { BrowserRouter, Navigate, Route, Routes } from "react-router"

import { AdminGuard } from "@/components/auth/admin-guard"
import { AuthGuard } from "@/components/auth/auth-guard"
import { AdminShell } from "@/routes/admin-shell"
import AdminPage from "@/routes/admin"
import { AppShell } from "@/routes/app-shell"
import { AuthShell } from "@/routes/auth-shell"
import GalleryPage from "@/routes/gallery"
import LoginPage from "@/routes/login"
import LogsPage from "@/routes/logs"
import RegisterPage from "@/routes/register"
import SettingsPage from "@/routes/settings"
import WorkbenchPage from "@/routes/workbench"

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AuthShell />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        <Route element={<AuthGuard />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<WorkbenchPage />} />
            <Route path="/gallery" element={<GalleryPage />} />
            <Route path="/logs" element={<LogsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>

        <Route element={<AdminGuard />}>
          <Route element={<AdminShell />}>
            <Route path="/admin" element={<AdminPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
