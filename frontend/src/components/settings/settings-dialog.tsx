"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useSettingsDialog } from "@/app/providers/app-state-provider"
import { SettingsContent } from "@/components/settings/settings-view"

export function SettingsDialog() {
  const { open, setOpen } = useSettingsDialog()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="sm:max-w-3xl p-0 h-[42rem] max-h-[85vh] flex flex-col overflow-hidden"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>设置</DialogTitle>
          <DialogDescription>管理账户与个性化偏好</DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-0 p-8 pb-10">
          <SettingsContent variant="dialog" />
        </div>
      </DialogContent>
    </Dialog>
  )
}
