export type ContactRole = 'doctor' | 'nurse' | 'tech' | 'maid'

export interface Contact {
  name: string
  phone: string
  role: ContactRole
}

export interface ContactGroup {
  title: string
  contacts: Contact[]
}

export const contactGroups: ContactGroup[] = [
  {
    title: 'เจ้าหน้าที่ Intervention',
    contacts: [
      { name: 'นพ.เกรียงไกร ภู่พิทยา', phone: '094-456-2236', role: 'doctor' },
      { name: 'นพ.จุน ซู จิน', phone: '086-565-2001', role: 'doctor' },
      { name: 'น.ส.นงนภัส อ่อนละออ', phone: '081-929-7628', role: 'nurse' },
      { name: 'น.ส.ณรัณรญาณ์ ณรัณวรานนทน์', phone: '086-414-1760', role: 'nurse' },
      { name: 'น.ส.ชลนิชา สกุลรัตน์', phone: '064-146-6326', role: 'nurse' },
      { name: 'น.ส.นรารัตน์ สว่างใหญ่', phone: '095-660-5256', role: 'nurse' },
      { name: 'น.ส.ธนัชชา คงนวล', phone: '095-707-8903', role: 'nurse' },
      { name: 'นายวุฒิพงษ์ น้อยบางยาง', phone: '081-167-4347', role: 'tech' },
      { name: 'น.ส.โสภิต ยี่อิน', phone: '093-332-8338', role: 'maid' },
      { name: 'น.ส.ณีรนุช เลิศบันลือศักดิ์', phone: '088-099-9318', role: 'maid' },
    ],
  },
  {
    title: 'เจ้าหน้าที่ภายนอกอยู่เวรแม่บ้าน',
    contacts: [
      { name: 'นางญาตานุช โทนะบุตร', phone: '089-800-9830', role: 'maid' },
      { name: 'นางเจรดา แข็งกสิกิจ', phone: '097-158-3149', role: 'maid' },
      { name: 'นายวุฒิชัย นามกิง', phone: '083-074-8045', role: 'maid' },
    ],
  },
]
