import type { Transition, Variants } from "motion/react"

export const easings = {
  emphasized: [0.2, 0.8, 0.2, 1] as const,
  standard: [0.4, 0, 0.2, 1] as const,
  exit: [0.4, 0, 1, 1] as const,
} as const

export const durations = {
  micro: 0.12,
  short: 0.2,
  base: 0.28,
  long: 0.4,
} as const

export const spring: Transition = {
  type: "spring",
  stiffness: 320,
  damping: 30,
  mass: 0.8,
}

export const softSpring: Transition = {
  type: "spring",
  stiffness: 180,
  damping: 26,
  mass: 0.9,
}

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: durations.base, ease: easings.emphasized },
  },
  exit: {
    opacity: 0,
    y: -4,
    transition: { duration: durations.short, ease: easings.exit },
  },
}

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { duration: durations.short, ease: easings.standard },
  },
  exit: {
    opacity: 0,
    transition: { duration: durations.short, ease: easings.exit },
  },
}

export const scaleFade: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { duration: durations.base, ease: easings.emphasized },
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    transition: { duration: durations.short, ease: easings.exit },
  },
}

export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -12 },
  show: {
    opacity: 1,
    x: 0,
    transition: { duration: durations.base, ease: easings.emphasized },
  },
}

export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 12 },
  show: {
    opacity: 1,
    x: 0,
    transition: { duration: durations.base, ease: easings.emphasized },
  },
}

export const slideInDown: Variants = {
  hidden: { opacity: 0, y: -10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: durations.base, ease: easings.emphasized },
  },
}

export const listContainer: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.02,
    },
  },
}

export const listItem: Variants = {
  hidden: { opacity: 0, y: 6 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: durations.short, ease: easings.emphasized },
  },
}

export const popIn: Variants = {
  initial: { scale: 1 },
  pop: {
    scale: [1, 1.2, 1],
    transition: { duration: 0.32, ease: easings.emphasized },
  },
}

