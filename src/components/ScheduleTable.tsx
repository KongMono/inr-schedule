'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  SHIFT_LABELS,
  THAI_MONTHS,
  type ScheduleData,
  type ShiftCode,
  type StaffMember,
} from '@/data/schedule'
import { createEmptyMonth, emptyStaff, nextShift } from '@/lib/scheduleStore'
import { fetchSchedules, saveMonth, removeMonth, resetAll } from '@/lib/scheduleRepo'

// soft gate เท่านั้น — ไม่ใช่ security จริง (PIN อยู่ฝั่ง client)
const EDIT_PIN = '11223344'
const EDIT_KEY = 'inr-schedule:edit'
const THEME_KEY = 'inr-schedule:theme'

const SHIFT_STYLE: Record<ShiftCode, string> = {
  M: 'text-blue-600 dark:text-blue-400 font-semibold',
  A: 'text-red-600 dark:text-red-400 font-bold text-lg leading-none',
  N: 'text-purple-600 dark:text-purple-400 font-semibold',
  N2: 'text-purple-600 dark:text-purple-400 font-semibold',
  OFF: 'text-gray-400 dark:text-gray-500 text-xs',
  SWAP: 'text-orange-500 dark:text-orange-400 text-xs',
  '-': 'text-gray-300 dark:text-gray-600',
}

const SHIFT_DISPLAY: Record<ShiftCode, string> = {
  M: '/',
  A: '✕',
  N: 'S',
  N2: 'S',
  OFF: 'บ/ด',
  SWAP: 'สลับ',
  '-': '',
}

const DAY_ABBR = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']

const ROLE_BG: Record<string, string> = {
  doctor: 'bg-blue-50 dark:bg-blue-950/40',
  nurse: 'bg-white dark:bg-gray-800',
  tech: 'bg-green-50 dark:bg-green-950/40',
}

const ROLE_LABEL: Record<string, string> = {
  doctor: 'แพทย์',
  nurse: 'พยาบาล',
  tech: 'นักเทคโน',
}

const ROLES: StaffMember['role'][] = ['doctor', 'nurse', 'tech']

function countWork(m: StaffMember) {
  return m.shifts.filter((s) => s === 'M' || s === 'A').length
}
function countNight(m: StaffMember) {
  return m.shifts.filter((s) => s === 'N' || s === 'N2').length
}
function byDate(a: ScheduleData, b: ScheduleData) {
  return a.thaiYear - b.thaiYear || a.month - b.month
}

function Legend() {
  return (
    <div className="flex flex-wrap justify-center gap-x-3 gap-y-1.5 sm:gap-4 mt-3 text-xs sm:text-sm">
      <span className="flex items-center gap-1">
        <span className="text-gray-400 dark:text-gray-500 text-xs">บ/ด</span>
        <span className="text-gray-600 dark:text-gray-300">เวรบ่ายดึก</span>
      </span>
      <span className="flex items-center gap-1">
        <span className="text-blue-600 dark:text-blue-400 font-semibold text-lg">/</span>
        <span className="text-gray-600 dark:text-gray-300">แพทย์เวร</span>
      </span>
      <span className="flex items-center gap-1">
        <span className="text-red-600 dark:text-red-400 font-bold text-lg">✕</span>
        <span className="text-gray-600 dark:text-gray-300">ไม่อยู่เวร</span>
      </span>
      <span className="flex items-center gap-1">
        <span className="text-purple-600 dark:text-purple-400 font-semibold">S</span>
        <span className="text-gray-600 dark:text-gray-300">standby</span>
      </span>
      <span className="flex items-center gap-1 bg-red-50 dark:bg-red-950/60 px-2 rounded border border-red-200 dark:border-red-900 text-red-500 dark:text-red-400 text-xs">
        วงกลม = วันหยุดราชการ
      </span>
    </div>
  )
}

export default function ScheduleTable() {
  const [schedules, setSchedules] = useState<ScheduleData[]>([])
  const [hydrated, setHydrated] = useState(false)
  const [selMonth, setSelMonth] = useState(1)
  const [selYear, setSelYear] = useState(2569)
  const [editing, setEditing] = useState(false)
  const [showPin, setShowPin] = useState(false)
  const [dark, setDark] = useState(false)

  // โหลดจาก Supabase หลัง mount + init dark mode
  useEffect(() => {
    let alive = true
    fetchSchedules().then((loaded) => {
      if (!alive) return
      setSchedules(loaded)
      const last = loaded[loaded.length - 1]
      if (last) {
        setSelMonth(last.month)
        setSelYear(last.thaiYear)
      }
      if (typeof window !== 'undefined' && sessionStorage.getItem(EDIT_KEY) === '1') {
        setEditing(true)
      }
      // dark mode: saved preference → system preference
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

  const existingIdx = schedules.findIndex((m) => m.month === selMonth && m.thaiYear === selYear)
  const exists = existingIdx >= 0
  const template = schedules.length ? schedules[schedules.length - 1] : undefined
  const data = useMemo<ScheduleData>(
    () => (exists ? schedules[existingIdx] : createEmptyMonth(selMonth, selYear, template)),
    [exists, existingIdx, schedules, selMonth, selYear, template],
  )

  // บันทึกเดือนที่กำลังดู → Supabase (debounce)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!hydrated) return
    const m = schedules.find((s) => s.month === selMonth && s.thaiYear === selYear)
    if (!m) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => saveMonth(m), 600)
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [schedules, selMonth, selYear, hydrated])

  if (!hydrated) {
    return <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-4 text-gray-400 text-sm">กำลังโหลด...</div>
  }

  const { department, totalDays, weekendDays, staff } = data
  const days = Array.from({ length: totalDays }, (_, i) => i + 1)
  const mobileStaff = editing ? staff : staff.filter((m) => m.name)
  const numOrUndef = (v: string) => (v === '' ? undefined : Number(v))

  // calendar grid offset (จ=0 ... อา=6)
  const calOffset = (new Date(data.year, data.month - 1, 1).getDay() + 6) % 7
  const calEndPad = (calOffset + totalDays) % 7 === 0 ? 0 : 7 - ((calOffset + totalDays) % 7)

  function unlock(pin: string): boolean {
    if (pin !== EDIT_PIN) return false
    setEditing(true)
    sessionStorage.setItem(EDIT_KEY, '1')
    setShowPin(false)
    return true
  }
  function lock() {
    setEditing(false)
    sessionStorage.removeItem(EDIT_KEY)
  }

  function updateCurrent(fn: (m: ScheduleData) => ScheduleData) {
    setSchedules((prev) => {
      const i = prev.findIndex((m) => m.month === selMonth && m.thaiYear === selYear)
      if (i >= 0) return prev.map((m, idx) => (idx === i ? fn(m) : m))
      const base = createEmptyMonth(selMonth, selYear, prev[prev.length - 1])
      return [...prev, fn(base)].sort(byDate)
    })
  }
  function cycleCell(staffIdx: number, dayIdx: number) {
    if (!editing) return
    updateCurrent((m) => ({
      ...m,
      staff: m.staff.map((s, si) =>
        si === staffIdx
          ? { ...s, shifts: s.shifts.map((sh, di) => (di === dayIdx ? nextShift(sh) : sh)) }
          : s,
      ),
    }))
  }
  function patchStaff(staffIdx: number, patch: Partial<StaffMember>) {
    updateCurrent((m) => ({
      ...m,
      staff: m.staff.map((s, si) => (si === staffIdx ? { ...s, ...patch } : s)),
    }))
  }
  function addStaff() {
    updateCurrent((m) => ({ ...m, staff: [...m.staff, emptyStaff('nurse', m.totalDays)] }))
  }
  function removeStaff(staffIdx: number) {
    updateCurrent((m) => ({ ...m, staff: m.staff.filter((_, i) => i !== staffIdx) }))
  }
  function toggleWeekend(day: number) {
    if (!editing) return
    updateCurrent((m) => ({
      ...m,
      weekendDays: m.weekendDays.includes(day)
        ? m.weekendDays.filter((d) => d !== day)
        : [...m.weekendDays, day].sort((a, b) => a - b),
    }))
  }
  function stepMonth(delta: number) {
    let m = selMonth + delta
    let y = selYear
    if (m < 1) { m = 12; y -= 1 }
    if (m > 12) { m = 1; y += 1 }
    setSelMonth(m)
    setSelYear(y)
  }
  function deleteMonth() {
    if (!exists) return
    if (!confirm(`ลบข้อมูลเดือน ${THAI_MONTHS[selMonth]} ${selYear}?`)) return
    removeMonth(selMonth, selYear)
    setSchedules((prev) => prev.filter((m) => !(m.month === selMonth && m.thaiYear === selYear)))
  }
  function doReset() {
    if (!confirm('รีเซ็ตข้อมูลทั้งหมดกลับเป็นค่าเริ่มต้น? (ลบทุกเดือนใน cloud)')) return
    resetAll().then((seed) => {
      setSchedules(seed)
      const last = seed[seed.length - 1]
      if (last) {
        setSelMonth(last.month)
        setSelYear(last.thaiYear)
      }
    })
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-2 sm:p-4 transition-colors">
      <div className="max-w-full">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-t-xl shadow px-3 py-3 sm:px-6 sm:py-4 mb-0">
          <div className="text-center relative">
            {/* Dark mode toggle */}
            <button
              onClick={toggleDark}
              className="absolute right-0 top-0 w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 text-base flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              title={dark ? 'เปลี่ยนเป็น Light Mode' : 'เปลี่ยนเป็น Dark Mode'}
            >
              {dark ? '☀' : '☾'}
            </button>

            <h1 className="text-base sm:text-xl font-bold text-gray-800 dark:text-gray-100">
              ตารางเวร ประจำเดือน{' '}
              <span className="text-blue-600 dark:text-blue-400">{THAI_MONTHS[selMonth]} {selYear}</span>
            </h1>
            {editing ? (
              <input
                className="mt-1 text-sm sm:text-base font-semibold text-gray-600 dark:text-gray-300 dark:bg-gray-800 text-center border border-transparent hover:border-gray-200 dark:hover:border-gray-600 focus:border-blue-300 rounded px-2 py-0.5 w-full max-w-md focus:outline-none"
                value={department}
                onChange={(e) => updateCurrent((m) => ({ ...m, department: e.target.value }))}
              />
            ) : (
              <h2 className="text-sm sm:text-base font-semibold text-gray-600 dark:text-gray-300 mt-1">{department}</h2>
            )}
          </div>

          {/* Month / Year picker */}
          <div className="flex flex-wrap justify-center items-center gap-2 mt-3">
            <button onClick={() => stepMonth(-1)} className="rounded-lg w-8 h-8 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-lg leading-none">‹</button>
            <select
              value={selMonth}
              onChange={(e) => setSelMonth(Number(e.target.value))}
              className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>{THAI_MONTHS[m]}</option>
              ))}
            </select>
            <input
              type="number"
              value={selYear}
              onChange={(e) => setSelYear(Number(e.target.value))}
              className="border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 text-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 shadow-sm w-20 text-center focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <button onClick={() => stepMonth(1)} className="rounded-lg w-8 h-8 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-lg leading-none">›</button>

            {editing ? (
              <>
                {exists && (
                  <button onClick={deleteMonth} className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800">
                    ลบเดือนนี้
                  </button>
                )}
                <button onClick={doReset} className="rounded-lg px-2 py-1.5 text-xs text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-600">รีเซ็ต</button>
                <button onClick={lock} className="rounded-lg px-3 py-1.5 text-sm font-medium bg-green-600 dark:bg-green-700 text-white shadow-sm">🔒 ล็อก</button>
              </>
            ) : (
              <button onClick={() => setShowPin(true)} className="rounded-lg px-3 py-1.5 text-sm font-medium bg-gray-700 dark:bg-gray-600 text-white shadow-sm">✎ แก้ไข</button>
            )}
          </div>

          {editing && !exists && (
            <p className="text-center text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 rounded-lg py-1.5 mt-2 max-w-md mx-auto">
              ยังไม่มีข้อมูลเดือนนี้ — คลิกช่องวันหรือเพิ่มคนเพื่อเริ่มสร้าง (บันทึกอัตโนมัติ)
            </p>
          )}
          {!editing && !exists && (
            <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-2">ยังไม่มีข้อมูลเดือนนี้</p>
          )}
          {editing && (
            <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-2">
              คลิกช่องวันเพื่อสลับเวร (วน: ว่าง → / → ✕ → S → S → บ/ด → สลับ) · คลิกเลขวันบนหัวตารางเพื่อตั้งวันหยุด
            </p>
          )}

          <Legend />
        </div>

        {/* ===== Desktop: table ===== */}
        <div className="hidden md:block bg-white dark:bg-gray-800 shadow rounded-b-xl overflow-x-auto">
          <table className="text-xs border-collapse w-full" style={{ minWidth: '1100px' }}>
            <thead>
              <tr className="bg-gray-700 dark:bg-gray-900 text-white">
                <th className="border border-gray-500 dark:border-gray-700 px-2 py-2 text-center w-8 sticky left-0 z-20 bg-gray-700 dark:bg-gray-900">ลำดับ</th>
                <th className="border border-gray-500 dark:border-gray-700 px-3 py-2 text-left w-28 sticky left-8 z-20 bg-gray-700 dark:bg-gray-900">ชื่อ-นามสกุล</th>
                {days.map((d) => {
                  const isWeekend = weekendDays.includes(d)
                  const dayAbbr = DAY_ABBR[new Date(data.year, data.month - 1, d).getDay()]
                  return (
                    <th
                      key={d}
                      onClick={editing ? () => toggleWeekend(d) : undefined}
                      className={`border border-gray-500 dark:border-gray-700 w-7 py-1 text-center ${isWeekend ? 'bg-red-700 dark:bg-red-900' : ''} ${editing ? 'cursor-pointer' : ''}`}
                    >
                      <div className="text-[8px] leading-none mb-0.5 opacity-75">{dayAbbr}</div>
                      <div className={isWeekend ? 'rounded-full border-2 border-white w-5 h-5 flex items-center justify-center mx-auto text-xs' : ''}>
                        {d}
                      </div>
                    </th>
                  )
                })}
                <th className="border border-gray-500 dark:border-gray-700 px-1 py-2 text-center w-8">ทำ</th>
                <th className="border border-gray-500 dark:border-gray-700 px-1 py-2 text-center w-8">OT</th>
                <th className="border border-gray-500 dark:border-gray-700 px-1 py-2 text-center w-8">เวร</th>
                {editing && <th className="border border-gray-500 dark:border-gray-700 px-1 py-2 text-center w-8"></th>}
              </tr>
            </thead>
            <tbody>
              {staff.map((member, rowIdx) => {
                if (!member.name && !editing) {
                  return (
                    <tr key={rowIdx} className="border-b dark:border-gray-700">
                      <td className="border border-gray-200 dark:border-gray-700 text-center text-gray-400 py-2 sticky left-0 z-10 bg-white dark:bg-gray-800">{rowIdx + 1}</td>
                      <td className="border border-gray-200 dark:border-gray-700 px-2 py-2 text-gray-300 dark:text-gray-600 italic text-xs sticky left-8 z-10 bg-white dark:bg-gray-800">-</td>
                      {days.map((d) => (<td key={d} className="border border-gray-100 dark:border-gray-700 text-center py-2"></td>))}
                      <td className="border border-gray-200 dark:border-gray-700"></td>
                      <td className="border border-gray-200 dark:border-gray-700"></td>
                      <td className="border border-gray-200 dark:border-gray-700"></td>
                    </tr>
                  )
                }
                const bg = ROLE_BG[member.role]
                return (
                  <tr key={rowIdx} className={`border-b dark:border-gray-700 ${editing ? '' : 'hover:bg-yellow-50 dark:hover:bg-yellow-900/20 transition-colors'} ${bg}`}>
                    <td className={`border border-gray-200 dark:border-gray-700 text-center text-gray-500 dark:text-gray-400 py-1.5 sticky left-0 z-10 ${bg}`}>
                      {rowIdx + 1}
                    </td>
                    <td className={`border border-gray-200 dark:border-gray-700 px-1 py-1.5 sticky left-8 z-10 ${bg} ${editing ? '' : 'font-medium text-gray-800 dark:text-gray-100 whitespace-nowrap'}`}>
                      {editing ? (
                        <div className="flex flex-col gap-0.5">
                          <input className="border dark:border-gray-600 rounded px-1 py-0.5 w-24 text-xs bg-white dark:bg-gray-700 dark:text-gray-200" value={member.name} placeholder="ชื่อ" onChange={(e) => patchStaff(rowIdx, { name: e.target.value })} />
                          <select className="border dark:border-gray-600 rounded px-1 py-0.5 w-24 text-[10px] text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-700" value={member.role} onChange={(e) => patchStaff(rowIdx, { role: e.target.value as StaffMember['role'] })}>
                            {ROLES.map((r) => (<option key={r} value={r}>{ROLE_LABEL[r]}</option>))}
                          </select>
                        </div>
                      ) : (
                        member.name
                      )}
                    </td>
                    {member.shifts.map((shift, dayIdx) => {
                      const day = dayIdx + 1
                      const isWeekend = weekendDays.includes(day)
                      return (
                        <td
                          key={dayIdx}
                          onClick={editing ? () => cycleCell(rowIdx, dayIdx) : undefined}
                          className={`border border-gray-200 dark:border-gray-700 text-center py-1.5 ${isWeekend ? 'bg-red-50 dark:bg-red-950/50' : ''} ${editing ? 'cursor-pointer hover:bg-yellow-100 dark:hover:bg-yellow-900/30' : ''}`}
                        >
                          <span className={SHIFT_STYLE[shift]} title={SHIFT_LABELS[shift]}>
                            {SHIFT_DISPLAY[shift] || (editing ? '·' : '')}
                          </span>
                        </td>
                      )
                    })}
                    {editing ? (
                      <>
                        <td className="border border-gray-200 dark:border-gray-700 p-0.5">
                          <input className="w-7 text-center text-xs border dark:border-gray-600 rounded bg-white dark:bg-gray-700 dark:text-gray-200" value={member.totalWork ?? ''} placeholder={String(countWork(member) || '')} onChange={(e) => patchStaff(rowIdx, { totalWork: numOrUndef(e.target.value) })} />
                        </td>
                        <td className="border border-gray-200 dark:border-gray-700 p-0.5">
                          <input className="w-7 text-center text-xs border dark:border-gray-600 rounded bg-white dark:bg-gray-700 dark:text-gray-200" value={member.totalOT ?? ''} onChange={(e) => patchStaff(rowIdx, { totalOT: numOrUndef(e.target.value) })} />
                        </td>
                        <td className="border border-gray-200 dark:border-gray-700 p-0.5">
                          <input className="w-7 text-center text-xs border dark:border-gray-600 rounded bg-white dark:bg-gray-700 dark:text-gray-200" value={member.totalNight ?? ''} placeholder={String(countNight(member) || '')} onChange={(e) => patchStaff(rowIdx, { totalNight: numOrUndef(e.target.value) })} />
                        </td>
                        <td className="border border-gray-200 dark:border-gray-700 text-center">
                          <button onClick={() => removeStaff(rowIdx)} className="text-red-500 dark:text-red-400 text-xs px-1">✕</button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="border border-gray-200 dark:border-gray-700 text-center font-semibold text-gray-700 dark:text-gray-200 py-1.5">
                          {member.totalWork ?? (countWork(member) > 0 ? countWork(member) : '')}
                        </td>
                        <td className="border border-gray-200 dark:border-gray-700 text-center font-semibold text-blue-600 dark:text-blue-400 py-1.5">
                          {member.totalOT ?? ''}
                        </td>
                        <td className="border border-gray-200 dark:border-gray-700 text-center font-semibold text-purple-600 dark:text-purple-400 py-1.5">
                          {member.totalNight ?? (countNight(member) > 0 ? countNight(member) : '')}
                        </td>
                      </>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
          {editing && (
            <div className="p-2">
              <button onClick={addStaff} className="text-sm text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-1">+ เพิ่มแถว</button>
            </div>
          )}
        </div>

        {/* ===== Mobile: calendar cards ===== */}
        <div className="md:hidden bg-gray-100 dark:bg-gray-900 rounded-b-xl space-y-4 pt-3">
          {mobileStaff.map((member, i) => {
            const realIdx = staff.indexOf(member)
            return (
              <div key={i} className="rounded-2xl bg-slate-50 dark:bg-gray-800 shadow border border-slate-200 dark:border-gray-700 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-gray-700">
                  {editing ? (
                    <div className="flex items-center gap-1.5 min-w-0">
                      <input className="border dark:border-gray-600 rounded-lg px-2 py-1 text-sm w-28 bg-white dark:bg-gray-700 dark:text-gray-200" value={member.name} placeholder="ชื่อ" onChange={(e) => patchStaff(realIdx, { name: e.target.value })} />
                      <select className="border dark:border-gray-600 rounded-lg px-1 py-1 text-[10px] text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-700" value={member.role} onChange={(e) => patchStaff(realIdx, { role: e.target.value as StaffMember['role'] })}>
                        {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                      </select>
                      <button onClick={() => removeStaff(realIdx)} className="text-red-400 text-sm px-1">✕</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-bold text-gray-800 dark:text-gray-100 text-base truncate">{member.name}</span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-300 shrink-0">{ROLE_LABEL[member.role]}</span>
                    </div>
                  )}
                  <div className="flex gap-3 text-sm shrink-0">
                    <span className="text-gray-700 dark:text-gray-300">ทำ <strong>{member.totalWork ?? (countWork(member) || '-')}</strong></span>
                    <span className="text-blue-500 dark:text-blue-400">OT <strong>{member.totalOT ?? '-'}</strong></span>
                    <span className="text-purple-500 dark:text-purple-400">เวร <strong>{member.totalNight ?? (countNight(member) || '-')}</strong></span>
                  </div>
                </div>

                {/* Calendar grid */}
                <div className="p-2.5">
                  {/* Day-of-week header */}
                  <div className="grid grid-cols-7 gap-1.5 mb-1">
                    {['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'].map((d, ci) => (
                      <div key={d} className={`text-center text-[10px] font-semibold py-0.5 ${ci >= 5 ? 'text-red-400 dark:text-red-500' : 'text-gray-400 dark:text-gray-500'}`}>{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1.5">
                    {/* empty cells before day 1 */}
                    {Array.from({ length: calOffset }, (_, i) => (
                      <div key={`s${i}`} className={`rounded-xl min-h-[58px] ${i >= 5 ? 'bg-red-50/40 dark:bg-red-950/20' : ''}`} />
                    ))}
                    {/* day cells */}
                    {member.shifts.map((shift, dayIdx) => {
                      const day = dayIdx + 1
                      const colIdx = (calOffset + dayIdx) % 7
                      const isWeekendCol = colIdx >= 5
                      const isHoliday = weekendDays.includes(day) && !isWeekendCol
                      const isRed = isWeekendCol || isHoliday
                      return (
                        <div
                          key={dayIdx}
                          onClick={editing ? () => cycleCell(realIdx, dayIdx) : undefined}
                          className={`flex flex-col items-center justify-between rounded-xl border py-1.5 min-h-[58px] ${
                            isRed
                              ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900'
                              : 'bg-white dark:bg-gray-700 border-gray-100 dark:border-gray-600'
                          } ${editing ? 'cursor-pointer active:bg-yellow-50 dark:active:bg-yellow-900/20' : ''}`}
                        >
                          <span className={`text-sm font-bold leading-none ${isRed ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-200'}`}>{day}</span>
                          <span className={`text-base leading-none flex items-center justify-center h-5 ${SHIFT_STYLE[shift]}`} title={SHIFT_LABELS[shift]}>
                            {SHIFT_DISPLAY[shift] || (editing ? '·' : '')}
                          </span>
                        </div>
                      )
                    })}
                    {/* empty cells to complete last row */}
                    {Array.from({ length: calEndPad }, (_, i) => {
                      const colIdx = (calOffset + totalDays + i) % 7
                      return <div key={`e${i}`} className={`rounded-xl min-h-[58px] ${colIdx >= 5 ? 'bg-red-50/40 dark:bg-red-950/20' : ''}`} />
                    })}
                  </div>
                </div>
              </div>
            )
          })}
          {editing && (
            <button onClick={addStaff} className="w-full text-sm text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-800 rounded-xl py-2">+ เพิ่มคน</button>
          )}
        </div>

        {/* Footer notes */}
        <div className="bg-white dark:bg-gray-800 mt-3 rounded-xl shadow px-4 py-3 sm:px-6 text-xs text-gray-600 dark:text-gray-400 space-y-1">
          <p>หมายเหตุ: S = standby</p>
          <p>เงินเวรพยาบาล 1,200/เวร</p>
          <p>เงินเวรนักเทคโนหัวใจ 1,600/เวร เวรละ 200 บาท</p>
        </div>
      </div>

      {showPin && <PinModal onCancel={() => setShowPin(false)} onSubmit={unlock} />}
    </div>
  )
}

function PinModal({ onCancel, onSubmit }: { onCancel: () => void; onSubmit: (pin: string) => boolean }) {
  const [pin, setPin] = useState('')
  const [err, setErr] = useState(false)

  function submit() {
    if (!onSubmit(pin)) setErr(true)
  }

  return (
    <div className="fixed inset-0 bg-black/40 dark:bg-black/60 flex items-center justify-center p-4 z-50" onClick={onCancel}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-5 w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-1">ใส่ PIN เพื่อแก้ไข</h3>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">โหมดแก้ไขต้องใช้ PIN</p>
        <input
          type="password"
          inputMode="numeric"
          autoFocus
          value={pin}
          onChange={(e) => { setPin(e.target.value); setErr(false) }}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          className={`border rounded-lg px-3 py-2 w-full text-center tracking-widest bg-white dark:bg-gray-700 dark:text-gray-100 ${err ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'}`}
          placeholder="••••••••"
        />
        {err && <p className="text-xs text-red-500 dark:text-red-400 mt-1">PIN ไม่ถูกต้อง</p>}
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onCancel} className="px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400">ยกเลิก</button>
          <button onClick={submit} className="px-4 py-1.5 text-sm bg-blue-600 dark:bg-blue-700 text-white rounded-lg font-medium">ปลดล็อก</button>
        </div>
      </div>
    </div>
  )
}
