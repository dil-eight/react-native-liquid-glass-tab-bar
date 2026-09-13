import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Gesture } from 'react-native-gesture-handler'
import {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import {
  BUMP_DISTANCE_SCALE_X,
  BUMP_DISTANCE_SCALE_Y,
  BUMP_RISE_MS,
  BUMP_SCALE_X,
  BUMP_SCALE_Y,
  BUMP_SETTLE_X_SPRING,
  BUMP_SETTLE_Y_SPRING,
  DISTANCE_PRESSURE_MAX,
  DRAG_DISTANCE_SCALE_X,
  DRAG_DISTANCE_SCALE_Y,
  DRAG_SCALE_X,
  DRAG_SCALE_Y,
  GLASS_EXIT_SQUASH_X,
  GLASS_EXIT_STRETCH_Y,
  GLASS_TAIL_MS,
  INDICATOR_RADIUS_FAR,
  INDICATOR_RADIUS_NEAR,
  REST_GLASS_HANDOFF_MS,
  REST_OPACITY_MS,
  REST_REVEAL_SPRING,
  REST_TO_GLASS_MS,
  TRAVEL_EASE,
  TRAVEL_WINDOW_MS,
  WIDTH_TIMING_MS,
} from './constants'
import type { IndicatorLayout } from './types'

type TrackedLayout = IndicatorLayout & {
  key: string
}

const GLASS_IDLE_OPACITY = 0.01

type Options = {
  leadMs?: number
  highlightHoldMs?: number
  hasGlass?: boolean
  layoutKeys?: ReadonlyArray<string>
  onDragChange?: (key: string) => void
}

export const useTravelingIndicator = (
  activeKey: string,
  { leadMs = 0, highlightHoldMs = 0, hasGlass = false, layoutKeys, onDragChange }: Options = {},
) => {
  const layouts = useRef<Record<string, IndicatorLayout>>({})
  const isPlaced = useRef(false)
  const isMovingRef = useRef(false)
  const isGlassLiveRef = useRef(false)
  const draggedKey = useRef<string | null>(null)
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([])
  const reduceMotion = useReducedMotion()

  const [isMoving, setIsMoving] = useState(false)
  const [isGlassLive, setIsGlassLive] = useState(false)
  const [highlightedKey, setHighlightedKey] = useState(activeKey)

  const translateX = useSharedValue(0)
  const width = useSharedValue(0)
  const bumpX = useSharedValue(0)
  const bumpY = useSharedValue(0)
  const dragX = useSharedValue(0)
  const dragY = useSharedValue(0)
  const dragPulse = useSharedValue(0)
  const distancePressure = useSharedValue(0)
  const glassPresence = useSharedValue(0)
  const restReveal = useSharedValue(1)
  const restOpacity = useSharedValue(1)
  const dragStartX = useSharedValue(0)
  const isDragPressureActive = useSharedValue(0)
  const isRowDragActive = useSharedValue(0)
  const rowWidth = useSharedValue(0)
  const trackedLayouts = useSharedValue<Array<TrackedLayout>>([])

  const clearTimers = useCallback(() => {
    for (const timer of timers.current) {
      clearTimeout(timer)
    }
    timers.current = []
  }, [])

  const after = useCallback((ms: number, run: () => void) => {
    timers.current.push(setTimeout(run, ms))
  }, [])

  const setMovingState = useCallback((value: boolean) => {
    isMovingRef.current = value
    setIsMoving(value)
  }, [])

  const setGlassLiveState = useCallback((value: boolean) => {
    isGlassLiveRef.current = value
    setIsGlassLive(value)
  }, [])

  const revealRestingPlate = useCallback(() => {
    restReveal.value = 0
    restOpacity.value = 0
    glassPresence.value = withTiming(0, {
      duration: REST_GLASS_HANDOFF_MS,
      easing: Easing.out(Easing.quad),
    })
    restOpacity.value = withTiming(1, {
      duration: REST_OPACITY_MS,
      easing: Easing.out(Easing.quad),
    })
    after(REST_GLASS_HANDOFF_MS, () => {
      setGlassLiveState(false)
      restReveal.value = withSpring(1, REST_REVEAL_SPRING)
    })
    after(REST_GLASS_HANDOFF_MS + REST_OPACITY_MS, () => {
      distancePressure.value = withSpring(0, BUMP_SETTLE_X_SPRING)
    })
  }, [after, distancePressure, glassPresence, restReveal, restOpacity, setGlassLiveState])

  const absorbRestingPlateIntoGlass = useCallback(() => {
    glassPresence.value = withTiming(1, {
      duration: REST_TO_GLASS_MS,
      easing: Easing.out(Easing.quad),
    })
    restReveal.value = withTiming(0, {
      duration: REST_TO_GLASS_MS,
      easing: Easing.out(Easing.quad),
    })
    restOpacity.value = withTiming(0, {
      duration: REST_TO_GLASS_MS,
      easing: Easing.out(Easing.quad),
    })
  }, [glassPresence, restReveal, restOpacity])

  const getDistancePressure = (travelDistance: number, base: number) => {
    'worklet'

    const travelUnits = travelDistance / base

    return Math.min(Math.max((travelUnits - 0.75) * 0.4, 0), DISTANCE_PRESSURE_MAX)
  }

  const getDragPressure = (dragDistance: number, base: number) => {
    'worklet'

    return Math.min((dragDistance / base) * 3.2, DISTANCE_PRESSURE_MAX)
  }

  const getMotionRadius = () => {
    'worklet'

    const radiusProgress = Math.min(distancePressure.value / DISTANCE_PRESSURE_MAX, 1)

    return INDICATOR_RADIUS_NEAR + radiusProgress * (INDICATOR_RADIUS_FAR - INDICATOR_RADIUS_NEAR)
  }

  const publishLayouts = useCallback(() => {
    const nextLayouts = Object.entries(layouts.current)
      .map(([layoutKey, value]) => ({ key: layoutKey, ...value }))
      .sort((a, b) => a.x - b.x)

    trackedLayouts.value = nextLayouts
    rowWidth.value = nextLayouts.reduce(
      (maxWidth, value) => Math.max(maxWidth, value.x + value.width),
      0,
    )
  }, [trackedLayouts, rowWidth])

  const travelTo = useCallback(
    (layout: IndicatorLayout, key: string) => {
      if (!isPlaced.current) {
        translateX.value = layout.x
        width.value = layout.width
        glassPresence.value = 0
        restOpacity.value = 1
        restReveal.value = 1
        isPlaced.current = true
        setGlassLiveState(false)
        setMovingState(false)
        return
      }

      const samePosition = Math.abs(layout.x - translateX.value) < 0.5
      const sameWidth = Math.abs(layout.width - width.value) < 0.5

      if (samePosition && sameWidth && !isMovingRef.current && !isGlassLiveRef.current) {
        clearTimers()
        cancelAnimation(translateX)
        cancelAnimation(width)
        cancelAnimation(bumpX)
        cancelAnimation(bumpY)
        cancelAnimation(dragX)
        cancelAnimation(dragY)
        cancelAnimation(dragPulse)
        cancelAnimation(distancePressure)
        cancelAnimation(glassPresence)
        cancelAnimation(restReveal)
        cancelAnimation(restOpacity)

        translateX.value = layout.x
        width.value = layout.width
        bumpX.value = 0
        bumpY.value = 0
        dragX.value = 0
        dragY.value = 0
        dragPulse.value = 0
        distancePressure.value = 0
        glassPresence.value = 0
        restOpacity.value = 1
        restReveal.value = 1
        setGlassLiveState(false)
        setMovingState(false)
        return
      }

      clearTimers()

      const lead = reduceMotion ? 0 : leadMs
      const travelDistance = Math.abs(layout.x - translateX.value)
      const pressureBase = Math.max(width.value, layout.width, 1)
      const nextDistancePressure = getDistancePressure(travelDistance, pressureBase)

      if (!reduceMotion) {
        distancePressure.value = withTiming(nextDistancePressure, {
          duration: BUMP_RISE_MS,
          easing: Easing.out(Easing.quad),
        })
      }

      if (hasGlass && !reduceMotion) {
        setGlassLiveState(true)
        absorbRestingPlateIntoGlass()
        after(lead + TRAVEL_WINDOW_MS + GLASS_TAIL_MS, revealRestingPlate)
      } else {
        glassPresence.value = 0
        restOpacity.value = 1
        restReveal.value = 1
      }

      after(lead, () => setMovingState(true))
      after(lead + TRAVEL_WINDOW_MS, () => {
        setMovingState(false)
        if (!hasGlass) {
          distancePressure.value = withSpring(0, BUMP_SETTLE_X_SPRING)
        }
      })

      if (reduceMotion) {
        translateX.value = withTiming(layout.x, { duration: WIDTH_TIMING_MS })
        width.value = withTiming(layout.width, { duration: WIDTH_TIMING_MS })
        return
      }

      translateX.value = withDelay(
        lead,
        withTiming(layout.x, { duration: TRAVEL_WINDOW_MS, easing: TRAVEL_EASE }),
      )
      width.value = withDelay(lead, withTiming(layout.width, { duration: WIDTH_TIMING_MS }))

      const rise = { duration: BUMP_RISE_MS, easing: Easing.out(Easing.quad) }
      bumpX.value = withDelay(lead, withTiming(1, rise))
      bumpY.value = withDelay(lead, withTiming(1, rise))
      after(lead + TRAVEL_WINDOW_MS, () => {
        bumpX.value = withSpring(0, BUMP_SETTLE_X_SPRING)
        bumpY.value = withSpring(0, BUMP_SETTLE_Y_SPRING)
      })
    },
    [
      reduceMotion,
      leadMs,
      hasGlass,
      after,
      clearTimers,
      translateX,
      width,
      bumpX,
      bumpY,
      dragX,
      dragY,
      dragPulse,
      distancePressure,
      glassPresence,
      restOpacity,
      restReveal,
      setGlassLiveState,
      setMovingState,
      absorbRestingPlateIntoGlass,
      revealRestingPlate,
    ],
  )

  const registerLayout = useCallback(
    (key: string, layout: IndicatorLayout) => {
      layouts.current[key] = layout
      publishLayouts()

      if (key === activeKey) {
        travelTo(layout, key)
      }
    },
    [activeKey, publishLayouts, travelTo],
  )

  useEffect(() => {
    if (!layoutKeys) {
      return
    }

    const allowedKeys = new Set(layoutKeys)
    let changed = false

    for (const key of Object.keys(layouts.current)) {
      if (!allowedKeys.has(key)) {
        delete layouts.current[key]
        changed = true
      }
    }

    if (changed) {
      publishLayouts()
    }
  }, [layoutKeys, publishLayouts])

  useEffect(() => {
    const layout = layouts.current[activeKey]

    if (draggedKey.current === activeKey) {
      draggedKey.current = null
      return
    }

    if (layout) {
      travelTo(layout, activeKey)
    }
  }, [activeKey, travelTo])

  useEffect(() => {
    if (!isPlaced.current) {
      setHighlightedKey(activeKey)
      return
    }

    const hold = reduceMotion ? 0 : highlightHoldMs

    if (hold === 0) {
      setHighlightedKey(activeKey)
      return
    }

    const timer = setTimeout(() => setHighlightedKey(activeKey), hold)

    return () => clearTimeout(timer)
  }, [activeKey, highlightHoldMs, reduceMotion])

  useEffect(() => clearTimers, [clearTimers])

  const beginDrag = useCallback(() => {
    clearTimers()
    setMovingState(true)
    if (hasGlass && !reduceMotion) {
      setGlassLiveState(true)
      absorbRestingPlateIntoGlass()
    }
  }, [
    clearTimers,
    hasGlass,
    reduceMotion,
    absorbRestingPlateIntoGlass,
    setGlassLiveState,
    setMovingState,
  ])

  const endDrag = useCallback(() => {
    const tail = hasGlass && !reduceMotion ? GLASS_TAIL_MS : 0

    after(TRAVEL_WINDOW_MS, () => {
      setMovingState(false)
      if (!hasGlass) {
        distancePressure.value = withSpring(0, BUMP_SETTLE_X_SPRING)
      }
    })
    after(TRAVEL_WINDOW_MS + tail, () => {
      if (hasGlass && !reduceMotion) {
        revealRestingPlate()
      }
    })
  }, [after, hasGlass, reduceMotion, revealRestingPlate, setMovingState, distancePressure])

  const commitDragChange = useCallback(
    (key: string) => {
      if (key !== activeKey) {
        draggedKey.current = key
      }

      onDragChange?.(key)
    },
    [activeKey, onDragChange],
  )

  const indicatorGesture = useMemo(() => {
    if (!onDragChange || reduceMotion) {
      return undefined
    }

    const nearestLayout = (centerX: number, list: Array<TrackedLayout>) => {
      'worklet'

      let nearest = list[0]
      let nearestDistance = Number.MAX_VALUE

      for (const layout of list) {
        const distance = Math.abs(layout.x + layout.width / 2 - centerX)

        if (distance < nearestDistance) {
          nearest = layout
          nearestDistance = distance
        }
      }

      return nearest
    }

    return Gesture.Pan()
      .minDistance(2)
      .hitSlop({ top: 8, bottom: 8, left: 8, right: 8 })
      .onBegin(() => {
        const list = trackedLayouts.value

        if (list.length === 0) {
          return
        }

        cancelAnimation(translateX)
        cancelAnimation(width)
        cancelAnimation(bumpX)
        cancelAnimation(bumpY)
        cancelAnimation(dragX)
        cancelAnimation(dragY)
        cancelAnimation(dragPulse)
        cancelAnimation(distancePressure)
        cancelAnimation(glassPresence)
        cancelAnimation(restReveal)
        cancelAnimation(restOpacity)

        dragStartX.value = translateX.value
        isDragPressureActive.value = 0
        bumpX.value = 0
        bumpY.value = 0
        dragX.value = 0
        dragY.value = 0
        dragPulse.value = 0
        distancePressure.value = 0
        if (hasGlass) {
          glassPresence.value = withTiming(1, {
            duration: REST_TO_GLASS_MS,
            easing: Easing.out(Easing.quad),
          })
          restReveal.value = withTiming(0, {
            duration: REST_TO_GLASS_MS,
            easing: Easing.out(Easing.quad),
          })
          restOpacity.value = withTiming(0, {
            duration: REST_TO_GLASS_MS,
            easing: Easing.out(Easing.quad),
          })
        } else {
          glassPresence.value = 0
          restOpacity.value = 1
          restReveal.value = 1
        }
        scheduleOnRN(beginDrag)
      })
      .onUpdate((event) => {
        const list = trackedLayouts.value

        if (list.length === 0) {
          return
        }

        const first = list[0]
        const last = list[list.length - 1]
        const maxX = last.x + last.width - width.value
        const nextX = Math.min(Math.max(dragStartX.value + event.translationX, first.x), maxX)
        const nearest = nearestLayout(nextX + width.value / 2, list)
        const pressureBase = Math.max(width.value, nearest.width, 1)
        const dragDistance = Math.abs(nextX - dragStartX.value)

        translateX.value = nextX
        width.value = withTiming(nearest.width, { duration: 90 })

        if (dragDistance > 1 && isDragPressureActive.value === 0) {
          isDragPressureActive.value = 1
          cancelAnimation(dragPulse)
          dragPulse.value = withRepeat(
            withTiming(1, {
              duration: 420,
              easing: Easing.inOut(Easing.quad),
            }),
            -1,
            true,
          )
          dragX.value = withTiming(1, {
            duration: BUMP_RISE_MS,
            easing: Easing.out(Easing.quad),
          })
          dragY.value = withTiming(1, {
            duration: BUMP_RISE_MS,
            easing: Easing.out(Easing.quad),
          })
        }

        distancePressure.value = getDragPressure(dragDistance, pressureBase)
      })
      .onFinalize((_event, success) => {
        const list = trackedLayouts.value

        if (list.length === 0) {
          scheduleOnRN(endDrag)
          return
        }

        const target = success
          ? nearestLayout(translateX.value + width.value / 2, list)
          : (list.find((layout) => layout.key === activeKey) ??
            nearestLayout(translateX.value + width.value / 2, list))

        isDragPressureActive.value = 0
        cancelAnimation(dragPulse)
        dragPulse.value = withTiming(0, {
          duration: 140,
          easing: Easing.out(Easing.quad),
        })
        translateX.value = withTiming(target.x, { duration: 150, easing: TRAVEL_EASE })
        width.value = withTiming(target.width, { duration: WIDTH_TIMING_MS })
        bumpX.value = withSpring(0, BUMP_SETTLE_X_SPRING)
        bumpY.value = withSpring(0, BUMP_SETTLE_Y_SPRING)
        dragX.value = withSpring(0, BUMP_SETTLE_X_SPRING)
        dragY.value = withSpring(0, BUMP_SETTLE_Y_SPRING)

        if (success) {
          scheduleOnRN(commitDragChange, target.key)
        }
        scheduleOnRN(endDrag)
      })
  }, [
    onDragChange,
    commitDragChange,
    reduceMotion,
    trackedLayouts,
    translateX,
    width,
    bumpX,
    bumpY,
    dragX,
    dragY,
    dragPulse,
    distancePressure,
    glassPresence,
    restReveal,
    restOpacity,
    dragStartX,
    isDragPressureActive,
    beginDrag,
    endDrag,
    activeKey,
    hasGlass,
  ])

  const rowGesture = useMemo(() => {
    if (!onDragChange || reduceMotion) {
      return undefined
    }

    const nearestLayout = (centerX: number, list: Array<TrackedLayout>) => {
      'worklet'

      let nearest = list[0]
      let nearestDistance = Number.MAX_VALUE

      for (const layout of list) {
        const distance = Math.abs(layout.x + layout.width / 2 - centerX)

        if (distance < nearestDistance) {
          nearest = layout
          nearestDistance = distance
        }
      }

      return nearest
    }

    const clampIndicatorX = (centerX: number, targetWidth: number, list: Array<TrackedLayout>) => {
      'worklet'

      const first = list[0]
      const last = list[list.length - 1]
      const maxX = last.x + last.width - targetWidth

      return Math.min(Math.max(centerX - targetWidth / 2, first.x), maxX)
    }

    return Gesture.Pan()
      .activateAfterLongPress(180)
      .minDistance(0)
      .hitSlop({ top: 10, bottom: 10, left: 0, right: 0 })
      .onBegin((event) => {
        const list = trackedLayouts.value

        if (list.length === 0) {
          return
        }

        cancelAnimation(translateX)
        cancelAnimation(width)
        cancelAnimation(bumpX)
        cancelAnimation(bumpY)
        cancelAnimation(dragX)
        cancelAnimation(dragY)
        cancelAnimation(dragPulse)
        cancelAnimation(distancePressure)
        cancelAnimation(glassPresence)
        cancelAnimation(restReveal)
        cancelAnimation(restOpacity)

        const target = nearestLayout(event.x, list)
        const nextX = clampIndicatorX(event.x, target.width, list)

        isRowDragActive.value = 1
        dragStartX.value = nextX
        isDragPressureActive.value = 0
        bumpX.value = 0
        bumpY.value = 0
        dragX.value = 0
        dragY.value = 0
        dragPulse.value = 0
        distancePressure.value = 0
        if (hasGlass) {
          glassPresence.value = withTiming(1, {
            duration: REST_TO_GLASS_MS,
            easing: Easing.out(Easing.quad),
          })
          restReveal.value = withTiming(0, {
            duration: REST_TO_GLASS_MS,
            easing: Easing.out(Easing.quad),
          })
          restOpacity.value = withTiming(0, {
            duration: REST_TO_GLASS_MS,
            easing: Easing.out(Easing.quad),
          })
        } else {
          glassPresence.value = 0
          restOpacity.value = 1
          restReveal.value = 1
        }
        translateX.value = withTiming(nextX, { duration: 150, easing: TRAVEL_EASE })
        width.value = withTiming(target.width, { duration: WIDTH_TIMING_MS })
        scheduleOnRN(beginDrag)
      })
      .onUpdate((event) => {
        const list = trackedLayouts.value

        if (list.length === 0) {
          return
        }

        const target = nearestLayout(event.x, list)
        const nextX = clampIndicatorX(event.x, target.width, list)
        const pressureBase = Math.max(width.value, target.width, 1)
        const dragDistance = Math.abs(nextX - dragStartX.value)

        translateX.value = nextX
        width.value = withTiming(target.width, { duration: 90 })

        if (dragDistance > 1 && isDragPressureActive.value === 0) {
          isDragPressureActive.value = 1
          cancelAnimation(dragPulse)
          dragPulse.value = withRepeat(
            withTiming(1, {
              duration: 420,
              easing: Easing.inOut(Easing.quad),
            }),
            -1,
            true,
          )
          dragX.value = withTiming(1, {
            duration: BUMP_RISE_MS,
            easing: Easing.out(Easing.quad),
          })
          dragY.value = withTiming(1, {
            duration: BUMP_RISE_MS,
            easing: Easing.out(Easing.quad),
          })
        }

        distancePressure.value = getDragPressure(dragDistance, pressureBase)
      })
      .onFinalize((_event, success) => {
        if (!success && isRowDragActive.value === 0) {
          return
        }

        const list = trackedLayouts.value
        isRowDragActive.value = 0

        if (list.length === 0) {
          scheduleOnRN(endDrag)
          return
        }

        const target = nearestLayout(translateX.value + width.value / 2, list)

        isDragPressureActive.value = 0
        cancelAnimation(dragPulse)
        dragPulse.value = withTiming(0, {
          duration: 140,
          easing: Easing.out(Easing.quad),
        })
        translateX.value = withTiming(target.x, { duration: 150, easing: TRAVEL_EASE })
        width.value = withTiming(target.width, { duration: WIDTH_TIMING_MS })
        bumpX.value = withSpring(0, BUMP_SETTLE_X_SPRING)
        bumpY.value = withSpring(0, BUMP_SETTLE_Y_SPRING)
        dragX.value = withSpring(0, BUMP_SETTLE_X_SPRING)
        dragY.value = withSpring(0, BUMP_SETTLE_Y_SPRING)

        if (success) {
          scheduleOnRN(commitDragChange, target.key)
        }
        scheduleOnRN(endDrag)
      })
  }, [
    onDragChange,
    commitDragChange,
    reduceMotion,
    trackedLayouts,
    translateX,
    width,
    bumpX,
    bumpY,
    dragX,
    dragY,
    dragPulse,
    distancePressure,
    glassPresence,
    restReveal,
    restOpacity,
    dragStartX,
    isDragPressureActive,
    isRowDragActive,
    beginDrag,
    endDrag,
    hasGlass,
  ])

  const indicatorStyle = useAnimatedStyle(() => {
    const bumpScaleX = BUMP_SCALE_X + distancePressure.value * BUMP_DISTANCE_SCALE_X
    const bumpScaleY = BUMP_SCALE_Y + distancePressure.value * BUMP_DISTANCE_SCALE_Y
    const dragScaleX = DRAG_SCALE_X + distancePressure.value * DRAG_DISTANCE_SCALE_X
    const dragScaleY = DRAG_SCALE_Y + distancePressure.value * DRAG_DISTANCE_SCALE_Y
    const pulse = dragPulse.value * dragX.value
    const motionScaleX = 1 + bumpX.value * bumpScaleX + dragX.value * dragScaleX - pulse * 0.05
    const motionScaleY = 1 + bumpY.value * bumpScaleY + dragY.value * dragScaleY + pulse * 0.08

    return {
      borderRadius: getMotionRadius(),
      width: width.value,
      transform: [
        { translateX: translateX.value },
        { scaleX: motionScaleX },
        { scaleY: motionScaleY },
      ],
    }
  })

  const indicatorGlassStyle = useAnimatedStyle(() => {
    const bumpScaleX = BUMP_SCALE_X + distancePressure.value * BUMP_DISTANCE_SCALE_X
    const bumpScaleY = BUMP_SCALE_Y + distancePressure.value * BUMP_DISTANCE_SCALE_Y
    const dragScaleX = DRAG_SCALE_X + distancePressure.value * DRAG_DISTANCE_SCALE_X
    const dragScaleY = DRAG_SCALE_Y + distancePressure.value * DRAG_DISTANCE_SCALE_Y
    const pulse = dragPulse.value * dragX.value
    const motionScaleX = 1 + bumpX.value * bumpScaleX + dragX.value * dragScaleX - pulse * 0.05
    const motionScaleY = 1 + bumpY.value * bumpScaleY + dragY.value * dragScaleY + pulse * 0.08
    const exitScaleX = 1 - (1 - glassPresence.value) * GLASS_EXIT_SQUASH_X
    const exitScaleY = 1 + (1 - glassPresence.value) * GLASS_EXIT_STRETCH_Y

    return {
      borderRadius: getMotionRadius(),
      opacity: Math.max(glassPresence.value, GLASS_IDLE_OPACITY),
      width: width.value,
      transform: [
        { translateX: translateX.value },
        { scaleX: motionScaleX * exitScaleX },
        { scaleY: motionScaleY * exitScaleY },
      ],
    }
  })

  const indicatorRestStyle = useAnimatedStyle(() => {
    const bumpScaleX = BUMP_SCALE_X + distancePressure.value * BUMP_DISTANCE_SCALE_X
    const bumpScaleY = BUMP_SCALE_Y + distancePressure.value * BUMP_DISTANCE_SCALE_Y
    const dragScaleX = DRAG_SCALE_X + distancePressure.value * DRAG_DISTANCE_SCALE_X
    const dragScaleY = DRAG_SCALE_Y + distancePressure.value * DRAG_DISTANCE_SCALE_Y
    const pulse = dragPulse.value * dragX.value
    const motionScaleX = 1 + bumpX.value * bumpScaleX + dragX.value * dragScaleX - pulse * 0.05
    const motionScaleY = 1 + bumpY.value * bumpScaleY + dragY.value * dragScaleY + pulse * 0.08
    const glassExitScaleX = 1 - (1 - glassPresence.value) * GLASS_EXIT_SQUASH_X
    const glassExitScaleY = 1 + (1 - glassPresence.value) * GLASS_EXIT_STRETCH_Y
    const handoffScaleX = glassExitScaleX + restReveal.value * (1 - glassExitScaleX)
    const handoffScaleY = glassExitScaleY + restReveal.value * (1 - glassExitScaleY)

    return {
      borderRadius: getMotionRadius(),
      opacity: restOpacity.value,
      width: width.value,
      transform: [
        { translateX: translateX.value },
        { scaleX: motionScaleX * handoffScaleX },
        { scaleY: motionScaleY * handoffScaleY },
      ],
    }
  })

  const indicatorClipStyle = useAnimatedStyle(() => {
    const bumpScaleX = BUMP_SCALE_X + distancePressure.value * BUMP_DISTANCE_SCALE_X
    const dragScaleX = DRAG_SCALE_X + distancePressure.value * DRAG_DISTANCE_SCALE_X
    const pulse = dragPulse.value * dragX.value
    const motionScaleX = 1 + bumpX.value * bumpScaleX + dragX.value * dragScaleX - pulse * 0.05
    const glassExitScaleX = 1 - (1 - glassPresence.value) * GLASS_EXIT_SQUASH_X
    const handoffScaleX = glassExitScaleX + restReveal.value * (1 - glassExitScaleX)
    const visibleWidth = width.value * motionScaleX * handoffScaleX

    return {
      borderRadius: getMotionRadius(),
      opacity: Math.max(glassPresence.value, restOpacity.value),
      width: visibleWidth,
      transform: [{ translateX: translateX.value + (width.value - visibleWidth) / 2 }],
    }
  })

  const indicatorContentStyle = useAnimatedStyle(() => {
    const bumpScaleX = BUMP_SCALE_X + distancePressure.value * BUMP_DISTANCE_SCALE_X
    const dragScaleX = DRAG_SCALE_X + distancePressure.value * DRAG_DISTANCE_SCALE_X
    const pulse = dragPulse.value * dragX.value
    const motionScaleX = 1 + bumpX.value * bumpScaleX + dragX.value * dragScaleX - pulse * 0.05
    const glassExitScaleX = 1 - (1 - glassPresence.value) * GLASS_EXIT_SQUASH_X
    const handoffScaleX = glassExitScaleX + restReveal.value * (1 - glassExitScaleX)
    const visibleWidth = width.value * motionScaleX * handoffScaleX
    const clipX = translateX.value + (width.value - visibleWidth) / 2

    return {
      width: rowWidth.value,
      transform: [{ translateX: -clipX }],
    }
  })

  return {
    registerLayout,
    indicatorStyle,
    indicatorGlassStyle,
    indicatorRestStyle,
    indicatorClipStyle,
    indicatorContentStyle,
    indicatorGesture,
    rowGesture,
    isMoving,
    isGlassLive,
    highlightedKey,
  }
}
