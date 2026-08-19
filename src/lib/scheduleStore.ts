import {
  schedules as seedSchedules,
  type ScheduleData,
  type ShiftCode,
  type StaffMember,
} from '@/data/schedule'

const STORAGE_KEY = 'inr-schedule:v1'

// ลำดับการ cycle เมื่อคลิก cell ใน edit mode
export const SHIFT_CYCLE: ShiftCode[] = ['-', 'M', 'A', 'N', 'N2', 'OFF', 'CBD', 'SWAP']

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

// ── Local backup history ────────────────────────────────────────
// เก็บ snapshot ของแต่ละเดือนไว้ในเครื่องนี้ (localStorage) ก่อนถูกเขียนทับทุกครั้ง
// ไม่ผูกกับ Supabase — กันเคสเผลอ save ทับข้อมูลจริงโดยไม่ตั้งใจ
const HISTORY_KEY = 'inr-schedule:history:v1'
const HISTORY_LIMIT = 15 // เก็บย้อนหลังสูงสุดต่อเดือน กันเปลือง localStorage

export interface HistorySnapshot {
  createdAt: number
  data: ScheduleData
}

type HistoryMap = Record<string, HistorySnapshot[]>

function historyKey(month: number, thaiYear: number): string {
  return `${month}-${thaiYear}`
}

function loadHistoryMap(): HistoryMap {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as HistoryMap) : {}
  } catch {
    return {}
  }
}

function saveHistoryMap(map: HistoryMap): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(map))
  } catch {
    // เกิน quota หรือ private mode — ปล่อยผ่าน ไม่ทำให้ save หลักพัง
  }
}

// เทียบข้อมูลแบบไม่สนลำดับ key (เผื่อ object ผ่าน JSON round-trip มาแล้วลำดับ key เปลี่ยน)
function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`
  if (v && typeof v === 'object') {
    const keys = Object.keys(v as Record<string, unknown>).sort()
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify((v as Record<string, unknown>)[k])}`).join(',')}}`
  }
  return JSON.stringify(v)
}

// เรียกก่อนเขียนทับข้อมูลเดือนหนึ่ง — เก็บสถานะเดิมไว้กู้คืนทีหลังได้
// ข้าม insert ถ้าเหมือน snapshot ล่าสุดเป๊ะ กันบวมโดยไม่จำเป็น (เช่น ล็อกโดยไม่ได้แก้อะไร)
export function pushHistory(m: ScheduleData): void {
  const map = loadHistoryMap()
  const key = historyKey(m.month, m.thaiYear)
  const list = map[key] ?? []
  if (list[0] && stableStringify(list[0].data) === stableStringify(m)) return
  list.unshift({ createdAt: Date.now(), data: m })
  map[key] = list.slice(0, HISTORY_LIMIT)
  saveHistoryMap(map)
}

export function loadHistory(month: number, thaiYear: number): HistorySnapshot[] {
  return loadHistoryMap()[historyKey(month, thaiYear)] ?? []
}
