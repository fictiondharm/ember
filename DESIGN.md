---
version: "1.0"
name: "FleetGrid Design System"
description: >
  FleetGrid adapts a Linear-inspired near-black product system into a
  commercial-fleet operations interface. The visual language is dense,
  technical, calm, and trustworthy, with a near-black canvas, layered
  charcoal surfaces, hairline borders, restrained lavender-blue primary
  interaction, and FleetGrid-specific semantic states for sustainability,
  warnings, logistics, and emergencies.

---

# FleetGrid Design System

## 1. Design Intent

FleetGrid is an operational control center, not a consumer social app and not a generic SaaS admin template.

The interface should communicate:

- operational clarity
- trust
- technical sophistication
- real-time awareness
- safety
- sustainability
- enterprise reliability

The interface should feel like a **mission-control system for commercial freight**.

Use visual restraint. Information architecture should do most of the work.

The dark canvas is the primary stage. Panels, borders, typography, map overlays, status indicators, and motion should establish hierarchy without excessive decoration.

---

## 2. Design Foundation

This system is based on the provided Linear design analysis.

Do not copy Linear branding, logos, names, or proprietary assets.

Use the documented design language as a visual foundation and adapt it for FleetGrid.

Core principles from the source:

- near-black canvas
- layered charcoal surfaces
- hairline borders
- light gray typography
- restrained lavender-blue primary accent
- compact controls
- dense technical UI
- minimal shadows
- subtle depth
- no decorative atmospheric gradients

---

## 3. Color Tokens

### Base

```yaml
colors:
  primary: "#5e6ad2"
  on-primary: "#ffffff"
  primary-hover: "#828fff"
  primary-focus: "#5e69d1"

  ink: "#f7f8f8"
  ink-muted: "#d0d6e0"
  ink-subtle: "#8a8f98"
  ink-tertiary: "#62666d"

  canvas: "#010102"
  surface-1: "#0f1011"
  surface-2: "#141516"
  surface-3: "#18191a"
  surface-4: "#191a1b"

  hairline: "#23252a"
  hairline-strong: "#34343a"
  hairline-tertiary: "#3e3e44"

  inverse-canvas: "#ffffff"
  inverse-surface-1: "#f5f6f6"
  inverse-surface-2: "#f6f7f7"
  inverse-ink: "#000000"

  brand-secure: "#7a7fad"
  semantic-success: "#27a644"
  semantic-overlay: "#000000"
```

### FleetGrid semantic colors

FleetGrid requires additional operational semantics.

These are for **product UI only**, not decorative marketing use.

```yaml
fleet_semantics:
  sustainability:
    color: "#27a644"
    use:
      - low-emission recommendation
      - successful green optimization
      - verified positive sustainability outcome

  warning:
    use:
      - route risk
      - deadline risk
      - uncertain incident
      - degraded conditions

  critical:
    use:
      - SOS
      - active emergency
      - critical safety state

  information:
    use:
      - logistics context
      - neutral vehicle information
      - system information
```

Important:

- Use semantic colors sparingly.
- Never make the entire interface brightly multicolored.
- Critical red must be reserved for genuinely critical states.
- Sustainability green should communicate data meaning, not become a decorative theme.
- Do not rely on color alone; pair semantic colors with icons, labels, or text.

---

## 4. Surface Hierarchy

Use this surface ladder consistently.

```text
Canvas
  ↓
Surface 1
  ↓
Surface 2
  ↓
Surface 3
  ↓
Surface 4
```

### Usage

```yaml
canvas:
  value: "#010102"
  use:
    - page background
    - large empty space
    - primary navigation background

surface-1:
  value: "#0f1011"
  use:
    - standard cards
    - panels
    - data containers
    - map-side panels

surface-2:
  value: "#141516"
  use:
    - featured panels
    - selected rows
    - elevated interactive surfaces

surface-3:
  value: "#18191a"
  use:
    - dropdowns
    - popovers
    - menus
    - sub-navigation

surface-4:
  value: "#191a1b"
  use:
    - high-priority nested surfaces
    - exceptional elevation
```

Prefer surface changes and hairlines over large shadows.

---

## 5. Typography

The source design documents a proprietary Linear display/text family.

Do not ship proprietary fonts.

Use:

### Preferred display fallback

```text
Inter
Geist Sans
SF Pro Display
-apple-system
system-ui
Segoe UI
Roboto
sans-serif
```

### Preferred body

```text
Inter
Geist Sans
-apple-system
system-ui
Segoe UI
Roboto
sans-serif
```

### Mono

```text
JetBrains Mono
Geist Mono
ui-monospace
SFMono-Regular
Menlo
monospace
```

---

## 6. Typography Tokens

```yaml
typography:
  display-xl:
    font-size: 80px
    font-weight: 600
    line-height: 1.05
    letter-spacing: -3px

  display-lg:
    font-size: 56px
    font-weight: 600
    line-height: 1.10
    letter-spacing: -1.8px

  display-md:
    font-size: 40px
    font-weight: 600
    line-height: 1.15
    letter-spacing: -1px

  headline:
    font-size: 28px
    font-weight: 600
    line-height: 1.20
    letter-spacing: -0.6px

  card-title:
    font-size: 22px
    font-weight: 500
    line-height: 1.25
    letter-spacing: -0.4px

  subhead:
    font-size: 20px
    font-weight: 400
    line-height: 1.40
    letter-spacing: -0.2px

  body-lg:
    font-size: 18px
    font-weight: 400
    line-height: 1.50
    letter-spacing: -0.1px

  body:
    font-size: 16px
    font-weight: 400
    line-height: 1.50
    letter-spacing: -0.05px

  body-sm:
    font-size: 14px
    font-weight: 400
    line-height: 1.50
    letter-spacing: 0

  caption:
    font-size: 12px
    font-weight: 400
    line-height: 1.40
    letter-spacing: 0

  button:
    font-size: 14px
    font-weight: 500
    line-height: 1.20
    letter-spacing: 0

  eyebrow:
    font-size: 13px
    font-weight: 500
    line-height: 1.30
    letter-spacing: 0.4px

  mono:
    font-size: 13px
    font-weight: 400
    line-height: 1.50
    letter-spacing: 0
```

### Operational typography

For operational dashboards, prefer:
- headline 28px for page title
- card-title 22px
- body 16px
- body-sm 14px
- caption 12px
- mono 13px for IDs, coordinates, hashes, telemetry values

Do not use 80px display type inside dense operational screens except for exceptional hero/landing surfaces.

---

## 7. Spacing

Use a 4px base grid.

```yaml
spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  section: 96px
```

Operational dashboard guidance:

- compact control gap: 8px
- standard control gap: 12px
- card padding: 16–24px
- major panel padding: 24px
- page section separation: 32–48px
- large marketing/landing section separation: 96px

---

## 8. Border Radius

```yaml
rounded:
  xs: 4px
  sm: 6px
  md: 8px
  lg: 12px
  xl: 16px
  xxl: 24px
  pill: 9999px
  full: 9999px
```

### Usage

- 4px: tiny metadata chips
- 6px: tags
- 8px: buttons, inputs, select controls
- 12px: cards and panels
- 16px: large map/product containers
- 24px: rare prominent callout containers
- pill: status indicators and compact filters
- full: avatar circles

Do not overuse pill shapes.

---

## 9. Elevation

Avoid traditional large drop shadows.

Use:

```text
Level 0
canvas only

Level 1
surface-1 + hairline

Level 2
surface-2 + stronger hairline

Level 3
surface-3

Level 4
focus outline
```

Focus:

```text
2px outline
#5e69d1
50% opacity
```

Use elevation primarily through:
- surface lift
- borders
- contrast
- subtle edge highlights

---

## 10. Buttons

### Primary

```yaml
background: "#5e6ad2"
text: "#ffffff"
font: button
radius: 8px
padding: "8px 14px"
```

Hover:

```text
#828fff
```

Pressed:

```text
#5e69d1
```

### Secondary

```yaml
background: "#0f1011"
text: "#f7f8f8"
border: "#23252a"
radius: 8px
padding: "8px 14px"
```

### Tertiary

Use for low-emphasis actions.

### Destructive

Use FleetGrid semantic critical treatment only for genuinely destructive/emergency-sensitive actions.

Do not make ordinary actions red.

---

## 11. Forms

Text input:

```yaml
background: "#0f1011"
text: "#f7f8f8"
border: "#23252a"
radius: 8px
padding: "8px 12px"
```

Focused:

- maintain the same dark surface
- use the focus outline
- do not change the entire input to lavender

Validation states:

- error: semantic critical
- warning: amber warning
- success: semantic success

Always pair with explanatory text.

---

## 12. Cards

FleetGrid cards are functional containers.

Use cards for:

- active truck summary
- shipment summary
- route recommendation
- incident summary
- carbon summary
- SOS summary
- AI recommendation
- PoD verification

Default:

```text
surface-1
hairline
12px radius
16–24px padding
```

Avoid excessive shadows.

---

## 13. Data Tables

Operational data should remain tabular when tabular structure is useful.

Use:
- compact row height
- aligned numbers
- clear headers
- subtle separators
- hover state
- sorting
- filtering
- pagination/virtualization where appropriate
- status badges

Do not convert every table into cards.

---

## 14. Status Badges

Default:

```text
surface-2
ink-muted
12px caption
pill radius
2px 8px padding
```

FleetGrid examples:

```text
IN TRANSIT
DELIVERED
DELAYED
AT RISK
INCIDENT
SOS
VERIFIED
PENDING
```

Use semantic colors when the status meaning requires urgency or emphasis.

---

## 15. Fleet Map

The map is the dominant operational visual.

### Map layers

```text
Trucks
Shipments
Routes
Incidents
Hazards
SOS
Charging
Refuelling
```

### Markers

Markers must be compact and legible.

Truck markers:
- neutral by default
- semantic state when useful

Incident markers:
- distinguish severity
- support selected state
- show confidence when appropriate

SOS:
- unmistakable
- high contrast
- pulsing motion allowed
- do not make the whole map pulse

### Map controls

Use compact dark controls consistent with the system.

---

## 16. Fleet Summary Cards

Example:

```text
ACTIVE TRUCKS
184

+12 since 09:00
```

Use:
- headline or card-title for metric
- body-sm/caption for context
- restrained trend indicator

---

## 17. Route Comparison

This is a key FleetGrid pattern.

```text
ROUTE A
ETA 18:20
₹4,400
280 kg CO₂e

ROUTE B
ETA 18:42
₹4,520
295 kg CO₂e

ROUTE C
ETA 19:00
₹4,650
310 kg CO₂e
```

Selected route:
- elevated surface
- clear border
- readable recommendation label
- explanation panel

Avoid bright visual noise.

---

## 18. Green Optimization Component

The sustainability choice should be a data comparison.

Example:

```text
LOWEST-EMISSION FEASIBLE

EV · 2.2 t

₹620 more than cheapest
~51% lower estimated CO₂e
Deadline achievable

[ASSIGN VEHICLE]
```

Green should be used specifically for sustainability semantics.

Do not turn the entire page green.

---

## 19. Road Incident Component

Example:

```text
ROAD CLOSURE
NH48

Confidence
94%

Reported by 3 trucks
Confirmed by 6 trucks
Last confirmation 4 min ago

8 trucks affected

[REVIEW ROUTES]
```

Use status + text + icon together.

---

## 20. SOS Component

SOS is the most important safety state.

### Active state

Use:
- strong critical color
- unmistakable icon
- large label
- truck/driver reference
- location
- timestamp
- shipment
- actions

Example:

```text
🚨 ACTIVE SOS

TRUCK
KA01AB1234

LOCATION
Current truck position

SHIPMENT
GL1821

TRIGGERED
20:14:32

[CALL DRIVER]
[OPEN MAP]
[ESCALATE]
```

Do not hide SOS inside generic notifications.

---

## 21. Incident Confidence

Confidence is a product concept, not decoration.

Use:
- percentage
- supporting evidence
- last confirmation
- source count

Example:

```text
Confidence 91%
4 confirmations
3 min ago
```

Avoid implying mathematical certainty when confidence is heuristic.

---

## 22. Telegram and Voice UI

Telegram is primarily an external channel, so web UI should represent the conversational event when useful.

For Voice Copilot, use a compact panel with:
- microphone state
- listening state
- speaking state
- tool/action state
- transcript
- response
- emergency state

ElevenLabs-inspired audio waveform aesthetics may be used sparingly.

Do not replace the entire FleetGrid visual identity with an audio-first design.

---

## 23. AI Recommendation Component

AI suggestions should look like actionable operations intelligence.

Example:

```text
RECOMMENDED VEHICLE

EV · 2.2 t

Why:
✓ Enough capacity
✓ 14 km from pickup
✓ Deadline feasible
✓ Charging feasible
✓ Lowest estimated CO₂e among feasible options

[ASSIGN]
```

The explanation is progressive:
- recommendation first
- key metrics second
- reasoning third

---

## 24. PoD Verification

PoD verification should clearly distinguish:

```text
PENDING
SUBMITTED
BLOCKCHAIN CONFIRMED
VERIFIED
MISMATCH
UNAVAILABLE
```

Example:

```text
DELIVERY VERIFIED

PoD integrity
✓ Verified

Blockchain transaction
0x7ac9...4f21

Delivered
17:42

```

Use mono for transaction IDs and hashes.

---

## 25. Navigation

For the operations dashboard, prefer a compact navigation system.

Potential navigation:

```text
Overview
Fleet
Shipments
Dispatch
Map
Incidents
Safety
Green
PoD
Analytics
Settings
```

Active navigation should use:
- subtle surface lift
- primary accent sparingly
- clear text hierarchy

Avoid large decorative nav treatments.

---

## 26. Top Navigation

Desktop:
- FleetGrid wordmark
- workspace/fleet selector
- main utility controls
- notifications
- user menu

Mobile:
- compact header
- menu/drawer
- high-priority safety notifications remain visible

---

## 27. Alerts and Notifications

Levels:

```text
INFO
WARNING
CRITICAL
SUCCESS
```

Examples:

INFO:
New shipment assigned

WARNING:
Deadline at risk

CRITICAL:
SOS active

SUCCESS:
PoD verified

Notifications should not all look equally urgent.

---

## 28. Motion

Motion should communicate system state.

Good uses:
- truck position transitions
- panel opening
- route selection
- status changes
- SOS alert
- voice/listening state

Avoid:
- excessive page animation
- decorative parallax
- bouncing UI everywhere
- animation that interferes with map interaction

Keep motion subtle and fast.

---

## 29. Responsive Behavior

Source system breakpoints:

```yaml
Desktop-XL: 1440px
Desktop: 1280px
Tablet: 1024px
Mobile-Lg: 768px
Mobile: 480px
```

FleetGrid adaptations:

### Desktop
- full navigation
- map + side panels
- dense data tables
- multi-column operational cards

### Tablet
- condensed navigation
- map + stacked panels
- 2-column layouts where practical

### Mobile
- single-column
- drawer navigation
- compact cards
- simplified tables
- touch-friendly actions

Driver workflows must be mobile-first.

---

## 30. Touch Targets

Minimum guidance:

- desktop controls: at least 40px tall
- touch controls: at least 44px
- SOS: larger than normal controls
- inputs: at least 44px touch target

Never put critical emergency actions too close together.

---

## 31. Accessibility

Always maintain:
- visible focus
- keyboard operation
- semantic HTML
- adequate contrast
- screen-reader labels
- status text in addition to color
- accessible dialogs
- accessible error messages

Map interactions need accessible alternatives where possible.

SOS and emergency notifications must remain understandable without relying on animation or color.

---

## 32. Do's

- Use #010102 as the anchor canvas.
- Use the four-step dark surface ladder.
- Use hairline borders.
- Use lavender-blue sparingly for primary interaction.
- Use compact controls.
- Use data-dense operational layouts.
- Use green specifically for sustainability semantics.
- Use critical color specifically for safety/emergency states.
- Use mono type for IDs, hashes, telemetry, and technical values.
- Explain AI recommendations.
- Keep map and operational data visually dominant.
- Reuse tokens and components.

---

## 33. Don'ts

- Do not create a generic SaaS dashboard.
- Do not make everything glow.
- Do not use atmospheric gradients as the main visual language.
- Do not use bright colors for decoration.
- Do not make every button a pill.
- Do not use huge shadows on dark cards.
- Do not use color as the only status indicator.
- Do not use red for ordinary actions.
- Do not use green as a global branding color.
- Do not create separate styling rules for every screen.
- Do not copy Linear branding/assets.
- Do not make the dashboard so minimal that important operational data disappears.

---

## 34. Component Naming

Prefer reusable semantic component names:

```text
FleetMap
TruckMarker
ShipmentMarker
IncidentMarker
SOSMarker
FleetSummaryCard
VehicleCard
VehicleDetails
ShipmentCard
ShipmentTimeline
DispatchRecommendation
RouteComparison
GreenOptimizationCard
IncidentPanel
IncidentConfidence
SOSPanel
TelemetryPanel
AIRecommendation
VoiceCopilot
PoDVerification
BlockchainStatus
StatusBadge
MetricCard
DataTable
FilterBar
EmptyState
LoadingState
ErrorState
```

Do not create multiple slightly different components for the same semantic purpose.

---

## 35. Data Visualization

Charts should prioritize operational understanding.

Use:
- line charts for telemetry/time
- bars for fleet comparisons
- compact KPI summaries
- route/incident overlays on maps

Avoid:
- 3D charts
- decorative charts
- excessive gradients
- chartjunk

---

## 36. Marketing / Landing Page

If FleetGrid includes a public landing page, retain the source system's marketing characteristics:

- near-black canvas
- restrained lavender-blue
- dense product screenshots
- large but controlled headline typography
- product UI as the visual protagonist
- minimal gradients
- no rainbow palette

The public site may be more spacious than the operations dashboard.

---

## 37. Implementation Checklist

For every new frontend feature:

1. Read this DESIGN.md.
2. Identify the closest existing component.
3. Reuse or extend its tokens.
4. Implement default/hover/focus/active/loading/error states.
5. Check accessibility.
6. Check responsive behavior.
7. Check visual hierarchy.
8. Render the screen.
9. Fix spacing/alignment/inconsistency.
10. Avoid one-off styling unless justified.

---

## 38. Design QA

Before marking frontend work complete, review:

- canvas/surface hierarchy
- typography
- spacing
- borders
- radii
- semantic colors
- component reuse
- map clarity
- table readability
- emergency visibility
- mobile behavior
- accessibility
- consistency across screens

The interface is not complete merely because it compiles.

It must also visually conform to this document.

---

## 39. Source Design Reference

This FleetGrid system was adapted from the supplied Linear design analysis.

The supplied source establishes:
- #010102 canvas
- layered charcoal surfaces
- #5e6ad2 primary accent
- light gray typography
- 4px spacing base
- 4px/6px/8px/12px/16px/24px radii
- restrained shadows
- compact buttons
- dark technical aesthetic
- responsive breakpoints around 1440/1280/1024/768/480

FleetGrid-specific additions in this file include:
- safety/SOS semantics
- road incident semantics
- green optimization semantics
- fleet map patterns
- dispatch patterns
- PoD/blockchain states
- Voice Copilot guidance
- operational dashboard information density

These adaptations should take precedence over source components whenever FleetGrid operational needs differ.
