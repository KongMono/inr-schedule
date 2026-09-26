// ห้าม Next.js cache ผลลัพธ์ของ route นี้เอง — ต้องยิงไปหา กทม. ใหม่ทุกครั้งที่เรียก
export const dynamic = 'force-dynamic'
// รันใกล้ปลายทางที่สุด — เดิม default region ของ Vercel (สหรัฐฯ) latency ไป กทม. สูงจน
// timeout ต่อ request ไม่พอ (local test ไทยเจอ ~60% success แต่ Vercel fail ทุกครั้ง)
export const preferredRegion = 'sin1'

// ดึงข้อมูลน้ำท่วม/ระดับน้ำจากสำนักการระบายน้ำ กทม. (public API, ไม่ต้อง auth)
// หมายเหตุ: server ฝั่ง กทม. สลับ backend แบบสุ่ม — ~ครึ่งหนึ่งของ request คืน HTML
// fallback แทน JSON จริง (bug ฝั่งเขา ไม่ใช่เรา) จึงต้อง retry จนกว่าจะได้ JSON
const BASE = 'https://flood.bangkok.go.th/api'

// พิกัดโรงพยาบาลกลาง (ถ.หลวง แขวงป้อมปราบ เขตป้อมปราบศัตรูพ่าย กทม.) — ศูนย์กลางระยะที่สนใจ
const HOSPITAL = { lat: 13.7524, lng: 100.5088 }
const RADIUS_KM = 15

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(a))
}

// retry จนกว่าจะได้ JSON จริง (server ฝั่ง กทม. คืน HTML fallback แบบสุ่มบ่อยมาก)
// query param กันชน (_r) จำเป็นมาก — ไม่งั้น Next.js request memoization จะมองว่า URL เดิม
// ซ้ำกันแล้ว dedupe เหลือ fetch จริงแค่ครั้งเดียว ทำให้ retry ทั้งหมดได้ผลลัพธ์เดิมซ้ำ
// timeout ต่อ request (ไม่ใช่แค่ retry นับครั้ง) กันเคส server ฝั่ง กทม. ค้างเฉยๆ ไม่ error —
// ถ้าไม่ตั้ง จะดึงเวลารวมยาวจนชน timeout ของ serverless function ทั้งฟังก์ชัน
async function fetchJsonWithRetry(url: string, debugLog: string[], tries = 4, timeoutMs = 2500): Promise<unknown | null> {
  for (let i = 0; i < tries; i++) {
    const t0 = Date.now()
    try {
      const bustUrl = `${url}${url.includes('?') ? '&' : '?'}_r=${Date.now()}-${i}`
      const res = await fetch(bustUrl, { headers: { Accept: 'application/json' }, cache: 'no-store', signal: AbortSignal.timeout(timeoutMs) })
      const ct = res.headers.get('content-type') ?? ''
      const ms = Date.now() - t0
      if (res.ok && ct.includes('json')) { debugLog.push(`${url} try${i}: OK json ${ms}ms`); return await res.json() }
      debugLog.push(`${url} try${i}: status=${res.status} ct=${ct} ${ms}ms`)
    } catch (err) {
      const ms = Date.now() - t0
      debugLog.push(`${url} try${i}: threw ${err instanceof Error ? `${err.name}:${err.message}` : String(err)} ${ms}ms`)
    }
  }
  return null
}

type WaterStation = {
  st_name?: string
  latitude?: number
  longitude?: number
  wl_m?: number
  status?: string
}

// จุดน้ำท่วมถนน — schema จริงจาก flood/currentevent
type FloodEvent = {
  st_name?: string
  district?: string
  latitude?: number
  longitude?: number
  current_lv?: number
  unit_display?: string
  status?: string
}

export async function GET() {
  // DEBUG ชั่วคราว — วินิจฉัยว่า Vercel เจออะไรจริง (timeout/blocked/html) ลบทิ้งหลังแก้เสร็จ
  const debugLog: string[] = []

  // ยิงสองแหล่งพร้อมกัน — sequential จะดึงเวลารวมยาวจนชน timeout ของ serverless function
  const [events, stations] = await Promise.all([
    fetchJsonWithRetry(`${BASE}/flood/currentevent`, debugLog),
    fetchJsonWithRetry(`${BASE}/mainwater/lastdata/0`, debugLog),
  ])

  if (events === null && stations === null) {
    // ทั้งสอง endpoint ตอบไม่ได้เลยหลัง retry ครบ — น่าจะเซิร์ฟเวอร์ กทม. ล่มจริงๆ ตอนนี้
    return Response.json({ configured: true, spots: [], error: 'bma server unreachable', debugLog }, { status: 502 })
  }

  type Spot = { location: string; detail: string; distanceKm: number; severity: 'critical' | 'warning' }
  const toSeverity = (status?: string): 'critical' | 'warning' => (status === 'critical' ? 'critical' : 'warning')
  const spots: Spot[] = []

  // จุดน้ำท่วมถนนที่ประกาศไว้จริง — กรองเฉพาะที่อยู่ในรัศมีที่สนใจ, เรียงใกล้สุดก่อน
  if (Array.isArray(events)) {
    const near = (events as FloodEvent[])
      .filter(e => e.latitude !== undefined && e.longitude !== undefined)
      .map(e => ({ e, dist: haversineKm(HOSPITAL.lat, HOSPITAL.lng, e.latitude!, e.longitude!) }))
      .filter(x => x.dist <= RADIUS_KM)
      .sort((a, b) => a.dist - b.dist)
    for (const { e, dist } of near) {
      spots.push({
        location: `${e.st_name ?? 'จุดน้ำท่วม'} (${e.district ?? ''})`,
        detail: `ระดับน้ำ ${e.current_lv ?? '-'} ${e.unit_display ?? ''}`,
        distanceKm: Math.round(dist * 10) / 10,
        severity: toSeverity(e.status),
      })
    }
  }

  // จุดวัดระดับน้ำที่ไม่ปกติ (warning/critical) ใกล้โรงพยาบาลกลาง — ใช้เป็นสัญญาณเสริม
  if (Array.isArray(stations)) {
    for (const s of stations as WaterStation[]) {
      if (s.status === 'normal' || !s.status) continue
      if (s.latitude === undefined || s.longitude === undefined) continue
      const dist = haversineKm(HOSPITAL.lat, HOSPITAL.lng, s.latitude, s.longitude)
      if (dist > RADIUS_KM) continue
      spots.push({
        location: s.st_name ?? 'จุดวัดระดับน้ำ',
        detail: `ระดับน้ำในคลอง ${s.wl_m ?? '-'} ม.รทก.`,
        distanceKm: Math.round(dist * 10) / 10,
        severity: toSeverity(s.status),
      })
    }
  }

  return Response.json({ configured: true, spots, updatedAt: Date.now() })
}
