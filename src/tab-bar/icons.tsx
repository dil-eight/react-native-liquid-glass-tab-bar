import { forwardRef, useImperativeHandle } from 'react'
import { View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated'
import Svg, { Circle, Path } from 'react-native-svg'

export type TabIconName = 'home' | 'messages' | 'bell' | 'more' | 'search'

export type AnimatedIconHandle = {
  start: () => void
}

type IconProps = {
  name: TabIconName
  color: string
  size?: number
}

const iconStroke = {
  fill: 'none',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  strokeWidth: 2.4,
} as const

const IconShape = ({ name, color, size = 25 }: IconProps) => {
  if (name === 'home') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d="M3 10.8 12 3l9 7.8" stroke={color} {...iconStroke} />
        <Path d="M5.5 9.8V21h13V9.8" stroke={color} {...iconStroke} />
        <Path d="M10 21v-6h4v6" stroke={color} {...iconStroke} />
        <Circle cx="16.6" cy="14.4" r="1" fill={color} />
      </Svg>
    )
  }

  if (name === 'messages') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d="M7.5 16.5H6a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4h6.5a4 4 0 0 1 4 4v4.5a4 4 0 0 1-4 4H11l-3.5 3v-3Z" stroke={color} {...iconStroke} />
        <Path d="M13.5 10.5H18a4 4 0 0 1 4 4V16a4 4 0 0 1-4 4h-.5v2.2L14.8 20h-3.3a4 4 0 0 1-3.8-2.8" stroke={color} {...iconStroke} />
      </Svg>
    )
  }

  if (name === 'bell') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d="M6 10a6 6 0 1 1 12 0c0 5 2 5.8 2 7H4c0-1.2 2-2 2-7Z" stroke={color} {...iconStroke} />
        <Path d="M10 20a2.3 2.3 0 0 0 4 0" stroke={color} {...iconStroke} />
      </Svg>
    )
  }

  if (name === 'more') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Circle cx="5" cy="12" r="2" fill={color} />
        <Circle cx="12" cy="12" r="2" fill={color} />
        <Circle cx="19" cy="12" r="2" fill={color} />
      </Svg>
    )
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="10.5" cy="10.5" r="6.5" stroke={color} {...iconStroke} />
      <Path d="m16 16 5 5" stroke={color} {...iconStroke} />
    </Svg>
  )
}

export const AnimatedIcon = forwardRef<AnimatedIconHandle, IconProps>((props, ref) => {
  const progress = useSharedValue(1)
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: progress.value }],
  }))

  useImperativeHandle(ref, () => ({
    start: () => {
      progress.value = withSequence(
        withSpring(1.16, { damping: 8, stiffness: 260, mass: 0.35 }),
        withSpring(1, { damping: 10, stiffness: 220, mass: 0.45 }),
      )
    },
  }))

  return (
    <Animated.View style={animatedStyle}>
      <View>
        <IconShape {...props} />
      </View>
    </Animated.View>
  )
})

AnimatedIcon.displayName = 'AnimatedIcon'
