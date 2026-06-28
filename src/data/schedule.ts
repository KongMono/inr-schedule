export type ShiftCode =
  | 'M'   // แพทย์เวร /
  | 'A'   // ไม่อยู่เวร X
  | 'N'   // standby S
  | 'N2'  // standby S (with number variant)
  | 'OFF' // เวรบ่ายดึก บ/ด
  | 'SWAP'// สลับ
  | '-'   // ว่าง/ไม่ได้ทำงาน

export interface StaffMember {
  id: number | null
  name: string
  role: 'doctor' | 'nurse' | 'tech'
  shifts: ShiftCode[]
  totalWork?: number
  totalOT?: number
  totalNight?: number
}

export interface ScheduleData {
  month: number
  year: number
  thaiYear: number
  department: string
  totalDays: number
  weekendDays: number[]
  staff: StaffMember[]
}

// ข้อมูลจากรูป: กรกฎาคม 2569 (July 2026)
// Shifts index 0 = วันที่ 1, index 1 = วันที่ 2, ...
// วันหยุด (วงกลมแดง): 4, 5, 11, 12, 18, 19, 25, 26, 28, 29
const july2569: ScheduleData = {
  month: 7,
  year: 2026,
  thaiYear: 2569,
  department: 'ศูนย์รังสีร่วมรักษา (INR)',
  totalDays: 31,
  weekendDays: [4, 5, 11, 12, 18, 19, 25, 26, 28, 29],
  staff: [
    {
      id: null,
      name: 'พ.เกรียงไกร',
      role: 'doctor',
      shifts: [
        'M','M','M','A','A','M','M','M','M','M',  // 1-10
        'A','A','M','M','M','M','M','M','A','A',  // 11-20
        'M','M','A','A','A','A','A','A','A','-',  // 21-29,30
        '-',                                       // 31
      ],
      totalWork: 16,
    },
    {
      id: null,
      name: 'พ.จุนซู จิน',
      role: 'doctor',
      shifts: [
        'M','M','M','M','M','M','M','M','A','A',  // 1-10
        'M','M','M','M','M','M','A','A','M','A',  // 11-20
        'A','A','A','A','A','-','A','A','A','-',  // 21-30
        'M',                                       // 31
      ],
    },
    {
      id: 1,
      name: 'นงนภัส',
      role: 'nurse',
      shifts: [
        'OFF','N','A','N','-','-','M','A','A','OFF', // 1-10
        'A','N','N','OFF','N2','A','N','N','N','A',  // 11-20
        'N','-','N','-','-','-','-','-','-','-',    // 21-30
        '-',                                          // 31
      ],
      totalWork: 3,
      totalOT: 7,
      totalNight: 6,
    },
    {
      id: 2,
      name: 'ณรัณรญาณ์',
      role: 'nurse',
      shifts: [
        'N','OFF','A','A','N','N','OFF','A','N','N', // 1-10
        'N','A','N','N','A','N','N','OFF','A','A',   // 11-20
        'N','-','-','N','-','-','-','-','N','-',    // 21-30
        '-',                                          // 31
      ],
      totalWork: 4,
      totalOT: 7,
      totalNight: 8,
    },
    {
      id: 3,
      name: 'ชลนิชา',
      role: 'nurse',
      shifts: [
        '-','-','OFF','A','A','N','N','OFF','-','-', // 1-10
        'A','A','N','N','A','N','N','A','N','A',     // 11-20
        'N','OFF','A','A','N','N','-','-','-','-',  // 21-30
        'N',                                          // 31
      ],
      totalWork: 4,
      totalOT: 7,
      totalNight: 8,
    },
    {
      id: 4,
      name: 'นรารัตน์',
      role: 'nurse',
      shifts: [
        'N','-','N','A','OFF','N','N','-','-','A',  // 1-10
        'A','N','-','N','N','N','A','N','N','A',    // 11-20
        'A','N','A','A','A','A','A','A','A','A',    // 21-30
        'OFF',                                        // 31
      ],
      totalWork: 4,
      totalOT: 7,
      totalNight: 8,
    },
    {
      id: 5,
      name: 'ธนัชชา',
      role: 'nurse',
      shifts: [
        '-','N','N','A','A','OFF','-','N','N','-',  // 1-10
        'A','-','-','N','-','N','OFF','A','N','A',  // 11-20
        'N','-','A','A','A','A','A','A','A','A',    // 21-30
        'N',                                          // 31
      ],
      totalWork: 3,
      totalOT: 7,
      totalNight: 6,
    },
    {
      id: 6,
      name: 'วุฒิพงษ์',
      role: 'tech',
      shifts: [
        '-','M','M','A','A','M','M','-','M','M',    // 1-10
        'A','A','M','M','M','M','M','A','-','M',    // 11-20
        'M','M','-','A','A','M','A','A','A','-',    // 21-30
        'M',                                          // 31
      ],
    },
    {
      id: 7,
      name: '',
      role: 'nurse',
      shifts: Array(31).fill('-'),
    },
    {
      id: 8,
      name: 'โสภิต',
      role: 'nurse',
      shifts: Array(31).fill('-'),
    },
    {
      id: 9,
      name: 'นีรนุช',
      role: 'nurse',
      shifts: Array(31).fill('-'),
    },
  ],
}

export const SHIFT_LABELS: Record<ShiftCode, string> = {
  M: 'แพทย์เวร',
  A: 'ไม่อยู่เวร',
  N: 'standby',
  N2: 'standby',
  OFF: 'เวรบ่ายดึก',
  SWAP: 'สลับ',
  '-': '',
}

// เพิ่มเดือนใหม่: detect จากรูป แล้ว push เข้า array นี้ (เรียงจากเก่า→ใหม่)
export const schedules: ScheduleData[] = [july2569]

// เดือนล่าสุดเป็น default
export const defaultScheduleIndex = schedules.length - 1

export const THAI_MONTHS = [
  '', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
]
