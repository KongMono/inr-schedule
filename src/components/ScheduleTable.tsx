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

const SHIFT_STYLE: Record<ShiftCode, string> = {
  M: 'text-blue-700 font-semibold',
  A: 'text-red-600 font-bold text-lg leading-none',
  N: 'text-purple-700 font-semibold',
  N2: 'text-purple-700 font-semibold',
  OFF: 'text-gray-400 text-xs',
  SWAP: 'text-orange-500 text-xs',
  '-': 'text-gray-300',
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

const ROLE_BG: Record<string, string> = {
  doctor: 'bg-blue-50',
  nurse: 'bg-white',
  tech: 'bg-green-50',
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
        <span className="text-blue-700 font-semibold text-lg">/</span>
        <span className="text-gray-600">แพทย์เวร</span>
      </span>
      <span className="flex items-center gap-1">
        <span className="text-red-600 font-bold text-lg">✕</span>
        <span className="text-gray-600">ไม่อยู่เวร</span>
      </span>
      <span className="flex items-center gap-1">
        <span className="text-purple-700 font-semibold">S</span>
        <span className="text-gray-600">standby</span>
      </span>
      <span className="flex items-center gap-1">
        <span className="text-gray-400 text-xs">บ/ด</span>
        <span className="text-gray-600">เวรบ่ายดึก</span>
      </span>
      <span className="flex items-center gap-1 bg-red-50 px-2 rounded border border-red-200 text-red-500 text-xs">
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

  // โหลดจาก Supabase หลัง mount (กัน SSR mismatch)
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
      setHydrated(true)
    })
    return () => {
      alive = false
    }
  }, [])

  const existingIdx = schedules.findIndex((m) => m.month === selMonth && m.thaiYear === selYear)
  const exists = existingIdx >= 0
  const template = schedules.length ? schedules[schedules.length - 1] : undefined
  const data = useMemo<ScheduleData>(
    () => (exists ? schedules[existingIdx] : createEmptyMonth(selMonth, selYear, template)),
    [exists, existingIdx, schedules, selMonth, selYear, template],
  )

  // บันทึกเดือนที่กำลังดู → Supabase (debounce กันยิงถี่ตอนคลิก cell)
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
    return <div className="min-h-screen bg-gray-100 p-4 text-gray-400 text-sm">กำลังโหลด...</div>
  }

  const { department, totalDays, weekendDays, staff } = data
  const days = Array.from({ length: totalDays }, (_, i) => i + 1)
  const numOrUndef = (v: string) => (v === '' ? undefined : Number(v))

  // ===== mutations (สร้างเดือนอัตโนมัติถ้ายังไม่มี) =====
  function updateCurrent(fn: (m: ScheduleData) => ScheduleData) {
    setSchedules((prev) => {
      const i = prev.findIndex((m) => m.month === selMonth && m.thaiYear === selYear)
      if (i >= 0) return prev.map((m, idx) => (idx === i ? fn(m) : m))
      const base = createEmptyMonth(selMonth, selYear, prev[prev.length - 1])
      return [...prev, fn(base)].sort(byDate)
    })
  }
  function cycleCell(staffIdx: number, dayIdx: number) {
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
    <div className="min-h-screen bg-gray-100 p-2 sm:p-4">
      <div className="max-w-full">
        {/* Header */}
        <div className="bg-white rounded-t-xl shadow px-3 py-3 sm:px-6 sm:py-4 mb-0">
          <div className="text-center">
            <h1 className="text-base sm:text-xl font-bold text-gray-800">
              ตารางเวร ประจำเดือน{' '}
              <span className="text-blue-700">{THAI_MONTHS[selMonth]} {selYear}</span>
            </h1>
            <input
              className="mt-1 text-sm sm:text-base font-semibold text-gray-600 text-center border border-transparent hover:border-gray-200 focus:border-blue-300 rounded px-2 py-0.5 w-full max-w-md focus:outline-none"
              value={department}
              onChange={(e) => updateCurrent((m) => ({ ...m, department: e.target.value }))}
            />
          </div>

          {/* Month / Year picker */}
          <div className="flex flex-wrap justify-center items-center gap-2 mt-3">
            <button onClick={() => stepMonth(-1)} className="rounded-lg w-8 h-8 bg-gray-100 text-gray-600 text-lg leading-none">‹</button>
            <select
              value={selMonth}
              onChange={(e) => setSelMonth(Number(e.target.value))}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-700 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>{THAI_MONTHS[m]}</option>
              ))}
            </select>
            <input
              type="number"
              value={selYear}
              onChange={(e) => setSelYear(Number(e.target.value))}
              className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-700 bg-white shadow-sm w-20 text-center focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <button onClick={() => stepMonth(1)} className="rounded-lg w-8 h-8 bg-gray-100 text-gray-600 text-lg leading-none">›</button>

            {exists && (
              <button onClick={deleteMonth} className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 border border-red-200">
                ลบเดือนนี้
              </button>
            )}
            <button onClick={doReset} className="rounded-lg px-2 py-1.5 text-xs text-gray-400 border border-gray-200">
              รีเซ็ต
            </button>
          </div>

          {!exists && (
            <p className="text-center text-xs text-amber-600 bg-amber-50 rounded-lg py-1.5 mt-2 max-w-md mx-auto">
              ยังไม่มีข้อมูลเดือนนี้ — คลิกช่องวันหรือเพิ่มคนเพื่อเริ่มสร้าง (บันทึกอัตโนมัติ)
            </p>
          )}
          <p className="text-center text-xs text-gray-400 mt-2">
            คลิกช่องวันเพื่อสลับเวร (วน: ว่าง → / → ✕ → S → S → บ/ด → สลับ) · คลิกเลขวันบนหัวตารางเพื่อตั้งวันหยุด
          </p>

          <Legend />
        </div>

        {/* ===== Desktop: table ===== */}
        <div className="hidden md:block bg-white shadow rounded-b-xl overflow-x-auto">
          <table className="text-xs border-collapse w-full" style={{ minWidth: '1100px' }}>
            <thead>
              <tr className="bg-gray-700 text-white">
                <th className="border border-gray-500 px-2 py-2 text-center w-8 sticky left-0 z-20 bg-gray-700">ลำดับ</th>
                <th className="border border-gray-500 px-3 py-2 text-left w-28 sticky left-8 z-20 bg-gray-700">ชื่อ-นามสกุล</th>
                {days.map((d) => {
                  const isWeekend = weekendDays.includes(d)
                  return (
                    <th
                      key={d}
                      onClick={() => toggleWeekend(d)}
                      className={`border border-gray-500 w-7 py-2 text-center cursor-pointer ${isWeekend ? 'bg-red-700' : ''}`}
                    >
                      <div className={isWeekend ? 'rounded-full border-2 border-white w-5 h-5 flex items-center justify-center mx-auto text-xs' : ''}>
                        {d}
                      </div>
                    </th>
                  )
                })}
                <th className="border border-gray-500 px-1 py-2 text-center w-8">ทำ</th>
                <th className="border border-gray-500 px-1 py-2 text-center w-8">OT</th>
                <th className="border border-gray-500 px-1 py-2 text-center w-8">เวร</th>
                <th className="border border-gray-500 px-1 py-2 text-center w-8"></th>
              </tr>
            </thead>
            <tbody>
              {staff.map((member, rowIdx) => {
                const bg = ROLE_BG[member.role]
                return (
                  <tr key={rowIdx} className={`border-b ${bg}`}>
                    <td className={`border border-gray-200 text-center text-gray-500 py-1.5 sticky left-0 z-10 ${bg}`}>
                      {rowIdx + 1}
                    </td>
                    <td className={`border border-gray-200 px-1 py-1.5 sticky left-8 z-10 ${bg}`}>
                      <div className="flex flex-col gap-0.5">
                        <input
                          className="border rounded px-1 py-0.5 w-24 text-xs"
                          value={member.name}
                          placeholder="ชื่อ"
                          onChange={(e) => patchStaff(rowIdx, { name: e.target.value })}
                        />
                        <select
                          className="border rounded px-1 py-0.5 w-24 text-[10px] text-gray-500"
                          value={member.role}
                          onChange={(e) => patchStaff(rowIdx, { role: e.target.value as StaffMember['role'] })}
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                          ))}
                        </select>
                      </div>
                    </td>
                    {member.shifts.map((shift, dayIdx) => {
                      const day = dayIdx + 1
                      const isWeekend = weekendDays.includes(day)
                      return (
                        <td
                          key={dayIdx}
                          onClick={() => cycleCell(rowIdx, dayIdx)}
                          className={`border border-gray-200 text-center py-1.5 cursor-pointer hover:bg-yellow-100 ${isWeekend ? 'bg-red-50' : ''}`}
                        >
                          <span className={SHIFT_STYLE[shift]} title={SHIFT_LABELS[shift]}>
                            {SHIFT_DISPLAY[shift] || '·'}
                          </span>
                        </td>
                      )
                    })}
                    <td className="border border-gray-200 p-0.5">
                      <input className="w-7 text-center text-xs border rounded" value={member.totalWork ?? ''} placeholder={String(countWork(member) || '')} onChange={(e) => patchStaff(rowIdx, { totalWork: numOrUndef(e.target.value) })} />
                    </td>
                    <td className="border border-gray-200 p-0.5">
                      <input className="w-7 text-center text-xs border rounded" value={member.totalOT ?? ''} onChange={(e) => patchStaff(rowIdx, { totalOT: numOrUndef(e.target.value) })} />
                    </td>
                    <td className="border border-gray-200 p-0.5">
                      <input className="w-7 text-center text-xs border rounded" value={member.totalNight ?? ''} placeholder={String(countNight(member) || '')} onChange={(e) => patchStaff(rowIdx, { totalNight: numOrUndef(e.target.value) })} />
                    </td>
                    <td className="border border-gray-200 text-center">
                      <button onClick={() => removeStaff(rowIdx)} className="text-red-500 text-xs px-1">✕</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="p-2">
            <button onClick={addStaff} className="text-sm text-blue-600 border border-blue-200 rounded-lg px-3 py-1">+ เพิ่มแถว</button>
          </div>
        </div>

        {/* ===== Mobile: card list ===== */}
        <div className="md:hidden bg-gray-100 rounded-b-xl space-y-3 pt-3">
          {staff.map((member, i) => (
            <div key={i} className={`rounded-xl shadow-sm border border-gray-200 p-3 ${ROLE_BG[member.role]}`}>
              <div className="flex items-center justify-between mb-2 gap-2">
                <div className="flex items-center gap-1 min-w-0">
                  <input className="border rounded px-1 py-0.5 text-sm w-28" value={member.name} placeholder="ชื่อ" onChange={(e) => patchStaff(i, { name: e.target.value })} />
                  <select className="border rounded px-1 py-0.5 text-[10px] text-gray-500" value={member.role} onChange={(e) => patchStaff(i, { role: e.target.value as StaffMember['role'] })}>
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                  </select>
                  <button onClick={() => removeStaff(i)} className="text-red-500 text-xs px-1">✕</button>
                </div>
                <div className="flex gap-2 text-xs shrink-0">
                  <span className="text-gray-700">ทำ {member.totalWork ?? (countWork(member) || '-')}</span>
                  <span className="text-blue-600">OT {member.totalOT ?? '-'}</span>
                  <span className="text-purple-600">เวร {member.totalNight ?? (countNight(member) || '-')}</span>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {member.shifts.map((shift, dayIdx) => {
                  const day = dayIdx + 1
                  const isWeekend = weekendDays.includes(day)
                  return (
                    <div
                      key={dayIdx}
                      onClick={() => cycleCell(i, dayIdx)}
                      className={`flex flex-col items-center justify-center rounded border py-1 cursor-pointer active:bg-yellow-100 ${isWeekend ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'}`}
                    >
                      <span className={`text-[10px] leading-none ${isWeekend ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>{day}</span>
                      <span className={`h-4 flex items-center ${SHIFT_STYLE[shift]}`} title={SHIFT_LABELS[shift]}>
                        {SHIFT_DISPLAY[shift] || '·'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
          <button onClick={addStaff} className="w-full text-sm text-blue-600 border border-blue-200 bg-white rounded-xl py-2">+ เพิ่มคน</button>
        </div>

        {/* Footer notes */}
        <div className="bg-white mt-3 rounded-xl shadow px-4 py-3 sm:px-6 text-xs text-gray-600 space-y-1">
          <p>หมายเหตุ: S = standby</p>
          <p>เงินเวรพยาบาล 1,200/เวร</p>
          <p>เงินเวรนักเทคโนหัวใจ 1,600/เวร เวรละ 200 บาท</p>
        </div>
      </div>
    </div>
  )
}
