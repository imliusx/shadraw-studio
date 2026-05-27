"use client"

import * as React from "react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field"
import type { HistoryRecord } from "@/components/workbench/types"

export type PublishOptions = {
  promptPublic: boolean
}

type PublishConfirmDialogProps = {
  record: HistoryRecord | null
  onOpenChange: (open: boolean) => void
  onConfirm: (record: HistoryRecord, options: PublishOptions) => void
}

export function PublishConfirmDialog({
  record,
  onOpenChange,
  onConfirm,
}: PublishConfirmDialogProps) {
  return (
    <AlertDialog open={record !== null} onOpenChange={onOpenChange}>
      {record ? (
        <PublishConfirmContent
          key={record.id}
          record={record}
          onConfirm={onConfirm}
        />
      ) : null}
    </AlertDialog>
  )
}

function PublishConfirmContent({
  record,
  onConfirm,
}: {
  record: HistoryRecord
  onConfirm: (record: HistoryRecord, options: PublishOptions) => void
}) {
  const [promptPublic, setPromptPublic] = React.useState(false)

  return (
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>确认公开到社区?</AlertDialogTitle>
        <AlertDialogDescription>
          公开后，社区画廊中的其他用户可以查看这张图片。
        </AlertDialogDescription>
      </AlertDialogHeader>
      <Field orientation="horizontal">
        <Checkbox
          id="publish-prompt"
          checked={promptPublic}
          onCheckedChange={(checked) => setPromptPublic(checked === true)}
        />
        <FieldContent>
          <FieldLabel htmlFor="publish-prompt">同时公开提示词</FieldLabel>
          
        </FieldContent>
      </Field>
      <AlertDialogFooter>
        <AlertDialogCancel>取消</AlertDialogCancel>
        <AlertDialogAction
          onClick={() => onConfirm(record, { promptPublic })}
        >
          公开
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  )
}
