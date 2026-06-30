'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  SHIFT_LABELS,
  THAI_MONTHS,
  type ScheduleData,
  type ShiftCode,
  type StaffMember,
} from '@/data/schedule'
import { createEmptyMonth, emptyStaff, nextShift } from '@/lib/scheduleStore'
import { fetchSchedules, saveMonth, removeMonth, resetAll, subscribeSchedules } from '@/lib/scheduleRepo'

const EDIT_PIN = '11223344'
const EDIT_KEY = 'inr-schedule:edit'
const THEME_KEY = 'inr-schedule:theme'

// ── Shift styling (MD3 color-aware) ─────────────────────────────
const SHIFT_STYLE: Record<ShiftCode, string> = {
  M:    'text-blue-600 dark:text-blue-400 font-medium',
  A:    'text-red-600 dark:text-red-400 font-bold text-lg leading-none',
  N:    'text-purple-600 dark:text-purple-400 font-medium',
  N2:   'text-purple-600 dark:text-purple-400 font-medium',
  OFF:  'text-gray-400 dark:text-gray-500 text-xs',
  SWAP: 'text-orange-500 dark:text-orange-400 text-xs',
  '-':  'text-gray-300 dark:text-gray-600',
}

const SHIFT_DISPLAY: Record<ShiftCode, string> = {
  M: '/', A: '✕', N: 'S', N2: 'S', OFF: 'บ/ด', SWAP: 'สลับ', '-': '',
}

const DAY_ABBR = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']

const ROLE_BG: Record<string, string> = {
  doctor: 'bg-blue-50 dark:bg-blue-950/40',
  nurse:  'bg-white dark:bg-gray-800',
  tech:   'bg-green-50 dark:bg-green-950/40',
}

const ROLE_LABEL: Record<string, string> = {
  doctor: 'แพทย์', nurse: 'พยาบาล', tech: 'นักเทคโน',
}

const ROLES: StaffMember['role'][] = ['doctor', 'nurse', 'tech']

function telHref(phone: string) { return `tel:${phone.replace(/[^0-9+]/g, '')}` }
function countWork(m: StaffMember)  { return m.shifts.filter(s => s === 'OFF').length }
function countNight(m: StaffMember) { return m.shifts.filter(s => s === 'N' || s === 'N2').length }
function byDate(a: ScheduleData, b: ScheduleData) {
  return a.thaiYear - b.thaiYear || a.month - b.month
}

// ── Ripple helper ────────────────────────────────────────────────
function addRipple(e: React.MouseEvent<HTMLElement>) {
  const el = e.currentTarget
  const dot = document.createElement('span')
  dot.className = 'md-ripple-dot'
  const rect = el.getBoundingClientRect()
  dot.style.left = `${e.clientX - rect.left}px`
  dot.style.top  = `${e.clientY - rect.top}px`
  el.appendChild(dot)
  dot.addEventListener('animationend', () => dot.remove())
}

// ── MD3 Button components ────────────────────────────────────────
function BtnFilled({ children, onClick, className = '' }: {
  children: React.ReactNode; onClick?: () => void; className?: string
}) {
  return (
    <button
      onClick={onClick}
      onMouseDown={addRipple}
      className={`md-state md-label-l relative overflow-hidden inline-flex items-center gap-2 h-10 px-6 rounded-full bg-teal-700 dark:bg-teal-600 text-white shadow-sm transition-all duration-200 hover:shadow-md active:scale-95 ${className}`}
    >
      {children}
    </button>
  )
}

function BtnTonal({ children, onClick, className = '' }: {
  children: React.ReactNode; onClick?: () => void; className?: string
}) {
  return (
    <button
      onClick={onClick}
      onMouseDown={addRipple}
      className={`md-state md-label-l relative overflow-hidden inline-flex items-center gap-2 h-10 px-6 rounded-full bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-200 transition-all duration-200 active:scale-95 ${className}`}
    >
      {children}
    </button>
  )
}

function BtnOutlined({ children, onClick, className = '', danger = false }: {
  children: React.ReactNode; onClick?: () => void; className?: string; danger?: boolean
}) {
  const colors = danger
    ? 'border-red-300 dark:border-red-800 text-red-600 dark:text-red-400'
    : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300'
  return (
    <button
      onClick={onClick}
      onMouseDown={addRipple}
      className={`md-state md-label-l relative overflow-hidden inline-flex items-center gap-2 h-10 px-6 rounded-full border transition-all duration-200 active:scale-95 ${colors} ${className}`}
    >
      {children}
    </button>
  )
}

function BtnIcon({ children, onClick, title = '', active = false }: {
  children: React.ReactNode; onClick?: () => void; title?: string; active?: boolean
}) {
  return (
    <button
      onClick={onClick}
      onMouseDown={addRipple}
      title={title}
      className={`md-state relative overflow-hidden w-12 h-12 rounded-full flex items-center justify-center text-xl transition-all duration-200 active:scale-90 ${
        active
          ? 'bg-teal-100 dark:bg-teal-900/60 text-teal-700 dark:text-teal-300'
          : 'bg-transparent text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
      }`}
    >
      {children}
    </button>
  )
}

// ── MD3 Theme Toggle Switch ──────────────────────────────────────
function ThemeSwitch({ dark, onToggle }: { dark: boolean; onToggle: () => void }) {
  return (
    <button
      role="switch"
      aria-checked={dark}
      onClick={onToggle}
      title={dark ? 'เปลี่ยนเป็น Light mode' : 'เปลี่ยนเป็น Dark mode'}
      style={{ touchAction: 'manipulation' }}
      className="relative flex items-center cursor-pointer select-none focus:outline-none group p-3 -m-3"
    >
      {/* Track */}
      <span className={`relative inline-flex items-center w-14 h-8 rounded-full transition-colors duration-300 ease-in-out border-2 ${
        dark
          ? 'bg-teal-600 border-teal-600'
          : 'bg-gray-200 dark:bg-gray-600 border-gray-300 dark:border-gray-500'
      } group-focus-visible:ring-2 group-focus-visible:ring-teal-400 group-focus-visible:ring-offset-2`}>
        {/* Thumb */}
        <span className={`absolute flex items-center justify-center rounded-full shadow-md transition-all duration-300 ease-in-out ${
          dark
            ? 'w-7 h-7 left-[calc(100%-1.875rem)] bg-white text-teal-600'
            : 'w-5 h-5 left-[3px] bg-white text-gray-500'
        }`}>
          <span className={`transition-all duration-300 leading-none ${dark ? 'text-sm' : 'text-xs'}`}>
            {dark ? '☀' : '☾'}
          </span>
        </span>
      </span>
    </button>
  )
}

// ── Legend ───────────────────────────────────────────────────────
function Legend() {
  return (
    <div className="flex flex-wrap justify-center gap-x-3 gap-y-1.5 sm:gap-4 mt-3 text-xs sm:text-sm">
      {[
        { sym: 'บ/ด', symCls: 'text-gray-400 dark:text-gray-500 text-xs', label: 'เวรบ่ายดึก' },
        { sym: '/',   symCls: 'text-blue-600 dark:text-blue-400 font-medium text-lg', label: 'แพทย์เวร' },
        { sym: '✕',   symCls: 'text-red-600 dark:text-red-400 font-bold text-lg', label: 'ไม่อยู่เวร' },
        { sym: 'S',   symCls: 'text-purple-600 dark:text-purple-400 font-medium', label: 'standby' },
      ].map(({ sym, symCls, label }) => (
        <span key={label} className="flex items-center gap-1">
          <span className={symCls}>{sym}</span>
          <span className="text-gray-600 dark:text-gray-300">{label}</span>
        </span>
      ))}
      <span className="flex items-center gap-1 bg-red-50 dark:bg-red-950/60 px-2 py-0.5 rounded-full border border-red-200 dark:border-red-900 text-red-500 dark:text-red-400 text-xs">
        วงกลม = วันหยุดราชการ
      </span>
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────
export default function ScheduleTable() {
  const [schedules, setSchedules] = useState<ScheduleData[]>([])
  const [hydrated,  setHydrated]  = useState(false)
  const [selMonth,  setSelMonth]  = useState(1)
  const [selYear,   setSelYear]   = useState(2569)
  const [editing,   setEditing]   = useState(false)
  const [showPin,   setShowPin]   = useState(false)
  const [dark,      setDark]      = useState(false)
  const [contentKey, setContentKey] = useState(0)
  const [slideDir,   setSlideDir]   = useState<'left' | 'right'>('left')

  useEffect(() => {
    let alive = true
    fetchSchedules().then((loaded) => {
      if (!alive) return
      setSchedules(loaded)
      const last = loaded[loaded.length - 1]
      if (last) { setSelMonth(last.month); setSelYear(last.thaiYear) }
      const saved = localStorage.getItem(THEME_KEY)
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      const isDark = saved ? saved === 'dark' : prefersDark
      setDark(isDark)
      document.documentElement.classList.toggle('dark', isDark)
      setHydrated(true)
    })
    return () => { alive = false }
  }, [])

  function toggleDark() {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem(THEME_KEY, next ? 'dark' : 'light')
  }

  const existingIdx = schedules.findIndex(m => m.month === selMonth && m.thaiYear === selYear)
  const exists = existingIdx >= 0
  const template = schedules.length ? schedules[schedules.length - 1] : undefined
  const data = useMemo<ScheduleData>(
    () => exists ? schedules[existingIdx] : createEmptyMonth(selMonth, selYear, template),
    [exists, existingIdx, schedules, selMonth, selYear, template],
  )

  // save เฉพาะตอนแก้ไขเอง (เรียกจาก updateCurrent) — ไม่ผูกกับทุกการเปลี่ยน
  // state เพื่อตัด feedback loop กับ realtime
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  function scheduleSave(m: ScheduleData) {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => saveMonth(m), 600)
  }

  // realtime: ฟังการเปลี่ยนแปลงจาก Supabase แล้ว merge เข้า state
  // ข้ามเดือนที่กำลังแก้อยู่ เพื่อไม่ทับสิ่งที่พิมพ์ค้าง
  const liveRef = useRef({ editing, selMonth, selYear })
  liveRef.current = { editing, selMonth, selYear }
  useEffect(() => {
    if (!hydrated) return
    const unsub = subscribeSchedules((c) => {
      const live = liveRef.current
      if (live.editing && c.month === live.selMonth && c.thaiYear === live.selYear) return
      setSchedules(prev => {
        if (c.type === 'delete') {
          return prev.filter(m => !(m.month === c.month && m.thaiYear === c.thaiYear))
        }
        const i = prev.findIndex(m => m.month === c.month && m.thaiYear === c.thaiYear)
        if (i >= 0) return prev.map((m, idx) => idx === i ? c.data! : m)
        return [...prev, c.data!].sort(byDate)
      })
    })
    return unsub
  }, [hydrated])

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-[var(--md-background)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 anim-fade-up">
          <div className="w-8 h-8 rounded-full border-2 border-teal-600 border-t-transparent animate-spin" />
          <p className="text-sm text-gray-400">กำลังโหลด…</p>
        </div>
      </div>
    )
  }

  const { department, totalDays, weekendDays, staff } = data
  const days = Array.from({ length: totalDays }, (_, i) => i + 1)
  const mobileStaff = editing ? staff : staff.filter(m => m.name)

  const calOffset = (new Date(data.year, data.month - 1, 1).getDay() + 6) % 7
  const calEndPad = (calOffset + totalDays) % 7 === 0 ? 0 : 7 - ((calOffset + totalDays) % 7)

  function unlock(pin: string): boolean {
    if (pin !== EDIT_PIN) return false
    setEditing(true); sessionStorage.setItem(EDIT_KEY, '1'); setShowPin(false); return true
  }
  function lock() { setEditing(false); sessionStorage.removeItem(EDIT_KEY) }

  function updateCurrent(fn: (m: ScheduleData) => ScheduleData) {
    setSchedules(prev => {
      const i = prev.findIndex(m => m.month === selMonth && m.thaiYear === selYear)
      const next = i >= 0
        ? prev.map((m, idx) => idx === i ? fn(m) : m)
        : [...prev, fn(createEmptyMonth(selMonth, selYear, prev[prev.length - 1]))].sort(byDate)
      const saved = next.find(m => m.month === selMonth && m.thaiYear === selYear)
      if (saved) scheduleSave(saved)
      return next
    })
  }
  function cycleCell(si: number, di: number) {
    if (!editing) return
    updateCurrent(m => ({
      ...m,
      staff: m.staff.map((s, i) => i === si
        ? { ...s, shifts: s.shifts.map((sh, j) => j === di ? nextShift(sh) : sh) }
        : s),
    }))
  }
  function patchStaff(si: number, patch: Partial<StaffMember>) {
    updateCurrent(m => ({ ...m, staff: m.staff.map((s, i) => i === si ? { ...s, ...patch } : s) }))
  }
  function addStaff() {
    updateCurrent(m => ({ ...m, staff: [...m.staff, emptyStaff('nurse', m.totalDays)] }))
  }
  function removeStaff(si: number) {
    updateCurrent(m => ({ ...m, staff: m.staff.filter((_, i) => i !== si) }))
  }
  function toggleWeekend(day: number) {
    if (!editing) return
    updateCurrent(m => ({
      ...m,
      weekendDays: m.weekendDays.includes(day)
        ? m.weekendDays.filter(d => d !== day)
        : [...m.weekendDays, day].sort((a, b) => a - b),
    }))
  }
  function stepMonth(delta: number) {
    setSlideDir(delta > 0 ? 'left' : 'right')
    setContentKey(k => k + 1)
    let m = selMonth + delta, y = selYear
    if (m < 1) { m = 12; y -= 1 }
    if (m > 12) { m = 1;  y += 1 }
    setSelMonth(m); setSelYear(y)
  }
  function deleteMonth() {
    if (!exists) return
    if (!confirm(`ลบข้อมูลเดือน ${THAI_MONTHS[selMonth]} ${selYear}?`)) return
    removeMonth(selMonth, selYear)
    setSchedules(prev => prev.filter(m => !(m.month === selMonth && m.thaiYear === selYear)))
  }
  function doReset() {
    if (!confirm('รีเซ็ตข้อมูลทั้งหมดกลับเป็นค่าเริ่มต้น? (ลบทุกเดือนใน cloud)')) return
    resetAll().then(seed => {
      setSchedules(seed)
      const last = seed[seed.length - 1]
      if (last) { setSelMonth(last.month); setSelYear(last.thaiYear) }
    })
  }

  const slideClass = slideDir === 'left' ? 'anim-slide-left' : 'anim-slide-right'

  return (
    <div className="min-h-screen bg-[var(--md-background)] transition-colors duration-300 p-2 sm:p-4">
      <div className="max-w-full">

        {/* ── MD3 Top App Bar ── */}
        <div className="relative bg-[var(--md-surface)] md-elev-1 rounded-t-2xl px-4 py-6 sm:px-6 sm:py-7 transition-colors duration-300">

          {/* Contact page link — absolute, left */}
          <div className="absolute top-4 left-4 z-10">
            <Link
              href="/contact"
              title="ข้อมูลติดต่อ"
              className="md-state md-label-l inline-flex items-center gap-1 h-10 px-4 rounded-full bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-200 transition-all duration-200 active:scale-95"
            >
              📞 ติดต่อ
            </Link>
          </div>

          {/* Dark mode toggle — absolute so it doesn't affect centering */}
          <div className="absolute top-4 right-4 z-10">
            <ThemeSwitch dark={dark} onToggle={toggleDark} />
          </div>

          {/* Centered title block */}
          <div className="text-center">
            <div className="anim-header-1 flex items-center justify-center gap-2 mb-3">
              <span className="grid place-items-center w-9 h-9 rounded-full bg-[var(--md-primary-container)] text-teal-700 dark:text-teal-200 text-lg shadow-sm">🩻</span>
              <span className="md-title-m sm:md-title-l tracking-wide text-teal-700 dark:text-teal-300 font-semibold">ศูนย์รังสี</span>
            </div>
            <p className="anim-header-2 md-body-m text-[var(--md-on-surface-var)]">ตารางเวร ประจำเดือน</p>
            <h1 key={`${selMonth}-${selYear}`} className="anim-pop md-headline-s sm:md-headline-m text-teal-700 dark:text-teal-400 mt-2">
              {THAI_MONTHS[selMonth]} {selYear}
            </h1>
            {editing ? (
              <input
                className="anim-header-3 mt-2 md-body-m text-[var(--md-on-surface-var)] bg-transparent text-center border-b border-gray-300 dark:border-gray-600 focus:border-teal-500 focus:outline-none w-full max-w-xs px-1 py-0.5 transition-colors"
                value={department}
                onChange={e => updateCurrent(m => ({ ...m, department: e.target.value }))}
              />
            ) : (
              <p className="anim-header-3 md-body-m text-[var(--md-on-surface-var)] mt-2">{department}</p>
            )}
          </div>

          {/* Month nav */}
          <div className="anim-header-4 flex flex-wrap justify-center items-center gap-2 mt-5">
            <BtnIcon onClick={() => stepMonth(-1)}>‹</BtnIcon>

            <select
              value={selMonth}
              onChange={e => { setSlideDir('left'); setContentKey(k => k + 1); setSelMonth(Number(e.target.value)) }}
              className="md-label-l border border-gray-300 dark:border-gray-600 rounded-full h-10 px-4 text-[var(--md-on-surface)] bg-[var(--md-surface)] focus:outline-none focus:ring-2 focus:ring-teal-400 transition-colors"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>{THAI_MONTHS[m]}</option>
              ))}
            </select>

            <input
              type="number"
              value={selYear}
              onChange={e => { setSlideDir('left'); setContentKey(k => k + 1); setSelYear(Number(e.target.value)) }}
              className="md-label-l border border-gray-300 dark:border-gray-600 rounded-full h-10 px-3 text-[var(--md-on-surface)] bg-[var(--md-surface)] w-20 text-center focus:outline-none focus:ring-2 focus:ring-teal-400 transition-colors"
            />

            <BtnIcon onClick={() => stepMonth(1)}>›</BtnIcon>

            <div className="flex items-center gap-2 ml-1">
              {editing ? (
                <>
                  {exists && <BtnOutlined onClick={deleteMonth} danger>ลบเดือนนี้</BtnOutlined>}
                  <BtnOutlined onClick={doReset}>รีเซ็ต</BtnOutlined>
                  <BtnFilled onClick={lock}>🔒 ล็อก</BtnFilled>
                </>
              ) : (
                <BtnTonal onClick={() => setShowPin(true)}>✎ แก้ไข</BtnTonal>
              )}
            </div>
          </div>

          {editing && !exists && (
            <p className="md-body-s text-center text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 rounded-xl px-4 py-2 mt-3 max-w-md mx-auto">
              ยังไม่มีข้อมูลเดือนนี้ — คลิกช่องวันหรือเพิ่มคนเพื่อเริ่มสร้าง
            </p>
          )}
          {!editing && !exists && (
            <p className="md-body-s text-center text-[var(--md-on-surface-var)] mt-3">ยังไม่มีข้อมูลเดือนนี้</p>
          )}
          {editing && (
            <p className="md-body-s text-center text-[var(--md-on-surface-var)] mt-3">
              คลิกช่องวัน (วน: ว่าง → / → ✕ → S → บ/ด → สลับ) · คลิกเลขวันบน header = วันหยุด
            </p>
          )}

          <Legend />
        </div>

        {/* ── Content (animates on month change) ── */}
        <div key={contentKey} className={slideClass}>

          {/* Desktop table */}
          <div className="hidden md:block bg-[var(--md-surface)] md-elev-1 rounded-b-2xl overflow-x-auto transition-colors duration-300">
            <table className="text-xs border-collapse w-full" style={{ minWidth: '1100px' }}>
              <thead>
                <tr className="bg-gray-800 dark:bg-gray-950 text-white">
                  <th className="border border-gray-600 px-2 py-2 text-center w-8 sticky left-0 z-20 bg-gray-800 dark:bg-gray-950 font-medium">ลำดับ</th>
                  <th className="border border-gray-600 px-3 py-2 text-left w-28 sticky left-8 z-20 bg-gray-800 dark:bg-gray-950 font-medium">ชื่อ-นามสกุล</th>
                  {days.map(d => {
                    const isWeekend = weekendDays.includes(d)
                    const dayAbbr = DAY_ABBR[new Date(data.year, data.month - 1, d).getDay()]
                    return (
                      <th
                        key={d}
                        onClick={editing ? () => toggleWeekend(d) : undefined}
                        className={`border border-gray-600 w-7 py-1 text-center transition-colors ${isWeekend ? 'bg-red-800 dark:bg-red-950' : ''} ${editing ? 'cursor-pointer hover:bg-gray-700' : ''}`}
                      >
                        <div className="text-[8px] leading-none mb-0.5 opacity-70">{dayAbbr}</div>
                        <div className={isWeekend ? 'rounded-full border-2 border-white/80 w-5 h-5 flex items-center justify-center mx-auto text-xs' : ''}>
                          {d}
                        </div>
                      </th>
                    )
                  })}
                  <th className="border border-gray-600 px-1 py-2 text-center w-8 font-medium">ทำ</th>
                  <th className="border border-gray-600 px-1 py-2 text-center w-8 font-medium">OT</th>
                  <th className="border border-gray-600 px-1 py-2 text-center w-8 font-medium">เวร</th>
                  {editing && <th className="border border-gray-600 px-1 py-2 text-center w-8"></th>}
                </tr>
              </thead>
              <tbody>
                {staff.map((member, rowIdx) => {
                  if (!member.name && !editing) {
                    return (
                      <tr key={rowIdx} className="border-b dark:border-gray-700">
                        <td className="border border-gray-200 dark:border-gray-700 text-center text-gray-400 py-2 sticky left-0 z-10 bg-white dark:bg-gray-800">{rowIdx + 1}</td>
                        <td className="border border-gray-200 dark:border-gray-700 px-2 py-2 text-gray-300 dark:text-gray-600 italic text-xs sticky left-8 z-10 bg-white dark:bg-gray-800">-</td>
                        {days.map(d => <td key={d} className="border border-gray-100 dark:border-gray-700 text-center py-2" />)}
                        <td className="border border-gray-200 dark:border-gray-700" /><td className="border border-gray-200 dark:border-gray-700" /><td className="border border-gray-200 dark:border-gray-700" />
                      </tr>
                    )
                  }
                  const bg = ROLE_BG[member.role]
                  return (
                    <tr key={rowIdx} className={`border-b dark:border-gray-700 ${editing ? '' : 'hover:brightness-95 dark:hover:brightness-110 transition-all duration-150'} ${bg}`}>
                      <td className={`border border-gray-200 dark:border-gray-700 text-center text-gray-500 dark:text-gray-400 py-1.5 sticky left-0 z-10 ${bg}`}>{rowIdx + 1}</td>
                      <td className={`border border-gray-200 dark:border-gray-700 px-1 py-1.5 sticky left-8 z-10 ${bg} ${editing ? '' : 'font-medium text-[var(--md-on-surface)] whitespace-nowrap'}`}>
                        {editing ? (
                          <div className="flex flex-col gap-0.5">
                            <input className="border dark:border-gray-600 rounded-lg px-1 py-0.5 w-24 text-xs bg-white dark:bg-gray-700 dark:text-gray-200" value={member.name} placeholder="ชื่อ" onChange={e => patchStaff(rowIdx, { name: e.target.value })} />
                            <input className="border dark:border-gray-600 rounded-lg px-1 py-0.5 w-24 text-[10px] bg-white dark:bg-gray-700 dark:text-gray-200" value={member.phone ?? ''} placeholder="เบอร์โทร" onChange={e => patchStaff(rowIdx, { phone: e.target.value || undefined })} />
                            <select className="border dark:border-gray-600 rounded-lg px-1 py-0.5 w-24 text-[10px] text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-700" value={member.role} onChange={e => patchStaff(rowIdx, { role: e.target.value as StaffMember['role'] })}>
                              {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                            </select>
                          </div>
                        ) : member.phone ? (
                          <a href={telHref(member.phone)} title={`โทร ${member.phone}`} className="text-teal-700 dark:text-teal-300 hover:underline">{member.name}</a>
                        ) : member.name}
                      </td>
                      {member.shifts.map((shift, dayIdx) => {
                        const isWeekend = weekendDays.includes(dayIdx + 1)
                        return (
                          <td
                            key={dayIdx}
                            onClick={editing ? () => cycleCell(rowIdx, dayIdx) : undefined}
                            className={`border border-gray-200 dark:border-gray-700 text-center py-1.5 transition-colors duration-100 ${isWeekend ? 'bg-red-50 dark:bg-red-950/50' : ''} ${editing ? 'cursor-pointer hover:bg-teal-50 dark:hover:bg-teal-900/30 active:bg-teal-100 dark:active:bg-teal-900/50' : ''}`}
                          >
                            <span className={SHIFT_STYLE[shift]} title={SHIFT_LABELS[shift]}>
                              {SHIFT_DISPLAY[shift] || (editing ? '·' : '')}
                            </span>
                          </td>
                        )
                      })}
                      <td className="border border-gray-200 dark:border-gray-700 text-center font-medium text-[var(--md-on-surface)] py-1.5">{countWork(member) > 0 ? countWork(member) : ''}</td>
                      <td className="border border-gray-200 dark:border-gray-700 text-center font-medium text-teal-600 dark:text-teal-400 py-1.5">{member.totalOT ?? ''}</td>
                      <td className="border border-gray-200 dark:border-gray-700 text-center font-medium text-purple-600 dark:text-purple-400 py-1.5">{countNight(member) > 0 ? countNight(member) : ''}</td>
                      {editing && (
                        <td className="border border-gray-200 dark:border-gray-700 text-center">
                          <button onClick={() => removeStaff(rowIdx)} className="text-red-500 dark:text-red-400 text-xs px-1 hover:text-red-700 transition-colors">✕</button>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {editing && (
              <div className="p-4">
                <BtnOutlined onClick={addStaff}>+ เพิ่มแถว</BtnOutlined>
              </div>
            )}
          </div>

          {/* Mobile calendar cards */}
          <div className="md:hidden rounded-b-2xl space-y-4 pt-4">
            {mobileStaff.map((member, i) => {
              const realIdx = staff.indexOf(member)
              return (
                <div
                  key={i}
                  className="anim-fade-up rounded-2xl bg-[var(--md-surface)] md-elev-2 border border-gray-100 dark:border-gray-700/50 overflow-hidden transition-colors duration-300"
                  style={{ animationDelay: `${i * 55}ms` }}
                >
                  {/* Card header — 16dp padding */}
                  <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100 dark:border-gray-700/60">
                    {editing ? (
                      <div className="flex flex-wrap items-center gap-2 min-w-0">
                        <input className="md-body-m border dark:border-gray-600 rounded-xl px-3 py-1.5 w-28 bg-[var(--md-surface-variant)] dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-teal-400" value={member.name} placeholder="ชื่อ" onChange={e => patchStaff(realIdx, { name: e.target.value })} />
                        <input className="md-body-m border dark:border-gray-600 rounded-xl px-3 py-1.5 w-28 bg-[var(--md-surface-variant)] dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-teal-400" value={member.phone ?? ''} placeholder="เบอร์โทร" inputMode="tel" onChange={e => patchStaff(realIdx, { phone: e.target.value || undefined })} />
                        <select className="md-label-m border dark:border-gray-600 rounded-xl px-2 py-1.5 text-gray-500 dark:text-gray-400 bg-[var(--md-surface-variant)]" value={member.role} onChange={e => patchStaff(realIdx, { role: e.target.value as StaffMember['role'] })}>
                          {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                        </select>
                        <button onClick={() => removeStaff(realIdx)} className="text-red-400 hover:text-red-600 transition-colors w-8 h-8 flex items-center justify-center">✕</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 min-w-0">
                        {member.phone ? (
                          <a href={telHref(member.phone)} className="md-title-m text-teal-700 dark:text-teal-300 truncate flex items-center gap-1" title={`โทร ${member.phone}`}>
                            <span className="truncate">{member.name}</span>
                            <span className="text-sm shrink-0">📞</span>
                          </a>
                        ) : (
                          <span className="md-title-m text-[var(--md-on-surface)] truncate">{member.name}</span>
                        )}
                        <span className="md-label-m px-2.5 py-1 rounded-full bg-teal-50 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 shrink-0">{ROLE_LABEL[member.role]}</span>
                      </div>
                    )}
                    <div className="flex gap-3 shrink-0 ml-2">
                      <span className="md-body-s text-[var(--md-on-surface-var)]">ทำ <strong className="text-[var(--md-on-surface)]">{member.totalWork ?? (countWork(member) || '-')}</strong></span>
                      <span className="md-body-s text-teal-500 dark:text-teal-400">OT <strong>{member.totalOT ?? '-'}</strong></span>
                      <span className="md-body-s text-purple-500 dark:text-purple-400">เวร <strong>{member.totalNight ?? (countNight(member) || '-')}</strong></span>
                    </div>
                  </div>

                  {/* Calendar grid — 16dp padding, 8dp gap */}
                  <div className="p-4 bg-[var(--md-surface-variant)]/30">
                    <div className="grid grid-cols-7 gap-2 mb-2">
                      {['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'].map((d, ci) => (
                        <div key={d} className={`md-label-s text-center py-1 ${ci >= 5 ? 'text-red-400 dark:text-red-500' : 'text-[var(--md-on-surface-var)]'}`}>{d}</div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-2">
                      {Array.from({ length: calOffset }, (_, i) => (
                        <div key={`s${i}`} className={`rounded-2xl min-h-[56px] ${i >= 5 ? 'bg-red-50/60 dark:bg-red-950/20' : ''}`} />
                      ))}
                      {member.shifts.map((shift, dayIdx) => {
                        const day = dayIdx + 1
                        const colIdx = (calOffset + dayIdx) % 7
                        const isWeekendCol = colIdx >= 5
                        const isHoliday = weekendDays.includes(day) && !isWeekendCol
                        const isRed = isWeekendCol || isHoliday
                        return (
                          <div
                            key={dayIdx}
                            onMouseDown={editing ? addRipple : undefined}
                            onClick={editing ? () => cycleCell(realIdx, dayIdx) : undefined}
                            className={`md-state flex flex-col items-center justify-between rounded-2xl border py-2 min-h-[56px] transition-all duration-150 ${
                              isRed
                                ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900/60'
                                : 'bg-[var(--md-surface)] border-gray-100 dark:border-gray-700/50'
                            } ${editing ? 'cursor-pointer active:scale-95' : ''}`}
                          >
                            <span className={`md-label-l leading-none ${isRed ? 'text-red-600 dark:text-red-400' : 'text-[var(--md-on-surface)]'}`}>{day}</span>
                            <span className={`md-body-l leading-none flex items-center justify-center h-5 ${SHIFT_STYLE[shift]}`} title={SHIFT_LABELS[shift]}>
                              {SHIFT_DISPLAY[shift] || (editing ? '·' : '')}
                            </span>
                          </div>
                        )
                      })}
                      {Array.from({ length: calEndPad }, (_, i) => {
                        const colIdx = (calOffset + totalDays + i) % 7
                        return <div key={`e${i}`} className={`rounded-2xl min-h-[56px] ${colIdx >= 5 ? 'bg-red-50/60 dark:bg-red-950/20' : ''}`} />
                      })}
                    </div>
                  </div>
                </div>
              )
            })}
            {editing && (
              <div className="pt-1 pb-4">
                <BtnOutlined onClick={addStaff} className="w-full justify-center">+ เพิ่มคน</BtnOutlined>
              </div>
            )}
          </div>

        </div>{/* end contentKey wrapper */}

        {/* Footer */}
        <div className="anim-fade-up bg-[var(--md-surface)] md-elev-1 mt-4 rounded-2xl px-4 py-4 sm:px-6 sm:py-5 md-body-s text-[var(--md-on-surface-var)] space-y-1.5 transition-colors duration-300">
          <p>หมายเหตุ: S = standby</p>
          <p>เงินเวรพยาบาล 1,200/เวร</p>
          <p>เงินเวรนักเทคโนหัวใจ 1,600/เวร เวรละ 200 บาท</p>
        </div>
      </div>

      {showPin && <PinModal onCancel={() => setShowPin(false)} onSubmit={unlock} />}
    </div>
  )
}

// ── PIN Modal ────────────────────────────────────────────────────
function PinModal({ onCancel, onSubmit }: { onCancel: () => void; onSubmit: (pin: string) => boolean }) {
  const [pin, setPin] = useState('')
  const [err, setErr] = useState(false)
  function submit() { if (!onSubmit(pin)) setErr(true) }

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-sm" onClick={onCancel}>
      <div
        className="anim-scale-in bg-[var(--md-surface)] md-elev-3 rounded-3xl p-6 w-full max-w-xs transition-colors"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="font-medium text-lg text-[var(--md-on-surface)] mb-1">ใส่ PIN เพื่อแก้ไข</h3>
        <p className="text-xs text-[var(--md-on-surface-var)] mb-4">โหมดแก้ไขต้องใช้ PIN</p>
        <input
          type="password"
          inputMode="numeric"
          autoFocus
          value={pin}
          onChange={e => { setPin(e.target.value); setErr(false) }}
          onKeyDown={e => e.key === 'Enter' && submit()}
          className={`border rounded-xl px-4 py-3 w-full text-center tracking-widest text-lg bg-[var(--md-surface-variant)] dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all ${err ? 'border-red-400 ring-1 ring-red-400' : 'border-gray-300 dark:border-gray-600'}`}
          placeholder="••••••••"
        />
        {err && <p className="text-xs text-red-500 dark:text-red-400 mt-1.5">PIN ไม่ถูกต้อง</p>}
        <div className="flex justify-end gap-2 mt-5">
          <BtnOutlined onClick={onCancel}>ยกเลิก</BtnOutlined>
          <BtnFilled onClick={submit}>ปลดล็อก</BtnFilled>
        </div>
      </div>
    </div>
  )
}
