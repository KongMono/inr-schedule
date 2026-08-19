-- รันครั้งเดียวใน Supabase SQL Editor เพื่อเปิดใช้ backup online (ข้ามเครื่อง)
-- แทนที่ backup แบบ localStorage เดิม

create table if not exists schedule_history (
  id bigint generated always as identity primary key,
  month int not null,
  thai_year int not null,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists schedule_history_month_year_idx
  on schedule_history (month, thai_year, created_at desc);

-- เปิด public read/write ให้ตรงกับ table `schedules` เดิม (แอปนี้คุมสิทธิ์แก้ไขด้วย PIN
-- ฝั่ง client เท่านั้น ไม่ได้ใช้ Supabase Auth — ถ้า `schedules` เปิด public ไว้แบบไหน ให้ตั้งตารางนี้แบบเดียวกัน)
alter table schedule_history enable row level security;

create policy "public read schedule_history"
  on schedule_history for select
  using (true);

create policy "public insert schedule_history"
  on schedule_history for insert
  with check (true);

create policy "public delete schedule_history"
  on schedule_history for delete
  using (true);
