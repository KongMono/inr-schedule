// ข้อมูลระดับน้ำจาก ThaiWater (คลังข้อมูลน้ำแห่งชาติ / สสน.) — public API ไม่ต้อง auth
//
// ทำไมไม่ใช้ของสำนักการระบายน้ำ กทม. (flood.bangkok.go.th) ทั้งที่ข้อมูลละเอียดกว่า:
// ฝั่ง กทม. ปิดกั้นทั้งสองทางที่แอปนี้เข้าถึงได้จริง — Vercel function ต่อ TCP ไม่ติดเลย
// (firewall กันช่วง IP ต่างประเทศ/cloud) ส่วน browser ก็โดน WAF ตอบ 503 ทุก request ที่เป็น
// cross-origin (พิสูจน์แล้ว: same-origin ได้ 200 JSON, cross-origin ได้ 503) ต่อให้ header
// ตอบ Access-Control-Allow-Origin: * ก็ตาม ThaiWater เปิด CORS จริงและยอมรับ request จากทุกที่
const ENDPOINT = 'https://api-v3.thaiwater.net/api/v1/thaiwater30/public/waterlevel_load'

// พิกัดโรงพยาบาลกลาง (ถ.หลวง แขวงป้อมปราบ เขตป้อมปราบศัตรูพ่าย กทม.)
const HOSPITAL = { lat: 13.7524, lng: 100.5088 }
const RADIUS_KM = 20 // สถานีวัดใน กทม. มีไม่หนาแน่น จึงกว้างกว่ากรณีจุดน้ำท่วมถนน

// situation_level ของ ThaiWater: 5 = ล้นตลิ่ง, 4 = ใกล้ล้น, 3 ลงมา = ยังปกติ
const LEVEL_CRITICAL = 5
const LEVEL_WARNING = 4

export interface FloodSpot {
  location: string
  detail: string
  distanceKm: number
  severity: 'critical' | 'warning'
}

type Station = {
  situation_level?: number
  waterlevel_msl?: string | null
  diff_wl_bank?: string | null
  diff_wl_bank_text?: string | null
  river_name?: string | null
  station?: {
    tele_station_name?: { th?: string }
    tele_station_lat?: number
    tele_station_long?: number
  }
  geocode?: { province_name?: { th?: string } }
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(a))
}

// ดึงสถานีที่น้ำล้นตลิ่ง/ใกล้ล้น รอบโรงพยาบาลกลาง เรียงใกล้สุดก่อน
// คืน null ถ้าต่อไม่ได้ (แยกจาก [] ที่แปลว่าเชื่อมต่อได้แต่ไม่มีจุดน่ากังวล)
export async function fetchFloodSpots(): Promise<FloodSpot[] | null> {
  let payload: unknown
  try {
    const res = await fetch(`${ENDPOINT}?_r=${Date.now()}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) return null
    payload = await res.json()
  } catch {
    return null
  }

  const data = (payload as { waterlevel_data?: { data?: Station[] } })?.waterlevel_data?.data
  if (!Array.isArray(data)) return null

  return data
    .filter(s => (s.situation_level ?? 0) >= LEVEL_WARNING)
    .map(s => {
      const lat = s.station?.tele_station_lat
      const lng = s.station?.tele_station_long
      if (lat === undefined || lng === undefined) return null
      const dist = haversineKm(HOSPITAL.lat, HOSPITAL.lng, lat, lng)
      if (dist > RADIUS_KM) return null

      const overflowing = s.situation_level === LEVEL_CRITICAL
      const diff = s.diff_wl_bank
      // diff_wl_bank_text บอกว่าตัวเลขคือ "ล้นตลิ่ง" หรือ "ต่ำกว่าตลิ่ง" กี่เมตร
      const bankNote = diff && s.diff_wl_bank_text
        ? `${s.diff_wl_bank_text.replace(' (ม.)', '')} ${diff} ม.`
        : ''

      return {
        location: s.station?.tele_station_name?.th ?? s.river_name ?? 'สถานีวัดระดับน้ำ',
        detail: [`ระดับน้ำ ${s.waterlevel_msl ?? '-'} ม.รทก.`, bankNote].filter(Boolean).join(' · '),
        distanceKm: Math.round(dist * 10) / 10,
        severity: (overflowing ? 'critical' : 'warning') as 'critical' | 'warning',
      }
    })
    .filter((s): s is FloodSpot => s !== null)
    .sort((a, b) => a.distanceKm - b.distanceKm)
}
