export interface Contact {
  name: string
  phone: string
}

export interface ContactGroup {
  title: string
  contacts: Contact[]
}

export const contactGroups: ContactGroup[] = [
  {
    title: 'เจ้าหน้าที่ Intervention',
    contacts: [
      { name: 'นพ.เกรียงไกร ภู่พิทยา', phone: '094-456-2236' },
      { name: 'นพ.จุน ซู จิน', phone: '086-565-2001' },
      { name: 'น.ส.นงนภัส อ่อนละออ', phone: '081-929-7628' },
      { name: 'น.ส.ณรัณรญาณ์ ณรัณวรานนทน์', phone: '086-414-1760' },
      { name: 'น.ส.ชลนิชา สกุลรัตน์', phone: '064-146-6326' },
      { name: 'น.ส.นรารัตน์ สว่างใหญ่', phone: '095-660-5256' },
      { name: 'น.ส.ธนัชชา คงนวล', phone: '095-707-8903' },
      { name: 'นายวุฒิพงษ์ น้อยบางยาง', phone: '081-167-4347' },
      { name: 'นายพงศธร ลลิตาภรพงษ์', phone: '065-835-4062' },
      { name: 'น.ส.โสภิต ยี่อิน', phone: '093-332-8338' },
      { name: 'น.ส.ณีรนุช เลิศบันลือศักดิ์', phone: '088-099-9318' },
    ],
  },
  {
    title: 'เจ้าหน้าที่ภายนอกอยู่เวรแม่บ้าน',
    contacts: [
      { name: 'นางญาตานุช โทนะบุตร', phone: '089-800-9830' },
      { name: 'นางเจรดา แข็งกสิกิจ', phone: '097-158-3149' },
      { name: 'นางสุดา เปล่งปลั่ง', phone: '063-541-4654' },
      { name: 'นายวุฒิชัย นามกิง', phone: '083-074-8045' },
    ],
  },
]
