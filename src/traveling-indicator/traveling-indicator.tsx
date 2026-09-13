import { GlassView } from 'expo-glass-effect'
import { type ComponentProps, useMemo } from 'react'
import type { ViewStyle } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { type AnimatedStyle } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import { GLASS_FADE_SECONDS } from './constants'
import type { IndicatorFinish } from './types'

const AnimatedGlassView = Animated.createAnimatedComponent(GlassView)

type Props = {
  finish: IndicatorFinish
  isMoving: boolean
  isGlassLive: boolean
  animatedStyle: AnimatedStyle<ViewStyle>
  glassAnimatedStyle?: AnimatedStyle<ViewStyle>
  restAnimatedStyle?: AnimatedStyle<ViewStyle>
  gesture?: ComponentProps<typeof GestureDetector>['gesture']
  onPress?: () => void
  restingColor: string
  movingColor: string
  glassStyle?: 'clear' | 'regular'
  keepGlassAtRest?: boolean
  glassTintColor?: string
  borderRadius: number
  inset?: number
}

export const TravelingIndicator = ({
  finish,
  isMoving,
  isGlassLive,
  animatedStyle,
  glassAnimatedStyle,
  restAnimatedStyle,
  gesture,
  onPress,
  restingColor,
  movingColor,
  glassTintColor,
  glassStyle = 'regular',
  keepGlassAtRest = false,
  borderRadius,
  inset = 0,
}: Props) => {
  const position = { position: 'absolute', left: 0, top: inset, bottom: inset } as const
  const captureGesture = useMemo(() => {
    if (!gesture || !onPress) {
      return gesture
    }

    const tapGesture = Gesture.Tap()
      .maxDistance(8)
      .onEnd((_event, success) => {
        if (success) {
          scheduleOnRN(onPress)
        }
      })

    return Gesture.Simultaneous(gesture, tapGesture)
  }, [gesture, onPress])

  if (finish === 'glass') {
    const restingPlate = (
      <Animated.View
        style={[
          position,
          { borderRadius, backgroundColor: restingColor },
          restAnimatedStyle ?? animatedStyle,
        ]}
      />
    )

    const glass = (
      <AnimatedGlassView
        glassEffectStyle={{
          style: glassStyle,
          animate: true,
          animationDuration: GLASS_FADE_SECONDS,
        }}
        tintColor={glassTintColor}
        isInteractive={isGlassLive || keepGlassAtRest}
        style={[
          position,
          { borderRadius, backgroundColor: 'transparent' },
          glassAnimatedStyle ?? animatedStyle,
        ]}
      />
    )

    if (!captureGesture) {
      return (
        <>
          {restingPlate}
          {glass}
        </>
      )
    }

    return (
      <>
        {restingPlate}
        {glass}
        <GestureDetector gesture={captureGesture}>
          <Animated.View
            style={[position, { zIndex: 3, backgroundColor: 'transparent' }, animatedStyle]}
          />
        </GestureDetector>
      </>
    )
  }

  const surfaceIndicator = (
    <Animated.View
      style={[
        position,
        { borderRadius },
        { backgroundColor: isMoving ? movingColor : restingColor },
        animatedStyle,
      ]}
    />
  )

  if (!captureGesture) {
    return surfaceIndicator
  }

  return (
    <>
      {surfaceIndicator}
      <GestureDetector gesture={captureGesture}>
        <Animated.View
          style={[position, { zIndex: 3, backgroundColor: 'transparent' }, animatedStyle]}
        />
      </GestureDetector>
    </>
  )
}
