# Building a draggable Liquid Glass tab bar in React Native

This note documents the path that led to the final tab bar example in this repository. It is intentionally separate from `README.md`: the README can stay short and practical, while this file keeps the design and implementation trail.

I originally built this interaction while working on the mobile interface for [Moniti](https://moniti.io), a consumer debt payoff app that turns credit cards and loans into a clear payoff plan.

## 1. Start with the visual target

The target interaction was closer to Slack and Telegram than to a normal selected tab pill:

- the indicator can be grabbed directly and dragged with a finger;
- while traveling or being dragged, the capsule behaves like a liquid bubble rather than a rigid pill;
- normal tab-to-tab travel uses capped distance pressure, while direct finger dragging adds extra deformation only while the finger is moving;
- the shape change is capped so long jumps do not become extreme;
- the icon and label turn white only in the area covered by the moving indicator;
- after motion, the glass hands off into a quieter resting highlight.

That last point matters. The indicator is not permanently “glass” in this design. Glass is the motion material; rest is a softer plate.

## 2. Separate geometry from material

The useful split is:

- `useTravelingIndicator` owns geometry, gesture, timing, and shared animated values;
- `TravelingIndicator` decides how to draw the material: native glass or a painted surface;
- `TabBar` draws the tabs, the indicator, and the clipped active highlight.

This made it possible for the surface fallback and native glass version to share the same movement behavior.

## 3. Make first render a resting state

React Native layout arrives after first paint. A naive indicator starts at `x = 0`, then animates to the active tab as soon as `onLayout` fires. That reads as a bug on mount.

The fix is to treat the first measured active layout as placement, not travel:

- set `translateX` and `width` immediately;
- set `glassPresence = 0`;
- set `restOpacity = 1`;
- set `restReveal = 1`;
- do not schedule travel timers.

Repeated layout with the same `x` and `width` is also treated as rest. That prevents a second `onLayout` from accidentally replaying the glass lifecycle.

## 4. Use distance pressure instead of fixed squash

The indicator shape is driven by `distancePressure`. A neighboring tab gets almost no additional pressure. A jump over one item reaches the visual maximum. Longer jumps still move farther, but the shape is capped.

The pressure formula is:

```ts
const travelUnits = travelDistance / pressureBase
const pressure = Math.min(Math.max((travelUnits - 0.75) * 0.4, 0), DISTANCE_PRESSURE_MAX)
```

Then width, height, and radius all derive from that pressure:

- width compresses with `BUMP_DISTANCE_SCALE_X`;
- height grows with `BUMP_DISTANCE_SCALE_Y`;
- radius eases from `INDICATOR_RADIUS_NEAR` to `INDICATOR_RADIUS_FAR`.

The important lesson was that radius matters as much as scale. A permanently huge radius makes every state look like a simple pill, even when the width and height are changing.

## 5. Clip the active tab layer

The white icon and label are not toggled on the selected tab. Instead, the tab faces are rendered twice:

- the base layer is inactive;
- the active white layer sits above it;
- the active layer is clipped to the animated indicator shape.

That gives the Slack-like effect where only the part under the moving glass turns white.

The clipped layer uses the same animated width, x position, radius, and opacity as the indicator, so it does not drift away from the material.

## 6. Add direct manipulation

The indicator has a transparent gesture hit layer above the material. On drag begin:

- running animations are cancelled;
- the current x position is captured;
- drag scale values are raised;
- for native glass, `glassPresence` is raised directly on the UI thread.

That UI-thread glass activation is important. If the drag begins and waits for a React state update before showing native glass, the first frames can show only the clipped highlight mask with no glass underneath.

Telegram has another detail that makes the bar feel alive: the user does not have to grab the current capsule. If they long-press anywhere in the tab row, the indicator flies to the finger and then follows it. The example handles that with a second row-level pan gesture:

- `activateAfterLongPress(180)` keeps normal taps on tabs intact;
- on begin, the indicator animates to `event.x`;
- on update, it follows the finger directly;
- on release, it settles to the nearest tab and commits that key.

The existing indicator-only pan still exists for immediate dragging from the capsule itself. The row gesture is only the “call the capsule over here” path.

## 7. Keep native GlassView mounted

Another subtle native issue: mounting `GlassView` only while moving can miss frames. The fix is to keep the glass view mounted in glass mode and drive visibility with animated opacity.

That first version still had a trap: at rest the opacity was exactly `0`. On some runs the next move did not visibly wake the native glass in time. The final version keeps the native view mounted and parks it at `0.01` opacity:

```ts
opacity: Math.max(glassPresence.value, GLASS_IDLE_OPACITY)
```

That keeps the native glass pipeline warm while the visible resting plate remains the surface the user sees.

## 8. Avoid tap backtracking

The row-level gesture introduced one more trap. On a normal tap, the row gesture may begin by moving the capsule toward the finger, then fail so the press handler can select the tab. If the failed row gesture always snaps back to the previously selected tab, the indicator visibly travels to the target, jumps back, and then travels to the target again after selection.

The fix is to separate the two gesture paths:

- direct indicator dragging restores the active tab when it is cancelled;
- row-level touch exploration settles to the nearest current capsule position when it is cancelled.

That keeps taps crisp while preserving the “pull the capsule to my finger” interaction for real row drags.

## 9. Do not delay the tab-bar glass

The shared motion hook supports a glass lead: glass can light up, then geometry can move a beat later. That worked well for calmer segmented controls, but it made the tab bar feel late. The user saw the glass appear first and only then saw the capsule resize or travel.

For the draggable tab bar, glass and geometry now start together:

```ts
useTravelingIndicator(value, {
  leadMs: 0,
  hasGlass: isGlass,
})
```

The interaction feels direct because the first visual response is already moving.

## 10. Fix the repeated active highlight

Press and drag should both animate the destination icon. The reliable signal is the selected `value` changing in the parent tab bar.

The tab bar keeps refs for both icon copies:

- the inactive base icon;
- the active clipped icon.

When `value` changes, both refs receive `start()`. That way the visible white icon animates when it is under the indicator, and drag selection behaves the same as tap selection.

There was one more tab-bar-specific mistake: the clipped white layer cannot be treated like a normal selected tab. The tab faces are rendered twice, and the whole clipped copy should be drawn as active. The moving mask decides which part is visible. If only the current key is active inside that copy, the highlight repeats or disappears in slices while the indicator travels.

## 11. What the logs showed

The disappearing-glass bug was easier to reason about after adding short event logs around the glass handoff. The important discovery was that the app itself was driving the native material all the way to zero and then removing the active glass window. Keeping the native `GlassView` mounted and never parking it at a perfect zero fixed the unreliable wake-up, while the separate resting plate preserved the intended idle design.

## 12. Compare with Telegram

Telegram's iOS code follows the same practical rule. Their [`GlassBackgroundView`](https://github.com/TelegramMessenger/Telegram-iOS/blob/6ad963e5b62d354da79040f388ae2b9132fb17b8/submodules/TelegramUI/Components/GlassBackgroundComponent/Sources/GlassBackgroundComponent.swift) keeps the native or legacy glass view in the hierarchy and updates frame, effect, alpha, and visibility through transitions. Their [`SolidRoundedButtonNode`](https://github.com/TelegramMessenger/Telegram-iOS/blob/6ad963e5b62d354da79040f388ae2b9132fb17b8/submodules/SolidRoundedButtonNode/Sources/SolidRoundedButtonNode.swift) lazy-creates the chrome overlay once, then only reframes it.

The important lesson is not Telegram's exact abstraction. The lesson is that material views should be stable objects during motion. Repeatedly creating, removing, or fully zeroing them is where the native compositor can miss the moment.

## 13. Storybook as the product surface

The example is intentionally Storybook-first. The stories show:

- the surface fallback;
- native Liquid Glass when available;
- side-by-side comparison;
- four and five item bars to test short, medium, and capped long jumps.

The colored background bands are not decorative. They make blur and refraction visible, which is necessary when judging glass behavior.

## Final shape

The final behavior is:

- immediate resting indicator on first render;
- draggable indicator in both surface and glass modes;
- long-press anywhere in the row to pull the indicator to the finger;
- cancelled row touches do not send the indicator backward before selection;
- shared motion constants for both modes;
- distance-based width, height, and radius;
- capped maximum deformation;
- clipped active icon and text highlight;
- native glass kept mounted and never parked at exact zero opacity;
- tab-bar glass starts with geometry instead of waiting for a lead;
- icon animation triggered when the selected tab is confirmed.
