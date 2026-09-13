import { BlurView } from 'expo-blur'
import { GlassContainer, GlassView } from 'expo-glass-effect'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { GestureDetector } from 'react-native-gesture-handler'
import Animated from 'react-native-reanimated'

import type { IndicatorLayout } from '../traveling-indicator'
import {
  HIGHLIGHT_HOLD_MS,
  TravelingIndicator,
  useLiquidGlass,
  useTravelingIndicator,
} from '../traveling-indicator'
import {
  BAR_BOTTOM_INSET,
  BAR_HAIRLINE,
  BAR_PADDING,
  BAR_TINT,
  INDICATOR_RESTING,
  INDICATOR_SURFACE_MOVING,
} from './constants'
import type { AnimatedIconHandle } from './icons'
import { TabBarTab, TabBarTabFace } from './tab-bar-item'
import type { TabBarItem, TabBarVariant } from './types'

export type TabBarProps = {
  items: Array<TabBarItem>
  value: string
  onChange: (key: string) => void
  variant?: TabBarVariant
  bottomInset?: number
}

export const TabBar = ({
  items,
  value,
  onChange,
  variant = 'surface',
  bottomInset = BAR_BOTTOM_INSET,
}: TabBarProps) => {
  const liquidAvailable = useLiquidGlass()
  const isGlass = variant === 'glass' && liquidAvailable
  const [tabLayouts, setTabLayouts] = useState<Record<string, IndicatorLayout>>({})
  const iconRefs = useRef<Record<string, AnimatedIconHandle | null>>({})
  const highlightIconRefs = useRef<Record<string, AnimatedIconHandle | null>>({})
  const previousValue = useRef(value)
  const pressedKey = useRef<string | null>(null)
  const itemKeys = useMemo(() => items.map((item) => item.key), [items])

  const playIcon = useCallback((key: string) => {
    iconRefs.current[key]?.start()
    highlightIconRefs.current[key]?.start()
  }, [])

  useEffect(() => {
    if (previousValue.current === value) {
      return
    }

    previousValue.current = value
    const wasStartedByPress = pressedKey.current === value
    pressedKey.current = null

    if (wasStartedByPress) {
      return
    }

    playIcon(value)
  }, [value, playIcon])

  const {
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
  } = useTravelingIndicator(value, {
    leadMs: 0,
    highlightHoldMs: isGlass ? HIGHLIGHT_HOLD_MS : 0,
    hasGlass: isGlass,
    layoutKeys: itemKeys,
    onDragChange: onChange,
  })

  const handlePressChange = useCallback(
    (key: string) => {
      pressedKey.current = key
      playIcon(key)
      onChange(key)
    },
    [onChange, playIcon],
  )

  useEffect(() => {
    setTabLayouts((current) => {
      const allowedKeys = new Set(itemKeys)
      const nextLayouts = Object.fromEntries(
        Object.entries(current).filter(([key]) => allowedKeys.has(key)),
      )

      return Object.keys(nextLayouts).length === Object.keys(current).length ? current : nextLayouts
    })
  }, [itemKeys])

  const handleLayout = useCallback(
    (key: string, layout: IndicatorLayout) => {
      registerLayout(key, layout)
      setTabLayouts((current) => {
        const previous = current[key]

        if (previous?.x === layout.x && previous.width === layout.width) {
          return current
        }

        return { ...current, [key]: layout }
      })
    },
    [registerLayout],
  )

  const tabRow = (
    <View style={styles.row}>
      <TravelingIndicator
        finish={isGlass ? 'glass' : 'surface'}
        isMoving={isMoving}
        isGlassLive={isGlassLive}
        animatedStyle={indicatorStyle}
        glassAnimatedStyle={indicatorGlassStyle}
        restAnimatedStyle={indicatorRestStyle}
        gesture={indicatorGesture}
        onPress={() => handlePressChange(value)}
        restingColor={INDICATOR_RESTING}
        movingColor={INDICATOR_SURFACE_MOVING}
        glassStyle="clear"
        borderRadius={999}
      />

      {items.map((item) => (
        <TabBarTab
          key={item.key}
          item={item}
          isActive={false}
          isSelected={item.key === value}
          onPress={handlePressChange}
          onLayout={handleLayout}
          iconRef={(ref) => {
            iconRefs.current[item.key] = ref
          }}
        />
      ))}

      <Animated.View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.activeClip, { borderRadius: 999 }, indicatorClipStyle]}
      >
        <Animated.View style={[styles.activeContent, indicatorContentStyle]}>
          {items.map((item) => {
            const layout = tabLayouts[item.key]

            if (!layout) {
              return null
            }

            return (
              <View
                key={item.key}
                style={[styles.activeItem, { left: layout.x, width: layout.width }]}
              >
                <TabBarTabFace
                  item={item}
                  isActive
                  iconRef={(ref) => {
                    highlightIconRefs.current[item.key] = ref
                  }}
                />
              </View>
            )
          })}
        </Animated.View>
      </Animated.View>
    </View>
  )

  const content = (
    <View
      style={{
        paddingHorizontal: BAR_PADDING,
        paddingTop: BAR_PADDING,
        paddingBottom: bottomInset,
      }}
    >
      {rowGesture ? <GestureDetector gesture={rowGesture}>{tabRow}</GestureDetector> : tabRow}
    </View>
  )

  return (
    <View style={styles.root}>
      <View style={styles.hairline} />
      {isGlass ? (
        <GlassContainer spacing={0} style={styles.container}>
          <GlassView glassEffectStyle="regular" style={StyleSheet.absoluteFill} />
          {content}
        </GlassContainer>
      ) : (
        <View style={styles.container}>
          <BlurView intensity={24} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.barTint} />
          {content}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  activeClip: {
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    top: 0,
    zIndex: 2,
  },
  activeContent: {
    height: '100%',
    position: 'relative',
  },
  activeItem: {
    alignItems: 'center',
    bottom: 0,
    gap: 3,
    paddingBottom: 8,
    paddingHorizontal: 6,
    paddingTop: 7,
    position: 'absolute',
    top: 0,
  },
  barTint: {
    backgroundColor: BAR_TINT,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  container: {
    overflow: 'hidden',
    position: 'relative',
  },
  hairline: {
    backgroundColor: BAR_HAIRLINE,
    height: StyleSheet.hairlineWidth,
  },
  root: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
  },
})
