'use client'

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
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
const ME_KEY = 'inr-schedule:me'

// ── Shift styling (MD3 color-aware) ─────────────────────────────
const SHIFT_STYLE: Record<ShiftCode, string> = {
  M:    'text-blue-600 dark:text-blue-400 font-medium',
  A:    'text-red-600 dark:text-red-400 font-bold text-lg leading-none',
  N:    'text-purple-600 dark:text-purple-400 font-medium',
  N2:   'text-purple-600 dark:text-purple-400 font-medium',
  OFF:  'text-gray-600 dark:text-gray-300 font-medium text-xs',
  SWAP: 'text-orange-500 dark:text-orange-400 text-xs',
  '-':  'text-gray-300 dark:text-gray-600',
}

const SHIFT_DISPLAY: Record<ShiftCode, string> = {
  M: '/', A: '✕', N: 'S', N2: 'S', OFF: 'บ/ด', SWAP: 'สลับ', '-': '',
}

const DAY_ABBR = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']

// พื้นหลังแถวตามตำแหน่ง — dark mode ใช้สีทึบ (ไม่ใช่ /40) เพื่อให้ช่อง
// sticky ซ้าย (ลำดับ/ชื่อ) ไม่โปร่งจนช่องวันลอดทะลุตอน scroll แนวนอน
const ROLE_BG: Record<string, string> = {
  doctor: 'bg-blue-50 dark:bg-[#1c2440]',
  nurse:  'bg-white dark:bg-gray-800',
  tech:   'bg-green-50 dark:bg-[#142827]',
}

const ROLE_LABEL: Record<string, string> = {
  doctor: 'แพทย์', nurse: 'พยาบาล', tech: 'นักเทคโน',
}

const ROLES: StaffMember['role'][] = ['doctor', 'nurse', 'tech']

function telHref(phone: string) { return `tel:${phone.replace(/[^0-9+]/g, '')}` }
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
        { sym: 'บ/ด', symCls: 'text-gray-600 dark:text-gray-300 font-medium text-xs', label: 'เวรบ่ายดึก' },
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

// ── Shared shift helpers (Today / Week views) ────────────────────
const THAI_DAY_FULL = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์']
const WORKING: ShiftCode[] = ['M', 'N', 'N2', 'OFF', 'SWAP']
const isWorking = (s: ShiftCode) => WORKING.includes(s)

// นับเวรของคนหนึ่งในเดือน — สำหรับสรุป "เวรของฉัน"
function shiftCounts(m: StaffMember) {
  let M = 0, S = 0, OFF = 0, SWAP = 0
  for (const s of m.shifts) {
    if (s === 'M') M++
    else if (s === 'N' || s === 'N2') S++
    else if (s === 'OFF') OFF++
    else if (s === 'SWAP') SWAP++
  }
  return { M, S, OFF, SWAP }
}
const COUNT_LABELS: { key: 'M' | 'S' | 'OFF' | 'SWAP'; label: string }[] = [
  { key: 'M', label: 'แพทย์เวร' }, { key: 'OFF', label: 'บ/ด' }, { key: 'S', label: 'standby' }, { key: 'SWAP', label: 'สลับ' },
]

// เงินเวร = จำนวน บ/ด (OFF) × อัตราตามตำแหน่ง (แพทย์ไม่คิด)
const PAY_RATE: Record<string, number> = { nurse: 1200, tech: 1600, doctor: 0 }

// ── วันหยุดราชการไทย (auto) — key: "เดือน-วัน" (เดือนแบบ 1-12) ──────
// แสดงผลอย่างเดียว ไม่แตะ weekendDays ที่บันทึกไว้
const THAI_HOLIDAYS: Record<number, Record<string, string>> = {
  2026: {
    '1-1': 'วันขึ้นปีใหม่',
    '3-3': 'วันมาฆบูชา',
    '4-6': 'วันจักรี',
    '4-13': 'วันสงกรานต์', '4-14': 'วันสงกรานต์', '4-15': 'วันสงกรานต์',
    '5-1': 'วันแรงงานแห่งชาติ',
    '5-4': 'วันฉัตรมงคล',
    '5-13': 'วันพืชมงคล',
    '5-31': 'วันวิสาขบูชา',
    '6-1': 'ชดเชยวันวิสาขบูชา',
    '6-3': 'วันเฉลิมพระชนมพรรษาสมเด็จพระบรมราชินี',
    '7-28': 'วันเฉลิมพระชนมพรรษา ร.10',
    '7-29': 'วันอาสาฬหบูชา',
    '7-30': 'วันเข้าพรรษา',
    '8-12': 'วันแม่แห่งชาติ',
    '10-13': 'วันนวมินทรมหาราช',
    '10-23': 'วันปิยมหาราช',
    '12-5': 'วันพ่อแห่งชาติ',
    '12-7': 'ชดเชยวันพ่อแห่งชาติ',
    '12-10': 'วันรัฐธรรมนูญ',
    '12-31': 'วันสิ้นปี',
  },
  // 2570 (2027) — ใส่เฉพาะวันที่ตายตัว (วันพระจันทรคติเลื่อน ต้องเพิ่มภายหลัง)
  2027: {
    '1-1': 'วันขึ้นปีใหม่',
    '4-6': 'วันจักรี',
    '4-13': 'วันสงกรานต์', '4-14': 'วันสงกรานต์', '4-15': 'วันสงกรานต์',
    '5-1': 'วันแรงงานแห่งชาติ',
    '5-4': 'วันฉัตรมงคล',
    '7-28': 'วันเฉลิมพระชนมพรรษา ร.10',
    '8-12': 'วันแม่แห่งชาติ',
    '10-13': 'วันนวมินทรมหาราช',
    '10-23': 'วันปิยมหาราช',
    '12-5': 'วันพ่อแห่งชาติ',
    '12-10': 'วันรัฐธรรมนูญ',
    '12-31': 'วันสิ้นปี',
  },
}

// คืน map { วันที่: ชื่อวันหยุด } ของเดือนนั้น (gregYear = ค.ศ.)
function holidaysOf(month: number, gregYear: number): Record<number, string> {
  const y = THAI_HOLIDAYS[gregYear]
  if (!y) return {}
  const out: Record<number, string> = {}
  for (const [k, name] of Object.entries(y)) {
    const [mo, d] = k.split('-').map(Number)
    if (mo === month) out[d] = name
  }
  return out
}

// กลุ่มเวรที่ "ทำงานวันนี้" เรียงตามความสำคัญ
const DUTY_GROUPS: { label: string; sym: string; match: (s: ShiftCode) => boolean; dot: string; accent: string }[] = [
  { label: 'แพทย์เวร',  sym: '/',    match: s => s === 'M',                dot: 'bg-blue-500',   accent: 'border-l-blue-400 dark:border-l-blue-500' },
  { label: 'Standby',   sym: 'S',    match: s => s === 'N' || s === 'N2',  dot: 'bg-purple-500', accent: 'border-l-purple-400 dark:border-l-purple-500' },
  { label: 'เวรบ่ายดึก', sym: 'บ/ด', match: s => s === 'OFF',              dot: 'bg-gray-400',   accent: 'border-l-gray-400 dark:border-l-gray-500' },
  { label: 'สลับเวร',   sym: 'สลับ', match: s => s === 'SWAP',             dot: 'bg-orange-500', accent: 'border-l-orange-400 dark:border-l-orange-500' },
]

// การ์ดชื่อคน — ชื่อ + ตำแหน่ง + ปุ่มโทร, มีแถบสีกลุ่มด้านซ้าย
function PersonCard({ m, accent, isMe = false }: { m: StaffMember; accent: string; isMe?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-2 pl-3 pr-2 py-2.5 rounded-xl border border-l-4 border-gray-100 dark:border-gray-700/50 bg-[var(--md-surface)] ${accent} ${isMe ? 'ring-2 ring-teal-400 dark:ring-teal-500' : ''}`}>
      <div className="min-w-0">
        <p className="md-body-m font-medium text-[var(--md-on-surface)] truncate flex items-center gap-1.5">
          <span className="truncate">{m.name}</span>
          {isMe && <span className="md-label-s px-1.5 py-0.5 rounded-full bg-teal-600 text-white shrink-0">ฉัน</span>}
        </p>
        <p className="md-label-s text-[var(--md-on-surface-var)]">{ROLE_LABEL[m.role]}</p>
      </div>
      {m.phone && (
        <a href={telHref(m.phone)} title={`โทร ${m.phone}`} className="shrink-0 grid place-items-center w-9 h-9 rounded-full bg-teal-50 dark:bg-teal-900/40 text-teal-600 dark:text-teal-300 text-sm active:scale-90 transition-transform">📞</a>
      )}
    </div>
  )
}

// ── Today View — "who's on duty" board ───────────────────────────
function TodayView({ schedules, meName }: { schedules: ScheduleData[]; meName: string | null }) {
  const today = new Date()
  const month = today.getMonth() + 1
  const thaiYear = today.getFullYear() + 543
  const dayIdx = today.getDate() - 1
  const data = schedules.find(m => m.month === month && m.thaiYear === thaiYear)
  const holName = holidaysOf(month, today.getFullYear())[today.getDate()]
  const isWeekendToday = data ? data.weekendDays.includes(today.getDate()) : (today.getDay() === 0 || today.getDay() === 6)
  const isHoliday = !!holName || isWeekendToday

  const named = data?.staff.filter(m => m.name) ?? []
  const shiftOf = (m: StaffMember): ShiftCode => m.shifts[dayIdx] ?? '-'
  const offToday = named.filter(m => !isWorking(shiftOf(m)))
  const anyWorking = named.some(m => isWorking(shiftOf(m)))

  // "เวรของฉัน"
  const me = meName ? named.find(m => m.name === meName) : undefined
  const myShift = me ? shiftOf(me) : '-'
  const myCounts = me ? shiftCounts(me) : null

  return (
    <div className="bg-[var(--md-surface)] md-elev-1 rounded-b-2xl p-4 sm:p-6 space-y-4">
      {/* Date hero */}
      <div className={`rounded-2xl px-5 py-5 text-center ${isHoliday ? 'bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50' : 'bg-teal-50 dark:bg-teal-950/30 border border-teal-100 dark:border-teal-900/50'}`}>
        <p className={`md-label-l ${isHoliday ? 'text-red-500 dark:text-red-400' : 'text-teal-600 dark:text-teal-400'}`}>
          วัน{THAI_DAY_FULL[today.getDay()]}{holName ? ` · ${holName}` : isWeekendToday ? ' · วันหยุด' : ''}
        </p>
        <p className={`md-headline-m font-medium mt-0.5 ${isHoliday ? 'text-red-600 dark:text-red-400' : 'text-teal-700 dark:text-teal-300'}`}>
          {today.getDate()} {THAI_MONTHS[month]} {thaiYear}
        </p>
      </div>

      {/* เวรของฉัน */}
      {me && (
        <div className="anim-fade-up rounded-2xl border-2 border-teal-300 dark:border-teal-700 bg-teal-50/60 dark:bg-teal-950/40 px-4 py-3.5">
          <div className="flex items-center justify-between gap-2">
            <span className="md-title-s text-teal-700 dark:text-teal-300 flex items-center gap-1.5 min-w-0">
              <span className="shrink-0">👤</span><span className="truncate">{me.name}</span>
            </span>
            <span className={`md-label-l shrink-0 px-3 py-1 rounded-full font-medium ${isWorking(myShift) ? 'bg-teal-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
              {isWorking(myShift) ? `${SHIFT_DISPLAY[myShift]} ${SHIFT_LABELS[myShift]}` : myShift === 'A' ? 'ไม่อยู่เวร' : 'ไม่มีเวร'}
            </span>
          </div>
          {myCounts && (
            <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
              <span className="md-label-s text-[var(--md-on-surface-var)]">เดือนนี้:</span>
              {COUNT_LABELS.filter(c => myCounts[c.key] > 0).map(c => (
                <span key={c.key} className="md-label-s px-2 py-0.5 rounded-full bg-white/70 dark:bg-gray-800 text-[var(--md-on-surface)] border border-teal-100 dark:border-teal-900">
                  {c.label} <strong className="text-teal-700 dark:text-teal-300">{myCounts[c.key]}</strong>
                </span>
              ))}
              {COUNT_LABELS.every(c => myCounts[c.key] === 0) && (
                <span className="md-label-s text-[var(--md-on-surface-var)]">ยังไม่มีเวร</span>
              )}
            </div>
          )}
        </div>
      )}

      {!data ? (
        <p className="text-center text-[var(--md-on-surface-var)] py-6">ไม่มีข้อมูลเดือนนี้</p>
      ) : !anyWorking ? (
        <p className="text-center text-[var(--md-on-surface-var)] py-6">ยังไม่มีเวรวันนี้</p>
      ) : (
        DUTY_GROUPS.map(g => {
          const people = named.filter(m => g.match(shiftOf(m)))
          if (!people.length) return null
          return (
            <section key={g.label} className="anim-fade-up">
              <div className="flex items-center gap-2 mb-2.5">
                <span className={`grid place-items-center w-7 h-7 rounded-full text-white text-xs font-bold shrink-0 ${g.dot}`}>{g.sym}</span>
                <span className="md-title-s text-[var(--md-on-surface)]">{g.label}</span>
                <span className="md-label-m px-2 py-0.5 rounded-full bg-[var(--md-surface-variant)] text-[var(--md-on-surface-var)]">{people.length}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {people.map((m, i) => <PersonCard key={i} m={m} accent={g.accent} isMe={!!meName && m.name === meName} />)}
              </div>
            </section>
          )
        })
      )}

      {/* Off today — muted chips */}
      {data && offToday.length > 0 && (
        <details className="group">
          <summary className="md-label-m text-[var(--md-on-surface-var)] cursor-pointer select-none list-none flex items-center gap-1 pt-1">
            <span className="transition-transform group-open:rotate-90">›</span>
            ไม่อยู่เวรวันนี้ ({offToday.length})
          </summary>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {offToday.map((m, i) => (
              <span key={i} className={`md-label-s px-2.5 py-1 rounded-full ${m.name === meName ? 'bg-teal-100 dark:bg-teal-900/60 text-teal-700 dark:text-teal-300 ring-1 ring-teal-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500'}`}>{m.name}{m.name === meName ? ' (ฉัน)' : ''}</span>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

// ── Week View — matrix (desktop) + day cards (mobile) ────────────
function WeekView({ schedules, meName }: { schedules: ScheduleData[]; meName: string | null }) {
  const today = new Date()
  const monday = new Date(today)
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7))
  const weekDays = Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d })

  const dataFor = (d: Date) => schedules.find(m => m.month === d.getMonth() + 1 && m.thaiYear === d.getFullYear() + 543)
  const refData = dataFor(today) ?? dataFor(weekDays[0]) ?? dataFor(weekDays[6])
  const members = refData?.staff.filter(m => m.name) ?? []

  const cols = weekDays.map(d => {
    const dd = dataFor(d)
    const holName = holidaysOf(d.getMonth() + 1, d.getFullYear())[d.getDate()]
    const isWeekendRaw = dd ? dd.weekendDays.includes(d.getDate()) : (d.getDay() === 0 || d.getDay() === 6)
    return {
      d,
      dd,
      holName,
      isToday: d.toDateString() === today.toDateString(),
      isWeekend: isWeekendRaw || !!holName, // ใช้คุมสีแดง (รวมวันหยุดราชการ)
    }
  })

  return (
    <div className="bg-[var(--md-surface)] md-elev-1 rounded-b-2xl">
      {/* Desktop matrix */}
      <div className="hidden md:block overflow-x-auto">
        <table className="text-sm border-collapse w-full" style={{ minWidth: '480px' }}>
          <thead>
            <tr className="bg-gray-800 dark:bg-gray-950 text-white">
              <th className="border border-gray-600 px-2 py-2 text-left sticky left-0 z-20 bg-gray-800 dark:bg-gray-950 w-28 font-medium">ชื่อ-นามสกุล</th>
              {cols.map(({ d, isToday, isWeekend, holName }) => (
                <th key={d.toISOString()} title={holName} className={`border border-gray-600 w-12 py-1 text-center ${isToday ? 'bg-teal-700 dark:bg-teal-800' : isWeekend ? 'bg-red-800 dark:bg-red-950' : ''}`}>
                  <div className="md-label-s leading-none mb-0.5 opacity-70">{DAY_ABBR[d.getDay()]}</div>
                  <div className={isToday ? 'rounded-full border-2 border-white/80 w-6 h-6 flex items-center justify-center mx-auto' : ''}>{d.getDate()}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROLES.map(role => {
              const rows = members.filter(m => m.role === role)
              if (!rows.length) return null
              return (
                <Fragment key={role}>
                  <tr>
                    <td colSpan={8} className="bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-0">
                      <div className="sticky left-0 w-max px-2 py-1 md-label-m font-semibold text-[var(--md-on-surface-var)]">
                        {ROLE_LABEL[role]} <span className="font-normal opacity-60">({rows.length})</span>
                      </div>
                    </td>
                  </tr>
                  {rows.map((member, ri) => {
                    const isMe = !!meName && member.name === meName
                    const bg = isMe ? 'bg-teal-100 dark:bg-teal-900' : ROLE_BG[member.role]
                    const meEdge = isMe ? 'border-y-2 border-y-teal-500 dark:border-y-teal-400' : ''
                    return (
                      <tr key={`${member.name}-${ri}`} className={`border-b dark:border-gray-700 ${bg}`}>
                        <td className={`border border-gray-200 dark:border-gray-700 px-2 py-1.5 sticky left-0 z-10 font-medium whitespace-nowrap ${bg} ${meEdge} ${isMe ? 'border-l-4 border-l-teal-500 dark:border-l-teal-400 text-teal-700 dark:text-teal-200 font-bold' : 'text-[var(--md-on-surface)]'}`}>
                          {member.phone ? <a href={telHref(member.phone)} className="text-teal-700 dark:text-teal-300 hover:underline">{member.name}</a> : member.name}
                          {isMe && <span className="ml-1 md-label-s px-1.5 py-0.5 rounded-full bg-teal-600 text-white">ฉัน</span>}
                        </td>
                        {cols.map(({ d, dd, isWeekend, isToday }) => {
                          const staffInDay = dd?.staff.find(s => s.name === member.name)
                          const shift: ShiftCode = staffInDay?.shifts[d.getDate() - 1] ?? '-'
                          return (
                            <td key={d.toISOString()} className={`border border-gray-200 dark:border-gray-700 text-center py-1.5 ${meEdge} ${isMe ? bg : isWeekend ? 'bg-red-50 dark:bg-red-950/50' : ''} ${isToday ? 'ring-1 ring-inset ring-teal-400 dark:ring-teal-600' : ''}`}>
                              <span className={SHIFT_STYLE[shift]}>{SHIFT_DISPLAY[shift]}</span>
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile day cards */}
      <div className="md:hidden p-3 space-y-3">
        {cols.map(({ d, dd, isToday, isWeekend, holName }, ci) => {
          const dayStaff = dd?.staff.filter(m => m.name && isWorking(m.shifts[d.getDate() - 1] ?? '-')) ?? []
          return (
            <div
              key={d.toISOString()}
              className={`anim-fade-up rounded-2xl border ${isToday ? 'border-teal-300 dark:border-teal-700 ring-1 ring-teal-300 dark:ring-teal-700' : 'border-gray-100 dark:border-gray-700/50'}`}
              style={{ animationDelay: `${ci * 45}ms` }}
            >
              <div className={`sticky top-0 z-10 flex items-center justify-between px-4 py-2.5 rounded-t-2xl shadow-sm backdrop-blur ${isToday ? 'bg-teal-100/90 dark:bg-teal-950/85' : isWeekend ? 'bg-red-100/90 dark:bg-red-950/80' : 'bg-[var(--md-surface-variant)]'}`}>
                <div className="min-w-0">
                  <span className={`md-title-s ${isToday ? 'text-teal-700 dark:text-teal-300' : isWeekend ? 'text-red-600 dark:text-red-400' : 'text-[var(--md-on-surface)]'}`}>
                    {THAI_DAY_FULL[d.getDay()]} {d.getDate()} {THAI_MONTHS[d.getMonth() + 1]} {d.getFullYear() + 543}
                  </span>
                  {holName && <span className="block md-label-s text-red-500 dark:text-red-400">🔴 {holName}</span>}
                </div>
                {isToday && <span className="md-label-s px-2 py-0.5 rounded-full bg-teal-600 text-white shrink-0">วันนี้</span>}
              </div>
              <div className="px-4 py-3">
                {dayStaff.length === 0 ? (
                  <p className="md-body-s text-[var(--md-on-surface-var)]">— ไม่มีเวร</p>
                ) : (
                  <div className="space-y-1.5">
                    {dayStaff.map((m, i) => {
                      const shift: ShiftCode = m.shifts[d.getDate() - 1] ?? '-'
                      const isMe = !!meName && m.name === meName
                      return (
                        <div key={i} className={`flex items-center justify-between gap-2 ${isMe ? '-mx-1 px-1 rounded-lg bg-teal-50 dark:bg-teal-950/50' : ''}`}>
                          <span className={`md-body-m truncate flex items-center gap-1 ${isMe ? 'font-semibold text-teal-700 dark:text-teal-300' : 'text-[var(--md-on-surface)]'}`}>
                            <span className="truncate">{m.name}</span>
                            {isMe && <span className="md-label-s px-1 rounded bg-teal-600 text-white shrink-0">ฉัน</span>}
                          </span>
                          <span className={`md-label-s shrink-0 px-2 py-0.5 rounded-full ${SHIFT_STYLE[shift]}`} title={SHIFT_LABELS[shift]}>
                            {SHIFT_DISPLAY[shift]} {SHIFT_LABELS[shift]}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Month Summary — จำนวนเวร + เงินเวร ────────────────────────────
function MonthSummary({ data }: { data: ScheduleData }) {
  const rows = data.staff.filter(m => m.name).map(m => {
    const c = shiftCounts(m)
    const rate = PAY_RATE[m.role] ?? 0
    return { m, c, pay: c.OFF * rate }
  })
  const total = rows.reduce((s, r) => s + r.pay, 0)
  const fmt = (n: number) => n.toLocaleString('th-TH')
  if (!rows.length) return null
  return (
    <div className="bg-[var(--md-surface)] md-elev-1 rounded-2xl mt-4 p-4 sm:p-6 transition-colors duration-300">
      <details className="group">
        <summary className="cursor-pointer select-none list-none flex items-center justify-between gap-2">
          <span className="md-title-m text-[var(--md-on-surface)]">💰 สรุปเวร &amp; เงินเวรเดือนนี้</span>
          <span className="flex items-center gap-3 shrink-0">
            <span className="md-label-m text-teal-700 dark:text-teal-300 font-medium">รวม ฿{fmt(total)}</span>
            <span className="text-[var(--md-on-surface-var)] transition-transform group-open:rotate-90">›</span>
          </span>
        </summary>
      <div className="overflow-x-auto mt-4">
        <table className="w-full text-sm border-collapse" style={{ minWidth: '460px' }}>
          <thead>
            <tr className="md-label-m text-[var(--md-on-surface-var)] border-b border-gray-200 dark:border-gray-700">
              <th className="text-left font-medium py-2 px-2">ชื่อ-นามสกุล</th>
              <th className="text-center font-medium py-2 px-2">ตำแหน่ง</th>
              <th className="text-center font-medium py-2 px-2">บ/ด</th>
              <th className="text-center font-medium py-2 px-2">standby</th>
              <th className="text-center font-medium py-2 px-2">แพทย์เวร</th>
              <th className="text-right font-medium py-2 px-2">เงินเวร</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ m, c, pay }, i) => (
              <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                <td className="py-2 px-2 text-[var(--md-on-surface)] whitespace-nowrap">{m.name}</td>
                <td className="py-2 px-2 text-center text-[var(--md-on-surface-var)]">{ROLE_LABEL[m.role]}</td>
                <td className="py-2 px-2 text-center font-medium text-[var(--md-on-surface)]">{c.OFF || '—'}</td>
                <td className="py-2 px-2 text-center text-[var(--md-on-surface-var)]">{c.S || '—'}</td>
                <td className="py-2 px-2 text-center text-[var(--md-on-surface-var)]">{c.M || '—'}</td>
                <td className="py-2 px-2 text-right font-medium text-teal-700 dark:text-teal-300">{pay > 0 ? `฿${fmt(pay)}` : '—'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300 dark:border-gray-600">
              <td colSpan={5} className="py-2 px-2 text-right font-medium text-[var(--md-on-surface)]">รวมเงินเวรทั้งเดือน</td>
              <td className="py-2 px-2 text-right font-bold text-teal-700 dark:text-teal-300">฿{fmt(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="md-label-s text-[var(--md-on-surface-var)] mt-3">
        เงินเวร = จำนวน บ/ด × อัตรา (พยาบาล ฿1,200 · นักเทคโน ฿1,600 ต่อเวร · แพทย์ไม่คิด)
      </p>
      </details>
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────
export default function ScheduleTable() {
  const _today = useMemo(() => new Date(), [])
  const [schedules, setSchedules] = useState<ScheduleData[]>([])
  const [hydrated,  setHydrated]  = useState(false)
  const [view,      setView]      = useState<'today' | 'week' | 'month'>('today')
  const [selMonth,  setSelMonth]  = useState(() => _today.getMonth() + 1)
  const [selYear,   setSelYear]   = useState(() => _today.getFullYear() + 543)
  const [editing,   setEditing]   = useState(false)
  const [showPin,   setShowPin]   = useState(false)
  const [dark,      setDark]      = useState(false)
  const [meName,    setMeName]    = useState<string | null>(null)
  const [contentKey, setContentKey] = useState(0)
  const [slideDir,   setSlideDir]   = useState<'left' | 'right'>('left')

  function setMe(name: string | null) {
    setMeName(name)
    if (name) localStorage.setItem(ME_KEY, name)
    else localStorage.removeItem(ME_KEY)
  }

  function switchView(v: 'today' | 'week' | 'month') {
    if (v !== 'month') {
      setEditing(false); sessionStorage.removeItem(EDIT_KEY)
      // กลับมาเดือนปัจจุบันให้ตรงกับสิ่งที่ today/week แสดง
      const now = new Date()
      setSelMonth(now.getMonth() + 1); setSelYear(now.getFullYear() + 543)
    }
    setView(v)
  }

  useEffect(() => {
    let alive = true
    fetchSchedules().then((loaded) => {
      if (!alive) return
      setSchedules(loaded)
      const saved = localStorage.getItem(THEME_KEY)
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      const isDark = saved ? saved === 'dark' : prefersDark
      setDark(isDark)
      document.documentElement.classList.toggle('dark', isDark)
      setMeName(localStorage.getItem(ME_KEY))
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

  // รายชื่อทั้งหมด (unique) สำหรับ picker "เวรของฉัน"
  const allNames = useMemo(() => {
    const seen = new Set<string>()
    const out: string[] = []
    for (const m of schedules.flatMap(s => s.staff)) {
      if (m.name && !seen.has(m.name)) { seen.add(m.name); out.push(m.name) }
    }
    return out
  }, [schedules])

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
  const holidays = holidaysOf(data.month, data.year) // วันหยุดราชการ (auto)

  // จัดกลุ่มแถวตาม role (คง index จริงไว้สำหรับ edit) + เลขลำดับเรียงต่อเนื่อง
  const roleGroups = (() => {
    let counter = 0
    return ROLES.map(role => ({
      role,
      rows: staff
        .map((member, rowIdx) => ({ member, rowIdx }))
        .filter(({ member }) => member.role === role && (member.name || editing))
        .map(r => ({ ...r, no: ++counter })),
    })).filter(g => g.rows.length > 0)
  })()
  const monthColSpan = 2 + days.length + (editing ? 1 : 0)

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
      <div className="max-w-4xl mx-auto">

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
            {view === 'month' ? (
              <>
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
              </>
            ) : (
              <>
                <h1 key={view} className="anim-pop md-headline-s sm:md-headline-m text-teal-700 dark:text-teal-400">
                  ตารางเวร{view === 'today' ? 'วันนี้' : 'สัปดาห์นี้'}
                </h1>
                <p className="anim-header-3 md-body-m text-[var(--md-on-surface-var)] mt-2">{department}</p>
              </>
            )}
          </div>

          {/* View tabs — segmented control */}
          <div className="anim-header-4 flex justify-center mt-5">
            <div className="flex w-full max-w-sm gap-1 p-1 rounded-full bg-[var(--md-surface-variant)] dark:bg-gray-800">
              {([['today', 'วันนี้'], ['week', 'สัปดาห์นี้'], ['month', 'เดือนนี้']] as const).map(([v, label]) => (
                <button
                  key={v}
                  style={{ touchAction: 'manipulation' }}
                  onClick={() => switchView(v)}
                  className={`md-label-l flex-1 py-2.5 rounded-full transition-all duration-200 active:scale-95 ${view === v ? 'bg-teal-600 dark:bg-teal-700 text-white shadow-sm' : 'text-[var(--md-on-surface-var)]'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* เวรของฉัน — เลือกชื่อตัวเอง */}
          <div className="flex justify-center items-center gap-2 mt-3">
            <div className="relative inline-flex items-center">
              <span className="absolute left-3 pointer-events-none text-sm">👤</span>
              <select
                value={meName ?? ''}
                onChange={e => setMe(e.target.value || null)}
                className={`md-label-m appearance-none h-9 pl-9 pr-8 rounded-full border bg-[var(--md-surface)] focus:outline-none focus:ring-2 focus:ring-teal-400 transition-colors ${meName ? 'border-teal-400 dark:border-teal-600 text-teal-700 dark:text-teal-300 font-medium' : 'border-gray-300 dark:border-gray-600 text-[var(--md-on-surface-var)]'}`}
              >
                <option value="">เลือกเวรของฉัน…</option>
                {allNames.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <span className="absolute right-3 pointer-events-none text-[var(--md-on-surface-var)] text-xs">▾</span>
            </div>
            {meName && (
              <button onClick={() => setMe(null)} title="ล้าง" className="md-state w-8 h-8 rounded-full grid place-items-center text-[var(--md-on-surface-var)] hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">✕</button>
            )}
          </div>

          {/* Month nav — month view only */}
          {view === 'month' && (
            <div className="flex flex-wrap justify-center items-center gap-2 mt-4">
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

              {/* Edit — month view only */}
              {view === 'month' && (
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
              )}
            </div>
          )}

          {view === 'month' && editing && !exists && (
            <p className="md-body-s text-center text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 rounded-xl px-4 py-2 mt-3 max-w-md mx-auto">
              ยังไม่มีข้อมูลเดือนนี้ — คลิกช่องวันหรือเพิ่มคนเพื่อเริ่มสร้าง
            </p>
          )}
          {view === 'month' && !editing && !exists && (
            <p className="md-body-s text-center text-[var(--md-on-surface-var)] mt-3">ยังไม่มีข้อมูลเดือนนี้</p>
          )}
          {view === 'month' && editing && (
            <p className="md-body-s text-center text-[var(--md-on-surface-var)] mt-3">
              คลิกช่องวัน (วน: ว่าง → / → ✕ → S → บ/ด → สลับ) · คลิกเลขวันบน header = วันหยุด
            </p>
          )}

          {view !== 'today' && <Legend />}
        </div>

        {/* ── Today view ── */}
        {view === 'today' && <TodayView schedules={schedules} meName={meName} />}

        {/* ── Week view ── */}
        {view === 'week' && <WeekView schedules={schedules} meName={meName} />}

        {/* ── Month view (animates on month change) ── */}
        {view === 'month' && <div key={contentKey} className={slideClass}>

          {/* Desktop table */}
          <div className="hidden md:block bg-[var(--md-surface)] md-elev-1 rounded-b-2xl overflow-x-auto transition-colors duration-300">
            <table className="text-sm border-collapse w-full" style={{ minWidth: '1280px' }}>
              <thead>
                <tr className="bg-gray-800 dark:bg-gray-950 text-white">
                  <th className="border border-gray-600 px-2 py-2 text-center w-8 sticky left-0 z-20 bg-gray-800 dark:bg-gray-950 font-medium">ลำดับ</th>
                  <th className="border border-gray-600 px-3 py-2 text-left w-28 sticky left-8 z-20 bg-gray-800 dark:bg-gray-950 font-medium">ชื่อ-นามสกุล</th>
                  {days.map(d => {
                    const holName = holidays[d]
                    const isWeekend = weekendDays.includes(d) || !!holName
                    const dayAbbr = DAY_ABBR[new Date(data.year, data.month - 1, d).getDay()]
                    return (
                      <th
                        key={d}
                        onClick={editing ? () => toggleWeekend(d) : undefined}
                        title={holName}
                        className={`border border-gray-600 w-9 py-1 text-center transition-colors ${isWeekend ? 'bg-red-800 dark:bg-red-950' : ''} ${editing ? 'cursor-pointer hover:bg-gray-700' : ''}`}
                      >
                        <div className="md-label-s leading-none mb-0.5 opacity-70">{dayAbbr}</div>
                        <div className={isWeekend ? 'rounded-full border-2 border-white/80 w-6 h-6 flex items-center justify-center mx-auto' : ''}>
                          {d}
                        </div>
                      </th>
                    )
                  })}
                  {editing && <th className="border border-gray-600 px-1 py-2 text-center w-8"></th>}
                </tr>
              </thead>
              <tbody>
                {roleGroups.map(({ role, rows }) => (
                  <Fragment key={role}>
                    <tr>
                      <td colSpan={monthColSpan} className="bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-0">
                        <div className="sticky left-0 w-max px-3 py-1.5 md-label-m font-semibold text-[var(--md-on-surface-var)]">
                          {ROLE_LABEL[role]} <span className="font-normal opacity-60">({rows.length})</span>
                        </div>
                      </td>
                    </tr>
                    {rows.map(({ member, rowIdx, no }) => {
                      const isMe = !editing && !!meName && member.name === meName
                      const bg = isMe ? 'bg-teal-100 dark:bg-teal-900' : ROLE_BG[member.role]
                      const meEdge = isMe ? 'border-y-2 border-y-teal-500 dark:border-y-teal-400' : ''
                      return (
                        <tr key={rowIdx} className={`border-b dark:border-gray-700 ${editing ? '' : 'hover:brightness-95 dark:hover:brightness-110 transition-all duration-150'} ${bg}`}>
                          <td className={`border border-gray-200 dark:border-gray-700 text-center text-gray-500 dark:text-gray-400 py-1.5 sticky left-0 z-10 ${bg} ${meEdge} ${isMe ? 'border-l-4 border-l-teal-500 dark:border-l-teal-400 text-teal-700 dark:text-teal-200 font-bold' : ''}`}>{no}</td>
                          <td className={`border border-gray-200 dark:border-gray-700 px-1 py-1.5 sticky left-8 z-10 ${bg} ${meEdge} ${editing ? '' : `font-medium whitespace-nowrap ${isMe ? 'text-teal-700 dark:text-teal-200 font-bold' : 'text-[var(--md-on-surface)]'}`}`}>
                            {editing ? (
                              <div className="flex flex-col gap-0.5">
                                <input className="border dark:border-gray-600 rounded-lg px-1 py-0.5 w-24 text-xs bg-white dark:bg-gray-700 dark:text-gray-200" value={member.name} placeholder="ชื่อ" onChange={e => patchStaff(rowIdx, { name: e.target.value })} />
                                <input className="border dark:border-gray-600 rounded-lg px-1 py-0.5 w-24 text-[10px] bg-white dark:bg-gray-700 dark:text-gray-200" value={member.phone ?? ''} placeholder="เบอร์โทร" onChange={e => patchStaff(rowIdx, { phone: e.target.value || undefined })} />
                                <select className="border dark:border-gray-600 rounded-lg px-1 py-0.5 w-24 text-[10px] text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-700" value={member.role} onChange={e => patchStaff(rowIdx, { role: e.target.value as StaffMember['role'] })}>
                                  {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                                </select>
                              </div>
                            ) : (
                              <span className="flex items-center gap-1">
                                {member.phone ? (
                                  <a href={telHref(member.phone)} title={`โทร ${member.phone}`} className="text-teal-700 dark:text-teal-300 hover:underline">{member.name}</a>
                                ) : member.name}
                                {isMe && <span className="md-label-s px-1.5 py-0.5 rounded-full bg-teal-600 text-white shrink-0">ฉัน</span>}
                              </span>
                            )}
                          </td>
                          {member.shifts.map((shift, dayIdx) => {
                            const isWeekend = weekendDays.includes(dayIdx + 1) || !!holidays[dayIdx + 1]
                            return (
                              <td
                                key={dayIdx}
                                onClick={editing ? () => cycleCell(rowIdx, dayIdx) : undefined}
                                className={`border border-gray-200 dark:border-gray-700 text-center py-1.5 transition-colors duration-100 ${meEdge} ${isMe ? bg : isWeekend ? 'bg-red-50 dark:bg-red-950/50' : ''} ${editing ? 'cursor-pointer hover:bg-teal-50 dark:hover:bg-teal-900/30 active:bg-teal-100 dark:active:bg-teal-900/50' : ''}`}
                              >
                                <span className={SHIFT_STYLE[shift]} title={SHIFT_LABELS[shift]}>
                                  {SHIFT_DISPLAY[shift] || (editing ? '·' : '')}
                                </span>
                              </td>
                            )
                          })}
                          {editing && (
                            <td className="border border-gray-200 dark:border-gray-700 text-center">
                              <button onClick={() => removeStaff(rowIdx)} className="text-red-500 dark:text-red-400 text-xs px-1 hover:text-red-700 transition-colors">✕</button>
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </Fragment>
                ))}
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
            {ROLES.map(role => {
              const group = mobileStaff.filter(m => m.role === role)
              if (!group.length) return null
              return (
                <Fragment key={role}>
                  <p className="md-title-s text-[var(--md-on-surface-var)] px-1 pt-1">{ROLE_LABEL[role]} <span className="font-normal opacity-60">({group.length})</span></p>
                  {group.map((member, gi) => {
              const realIdx = staff.indexOf(member)
              return (
                <div
                  key={realIdx}
                  className="anim-fade-up rounded-2xl bg-[var(--md-surface)] md-elev-2 border border-gray-100 dark:border-gray-700/50 overflow-hidden transition-colors duration-300"
                  style={{ animationDelay: `${gi * 55}ms` }}
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
                        const holName = holidays[day]
                        const isHoliday = (weekendDays.includes(day) || !!holName) && !isWeekendCol
                        const isRed = isWeekendCol || isHoliday
                        return (
                          <div
                            key={dayIdx}
                            onMouseDown={editing ? addRipple : undefined}
                            onClick={editing ? () => cycleCell(realIdx, dayIdx) : undefined}
                            title={holName}
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
                </Fragment>
              )
            })}
            {editing && (
              <div className="pt-1 pb-4">
                <BtnOutlined onClick={addStaff} className="w-full justify-center">+ เพิ่มคน</BtnOutlined>
              </div>
            )}
          </div>

          {!editing && <MonthSummary data={data} />}

        </div>}{/* end month view */}

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
