import { Suspense } from "react"
import { ImageWorkbench } from "@/components/image-workbench"

export default function Home() {
  return (
    <Suspense fallback={null}>
      <ImageWorkbench />
    </Suspense>
  )
}
