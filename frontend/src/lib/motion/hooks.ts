import { useReducedMotion } from "motion/react"

import {
  fadeIn,
  fadeInUp,
  listContainer,
  listItem,
  popIn,
  scaleFade,
  slideInDown,
  slideInLeft,
  slideInRight,
} from "@/lib/motion/presets"

const reducedVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0 } },
  exit: { opacity: 0, transition: { duration: 0 } },
}

export function useMotionVariants() {
  const reduce = useReducedMotion()
  if (reduce) {
    return {
      reduce: true,
      fadeIn: reducedVariants,
      fadeInUp: reducedVariants,
      scaleFade: reducedVariants,
      slideInLeft: reducedVariants,
      slideInRight: reducedVariants,
      slideInDown: reducedVariants,
      listContainer: reducedVariants,
      listItem: reducedVariants,
      popIn: {
        initial: { scale: 1 },
        pop: { scale: 1, transition: { duration: 0 } },
      },
    }
  }
  return {
    reduce: false,
    fadeIn,
    fadeInUp,
    scaleFade,
    slideInLeft,
    slideInRight,
    slideInDown,
    listContainer,
    listItem,
    popIn,
  }
}
