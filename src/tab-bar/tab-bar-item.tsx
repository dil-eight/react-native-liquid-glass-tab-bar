import { type Ref, useRef } from 'react'
import { type LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native'

import type { IndicatorLayout } from '../traveling-indicator'
import { AnimatedIcon, type AnimatedIconHandle } from './icons'
import type { TabBarItem } from './types'

const ACTIVE_COLOR = '#FFFFFF'
const INACTIVE_COLOR = '#8A92A3'

type Props = {
  item: TabBarItem
  isActive: boolean
  isSelected: boolean
  onPress: (key: string) => void
  onLayout: (key: string, layout: IndicatorLayout) => void
  iconRef?: Ref<AnimatedIconHandle>
}

type FaceProps = {
  item: TabBarItem
  isActive: boolean
  iconRef?: Ref<AnimatedIconHandle>
}

export const TabBarTabFace = ({ item, isActive, iconRef }: FaceProps) => (
  <>
    <View style={styles.iconSlot}>
      <AnimatedIcon
        ref={iconRef}
        name={item.icon}
        size={25}
        color={isActive ? ACTIVE_COLOR : INACTIVE_COLOR}
      />
    </View>
    <Text style={[styles.label, isActive ? styles.activeLabel : styles.inactiveLabel]}>
      {item.label}
    </Text>
  </>
)

export const TabBarTab = ({ item, isActive, isSelected, onPress, onLayout, iconRef }: Props) => {
  const fallbackIconRef = useRef<AnimatedIconHandle>(null)
  const activeIconRef = iconRef ?? fallbackIconRef

  const handleLayout = (event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout
    onLayout(item.key, { x, width })
  }

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={item.label}
      onLayout={handleLayout}
      onPress={() => onPress(item.key)}
      style={styles.root}
    >
      <TabBarTabFace item={item} isActive={isActive} iconRef={activeIconRef} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  activeLabel: {
    color: ACTIVE_COLOR,
    fontWeight: '700',
  },
  iconSlot: {
    alignItems: 'center',
    height: 26,
    justifyContent: 'center',
    width: 40,
  },
  inactiveLabel: {
    color: INACTIVE_COLOR,
    fontWeight: '600',
  },
  label: {
    fontSize: 12,
    lineHeight: 15,
  },
  root: {
    alignItems: 'center',
    flex: 1,
    gap: 3,
    paddingBottom: 8,
    paddingHorizontal: 6,
    paddingTop: 7,
  },
})
