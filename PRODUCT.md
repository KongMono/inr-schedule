# Product

## Register

product

## Platform

web

## Users

Nurses and doctors at a Thai hospital radiology center (INR). Primary context: checking their own on-call shifts and colleagues' shifts on a phone, often between tasks during a workday or before/after a night shift (bright ward light or dark room — both themes matter). A schedule maintainer edits the monthly roster (PIN-gated edit mode), usually on desktop. Thai is the primary language of the UI.

## Product Purpose

A single-page monthly on-call schedule board that replaces printed/Excel rosters. Success: any staff member can answer "who's on duty right now / tonight / tomorrow" in under five seconds on a phone, and the maintainer can update a month's shifts without touching a spreadsheet. Multi-tab realtime sync via Supabase keeps everyone looking at the same truth.

## Brand Personality

Calm, clear, trustworthy. iOS-clean: neutral grouped backgrounds, a single teal accent, soft elevation, frosted glass sparingly. The interface should feel like a well-made system utility, not a branded app — the schedule data is the hero.

## Anti-references

- Dense Excel/HIS-style grids: tiny cells, hairline borders everywhere, unreadable on a phone. This app exists to escape that.
- Heavy Material Design idioms (saturated multi-color palettes, ripple effects everywhere) — the committed direction is iOS-flavored.

## Design Principles

1. **Glanceable first** — the answer to "who's on duty" must be visible without scrolling, tapping, or reading legends.
2. **Phone is the primary device** — every feature must work one-handed on a small screen; desktop is the editing convenience, not the baseline.
3. **Data is the hero** — chrome stays neutral; color is reserved for meaning (shift codes, today, holidays, errors).
4. **Both lighting conditions are real** — light and dark themes are equally first-class because users check schedules in wards and in dark on-call rooms.
5. **Never lie about state** — edits, sync status, and month context must always be unambiguous; a wrong-looking roster erodes all trust.

## Accessibility & Inclusion

WCAG 2.1 AA. Body text contrast ≥4.5:1 in both themes (previously audited via Lighthouse — keep it that way). Touch targets ≥44px for shift cells and controls. Respect `prefers-reduced-motion` for slide/fade transitions. Thai text rendering: ensure line-height accommodates Thai diacritics.
