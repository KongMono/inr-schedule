# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev          # dev server (Turbopack)
npm run build        # production build — use this to type-check (no tsc binary)
npm run start        # serve production build
```

There are no tests. Use `npm run build` to catch TypeScript/compilation errors before pushing.

## Architecture

Single-page app for managing monthly nurse/doctor on-call schedules at a Thai hospital radiology center (INR).

**Data flow:**
```
src/data/schedule.ts   ← seed data (hardcoded monthly schedules)
        ↓
src/lib/scheduleStore.ts  ← localStorage CRUD + helpers (daysInMonth, createEmptyMonth, nextShift)
src/lib/scheduleRepo.ts   ← async facade: Supabase when configured, localStorage fallback
src/lib/supabase.ts       ← Supabase client (null when env vars absent)
        ↓
src/components/ScheduleTable.tsx  ← entire UI (single 'use client' component)
```

**Supabase table `schedules`:** columns `month`, `thai_year`, `data jsonb`. The full `ScheduleData` object is stored in the `data` column. Staff identity (name/phone/role) always comes from seed (`applyIdentity` in scheduleRepo) — only `shifts` arrays are persisted per-month. Realtime subscriptions via `subscribeSchedules` keep multiple browser tabs in sync.

**Key types** (`src/data/schedule.ts`):
- `ShiftCode`: `'M' | 'A' | 'N' | 'N2' | 'OFF' | 'SWAP' | '-'`
- `ScheduleData.year` = Gregorian; `thaiYear` = Buddhist Era (year + 543)
- `weekendDays` is a manual list (not computed) — it includes public holidays shown as red circles

**ScheduleTable.tsx internals:**
- PIN gate for edit mode: `EDIT_PIN = '11223344'`, persisted in `sessionStorage`
- Theme toggle: class-based dark mode (`.dark` on `<html>`), persisted in `localStorage` under `THEME_KEY`
- Calendar grid offset: `(new Date(year, month-1, 1).getDay() + 6) % 7` for Monday-first layout
- Month navigation triggers `contentKey` state change → React `key` remount → CSS slide animation replays
- All button/UI primitives (`BtnFilled`, `BtnTonal`, `BtnOutlined`, `BtnIcon`, `ThemeSwitch`) are defined locally in the same file

## Styling

- **Tailwind v4** — use `@import "tailwindcss"` not v3 `@tailwind` directives. No `tailwind.config.js`.
- **Dark mode** — class-based via `@variant dark (&:where(.dark, .dark *))` in `globals.css`. Use `dark:` utilities normally.
- **MD3 tokens** — CSS custom properties (`--md-primary`, `--md-surface`, etc.) defined in `:root` and `.dark` in `globals.css`. Prefer these over raw Tailwind colors for themed surfaces.
- **Typography** — use `.md-headline-s/m`, `.md-title-l/m/s`, `.md-body-l/m/s`, `.md-label-l/m/s` classes from `globals.css`.

## Environment

Requires for Supabase (optional — falls back to localStorage without them):
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```
