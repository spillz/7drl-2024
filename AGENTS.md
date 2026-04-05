# AGENTS.md

This file defines repository-wide implementation expectations for human and AI contributors.

## Core development rules

1. **Use modern class-based object-oriented JavaScript.**
   - Prefer `class` syntax, inheritance/composition, and clear public methods.
   - Keep responsibilities separated (UI widgets, game state, AI, map gen, actions).

2. **Use ESKV for rendering and UI.**
   - Keep gameplay visuals and HUD/UI in ESKV widgets/layouts.
   - Prefer ESKV widget composition over ad-hoc DOM drawing.
   - Favor declarative ESKV markup for major screens and reusable widget classes for behavior.

3. **Type-check with JSDoc at edit time.**
   - Add `//@ts-check` at the top of JS source files.
   - Use JSDoc annotations for classes, fields, params, and return types.
   - Keep code compatible with `tsc --noEmit --allowJs --checkJs`.

4. **Document new systems with concise examples.**
   - Include usage examples for ESKV UI patterns when adding new UI elements.
   - Keep examples close to the code they describe (comments, docs, or design notes).

---

## ESKV UI usage example

```js
//@ts-check
import * as eskv from "eskv/lib/eskv.js";

class MissionHud extends eskv.BoxLayout {
  /** @param {Partial<eskv.BoxLayout>=} props */
  constructor(props = {}) {
    super({ orientation: "horizontal", ...props });
    this.addChild(new eskv.Label({ text: "Squad Status", hints: { w: 0.5 } }));
    this.addChild(new eskv.Button({ text: "End Turn", hints: { w: 0.5 } }));
  }
}
```

### Markup pattern example

```yaml
Game:
  Notebook:
    BoxLayout:
      id: 'root'
      orientation: 'vertical'
      BoxLayout:
        id: 'hudBar'
        orientation: 'horizontal'
      ScrollView:
        id: 'mapScroll'
        MissionMap:
          id: 'missionMap'
      BoxLayout:
        id: 'squadPanel'
        orientation: 'horizontal'
```

---

## Recommended game layout

Use a stable 3-band layout for moment-to-moment play:

1. **Top HUD bar**
   - Mission timer, alert level, objectives, quick help.
2. **Center tactical view**
   - Scrollable/zoomable `MissionMap` with overlays (LOS, sound, suppression, path preview).
3. **Bottom squad/action panel**
   - Character portraits, health/status, queued actions, timeline/time-loop controls.

This structure should remain consistent across levels; only data/content changes per mission.

---

## Implementation checklist for contributors

- [ ] New JS files include `//@ts-check`.
- [ ] Public APIs and non-trivial fields are JSDoc typed.
- [ ] UI additions are built with ESKV widgets/markup.
- [ ] New gameplay systems are represented as classes (not loose function bundles).
- [ ] Any significant UI addition includes a short ESKV usage example in docs/comments.
