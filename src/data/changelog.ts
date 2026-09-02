// รายการอัปเดตของแอป — เพิ่ม entry ใหม่ไว้ "บนสุด" ทุกครั้งที่มีฟีเจอร์ใหม่
// version ใช้เทียบว่า user เคยเห็น entry ล่าสุดหรือยัง (เก็บใน localStorage)
// Dialog "มีอะไรใหม่" จะโชว์ entries ทั้งหมดที่ยังไม่เคยเห็น (ใหม่กว่า version ที่เคยเห็นล่าสุด)
export interface ChangelogEntry {
  version: string // ใช้วันที่ YYYY-MM-DD + ลำดับกันชนกันในวันเดียว เช่น '2026-09-02'
  items: string[]
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '2026-09-02',
    items: [
      'เพิ่มสถานะ "ลาป่วย" ในตารางเวร',
      'แจ้งเตือนเมื่อแอปมีอัปเดตใหม่',
    ],
  },
]
