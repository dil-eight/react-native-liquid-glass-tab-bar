import { GestureHandlerRootView } from 'react-native-gesture-handler'

import StorybookUIRoot from './.rnstorybook'

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StorybookUIRoot />
    </GestureHandlerRootView>
  )
}
