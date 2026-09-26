-- ประกาศบนสุดของหน้า (เช่นแจ้งเตือนน้ำท่วม) — แถวเดียว (id = 1) พอ
create table if not exists announcement (
  id int primary key default 1,
  message text not null default '',
  active boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table announcement enable row level security;
create policy "public read announcement" on announcement for select using (true);
create policy "public upsert announcement" on announcement for insert with check (true);
create policy "public update announcement" on announcement for update using (true);

-- เปิด realtime ให้ตารางนี้ (ให้ browser อื่นเห็นประกาศทันทีไม่ต้อง reload)
alter publication supabase_realtime add table announcement;
