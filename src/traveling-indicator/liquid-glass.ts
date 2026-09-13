import { Platform } from 'react-native'

export const LIQUID_GLASS_MIN_IOS = 26

export const hasLiquidGlass = () => {
  if (Platform.OS !== 'ios') {
    return false
  }

  const version = typeof Platform.Version === 'string' ? Number.parseFloat(Platform.Version) : Platform.Version

  return version >= LIQUID_GLASS_MIN_IOS
}

export const useLiquidGlass = hasLiquidGlass
