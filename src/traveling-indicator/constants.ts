import { Easing } from 'react-native-reanimated'

export const TRAVEL_EASE = Easing.out(Easing.cubic)

export const BUMP_RISE_MS = 130

export const BUMP_SETTLE_X_SPRING = {
  damping: 13,
  stiffness: 190,
  mass: 1,
} as const

export const BUMP_SETTLE_Y_SPRING = {
  damping: 9,
  stiffness: 130,
  mass: 1,
} as const

export const BUMP_SCALE_X = 0
export const BUMP_SCALE_Y = 0.05
export const BUMP_DISTANCE_SCALE_X = -0.2
export const BUMP_DISTANCE_SCALE_Y = 0.24

export const DRAG_SCALE_X = -0.08
export const DRAG_SCALE_Y = 0.12
export const DRAG_DISTANCE_SCALE_X = 0.18
export const DRAG_DISTANCE_SCALE_Y = -0.3

export const DISTANCE_PRESSURE_MAX = 0.5
export const INDICATOR_RADIUS_NEAR = 30
export const INDICATOR_RADIUS_FAR = 28

export const WIDTH_TIMING_MS = 260

export const GLASS_LEAD_MS = 200
export const TRAVEL_WINDOW_MS = 260
export const GLASS_TAIL_MS = 0

export const HIGHLIGHT_HOLD_MS = 300

export const GLASS_FADE_SECONDS = 0.18

export const REST_TO_GLASS_MS = 100
export const REST_OPACITY_MS = 220
export const REST_GLASS_HANDOFF_MS = 180
export const GLASS_EXIT_SQUASH_X = 0.18
export const GLASS_EXIT_STRETCH_Y = 0.08
export const REST_REVEAL_SPRING = {
  damping: 16,
  stiffness: 210,
  mass: 0.7,
} as const

export const NOTICE_BACKDROP = '#0E121AF2'
