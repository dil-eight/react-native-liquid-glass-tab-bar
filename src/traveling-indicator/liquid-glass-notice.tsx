import { StyleSheet, Text, View } from 'react-native'

import { LIQUID_GLASS_MIN_IOS } from './liquid-glass'
import { NOTICE_BACKDROP } from './constants'

export const LiquidGlassNotice = () => (
  <View style={styles.root}>
    <Text style={styles.title}>Liquid Glass fallback</Text>
    <Text style={styles.body}>
      Native Liquid Glass needs iOS {LIQUID_GLASS_MIN_IOS} or newer and a build with
      expo-glass-effect. This story falls back to the surface finish on this device.
    </Text>
  </View>
)

const styles = StyleSheet.create({
  root: {
    backgroundColor: NOTICE_BACKDROP,
    borderRadius: 14,
    gap: 4,
    margin: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
  },
  body: {
    color: '#A8B3C7',
    fontSize: 12,
    lineHeight: 17,
  },
})
