import { schedules as seedSchedules, type ScheduleData } from '@/data/schedule'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { loadSchedules, saveSchedules, resetSchedules } from '@/lib/scheduleStore'

const TABLE = 'schedules'

export const usingRemote = isSupabaseConfigured

function sortByDate(a: ScheduleData, b: ScheduleData) {
  return a.year - b.year || a.month - b.month
}

// ชื่อ/นามสกุล/เบอร์/role เป็นข้อมูล reference — sync จาก seed ตาม index
// ทับลงทุกเดือนที่โหลดมา (เก็บ shifts/ยอดที่แก้ไว้)
const seedIdentity = (seedSchedules[0]?.staff ?? []).map((s) => ({
  name: s.name,
  phone: s.phone,
  role: s.role,
}))

function syncIdentity(list: ScheduleData[]): ScheduleData[] {
  return list.map((m) => ({
    ...m,
    staff: m.staff.map((s, i) => ({
      ...s,
      ...(seedIdentity[i] ?? {}),
      // ทำ (บ/ด) + เวร (standby) นับอัตโนมัติ — ล้างค่าที่ cache ไว้
      totalWork: undefined,
      totalNight: undefined,
    })),
  }))
}

// แถวใน Supabase: { month, thai_year, data jsonb }
function rowToData(row: { data: ScheduleData }): ScheduleData {
  return row.data
}

export async function fetchSchedules(): Promise<ScheduleData[]> {
  if (!supabase) return syncIdentity(loadSchedules())
  const { data, error } = await supabase.from(TABLE).select('data').order('thai_year').order('month')
  if (error) {
    console.error('[schedule] fetch error:', error.message)
    return syncIdentity(loadSchedules())
  }
  const rows = (data ?? []).map(rowToData).sort(sortByDate)
  if (rows.length === 0) {
    // remote ว่าง → seed ครั้งแรก
    await Promise.all(seedSchedules.map(saveMonth))
    return [...seedSchedules].sort(sortByDate)
  }
  return syncIdentity(rows)
}

export async function saveMonth(m: ScheduleData): Promise<void> {
  if (!supabase) {
    saveSchedules(mergeLocal(m))
    return
  }
  const { error } = await supabase
    .from(TABLE)
    .upsert({ month: m.month, thai_year: m.thaiYear, data: m }, { onConflict: 'month,thai_year' })
  if (error) console.error('[schedule] save error:', error.message)
}

export async function removeMonth(month: number, thaiYear: number): Promise<void> {
  if (!supabase) {
    const next = loadSchedules().filter((m) => !(m.month === month && m.thaiYear === thaiYear))
    saveSchedules(next)
    return
  }
  const { error } = await supabase.from(TABLE).delete().eq('month', month).eq('thai_year', thaiYear)
  if (error) console.error('[schedule] delete error:', error.message)
}

export async function resetAll(): Promise<ScheduleData[]> {
  if (!supabase) return resetSchedules()
  await supabase.from(TABLE).delete().neq('month', -1) // ลบทุกแถว
  await Promise.all(seedSchedules.map(saveMonth))
  return [...seedSchedules].sort(sortByDate)
}

// fallback localStorage: รวม month เดียวเข้า list เดิม
function mergeLocal(m: ScheduleData): ScheduleData[] {
  const list = loadSchedules().filter((x) => !(x.month === m.month && x.thaiYear === m.thaiYear))
  return [...list, m].sort(sortByDate)
}
