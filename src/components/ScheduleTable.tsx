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
import { fetchSchedules, saveMonth, removeMonth, resetAll, subscribeSchedules, subscribeOnlineCount } from '@/lib/scheduleRepo'

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
  OFF:  'text-orange-600 dark:text-orange-400 font-bold text-xs',
  CBD:  'text-rose-600 dark:text-rose-400 font-bold text-xs',
  SWAP: 'text-indigo-500 dark:text-indigo-400 text-xs',
  '-':  'text-gray-300 dark:text-gray-600',
}

const SHIFT_DISPLAY: Record<ShiftCode, string> = {
  M: '/', A: '✕', N: 'S', N2: 'S', OFF: 'บ/ด', CBD: 'ช/บ/ด', SWAP: 'สลับ', '-': '',
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
  doctor: 'แพทย์', nurse: 'พยาบาล', tech: 'นักเทคโนโลยีหัวใจและทรวงอก',
}

const ROLES: StaffMember['role'][] = ['doctor', 'nurse', 'tech']

function telHref(phone: string) { return `tel:${phone.replace(/[^0-9+]/g, '')}` }
function byDate(a: ScheduleData, b: ScheduleData) {
  return a.thaiYear - b.thaiYear || a.month - b.month
}

// ── Button components (iOS-style: tinted pills, press = dim + scale) ──
function PhoneIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.07 9.81 19.79 19.79 0 0 1 1 1.18 2 2 0 0 1 2.92 0h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 7.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 15l.92 1.92z" />
    </svg>
  )
}

function BtnFilled({ children, onClick, className = '' }: {
  children: React.ReactNode; onClick?: () => void; className?: string
}) {
  return (
    <button
      onClick={onClick}
      className={`md-label-l inline-flex items-center gap-2 h-10 px-6 rounded-full bg-teal-600 dark:bg-teal-500 text-white transition-all duration-150 active:opacity-70 active:scale-[0.97] ${className}`}
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
      className={`md-label-l inline-flex items-center gap-2 h-10 px-6 rounded-full bg-teal-600/10 dark:bg-teal-400/15 text-teal-700 dark:text-teal-300 transition-all duration-150 active:opacity-70 active:scale-[0.97] ${className}`}
    >
      {children}
    </button>
  )
}

function BtnOutlined({ children, onClick, className = '', danger = false }: {
  children: React.ReactNode; onClick?: () => void; className?: string; danger?: boolean
}) {
  const colors = danger
    ? 'bg-red-500/10 dark:bg-red-400/15 text-red-600 dark:text-red-400'
    : 'bg-gray-500/10 dark:bg-gray-400/15 text-gray-600 dark:text-gray-300'
  return (
    <button
      onClick={onClick}
      className={`md-label-l inline-flex items-center gap-2 h-10 px-6 rounded-full transition-all duration-150 active:opacity-70 active:scale-[0.97] ${colors} ${className}`}
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
      title={title}
      className={`w-10 h-10 rounded-full flex items-center justify-center text-lg leading-none transition-all duration-150 active:opacity-60 active:scale-90 ${
        active
          ? 'bg-teal-600/10 dark:bg-teal-400/15 text-teal-700 dark:text-teal-300'
          : 'bg-gray-500/10 dark:bg-gray-400/15 text-teal-600 dark:text-teal-400'
      }`}
    >
      {children}
    </button>
  )
}

// ── Theme Toggle Switch (iOS-style) ──────────────────────────────
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
      <span className={`relative inline-flex items-center w-[51px] h-[31px] rounded-full transition-colors duration-300 ease-out ${
        dark ? 'bg-teal-500' : 'bg-[#E9E9EB]'
      } group-focus-visible:ring-2 group-focus-visible:ring-teal-400 group-focus-visible:ring-offset-2`}>
        {/* Thumb */}
        <span
          className="absolute flex items-center justify-center w-[27px] h-[27px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.15),0_1px_1px_rgba(0,0,0,0.16)] transition-all duration-300 ease-out"
          style={{ left: dark ? 22 : 2 }}
        >
          <span className={`text-xs leading-none transition-colors duration-300 ${dark ? 'text-teal-600' : 'text-gray-400'}`}>
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
        { sym: 'บ/ด', symCls: 'text-orange-600 dark:text-orange-400 font-bold text-xs', label: 'เวรบ่ายดึก' },
        { sym: 'ช/บ/ด', symCls: 'text-rose-600 dark:text-rose-400 font-bold text-xs', label: 'เวรเช้าบ่ายดึก' },
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
const WORKING: ShiftCode[] = ['M', 'N', 'N2', 'OFF', 'CBD', 'SWAP']
const isWorking = (s: ShiftCode) => WORKING.includes(s)

// นับเวรของคนหนึ่งในเดือน — สำหรับสรุป "เวรของฉัน"
function shiftCounts(m: StaffMember) {
  let M = 0, S = 0, OFF = 0, CBD = 0, SWAP = 0
  for (const s of m.shifts) {
    if (s === 'M') M++
    else if (s === 'N' || s === 'N2') S++
    else if (s === 'OFF') OFF++
    else if (s === 'CBD') CBD++
    else if (s === 'SWAP') SWAP++
  }
  return { M, S, OFF, CBD, SWAP }
}
const COUNT_LABELS: { key: 'M' | 'S' | 'OFF' | 'CBD' | 'SWAP'; label: string }[] = [
  { key: 'M', label: 'แพทย์เวร' }, { key: 'OFF', label: 'บ/ด' }, { key: 'CBD', label: 'ช/บ/ด' }, { key: 'S', label: 'standby' }, { key: 'SWAP', label: 'สลับ' },
]

// เงินเวร บ/ด = จำนวน บ/ด (OFF) × อัตราตามตำแหน่ง
// นักเทคโน/แพทย์ไม่คิด บ/ด (นักเทคโนรับเป็น standby OT ชม.ละ 400 แทน)
const PAY_RATE: Record<string, number> = { nurse: 1200, tech: 0, doctor: 0 }
// เวรเช้าบ่ายดึก (ช/บ/ด, เต็มวัน) = 3600 บาท/วัน เท่ากันทุกตำแหน่ง (แพทย์ไม่คิด)
const CBD_PAY = 3600
// อัตรา OT ต่อชั่วโมง เมื่อ standby ถูกเรียกมาทำงาน — ต่างตามตำแหน่ง (แพทย์ไม่คิด)
const OT_RATE: Record<string, number> = { nurse: 200, tech: 400, doctor: 0 }

// standby ที่ถูกเรียกมาทำงาน (มีชั่วโมง)
const isStandby = (s: ShiftCode) => s === 'N' || s === 'N2'
const hoursOf = (m: StaffMember, dayIdx: number) => m.standbyHours?.[dayIdx] ?? 0
// รวมชั่วโมง standby ทั้งเดือนของคนหนึ่ง
function standbyHoursTotal(m: StaffMember) {
  return Object.values(m.standbyHours ?? {}).reduce((s, h) => s + (h || 0), 0)
}
// สัญลักษณ์ในช่อง: standby ที่มีชั่วโมง → "S·N"
function cellSymbol(shift: ShiftCode, hrs: number) {
  if (isStandby(shift) && hrs > 0) return `S·${hrs}`
  return SHIFT_DISPLAY[shift]
}

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
  2027: {
    '1-1': 'วันขึ้นปีใหม่',
    '2-21': 'วันมาฆบูชา',
    '2-22': 'ชดเชยวันมาฆบูชา',
    '4-6': 'วันจักรี',
    '4-13': 'วันสงกรานต์', '4-14': 'วันสงกรานต์', '4-15': 'วันสงกรานต์',
    '5-1': 'วันแรงงานแห่งชาติ',
    '5-3': 'ชดเชยวันแรงงานแห่งชาติ',
    '5-4': 'วันฉัตรมงคล',
    '5-20': 'วันวิสาขบูชา',
    '6-3': 'วันเฉลิมพระชนมพรรษาสมเด็จพระบรมราชินี',
    '7-18': 'วันอาสาฬหบูชา',
    '7-19': 'วันเข้าพรรษา',
    '7-20': 'ชดเชยวันอาสาฬหบูชา',
    '7-28': 'วันเฉลิมพระชนมพรรษา ร.10',
    '8-12': 'วันแม่แห่งชาติ',
    '10-13': 'วันนวมินทรมหาราช',
    '10-23': 'วันปิยมหาราช',
    '10-25': 'ชดเชยวันปิยมหาราช',
    '12-5': 'วันพ่อแห่งชาติ',
    '12-6': 'ชดเชยวันพ่อแห่งชาติ',
    '12-10': 'วันรัฐธรรมนูญ',
    '12-31': 'วันสิ้นปี',
  },
  2028: {
    '1-1': 'วันขึ้นปีใหม่',
    '1-3': 'ชดเชยวันขึ้นปีใหม่',
    '2-10': 'วันมาฆบูชา',
    '4-6': 'วันจักรี',
    '4-13': 'วันสงกรานต์', '4-14': 'วันสงกรานต์', '4-15': 'วันสงกรานต์',
    '4-17': 'ชดเชยวันสงกรานต์',
    '5-1': 'วันแรงงานแห่งชาติ',
    '5-4': 'วันฉัตรมงคล',
    '5-8': 'วันวิสาขบูชา',
    '6-3': 'วันเฉลิมพระชนมพรรษาสมเด็จพระบรมราชินี',
    '6-5': 'ชดเชยวันเฉลิมพระชนมพรรษาสมเด็จพระบรมราชินี',
    '7-6': 'วันอาสาฬหบูชา',
    '7-7': 'วันเข้าพรรษา',
    '7-28': 'วันเฉลิมพระชนมพรรษา ร.10',
    '8-12': 'วันแม่แห่งชาติ',
    '8-14': 'ชดเชยวันแม่แห่งชาติ',
    '10-13': 'วันนวมินทรมหาราช',
    '10-23': 'วันปิยมหาราช',
    '12-5': 'วันพ่อแห่งชาติ',
    '12-10': 'วันรัฐธรรมนูญ',
    '12-11': 'ชดเชยวันรัฐธรรมนูญ',
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
  { label: 'แพทย์เวร',  sym: '/',    match: s => s === 'M',                dot: 'bg-blue-600',   accent: 'border-blue-200 dark:border-blue-800/70' },
  { label: 'เวรบ่ายดึก', sym: 'บ/ด', match: s => s === 'OFF',              dot: 'bg-orange-700', accent: 'border-orange-200 dark:border-orange-800/70' },
  { label: 'เวรเช้าบ่ายดึก', sym: 'ช/บ/ด', match: s => s === 'CBD',        dot: 'bg-rose-700',   accent: 'border-rose-200 dark:border-rose-800/70' },
  { label: 'Standby',   sym: 'S',    match: s => s === 'N' || s === 'N2',  dot: 'bg-purple-600', accent: 'border-purple-200 dark:border-purple-800/70' },
  { label: 'สลับเวร',   sym: 'สลับ', match: s => s === 'SWAP',             dot: 'bg-orange-700', accent: 'border-orange-200 dark:border-orange-800/70' },
]

// การ์ดชื่อคน — ชื่อ + ตำแหน่ง + ปุ่มโทร, ขอบสีตามกลุ่มเวร
function PersonCard({ m, accent, isMe = false }: { m: StaffMember; accent: string; isMe?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-2 pl-3 pr-2 py-2.5 rounded-xl border bg-[var(--md-surface)] ${accent} ${isMe ? 'ring-2 ring-teal-400 dark:ring-teal-500 anim-ring-pulse' : ''}`}>
      <div className="min-w-0">
        <p className="md-body-m font-medium text-[var(--md-on-surface)] truncate flex items-center gap-1.5">
          <span className="truncate">{m.name}</span>
          {isMe && <span className="md-label-s px-1.5 py-0.5 rounded-full bg-teal-600 text-white shrink-0">ฉัน</span>}
        </p>
        <p className="md-label-s text-[var(--md-on-surface-var)]">{ROLE_LABEL[m.role]}</p>
      </div>
      {m.phone && (
        <a href={telHref(m.phone)} title={`โทร ${m.phone}`} className="shrink-0 grid place-items-center w-9 h-9 rounded-full bg-teal-100 dark:bg-teal-500 text-teal-700 dark:text-white active:scale-90 transition-transform"><PhoneIcon /></a>
      )}
    </div>
  )
}

// ── Today View — "who's on duty" board ───────────────────────────
// เวรหนึ่งวันคุมยาวถึง 08:00 เช้าวันถัดไป — ก่อน 8 โมงเช้าจึงยังนับ
// "เวรตอนนี้" เป็นของเมื่อวาน และแสดงเวรวันถัดไปต่อท้ายเสมอ
function TodayView({ schedules, meName }: { schedules: ScheduleData[]; meName: string | null }) {
  const now = new Date()
  const today = now
  const month = today.getMonth() + 1
  const thaiYear = today.getFullYear() + 543
  const isBefore8 = now.getHours() < 8
  const activeDate = new Date(now)
  if (isBefore8) activeDate.setDate(activeDate.getDate() - 1)
  const nextDate = new Date(activeDate)
  nextDate.setDate(nextDate.getDate() + 1)

  const dataFor = (d: Date) => schedules.find(m => m.month === d.getMonth() + 1 && m.thaiYear === d.getFullYear() + 543)
  const data = dataFor(today)
  const holName = holidaysOf(month, today.getFullYear())[today.getDate()]
  const isWeekendToday = data ? data.weekendDays.includes(today.getDate()) : (today.getDay() === 0 || today.getDay() === 6)
  const isHoliday = !!holName || isWeekendToday

  // "เวรของฉัน" — ยึดเวรที่กำลังคุมอยู่ (activeDate)
  const activeNamed = dataFor(activeDate)?.staff.filter(m => m.name) ?? []
  const me = meName ? activeNamed.find(m => m.name === meName) : undefined
  const myShift: ShiftCode = me ? (me.shifts[activeDate.getDate() - 1] ?? '-') : '-'
  const myCounts = me ? shiftCounts(me) : null

  const thDate = (d: Date) => `${d.getDate()} ${THAI_MONTHS[d.getMonth() + 1]}`

  // บอร์ดรายชื่อคนอยู่เวรของวันหนึ่ง (ใช้ทั้งบล็อก "ตอนนี้" และ "ถัดไป")
  const dutyBoard = (d: Date) => {
    const dd = dataFor(d)
    const named = dd?.staff.filter(m => m.name) ?? []
    const shiftOf = (m: StaffMember): ShiftCode => m.shifts[d.getDate() - 1] ?? '-'
    if (!dd) return <p className="text-center text-[var(--md-on-surface-var)] py-4 md-body-m">ไม่มีข้อมูลเดือนนี้</p>
    if (!named.some(m => isWorking(shiftOf(m)))) return <p className="text-center text-[var(--md-on-surface-var)] py-4 md-body-m">ยังไม่มีเวรวันนี้</p>
    return DUTY_GROUPS.map(g => {
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
  }

  // คนไม่อยู่เวรของวันที่กำลังคุมอยู่
  const offNow = activeNamed.filter(m => !isWorking(m.shifts[activeDate.getDate() - 1] ?? '-'))

  return (
    <div className="bg-[var(--md-surface)] md-elev-1 rounded-b-2xl p-4 sm:p-6 space-y-4">
      {/* Date hero */}
      <div className={`rounded-2xl px-5 py-5 text-center ${isHoliday ? 'bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50' : 'bg-teal-50 dark:bg-teal-950/30 border border-teal-100 dark:border-teal-900/50'}`}>
        <p className={`md-label-l ${isHoliday ? 'text-red-600 dark:text-red-400' : 'text-teal-700 dark:text-teal-400'}`}>
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
            <span className={`md-label-l shrink-0 px-3 py-1 rounded-full font-medium ${isWorking(myShift) ? 'bg-teal-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
              {isWorking(myShift) ? `${SHIFT_DISPLAY[myShift]} ${SHIFT_LABELS[myShift]}${isBefore8 ? ' · ถึง 08:00' : ''}` : myShift === 'A' ? 'ไม่อยู่เวร' : 'ไม่มีเวร'}
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

      {/* ── เวรตอนนี้ (คุมถึง 08:00 เช้าวันถัดไป) ── */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-teal-500" />
          </span>
          <span className="md-title-m text-[var(--md-on-surface)]">เวรตอนนี้</span>
          <span className="md-label-s px-2 py-0.5 rounded-full bg-teal-600/10 dark:bg-teal-400/15 text-teal-700 dark:text-teal-300">
            {isBefore8 ? `ของเมื่อวาน (${thDate(activeDate)}) · ถึง 08:00 น.` : `${thDate(activeDate)} · ถึง 08:00 น. พรุ่งนี้`}
          </span>
        </div>
        {dutyBoard(activeDate)}

        {/* ไม่อยู่เวร — ของวันที่กำลังคุมอยู่ */}
        {offNow.length > 0 && (
          <details className="group">
            <summary className="md-label-m text-[var(--md-on-surface-var)] cursor-pointer select-none list-none flex items-center gap-1 pt-1">
              <span className="transition-transform group-open:rotate-90">›</span>
              ไม่อยู่เวร ({offNow.length})
            </summary>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {offNow.map((m, i) => (
                <span key={i} className={`md-label-s px-2.5 py-1 rounded-full ${m.name === meName ? 'bg-teal-100 dark:bg-teal-900/60 text-teal-700 dark:text-teal-300 ring-1 ring-teal-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>{m.name}{m.name === meName ? ' (ฉัน)' : ''}</span>
              ))}
            </div>
          </details>
        )}
      </section>

      {/* ── เวรถัดไป (เริ่ม 08:00) ── */}
      <section className="rounded-2xl bg-[var(--md-surface-variant)]/60 dark:bg-[var(--md-surface-variant)]/40 p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm leading-none">⏭️</span>
          <span className="md-title-m text-[var(--md-on-surface)]">เวรถัดไป</span>
          <span className="md-label-s px-2 py-0.5 rounded-full bg-gray-500/10 dark:bg-gray-400/15 text-[var(--md-on-surface-var)]">
            {isBefore8 ? `วันนี้ (${thDate(nextDate)})` : `พรุ่งนี้ (${thDate(nextDate)})`} · เริ่ม 08:00 น.
          </span>
        </div>
        {dutyBoard(nextDate)}
      </section>
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
                        {ROLE_LABEL[role]} <span className="font-normal">({rows.length})</span>
                      </div>
                    </td>
                  </tr>
                  {rows.map((member, ri) => {
                    const isMe = !!meName && member.name === meName
                    const bg = isMe ? 'bg-teal-100 dark:bg-teal-900' : ROLE_BG[member.role]
                    const meEdge = isMe ? 'border-y-2 border-y-teal-500 dark:border-y-teal-400' : ''
                    return (
                      <tr key={`${member.name}-${ri}`} className={`border-b dark:border-gray-700 ${bg}`}>
                        <td className={`border border-gray-200 dark:border-gray-700 px-2 py-1.5 sticky left-0 z-10 font-medium whitespace-nowrap ${bg} ${meEdge} ${isMe ? 'text-teal-700 dark:text-teal-200 font-bold' : 'text-[var(--md-on-surface)]'}`}>
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

// ── แผงป้อนชั่วโมง Standby (edit mode) ────────────────────────────
// รวบรวมทุกเวร standby (S) ในเดือน แล้วให้กรอกชั่วโมงที่ถูกเรียกมาทำงาน
function StandbyHoursPanel({ data, onSet }: {
  data: ScheduleData
  onSet: (si: number, di: number, hours: number) => void
}) {
  // จัดกลุ่มตามวัน: di → รายชื่อคน standby วันนั้น
  const byDay = new Map<number, { si: number; m: StaffMember }[]>()
  data.staff.forEach((m, si) => {
    if (!m.name) return
    m.shifts.forEach((sh, di) => {
      if (!isStandby(sh)) return
      const arr = byDay.get(di) ?? []
      arr.push({ si, m })
      byDay.set(di, arr)
    })
  })
  const days = [...byDay.keys()].sort((a, b) => a - b)
  const dow = (di: number) => new Date(data.year, data.month - 1, di + 1).getDay()
  return (
    <div className="bg-[var(--md-surface)] md-elev-1 rounded-2xl mt-4 p-4 sm:p-6 transition-colors duration-300">
      <details className="group" open>
        <summary className="cursor-pointer select-none list-none flex items-center justify-between gap-2">
          <span className="md-title-m text-[var(--md-on-surface)]">⏱️ ชั่วโมง Standby ที่ถูกเรียกทำงาน</span>
          <span className="text-[var(--md-on-surface-var)] transition-transform group-open:rotate-90">›</span>
        </summary>
        {days.length === 0 ? (
          <p className="md-body-s text-[var(--md-on-surface-var)] mt-4">ยังไม่มีเวร standby (S) ในเดือนนี้ — ตั้งช่องวันให้เป็น S ก่อน แล้วรายการจะขึ้นที่นี่</p>
        ) : (
          <div className="mt-4 -mx-4 sm:-mx-6 max-h-[65vh] overflow-y-auto">
            {days.map(di => {
              const isRed = data.weekendDays.includes(di + 1)
              return (
                <div key={di}>
                  {/* หัววัน — sticky */}
                  <div className="sticky top-0 z-10 bg-[var(--md-surface)] px-4 sm:px-6 py-2 border-y border-gray-200 dark:border-gray-700">
                    <span className={`md-label-l font-semibold ${isRed ? 'text-red-600 dark:text-red-400' : 'text-teal-700 dark:text-teal-300'}`}>
                      {THAI_DAY_FULL[dow(di)]}ที่ {di + 1} {THAI_MONTHS[data.month]}
                    </span>
                  </div>
                  {/* รายชื่อคน standby วันนั้น */}
                  <div className="px-4 sm:px-6">
                    {byDay.get(di)!.map(({ si, m }) => {
                      const hrs = hoursOf(m, di)
                      return (
                        <div key={si} className="flex items-center gap-3 py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
                          <span className="md-body-m text-[var(--md-on-surface)] flex-1 truncate">{m.name}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button aria-label="ลดชั่วโมง" onClick={() => onSet(si, di, hrs - 1)} className="w-8 h-8 rounded-full bg-gray-500/10 dark:bg-gray-400/15 text-gray-600 dark:text-gray-300 active:scale-90 transition-transform text-lg leading-none">−</button>
                            <span className={`w-14 text-center md-label-l tabular-nums ${hrs > 0 ? 'text-teal-700 dark:text-teal-300 font-semibold' : 'text-[var(--md-on-surface-var)]'}`}>{hrs > 0 ? `${hrs} ชม` : '—'}</span>
                            <button aria-label="เพิ่มชั่วโมง" onClick={() => onSet(si, di, hrs + 1)} className="w-8 h-8 rounded-full bg-teal-600/10 dark:bg-teal-400/15 text-teal-700 dark:text-teal-300 active:scale-90 transition-transform text-lg leading-none">+</button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </details>
    </div>
  )
}

// ── Month Summary — จำนวนเวร + เงินเวร ────────────────────────────
function MonthSummary({ data }: { data: ScheduleData }) {
  const rows = data.staff.filter(m => m.name).map(m => {
    const c = shiftCounts(m)
    const rate = PAY_RATE[m.role] ?? 0
    const cbdPay = m.role === 'doctor' ? 0 : c.CBD * CBD_PAY
    const otHrs = standbyHoursTotal(m)
    const otPay = m.role === 'doctor' ? 0 : otHrs * (OT_RATE[m.role] ?? 0)
    return { m, c, otHrs, pay: c.OFF * rate + cbdPay + otPay }
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
              <th className="text-center font-medium py-2 px-2">ช/บ/ด</th>
              <th className="text-center font-medium py-2 px-2">standby</th>
              <th className="text-center font-medium py-2 px-2">OT (ชม)</th>
              <th className="text-center font-medium py-2 px-2">แพทย์เวร</th>
              <th className="text-right font-medium py-2 px-2">เงินเวร</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ m, c, otHrs, pay }, i) => (
              <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                <td className="py-2 px-2 text-[var(--md-on-surface)] whitespace-nowrap">{m.name}</td>
                <td className="py-2 px-2 text-center text-[var(--md-on-surface-var)]">{ROLE_LABEL[m.role]}</td>
                <td className="py-2 px-2 text-center font-medium text-[var(--md-on-surface)]">{c.OFF || '—'}</td>
                <td className="py-2 px-2 text-center font-medium text-[var(--md-on-surface)]">{c.CBD || '—'}</td>
                <td className="py-2 px-2 text-center text-[var(--md-on-surface-var)]">{c.S || '—'}</td>
                <td className="py-2 px-2 text-center text-[var(--md-on-surface)]">{otHrs || '—'}</td>
                <td className="py-2 px-2 text-center text-[var(--md-on-surface-var)]">{c.M || '—'}</td>
                <td className="py-2 px-2 text-right font-medium text-teal-700 dark:text-teal-300">{pay > 0 ? `฿${fmt(pay)}` : '—'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300 dark:border-gray-600">
              <td colSpan={7} className="py-2 px-2 text-right font-medium text-[var(--md-on-surface)]">รวมเงินเวรทั้งเดือน</td>
              <td className="py-2 px-2 text-right font-bold text-teal-700 dark:text-teal-300">฿{fmt(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="md-label-s text-[var(--md-on-surface-var)] mt-3">
        เงินเวร = (บ/ด × อัตราตำแหน่ง) + (ช/บ/ด × ฿3,600) + (OT ชม × อัตราตำแหน่ง) — พยาบาล บ/ด ฿1,200/เวร · เวรเช้าบ่ายดึก ฿3,600/วัน · standby OT พยาบาล ฿{OT_RATE.nurse}/ชม · นักเทคโน ฿{OT_RATE.tech}/ชม · แพทย์ไม่คิด
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

  // เดือนต้นแบบสำหรับก๊อปปี้ = เดือนก่อนหน้า (ถ้าไม่มี ใช้เดือนล่าสุดก่อนปัจจุบัน)
  const prevSource = useMemo(() => {
    let m = selMonth - 1, y = selYear
    if (m < 1) { m = 12; y -= 1 }
    const prev = schedules.find(s => s.month === m && s.thaiYear === y)
    if (prev) return prev
    const before = schedules
      .filter(s => s.thaiYear < selYear || (s.thaiYear === selYear && s.month < selMonth))
      .sort(byDate)
    return before[before.length - 1]
  }, [schedules, selMonth, selYear])

  const captureRef = useRef<HTMLDivElement>(null)
  const [exporting, setExporting] = useState(false)
  const [holTip, setHolTip] = useState<{ text: string; x: number; y: number } | null>(null)

  function showHolTip(e: React.MouseEvent | React.TouchEvent, text: string) {
    if (!text) return
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setHolTip({ text, x: r.left + r.width / 2, y: r.top + window.scrollY })
  }
  function hideHolTip() { setHolTip(null) }

  // save เฉพาะตอนแก้ไขเอง (เรียกจาก updateCurrent) — ไม่ผูกกับทุกการเปลี่ยน
  // state เพื่อตัด feedback loop กับ realtime
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  function scheduleSave(m: ScheduleData) {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => saveMonth(m), 600)
  }

  // presence: นับคนที่เปิดเว็บอยู่ตอนนี้
  const [onlineCount, setOnlineCount] = useState(1)
  useEffect(() => {
    if (!hydrated) return
    return subscribeOnlineCount(setOnlineCount)
  }, [hydrated])

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
  // ตั้งชั่วโมง standby ที่ถูกเรียกมาทำงาน (0 = ล้างออก) — เก็บแบบ sparse
  function setStandbyHour(si: number, di: number, hours: number) {
    const h = Math.max(0, Math.min(24, Math.round(hours)))
    updateCurrent(m => ({
      ...m,
      staff: m.staff.map((s, i) => {
        if (i !== si) return s
        const next: Record<number, number> = { ...(s.standbyHours ?? {}) }
        if (h > 0) next[di] = h
        else delete next[di]
        return { ...s, standbyHours: next }
      }),
    }))
  }
  function addStaff() {
    updateCurrent(m => ({ ...m, staff: [...m.staff, emptyStaff('nurse', m.totalDays)] }))
  }
  function removeStaff(si: number) {
    const name = data.staff[si]?.name ?? ''
    if (!confirm(`ลบ ${name} ออกจากตารางเดือนนี้?`)) return
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

  function copyFromPrevious() {
    if (!prevSource) return
    if (!confirm(`ก๊อปปี้เวรจาก ${THAI_MONTHS[prevSource.month]} ${prevSource.thaiYear} มาเดือนนี้?\n(เวรเดิมของเดือนนี้จะถูกแทนที่ — เริ่มเป็นฐานแล้วแก้ต่อได้)`)) return
    updateCurrent(m => ({
      ...m,
      staff: m.staff.map(s => {
        const from = prevSource.staff.find(x => x.name === s.name)
        if (!from) return s
        return { ...s, shifts: Array.from({ length: m.totalDays }, (_, i) => from.shifts[i] ?? '-') }
      }),
    }))
  }

  // บันทึก/แชร์ตารางเป็นรูป PNG
  async function exportImage() {
    const node = captureRef.current
    if (!node || exporting) return
    setExporting(true)
    // ปลด overflow ของตารางชั่วคราว เพื่อแคปได้เต็มความกว้าง (ไม่โดนตัด)
    const scrollers = Array.from(node.querySelectorAll<HTMLElement>('.overflow-x-auto'))
    const prevOverflow = scrollers.map(s => s.style.overflow)
    scrollers.forEach(s => { s.style.overflow = 'visible' })
    // ซ่อน toolbar จริง (display:none) เพื่อให้ layout ยุบ ไม่เหลือช่องว่างใน header
    const hidden = Array.from(node.querySelectorAll<HTMLElement>('[data-export-hide]'))
    const prevDisplay = hidden.map(h => h.style.display)
    hidden.forEach(h => { h.style.display = 'none' })
    // เพิ่ม padding รอบภาพ กันเนื้อหาชิดขอบ
    const prevPadding = node.style.padding
    node.style.padding = '16px'
    try {
      const { toPng } = await import('html-to-image')
      const dataUrl = await toPng(node, {
        pixelRatio: 2,
        width: node.scrollWidth,
        backgroundColor: dark ? '#000000' : '#F2F2F7',
      })
      const label = view === 'month'
        ? `${THAI_MONTHS[selMonth]}-${selYear}`
        : view === 'week' ? 'สัปดาห์นี้' : 'วันนี้'
      const fname = `ตารางเวร-${label}.png`
      // แชร์ผ่าน Web Share (มือถือ → LINE ได้) ถ้าไม่รองรับ → ดาวน์โหลด
      try {
        const blob = await (await fetch(dataUrl)).blob()
        const file = new File([blob], fname, { type: 'image/png' })
        const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean }
        if (nav.canShare && nav.canShare({ files: [file] })) {
          await nav.share({ files: [file] } as ShareData)
          return
        }
      } catch { /* ยกเลิก share หรือไม่รองรับ → ดาวน์โหลดแทน */ }
      const a = document.createElement('a')
      a.href = dataUrl; a.download = fname; a.click()
    } catch (e) {
      console.error('[export] error:', e)
      alert('บันทึกรูปไม่สำเร็จ ลองใหม่อีกครั้ง')
    } finally {
      scrollers.forEach((s, i) => { s.style.overflow = prevOverflow[i] })
      hidden.forEach((h, i) => { h.style.display = prevDisplay[i] })
      node.style.padding = prevPadding
      setExporting(false)
    }
  }

  // การ์ดปฏิทินราย mobile — reuse ได้ทั้งใน group และ pinned "เวรของฉัน"
  function renderMobileCard(member: StaffMember, animIdx: number, pinned = false) {
    const realIdx = staff.indexOf(member)
    return (
      <div
        key={pinned ? `pin-${realIdx}` : realIdx}
        className={`anim-fade-up rounded-2xl bg-[var(--md-surface)] md-elev-2 border overflow-hidden transition-colors duration-300 ${pinned ? 'ring-2 ring-teal-400 dark:ring-teal-500 border-transparent' : 'border-gray-100 dark:border-gray-700/50'}`}
        style={{ animationDelay: `${animIdx * 55}ms` }}
      >
        {/* Card header — 16dp padding */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100 dark:border-gray-700/60">
          {editing ? (
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <input className="md-body-m border dark:border-gray-600 rounded-xl px-3 py-1.5 w-28 bg-[var(--md-surface-variant)] dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-teal-400" value={member.name} placeholder="ชื่อ" aria-label="ชื่อ" onChange={e => patchStaff(realIdx, { name: e.target.value })} />
              <input className="md-body-m border dark:border-gray-600 rounded-xl px-3 py-1.5 w-28 bg-[var(--md-surface-variant)] dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-teal-400" value={member.phone ?? ''} placeholder="เบอร์โทร" aria-label="เบอร์โทร" inputMode="tel" onChange={e => patchStaff(realIdx, { phone: e.target.value || undefined })} />
              <select aria-label="ตำแหน่ง" className="md-label-m border dark:border-gray-600 rounded-xl px-2 py-1.5 text-gray-500 dark:text-gray-400 bg-[var(--md-surface-variant)]" value={member.role} onChange={e => patchStaff(realIdx, { role: e.target.value as StaffMember['role'] })}>
                {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
              <button onClick={() => removeStaff(realIdx)} className="text-red-400 hover:text-red-600 transition-colors w-8 h-8 flex items-center justify-center">✕</button>
            </div>
          ) : (
            <div className="flex items-center gap-2 min-w-0">
              {member.phone ? (
                <a href={telHref(member.phone)} className="md-title-m text-teal-700 dark:text-teal-300 truncate flex items-center gap-1" title={`โทร ${member.phone}`}>
                  <span className="truncate">{member.name}</span>
                  <PhoneIcon className="w-4 h-4 shrink-0" />
                </a>
              ) : (
                <span className="md-title-m text-[var(--md-on-surface)] truncate">{member.name}</span>
              )}
              {pinned && <span className="md-label-s px-1.5 py-0.5 rounded-full bg-teal-600 text-white shrink-0">ฉัน</span>}
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
                  onClick={editing ? () => cycleCell(realIdx, dayIdx) : undefined}
                  onMouseEnter={holName && !editing ? e => showHolTip(e, holName) : undefined}
                  onMouseLeave={holName && !editing ? hideHolTip : undefined}
                  onTouchStart={holName && !editing ? e => showHolTip(e, holName) : undefined}
                  onTouchEnd={holName && !editing ? hideHolTip : undefined}
                  className={`md-state flex flex-col items-center justify-between rounded-2xl border py-2 min-h-[56px] transition-all duration-150 ${
                    isRed
                      ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900/60'
                      : 'bg-[var(--md-surface)] border-gray-100 dark:border-gray-700/50'
                  } ${editing ? 'cursor-pointer active:scale-95' : ''}`}
                >
                  <span className={`md-label-l leading-none ${isRed ? 'text-red-600 dark:text-red-400' : 'text-[var(--md-on-surface)]'}`}>{day}</span>
                  <span className={`leading-none flex items-center justify-center h-5 ${isStandby(shift) && hoursOf(member, dayIdx) > 0 ? 'md-label-m' : 'md-body-l'} ${SHIFT_STYLE[shift]}`} title={SHIFT_LABELS[shift]}>
                    {cellSymbol(shift, hoursOf(member, dayIdx)) || (editing ? '·' : '')}
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
  }

  const slideClass = slideDir === 'left' ? 'anim-slide-left' : 'anim-slide-right'

  return (
    <div className="min-h-screen bg-[var(--md-background)] transition-colors duration-300 p-2 sm:p-4">
      <div className="max-w-4xl mx-auto">
       <div ref={captureRef} className="bg-[var(--md-background)]">

        {/* ── MD3 Top App Bar ── */}
        <div className="relative bg-[var(--md-surface)] md-elev-1 rounded-t-2xl px-4 py-6 sm:px-6 sm:py-7 transition-colors duration-300">

          {/* Contact page link — absolute, left */}
          <div data-export-hide className="absolute top-4 left-4 z-10">
            <Link
              href="/contact"
              title="ข้อมูลติดต่อ"
              className="md-label-l inline-flex items-center gap-1 h-10 px-4 rounded-full bg-teal-600/10 dark:bg-teal-400/15 text-teal-700 dark:text-teal-300 transition-all duration-150 active:opacity-70 active:scale-[0.97]"
            >
              📞 ติดต่อ
            </Link>
          </div>

          {/* Online count + dark mode toggle — absolute, right */}
          <div data-export-hide className="absolute top-4 right-4 z-10 flex items-center gap-2">
            <span
              title="จำนวนคนที่เปิดดูอยู่ตอนนี้"
              aria-label={`ออนไลน์ ${onlineCount} คน`}
              className="md-label-m inline-flex items-center gap-1.5 h-8 px-2.5 rounded-full bg-teal-600/10 dark:bg-teal-400/15 text-teal-700 dark:text-teal-300"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500" />
              </span>
              {onlineCount}
            </span>
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
                    aria-label="ชื่อหน่วยงาน"
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

          {/* View tabs — iOS segmented control */}
          <div data-export-hide className="anim-header-4 flex justify-center mt-5">
            <div className="flex w-full max-w-sm gap-0.5 p-0.5 rounded-[10px] bg-[#767680]/[0.12] dark:bg-[#767680]/[0.24]">
              {([['today', 'วันนี้'], ['week', 'สัปดาห์นี้'], ['month', 'เดือนนี้']] as const).map(([v, label]) => (
                <button
                  key={v}
                  style={{ touchAction: 'manipulation' }}
                  onClick={() => switchView(v)}
                  className={`md-label-l flex-1 py-2 rounded-[8px] transition-all duration-200 ${view === v ? 'bg-white dark:bg-[#636366] text-[var(--md-on-surface)] shadow-[0_1px_4px_rgba(0,0,0,0.12)] font-semibold' : 'text-[var(--md-on-surface-var)] active:opacity-60'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* เวรของฉัน — เลือกชื่อตัวเอง */}
          <div data-export-hide className="flex justify-center items-center gap-2 mt-3">
            <div className="relative inline-flex items-center">
              <span className="absolute left-3 pointer-events-none text-sm">👤</span>
              <select
                value={meName ?? ''}
                aria-label="เลือกเวรของฉัน"
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

          {/* บันทึก/แชร์ภาพ */}
          <div data-export-hide className="flex justify-center mt-3">
            <BtnTonal onClick={exportImage}>{exporting ? 'กำลังสร้างรูป…' : '📷 แชร์เป็นรูปภาพ'}</BtnTonal>
          </div>

          {/* Month nav — month view only */}
          {view === 'month' && (
            <div data-export-hide className="flex flex-wrap justify-center items-center gap-2 mt-4">
              <BtnIcon onClick={() => stepMonth(-1)}>
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
              </BtnIcon>
              <span className="relative inline-flex items-center">
                <select
                  value={selMonth}
                  aria-label="เลือกเดือน"
                  onChange={e => { setSlideDir('left'); setContentKey(k => k + 1); setSelMonth(Number(e.target.value)) }}
                  className="md-label-l appearance-none h-10 pl-4 pr-8 rounded-full bg-gray-500/10 dark:bg-gray-400/15 text-[var(--md-on-surface)] focus:outline-none focus:ring-2 focus:ring-teal-400 transition-colors"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <option key={m} value={m}>{THAI_MONTHS[m]}</option>
                  ))}
                </select>
                <span className="absolute right-3 pointer-events-none text-[var(--md-on-surface-var)] text-[10px]">▼</span>
              </span>
              <input
                type="number"
                value={selYear}
                aria-label="ปี พ.ศ."
                onChange={e => { setSlideDir('left'); setContentKey(k => k + 1); setSelYear(Number(e.target.value)) }}
                className="md-label-l h-10 px-3 rounded-full bg-gray-500/10 dark:bg-gray-400/15 text-[var(--md-on-surface)] w-20 text-center focus:outline-none focus:ring-2 focus:ring-teal-400 transition-colors"
              />
              <BtnIcon onClick={() => stepMonth(1)}>
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
              </BtnIcon>

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
          {view === 'month' && editing && prevSource && (
            <div data-export-hide className="flex justify-center mt-3">
              <BtnTonal onClick={copyFromPrevious}>📋 ก๊อปปี้เวรจาก {THAI_MONTHS[prevSource.month]} {prevSource.thaiYear}</BtnTonal>
            </div>
          )}
          {view === 'month' && editing && (
            <p className="md-body-s text-center text-[var(--md-on-surface-var)] mt-3">
              คลิกช่องวัน (วน: ว่าง → / → ✕ → S → บ/ด → ช/บ/ด → สลับ) · คลิกเลขวันบน header = วันหยุด
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
                        onMouseEnter={holName ? e => showHolTip(e, holName) : undefined}
                        onMouseLeave={holName ? hideHolTip : undefined}
                        className={`border border-gray-600 w-9 py-1 text-center transition-colors ${isWeekend ? 'bg-red-800 dark:bg-red-950' : ''} ${editing ? 'cursor-pointer hover:bg-gray-700' : ''} ${holName && !editing ? 'cursor-help' : ''}`}
                      >
                        <div className="md-label-s leading-none mb-0.5 opacity-70">{dayAbbr}</div>
                        <div className={isWeekend ? 'rounded-full border-2 border-white/80 w-6 h-6 flex items-center justify-center mx-auto' : ''}>
                          {d}
                        </div>
                      </th>
                    )
                  })}
                  {editing && <th className="px-2 py-2 text-center w-10 font-medium text-gray-400 bg-gray-800 dark:bg-gray-950">ลบ</th>}
                </tr>
              </thead>
              <tbody>
                {roleGroups.map(({ role, rows }) => (
                  <Fragment key={role}>
                    <tr>
                      <td colSpan={monthColSpan} className="bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-0">
                        <div className="sticky left-0 w-max px-3 py-1.5 md-label-m font-semibold text-[var(--md-on-surface-var)]">
                          {ROLE_LABEL[role]} <span className="font-normal">({rows.length})</span>
                        </div>
                      </td>
                    </tr>
                    {rows.map(({ member, rowIdx, no }) => {
                      const isMe = !editing && !!meName && member.name === meName
                      const bg = isMe ? 'bg-teal-100 dark:bg-teal-900' : ROLE_BG[member.role]
                      const meEdge = isMe ? 'border-y-2 border-y-teal-500 dark:border-y-teal-400' : ''
                      return (
                        <tr key={rowIdx} className={`border-b dark:border-gray-700 ${editing ? '' : 'hover:brightness-95 dark:hover:brightness-110 transition-all duration-150'} ${bg}`}>
                          <td className={`border border-gray-200 dark:border-gray-700 text-center text-gray-500 dark:text-gray-400 py-1.5 sticky left-0 z-10 ${bg} ${meEdge} ${isMe ? 'text-teal-700 dark:text-teal-200 font-bold' : ''}`}>{no}</td>
                          <td className={`border border-gray-200 dark:border-gray-700 px-1 py-1.5 sticky left-8 z-10 ${bg} ${meEdge} ${editing ? '' : `font-medium whitespace-nowrap ${isMe ? 'text-teal-700 dark:text-teal-200 font-bold' : 'text-[var(--md-on-surface)]'}`}`}>
                            {editing ? (
                              <div className="flex flex-col gap-0.5">
                                <input className="border dark:border-gray-600 rounded-lg px-1 py-0.5 w-24 text-xs bg-white dark:bg-gray-700 dark:text-gray-200" value={member.name} placeholder="ชื่อ" aria-label="ชื่อ" onChange={e => patchStaff(rowIdx, { name: e.target.value })} />
                                <input className="border dark:border-gray-600 rounded-lg px-1 py-0.5 w-24 text-[10px] bg-white dark:bg-gray-700 dark:text-gray-200" value={member.phone ?? ''} placeholder="เบอร์โทร" aria-label="เบอร์โทร" onChange={e => patchStaff(rowIdx, { phone: e.target.value || undefined })} />
                                <select aria-label="ตำแหน่ง" className="border dark:border-gray-600 rounded-lg px-1 py-0.5 w-24 text-[10px] text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-700" value={member.role} onChange={e => patchStaff(rowIdx, { role: e.target.value as StaffMember['role'] })}>
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
                                  {cellSymbol(shift, hoursOf(member, dayIdx)) || (editing ? '·' : '')}
                                </span>
                              </td>
                            )
                          })}
                          {editing && (
                            <td className="text-center px-2 bg-[var(--md-surface)]">
                              <button
                                onClick={() => removeStaff(rowIdx)}
                                title={`ลบ ${member.name}`}
                                aria-label={`ลบ ${member.name}`}
                                className="inline-flex items-center justify-center w-7 h-7 rounded-full text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 hover:text-red-700 transition-colors"
                              >
                                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6" />
                                  <path d="M10 11v6M14 11v6" />
                                </svg>
                              </button>
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
            {!editing && meName && (() => {
              const meMember = mobileStaff.find(m => m.name === meName)
              if (!meMember) return null
              return (
                <Fragment>
                  <p className="md-title-s text-teal-700 dark:text-teal-300 px-1 pt-1 font-semibold">เวรของฉัน</p>
                  {renderMobileCard(meMember, 0, true)}
                </Fragment>
              )
            })()}
            {ROLES.map(role => {
              const group = mobileStaff.filter(m => m.role === role)
              if (!group.length) return null
              return (
                <Fragment key={role}>
                  <p className="md-title-s text-[var(--md-on-surface-var)] px-1 pt-1">{ROLE_LABEL[role]} <span className="font-normal">({group.length})</span></p>
                  {group.map((member, gi) => renderMobileCard(member, gi))}
                </Fragment>
              )
            })}
            {editing && (
              <div className="pt-1 pb-4">
                <BtnOutlined onClick={addStaff} className="w-full justify-center">+ เพิ่มคน</BtnOutlined>
              </div>
            )}
          </div>

          {editing && <StandbyHoursPanel data={data} onSet={setStandbyHour} />}
          {!editing && <MonthSummary data={data} />}

        </div>}{/* end month view */}

       </div>{/* end capture area */}

        {/* Footer */}
        <div className="anim-fade-up bg-[var(--md-surface)] md-elev-1 mt-4 rounded-2xl px-4 py-4 sm:px-6 sm:py-5 md-body-s text-[var(--md-on-surface-var)] space-y-1.5 transition-colors duration-300">
          <p>หมายเหตุ: S = standby</p>
          <p>เงินเวรพยาบาล บ/ด 1,200/เวร · standby ชม.ละ 200 บาท</p>
          <p>เงินเวรนักเทคโนโลยีหัวใจและทรวงอก standby ชม.ละ 400 บาท</p>
          <p>เวรเช้าบ่ายดึก (ช/บ/ด) 3,600 บาท/วัน</p>
        </div>
      </div>

      {showPin && <PinModal onCancel={() => setShowPin(false)} onSubmit={unlock} />}

      {/* Holiday tooltip bubble — fixed position, escapes overflow */}
      {holTip && (
        <div
          className="pointer-events-none fixed z-[9999] -translate-x-1/2 -translate-y-full"
          style={{ left: holTip.x, top: holTip.y - 8 }}
        >
          <div className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 md-label-m px-3 py-1.5 rounded-lg shadow-xl whitespace-nowrap">
            {holTip.text}
          </div>
          <div className="mx-auto w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-gray-900 dark:border-t-gray-100" />
        </div>
      )}
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
          aria-label="PIN"
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
