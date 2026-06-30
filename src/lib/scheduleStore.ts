import {
  schedules as seedSchedules,
  type ScheduleData,
  type ShiftCode,
  type StaffMember,
} from '@/data/schedule'

const STORAGE_KEY = 'inr-schedule:v1'

// ลำดับการ cycle เมื่อคลิก cell ใน edit mode
export const SHIFT_CYCLE: ShiftCode[] = ['-', 'M', 'A', 'N', 'N2', 'OFF', 'SWAP']

export function nextShift(current: ShiftCode): ShiftCode {
  const i = SHIFT_CYCLE.indexOf(current)
  return SHIFT_CYCLE[(i + 1) % SHIFT_CYCLE.length]
}

export function daysInMonth(month: number, gregorianYear: number): number {
  return new Date(gregorianYear, month, 0).getDate()
}

// วันเสาร์-อาทิตย์ของเดือน (default weekend)
export function weekendOf(month: number, gregorianYear: number): number[] {
  const total = daysInMonth(month, gregorianYear)
  const out: number[] = []
  for (let d = 1; d <= total; d++) {
    const dow = new Date(gregorianYear, month - 1, d).getDay()
    if (dow === 0 || dow === 6) out.push(d)
  }
  return out
}

export function createEmptyMonth(
  month: number,
  thaiYear: number,
  template?: ScheduleData,
): ScheduleData {
  const year = thaiYear - 543
  const totalDays = daysInMonth(month, year)
  const staff: StaffMember[] = (template?.staff ?? []).map((m) => ({
    id: m.id,
    name: m.name,
    phone: m.phone,
    role: m.role,
    shifts: Array(totalDays).fill('-') as ShiftCode[],
  }))
  return {
    month,
    year,
    thaiYear,
    department: template?.department ?? 'ศูนย์รังสีร่วมรักษา (INR)',
    totalDays,
    weekendDays: weekendOf(month, year),
    staff,
  }
}

export function emptyStaff(role: StaffMember['role'], totalDays: number): StaffMember {
  return { id: null, name: '', role, shifts: Array(totalDays).fill('-') as ShiftCode[] }
}

export function loadSchedules(): ScheduleData[] {
  if (typeof window === 'undefined') return seedSchedules
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return seedSchedules
    const parsed = JSON.parse(raw) as ScheduleData[]
    if (!Array.isArray(parsed) || parsed.length === 0) return seedSchedules
    return parsed
  } catch {
    return seedSchedules
  }
}

export function saveSchedules(data: ScheduleData[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // เกิน quota หรือ private mode — ปล่อยผ่าน
  }
}

export function resetSchedules(): ScheduleData[] {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(STORAGE_KEY)
  }
  return seedSchedules
}
