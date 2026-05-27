import * as React from "react"
import { motion } from "motion/react"

import { useMotionVariants } from "@/lib/motion"

type TabFadeProps = {
  tabKey: string
  children: React.ReactNode
  className?: string
}

export function TabFade({ tabKey, children, className }: TabFadeProps) {
  const { reduce } = useMotionVariants()
  return (
    <motion.div
      key={tabKey}
      initial={reduce ? { opacity: 1 } : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: reduce ? 0 : 0.22,
        ease: [0.2, 0.8, 0.2, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
