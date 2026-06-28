'use client'

import { scheduleData, SHIFT_LABELS, WEEKEND_DAYS, THAI_MONTHS, type ShiftCode } from '@/data/schedule'

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
  OFF: 'ผ/ด',
  SWAP: 'สลับ',
  '-': '',
}

const ROLE_BG: Record<string, string> = {
  doctor: 'bg-blue-50',
  nurse: 'bg-white',
  tech: 'bg-green-50',
}

export default function ScheduleTable() {
  const { month, thaiYear, department, totalDays, staff } = scheduleData
  const days = Array.from({ length: totalDays }, (_, i) => i + 1)

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-full overflow-x-auto">
        {/* Header */}
        <div className="bg-white rounded-t-xl shadow px-6 py-4 mb-0">
          <div className="text-center">
            <h1 className="text-xl font-bold text-gray-800">
              ตารางเวร ประจำเดือน{' '}
              <span className="text-blue-700">{THAI_MONTHS[month]} {thaiYear}</span>
            </h1>
            <h2 className="text-base font-semibold text-gray-600 mt-1">{department}</h2>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap justify-center gap-4 mt-3 text-sm">
            <span className="flex items-center gap-1">
              <span className="text-blue-700 font-semibold text-lg">/</span>
              <span className="text-gray-600">เช้า</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="text-red-600 font-bold text-lg">✕</span>
              <span className="text-gray-600">บ่าย</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="text-purple-700 font-semibold">S</span>
              <span className="text-gray-600">เวรบ่าย 16.01-24.00</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="text-gray-400 text-xs">ผ/ด</span>
              <span className="text-gray-600">หยุด</span>
            </span>
            <span className="flex items-center gap-1 bg-red-50 px-2 rounded border border-red-200 text-red-500 text-xs">วงกลม = วันหยุดราชการ</span>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white shadow rounded-b-xl overflow-x-auto">
          <table className="text-xs border-collapse w-full" style={{ minWidth: '1100px' }}>
            <thead>
              <tr className="bg-gray-700 text-white">
                <th className="border border-gray-500 px-2 py-2 text-center w-8">ลำดับ</th>
                <th className="border border-gray-500 px-3 py-2 text-left w-28">ชื่อ-นามสกุล</th>
                {days.map((d) => {
                  const isWeekend = WEEKEND_DAYS.includes(d)
                  return (
                    <th
                      key={d}
                      className={`border border-gray-500 w-7 py-2 text-center ${
                        isWeekend ? 'bg-red-700' : ''
                      }`}
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
              </tr>
            </thead>
            <tbody>
              {staff.map((member, rowIdx) => {
                if (!member.name) {
                  return (
                    <tr key={rowIdx} className="border-b">
                      <td className="border border-gray-200 text-center text-gray-400 py-2">{member.id}</td>
                      <td className="border border-gray-200 px-2 py-2 text-gray-300 italic text-xs">-</td>
                      {days.map((d) => (
                        <td key={d} className="border border-gray-100 text-center py-2"></td>
                      ))}
                      <td className="border border-gray-200"></td>
                      <td className="border border-gray-200"></td>
                      <td className="border border-gray-200"></td>
                    </tr>
                  )
                }

                const countWork = member.shifts.filter((s) => s === 'M' || s === 'A').length
                const countNight = member.shifts.filter((s) => s === 'N' || s === 'N2').length

                return (
                  <tr
                    key={rowIdx}
                    className={`border-b hover:bg-yellow-50 transition-colors ${ROLE_BG[member.role]}`}
                  >
                    <td className="border border-gray-200 text-center text-gray-500 py-1.5">
                      {member.id}
                    </td>
                    <td className="border border-gray-200 px-2 py-1.5 font-medium text-gray-800 whitespace-nowrap">
                      {member.name}
                    </td>
                    {member.shifts.map((shift, dayIdx) => {
                      const day = dayIdx + 1
                      const isWeekend = WEEKEND_DAYS.includes(day)
                      return (
                        <td
                          key={dayIdx}
                          className={`border border-gray-200 text-center py-1.5 ${
                            isWeekend ? 'bg-red-50' : ''
                          }`}
                        >
                          <span
                            className={SHIFT_STYLE[shift]}
                            title={SHIFT_LABELS[shift]}
                          >
                            {SHIFT_DISPLAY[shift]}
                          </span>
                        </td>
                      )
                    })}
                    <td className="border border-gray-200 text-center font-semibold text-gray-700 py-1.5">
                      {member.totalWork ?? (countWork > 0 ? countWork : '')}
                    </td>
                    <td className="border border-gray-200 text-center font-semibold text-blue-600 py-1.5">
                      {member.totalOT ?? ''}
                    </td>
                    <td className="border border-gray-200 text-center font-semibold text-purple-600 py-1.5">
                      {member.totalNight ?? (countNight > 0 ? countNight : '')}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Footer notes */}
        <div className="bg-white mt-3 rounded-xl shadow px-6 py-3 text-xs text-gray-600 space-y-1">
          <p>หมายเหตุ: เวรบ่าย 16.01-24.00</p>
          <p>เงินเวรพยาบาล 1,200/เวร</p>
          <p>เงินเวรนักเทคโนหัวใจ 1,600/เวร เวรละ 200 บาท</p>
        </div>
      </div>
    </div>
  )
}
