---
name: INR Schedule
description: iOS-clean on-call schedule board for a Thai hospital radiology center
colors:
  scrub-teal: "#0D9488"
  scrub-teal-dark: "#2DD4BF"
  teal-container: "#CCFBF1"
  teal-container-dark: "#134E4A"
  cyan-accent: "#06B6D4"
  surface: "#FFFFFF"
  surface-dark: "#1C1C1E"
  grouped-bg: "#F2F2F7"
  grouped-bg-dark: "#000000"
  surface-variant: "#F2F2F7"
  surface-variant-dark: "#2C2C2E"
  ink: "#1C1C1E"
  ink-dark: "#F2F2F7"
  ink-secondary: "#6C6C70"
  ink-secondary-dark: "#98989F"
  outline: "#C6C6C8"
  outline-dark: "#3A3A3C"
  alert-red: "#FF3B30"
  alert-red-dark: "#FF453A"
typography:
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', Arial, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1.29
    letterSpacing: "-0.02em"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "-0.005em"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', Arial, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.33
    letterSpacing: "0.01em"
rounded:
  md: "12px"
  lg: "16px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.scrub-teal}"
    textColor: "#FFFFFF"
    rounded: "{rounded.full}"
    height: "40px"
    padding: "0 24px"
  button-tonal:
    backgroundColor: "#0D94881A"
    textColor: "#0F766E"
    rounded: "{rounded.full}"
    height: "40px"
    padding: "0 24px"
  button-icon:
    rounded: "{rounded.full}"
    width: "40px"
    height: "40px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "16px"
  input:
    backgroundColor: "{colors.surface-variant}"
    rounded: "{rounded.md}"
    padding: "6px 12px"
---

# Design System: INR Schedule

## 1. Overview

**Creative North Star: "The Ward Glance"**

One look answers "who's on duty" — that is the whole system. The interface behaves like an iOS system utility: neutral grouped backgrounds (#F2F2F7 light, true black dark), white surface cards with large rounded corners, and a single Scrub Teal accent that carries every interactive and "you/now" signal. Nothing decorates; every color on screen encodes meaning (a shift code, today, a holiday, an error, "me").

The system explicitly rejects dense Excel/HIS-style grids (hairline borders, tiny cells) and heavy Material idioms (multi-color saturation, ripples). Density is achieved with typography weight and pill chips, never with more borders.

**Key Characteristics:**
- iOS grouped-background layering: bg → surface card → tinted callout
- Pill geometry everywhere: full-radius buttons, chips, badges
- Scrub Teal = interaction + identity ("ฉัน", today); red = weekend/holiday/danger only
- Dark mode is first-class (true black bg, elevated #1C1C1E surfaces)
- Soft tactile feedback: `active:scale-[0.97]` + opacity dip on every pressable

## 2. Colors

A restrained iOS-neutral shell with one committed teal voice.

### Primary
- **Scrub Teal** (#0D9488 light / #2DD4BF dark): every filled button, "me" badges, today ring, sync indicator. The scrubs-in-a-ward association grounds the hospital brief. Tonal uses: 10–15% alpha for tonal buttons, teal-50/teal-950 tints for "today" callouts.

### Secondary
- **Cyan Accent** (#06B6D4): reserved, rarely used; gradient-free highlight only.

### Neutral
- **Grouped Background** (#F2F2F7 light / #000000 dark): the page itself, iOS grouped-list style.
- **Surface** (#FFFFFF / #1C1C1E): cards that float on the grouped bg with soft elevation.
- **Surface Variant** (#F2F2F7 / #2C2C2E): inputs, inset sections, count chips.
- **Ink** (#1C1C1E / #F2F2F7) and **Ink Secondary** (#6C6C70 / #98989F): text hierarchy. Ink Secondary is for labels/meta only, never body-length text.
- **Alert Red** (#FF3B30 / #FF453A): errors; red-50/red-950 tints mark weekends and holidays.

### Named Rules
**The Meaning-Only Rule.** Chromatic color appears only when it encodes state: shift codes (blue M, red A, purple N, orange OFF, indigo SWAP), today (teal), holiday/weekend (red), me (teal). Decoration stays neutral.

**The Two-Voices Rule.** Teal speaks for "you and now"; red speaks for "off-duty and holiday". No third voice joins at surface level.

## 3. Typography

**Display/Body Font:** -apple-system / SF Pro Text (Arial fallback)

**Character:** A single native system stack in many weights — invisible typography that renders Thai and Latin equally well and feels OS-native on the phones nurses actually use.

### Hierarchy
- **Headline** (700, 1.5–1.75rem, tight -0.015 to -0.02em): month title, page header.
- **Title** (600, 0.875–1.375rem): section headers, day numbers, staff names.
- **Body** (400, 0.75–1rem): schedule content, phone numbers.
- **Label** (500–600, 0.6875–0.875rem, +0.01em): chips, badges, shift codes, counts.

### Named Rules
**The Thai Headroom Rule.** Line-height never drops below 1.25× on Thai text; diacritics (วรรณยุกต์) must never clip.

## 4. Elevation

Hybrid: soft diffuse shadows in light mode, tonal layering in dark mode. Light mode floats white cards on the grouped bg with barely-there ambient shadows; dark mode relies on surface lightness steps (#000 → #1C1C1E → #2C2C2E) with deeper shadows only for modals.

### Shadow Vocabulary
- **elev-1** (`0 1px 2px rgba(0,0,0,.04), 0 4px 16px rgba(0,0,0,.06)`): resting cards, main schedule surface.
- **elev-2** (`0 2px 4px rgba(0,0,0,.05), 0 8px 24px rgba(0,0,0,.08)`): staff edit cards, pinned rows.
- **elev-3** (`0 4px 8px rgba(0,0,0,.08), 0 16px 40px rgba(0,0,0,.14)`): dialogs/overlays only.
- **ios-blur** (`rgba(255,255,255,.72)` + `backdrop-filter: blur(20px) saturate(180%)`): sticky headers only — frosted glass is functional (content scrolls beneath), never decorative.

### Named Rules
**The Whisper Shadow Rule.** If a shadow is noticeable, it's too dark. Elevation reads as air, not as drop shadow.

## 5. Components

Character: **นุ่ม กดแล้วรู้สึก** — soft geometry, tactile press feedback on everything interactive.

### Buttons
- **Shape:** full pill (9999px), height 40px, px-24px.
- **Primary (BtnFilled):** Scrub Teal fill, white text.
- **Tonal (BtnTonal):** teal at 10–15% alpha, teal-700/300 text.
- **Outlined (BtnOutlined):** 1px outline, transparent bg; `danger` variant swaps to Alert Red.
- **Icon (BtnIcon):** 40×40 circle.
- **Press feedback (all):** `active:opacity-70 active:scale-[0.97]` over 150ms; icon buttons scale to 0.90.

### Chips
- **Style:** full-radius pill, `px-2 py-0.5`, label-s/m type.
- **Variants:** neutral (surface-variant bg), me (solid teal + white text), count (teal tint), status (red tint + red border for alerts).

### Cards / Containers
- **Corner Style:** 16px (rounded-2xl); grouped card stacks use rounded-t-2xl/rounded-b-2xl to read as one sheet.
- **Background:** surface white / #1C1C1E; callouts use teal-50 or red-50 tints with matching 1px borders.
- **Shadow:** elev-1 at rest.
- **Today emphasis:** teal border + ring, never a fill change alone.

### Inputs / Fields
- **Style:** surface-variant bg, 1px border, 12px radius (rounded-xl), `px-3 py-1.5`.
- **Focus:** `focus:ring-1 ring-teal-400`, no outline.

### Navigation
- Month prev/next as tonal pill buttons flanking an animated month title (`anim-pop` on change); sticky day headers use ios-blur.

### Signature Component: Shift Cell
Calendar day cell: rounded-2xl bordered tile, min-height 56px, weekend columns get a red-50 wash. Shift codes are typographic, not badges: `/` blue, `✕` red bold, `S` purple, `บ/ด` orange — color + glyph carry the data.

## 6. Do's and Don'ts

### Do:
- **Do** keep every pressable with tactile feedback (`active:scale` + opacity, 150ms).
- **Do** use teal tints (teal-50/teal-950) + 1px teal border for "today/me" emphasis.
- **Do** hold body text at Ink (#1C1C1E / #F2F2F7); Ink Secondary (#6C6C70) only for short labels — it fails 4.5:1 in long-form use on tinted surfaces.
- **Do** keep touch targets ≥40px (buttons already are; shift cells ≥56px).
- **Do** honor `prefers-reduced-motion` for the fade-up/slide/pop entrance set.

### Don't:
- **Don't** build dense Excel/HIS-style grids — no hairline-border tables, no sub-12px cell text. PRODUCT.md names this the primary anti-reference.
- **Don't** import heavy Material idioms: no ripples, no saturated multi-color palettes, no FABs.
- **Don't** add a third accent color; teal and red are the only voices (The Two-Voices Rule).
- **Don't** use frosted glass anywhere except sticky scroll headers.
- **Don't** use colored `border-left` stripes thicker than 1px as accents.
