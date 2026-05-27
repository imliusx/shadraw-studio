import { AdminGuard } from "@/components/auth/admin-guard"
import { AppHeader } from "@/components/app-header"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGuard>
      <AppHeader />
      {children}
    </AdminGuard>
  )
}
