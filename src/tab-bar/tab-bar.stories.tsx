import type { Meta, StoryObj } from '@storybook/react-native'
import { type ReactNode, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { hasLiquidGlass, LiquidGlassNotice } from '../traveling-indicator'
import { TabBar } from './tab-bar'
import type { TabBarItem, TabBarVariant } from './types'

const THREE_ITEMS: Array<TabBarItem> = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'dms', label: 'DMs', icon: 'messages' },
  { key: 'activity', label: 'Activity', icon: 'bell' },
]

const FOUR_ITEMS: Array<TabBarItem> = [
  ...THREE_ITEMS,
  { key: 'more', label: 'More', icon: 'more' },
]

const FIVE_ITEMS: Array<TabBarItem> = [
  ...FOUR_ITEMS,
  { key: 'search', label: 'Search', icon: 'search' },
]

const BAND_COLORS = ['#7C3AED', '#0EA5E9', '#F97316', '#22C55E', '#EF4444', '#EAB308']

const Backdrop = ({ children }: { children: ReactNode }) => (
  <View style={styles.backdrop}>
    <View style={styles.bands}>
      {BAND_COLORS.map((color) => (
        <View key={color} style={[styles.band, { backgroundColor: color }]} />
      ))}
    </View>
    {children}
  </View>
)

const Demo = ({
  variant,
  bottomInset,
  items = THREE_ITEMS,
}: {
  variant: TabBarVariant
  bottomInset?: number
  items?: Array<TabBarItem>
}) => {
  const [value, setValue] = useState(items[0]?.key ?? 'home')
  const isGlassMissing = variant === 'glass' && !hasLiquidGlass()

  return (
    <Backdrop>
      {isGlassMissing ? <LiquidGlassNotice /> : null}
      <View style={styles.previewSpace} />
      <TabBar
        items={items}
        value={value}
        onChange={setValue}
        variant={variant}
        bottomInset={bottomInset}
      />
    </Backdrop>
  )
}

const meta: Meta<typeof TabBar> = {
  title: 'Liquid Glass Tab Bar',
  component: TabBar,
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['surface', 'glass'] satisfies Array<TabBarVariant>,
    },
  },
}

export default meta

type Story = StoryObj<typeof TabBar>

export const Surface: Story = {
  render: () => (
    <View style={styles.screen}>
      <Demo variant="surface" bottomInset={16} />
    </View>
  ),
}

export const Glass: Story = {
  render: () => (
    <View style={styles.screen}>
      <Demo variant="glass" bottomInset={16} />
    </View>
  ),
}

export const FourItems: Story = {
  render: () => (
    <View style={styles.screen}>
      <Demo variant="glass" bottomInset={16} items={FOUR_ITEMS} />
    </View>
  ),
}

export const FiveItems: Story = {
  render: () => (
    <View style={styles.screen}>
      <Demo variant="glass" bottomInset={16} items={FIVE_ITEMS} />
    </View>
  ),
}

export const SideBySide: Story = {
  render: () => (
    <View style={styles.screen}>
      <View style={styles.stack}>
        <View style={styles.block}>
          <Text style={styles.caption}>Surface fallback</Text>
          <Demo variant="surface" bottomInset={16} />
        </View>
        <View style={styles.block}>
          <Text style={styles.caption}>Native Liquid Glass</Text>
          <Demo variant="glass" bottomInset={16} />
        </View>
      </View>
    </View>
  ),
}

const styles = StyleSheet.create({
  backdrop: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  band: {
    flex: 1,
  },
  bands: {
    bottom: 0,
    flexDirection: 'row',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  block: {
    gap: 8,
  },
  caption: {
    color: '#8A92A3',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  previewSpace: {
    height: 96,
  },
  screen: {
    backgroundColor: '#101216',
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
  stack: {
    gap: 24,
  },
})
