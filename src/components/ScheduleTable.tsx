'use client'

import { useEffect, useState } from 'react'
import {
  SHIFT_LABELS,
  THAI_MONTHS,
  type ScheduleData,
  type ShiftCode,
  type StaffMember,
} from '@/data/schedule'
import {
  loadSchedules,
  saveSchedules,
  resetSchedules,
  createEmptyMonth,
  emptyStaff,
  nextShift,
} from '@/lib/scheduleStore'

const SHIFT_STYLE: Record<ShiftCode, string> = {
  M: 'text-blue-700 font-semibold',
  A: 'text-red-600 font-bold text-lg leading-none',
  N: 'text-purple-700 font-semibold',
  N2: 'text-purple-700 font-semibold',
  OFF: 'text-gray-400 text-xs',
  SWAP: 'text-orange-500 text-xs',
  '-': 'text-gray-200',
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
  const [selected, setSelected] = useState(0)
  const [editMode, setEditMode] = useState(false)
  const [showAdd, setShowAdd] = useState(false)

  // โหลดจาก localStorage หลัง mount (กัน SSR mismatch)
  useEffect(() => {
    const loaded = loadSchedules()
    setSchedules(loaded)
    setSelected(loaded.length - 1)
    setHydrated(true)
  }, [])

  // persist ทุกครั้งที่เปลี่ยน
  useEffect(() => {
    if (hydrated) saveSchedules(schedules)
  }, [schedules, hydrated])

  if (!hydrated || schedules.length === 0) {
    return <div className="min-h-screen bg-gray-100 p-4 text-gray-400 text-sm">กำลังโหลด...</div>
  }

  const safeSelected = Math.min(selected, schedules.length - 1)
  const data = schedules[safeSelected]
  const { month, thaiYear, department, totalDays, weekendDays, staff } = data
  const days = Array.from({ length: totalDays }, (_, i) => i + 1)
  const mobileStaff = editMode ? staff : staff.filter((m) => m.name)

  // ===== mutations =====
  function updateSelected(fn: (m: ScheduleData) => ScheduleData) {
    setSchedules((prev) => prev.map((m, i) => (i === safeSelected ? fn(m) : m)))
  }
  function cycleCell(staffIdx: number, dayIdx: number) {
    updateSelected((m) => ({
      ...m,
      staff: m.staff.map((s, si) =>
        si === staffIdx
          ? { ...s, shifts: s.shifts.map((sh, di) => (di === dayIdx ? nextShift(sh) : sh)) }
          : s,
      ),
    }))
  }
  function patchStaff(staffIdx: number, patch: Partial<StaffMember>) {
    updateSelected((m) => ({
      ...m,
      staff: m.staff.map((s, si) => (si === staffIdx ? { ...s, ...patch } : s)),
    }))
  }
  function addStaff() {
    updateSelected((m) => ({ ...m, staff: [...m.staff, emptyStaff('nurse', m.totalDays)] }))
  }
  function removeStaff(staffIdx: number) {
    updateSelected((m) => ({ ...m, staff: m.staff.filter((_, i) => i !== staffIdx) }))
  }
  function toggleWeekend(day: number) {
    updateSelected((m) => ({
      ...m,
      weekendDays: m.weekendDays.includes(day)
        ? m.weekendDays.filter((d) => d !== day)
        : [...m.weekendDays, day].sort((a, b) => a - b),
    }))
  }
  function deleteMonth() {
    if (schedules.length <= 1) return
    setSchedules((prev) => prev.filter((_, i) => i !== safeSelected))
    setSelected((s) => Math.max(0, s - 1))
  }
  function doReset() {
    const seed = resetSchedules()
    setSchedules(seed)
    setSelected(seed.length - 1)
    setEditMode(false)
  }

  const numOrUndef = (v: string) => (v === '' ? undefined : Number(v))

  return (
    <div className="min-h-screen bg-gray-100 p-2 sm:p-4">
      <div className="max-w-full">
        {/* Header */}
        <div className="bg-white rounded-t-xl shadow px-3 py-3 sm:px-6 sm:py-4 mb-0">
          <div className="text-center">
            <h1 className="text-base sm:text-xl font-bold text-gray-800">
              ตารางเวร ประจำเดือน{' '}
              <span className="text-blue-700">{THAI_MONTHS[month]} {thaiYear}</span>
            </h1>
            {editMode ? (
              <input
                className="mt-1 text-sm sm:text-base font-semibold text-gray-600 text-center border rounded px-2 py-0.5 w-full max-w-md"
                value={department}
                onChange={(e) => updateSelected((m) => ({ ...m, department: e.target.value }))}
              />
            ) : (
              <h2 className="text-sm sm:text-base font-semibold text-gray-600 mt-1">{department}</h2>
            )}
          </div>

          {/* Controls */}
          <div className="flex flex-wrap justify-center items-center gap-2 mt-3">
            <select
              value={safeSelected}
              onChange={(e) => setSelected(Number(e.target.value))}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-700 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              {schedules.map((s, i) => (
                <option key={i} value={i}>
                  {THAI_MONTHS[s.month]} {s.thaiYear}
                </option>
              ))}
            </select>

            <button
              onClick={() => setEditMode((v) => !v)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium shadow-sm ${
                editMode ? 'bg-green-600 text-white' : 'bg-gray-700 text-white'
              }`}
            >
              {editMode ? '✓ เสร็จ' : '✎ แก้ไข'}
            </button>

            <button
              onClick={() => setShowAdd(true)}
              className="rounded-lg px-3 py-1.5 text-sm font-medium bg-blue-600 text-white shadow-sm"
            >
              + เพิ่มเดือน
            </button>

            {editMode && (
              <>
                <button
                  onClick={deleteMonth}
                  disabled={schedules.length <= 1}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium bg-red-600 text-white shadow-sm disabled:opacity-40"
                >
                  ลบเดือนนี้
                </button>
                <button
                  onClick={doReset}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium border border-gray-300 text-gray-600"
                >
                  รีเซ็ตเริ่มต้น
                </button>
              </>
            )}
          </div>

          {editMode && (
            <p className="text-center text-xs text-gray-400 mt-2">
              คลิกช่องวันเพื่อสลับเวร (วน: ว่าง → / → ✕ → S → S → บ/ด → สลับ) · คลิกเลขวันบนหัวตารางเพื่อตั้งวันหยุด · บันทึกอัตโนมัติ
            </p>
          )}

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
                      onClick={editMode ? () => toggleWeekend(d) : undefined}
                      className={`border border-gray-500 w-7 py-2 text-center ${isWeekend ? 'bg-red-700' : ''} ${editMode ? 'cursor-pointer' : ''}`}
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
                {editMode && <th className="border border-gray-500 px-1 py-2 text-center w-8"></th>}
              </tr>
            </thead>
            <tbody>
              {staff.map((member, rowIdx) => {
                if (!member.name && !editMode) {
                  return (
                    <tr key={rowIdx} className="border-b">
                      <td className="border border-gray-200 text-center text-gray-400 py-2 sticky left-0 z-10 bg-white">{member.id}</td>
                      <td className="border border-gray-200 px-2 py-2 text-gray-300 italic text-xs sticky left-8 z-10 bg-white">-</td>
                      {days.map((d) => (
                        <td key={d} className="border border-gray-100 text-center py-2"></td>
                      ))}
                      <td className="border border-gray-200"></td>
                      <td className="border border-gray-200"></td>
                      <td className="border border-gray-200"></td>
                    </tr>
                  )
                }

                const bg = ROLE_BG[member.role]
                return (
                  <tr key={rowIdx} className={`border-b hover:bg-yellow-50 transition-colors ${bg}`}>
                    <td className={`border border-gray-200 text-center text-gray-500 py-1.5 sticky left-0 z-10 ${bg}`}>
                      {rowIdx + 1}
                    </td>
                    <td className={`border border-gray-200 px-1 py-1.5 font-medium text-gray-800 whitespace-nowrap sticky left-8 z-10 ${bg}`}>
                      {editMode ? (
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
                          onClick={editMode ? () => cycleCell(rowIdx, dayIdx) : undefined}
                          className={`border border-gray-200 text-center py-1.5 ${isWeekend ? 'bg-red-50' : ''} ${editMode ? 'cursor-pointer hover:bg-yellow-100' : ''}`}
                        >
                          <span className={SHIFT_STYLE[shift]} title={SHIFT_LABELS[shift]}>
                            {SHIFT_DISPLAY[shift] || (editMode ? '·' : '')}
                          </span>
                        </td>
                      )
                    })}
                    {editMode ? (
                      <>
                        <td className="border border-gray-200 p-0.5">
                          <input className="w-7 text-center text-xs border rounded" value={member.totalWork ?? ''} onChange={(e) => patchStaff(rowIdx, { totalWork: numOrUndef(e.target.value) })} />
                        </td>
                        <td className="border border-gray-200 p-0.5">
                          <input className="w-7 text-center text-xs border rounded" value={member.totalOT ?? ''} onChange={(e) => patchStaff(rowIdx, { totalOT: numOrUndef(e.target.value) })} />
                        </td>
                        <td className="border border-gray-200 p-0.5">
                          <input className="w-7 text-center text-xs border rounded" value={member.totalNight ?? ''} onChange={(e) => patchStaff(rowIdx, { totalNight: numOrUndef(e.target.value) })} />
                        </td>
                        <td className="border border-gray-200 text-center">
                          <button onClick={() => removeStaff(rowIdx)} className="text-red-500 text-xs px-1">✕</button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="border border-gray-200 text-center font-semibold text-gray-700 py-1.5">
                          {member.totalWork ?? (countWork(member) > 0 ? countWork(member) : '')}
                        </td>
                        <td className="border border-gray-200 text-center font-semibold text-blue-600 py-1.5">
                          {member.totalOT ?? ''}
                        </td>
                        <td className="border border-gray-200 text-center font-semibold text-purple-600 py-1.5">
                          {member.totalNight ?? (countNight(member) > 0 ? countNight(member) : '')}
                        </td>
                      </>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
          {editMode && (
            <div className="p-2">
              <button onClick={addStaff} className="text-sm text-blue-600 border border-blue-200 rounded-lg px-3 py-1">+ เพิ่มแถว</button>
            </div>
          )}
        </div>

        {/* ===== Mobile: card list ===== */}
        <div className="md:hidden bg-gray-100 rounded-b-xl space-y-3 pt-3">
          {mobileStaff.map((member, i) => {
            const realIdx = staff.indexOf(member)
            return (
              <div key={i} className={`rounded-xl shadow-sm border border-gray-200 p-3 ${ROLE_BG[member.role]}`}>
                <div className="flex items-center justify-between mb-2 gap-2">
                  {editMode ? (
                    <div className="flex items-center gap-1 min-w-0">
                      <input className="border rounded px-1 py-0.5 text-sm w-28" value={member.name} placeholder="ชื่อ" onChange={(e) => patchStaff(realIdx, { name: e.target.value })} />
                      <select className="border rounded px-1 py-0.5 text-[10px] text-gray-500" value={member.role} onChange={(e) => patchStaff(realIdx, { role: e.target.value as StaffMember['role'] })}>
                        {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                      </select>
                      <button onClick={() => removeStaff(realIdx)} className="text-red-500 text-xs px-1">✕</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-semibold text-gray-800 truncate">{member.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-600 shrink-0">{ROLE_LABEL[member.role]}</span>
                    </div>
                  )}
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
                        onClick={editMode ? () => cycleCell(realIdx, dayIdx) : undefined}
                        className={`flex flex-col items-center justify-center rounded border py-1 ${isWeekend ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'} ${editMode ? 'cursor-pointer active:bg-yellow-100' : ''}`}
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
            )
          })}
          {editMode && (
            <button onClick={addStaff} className="w-full text-sm text-blue-600 border border-blue-200 bg-white rounded-xl py-2">+ เพิ่มคน</button>
          )}
        </div>

        {/* Footer notes */}
        <div className="bg-white mt-3 rounded-xl shadow px-4 py-3 sm:px-6 text-xs text-gray-600 space-y-1">
          <p>หมายเหตุ: S = standby</p>
          <p>เงินเวรพยาบาล 1,200/เวร</p>
          <p>เงินเวรนักเทคโนหัวใจ 1,600/เวร เวรละ 200 บาท</p>
        </div>
      </div>

      {showAdd && (
        <AddMonthModal
          template={data}
          onCancel={() => setShowAdd(false)}
          onCreate={(month, thaiYear, copyStaff) => {
            const m = createEmptyMonth(month, thaiYear, copyStaff ? data : undefined)
            setSchedules((prev) => [...prev, m])
            setSelected(schedules.length)
            setShowAdd(false)
            setEditMode(true)
          }}
        />
      )}
    </div>
  )
}

function AddMonthModal({
  template,
  onCancel,
  onCreate,
}: {
  template: ScheduleData
  onCancel: () => void
  onCreate: (month: number, thaiYear: number, copyStaff: boolean) => void
}) {
  const [month, setMonth] = useState(template.month === 12 ? 1 : template.month + 1)
  const [thaiYear, setThaiYear] = useState(template.month === 12 ? template.thaiYear + 1 : template.thaiYear)
  const [copyStaff, setCopyStaff] = useState(true)

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={onCancel}>
      <div className="bg-white rounded-xl shadow-xl p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold text-gray-800 mb-3">เพิ่มเดือนใหม่</h3>
        <label className="block text-sm text-gray-600 mb-1">เดือน</label>
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="border rounded-lg px-3 py-1.5 w-full mb-3 text-sm">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>{THAI_MONTHS[m]}</option>
          ))}
        </select>
        <label className="block text-sm text-gray-600 mb-1">ปี (พ.ศ.)</label>
        <input type="number" value={thaiYear} onChange={(e) => setThaiYear(Number(e.target.value))} className="border rounded-lg px-3 py-1.5 w-full mb-3 text-sm" />
        <label className="flex items-center gap-2 text-sm text-gray-600 mb-4">
          <input type="checkbox" checked={copyStaff} onChange={(e) => setCopyStaff(e.target.checked)} />
          คัดลอกรายชื่อจากเดือนปัจจุบัน (เวรว่างทั้งหมด)
        </label>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-3 py-1.5 text-sm text-gray-500">ยกเลิก</button>
          <button onClick={() => onCreate(month, thaiYear, copyStaff)} className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg font-medium">สร้าง</button>
        </div>
        {!copyStaff && <p className="text-[10px] text-gray-400 mt-2">* ไม่คัดลอก = ตารางว่าง ต้องเพิ่มคนเอง</p>}
      </div>
    </div>
  )
}
