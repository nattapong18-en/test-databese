# Pulseboard — Realtime Stock Dashboard

โปรเจกต์นี้เป็นเว็บไซต์ Dashboard หุ้นจำลองที่จัดทำขึ้นเพื่อศึกษาและสาธิตการทำงานของ Database โดยเฉพาะการรับส่งข้อมูลแบบ Realtime ระหว่าง Supabase และหน้าเว็บ

ราคาหุ้นทั้งหมดในโปรเจกต์นี้เป็นข้อมูลจำลอง ไม่ใช่ข้อมูลจากตลาดหุ้นจริง และไม่มีการซื้อขายเงินจริง

## จุดประสงค์ของโปรเจกต์

โปรเจกต์นี้ช่วยให้เห็นภาพการทำงานของระบบ Database ตั้งแต่ต้นจนจบ:

```text
ตัวจำลองสุ่มราคา
        ↓
บันทึกข้อมูลลง Supabase
        ↓
Supabase Realtime ส่ง Event
        ↓
หน้าเว็บรับข้อมูล
        ↓
ตาราง กราฟ และ Portfolio อัปเดตทันที
```

## ฟีเจอร์หลัก

- แสดงราคาหุ้นจำลอง เช่น AAPL, TSLA, MSFT และ GOOGL
- ราคาหุ้นเปลี่ยนอัตโนมัติทุก 3.5 วินาที
- รองรับ Supabase Realtime และการเปิดเว็บหลายแท็บ
- แก้ราคาและค่า Volatility จากหน้าเว็บได้
- มีกราฟย้อนหลังช่วง `1D`, `1W`, `1M` และ `1Y`
- เก็บประวัติราคาลงตาราง `stock_price_history`
- มี Portfolio, เงินสดจำลอง และ Holdings
- รองรับ Market Buy/Sell แบบจำลอง
- มีประวัติคำสั่งซื้อขายจำลอง
- รองรับการแสดงผลบนมือถือ

## เทคโนโลยีที่ใช้

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- Recharts
- Supabase PostgreSQL
- Supabase Realtime
- Cloudflare OpenNext สำหรับการ Deploy

## การติดตั้ง

ติดตั้ง dependencies:

```bash
npm install
```

สร้างไฟล์ `.env.local` ที่ root ของโปรเจกต์:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-publishable-or-anon-key
SUPABASE_SECRET_KEY=your-secret-key
SIMULATOR_INTERVAL_MS=3500
MANUAL_HOLD_SECONDS=15
```

คำอธิบายตัวแปร:

- `NEXT_PUBLIC_SUPABASE_URL` คือ Project URL ของ Supabase
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` หรือ Publishable key ใช้สำหรับหน้าเว็บ
- `SUPABASE_SECRET_KEY` ใช้เฉพาะฝั่ง server และ simulator
- `SIMULATOR_INTERVAL_MS` กำหนดช่วงเวลาการเปลี่ยนราคา
- `MANUAL_HOLD_SECONDS` กำหนดเวลาพักราคาหลังจากแก้ราคาเอง

ห้ามนำ `SUPABASE_SECRET_KEY` ไปใช้ใน browser หรือ commit ขึ้น GitHub

## ตั้งค่า Supabase

1. เปิด Supabase Dashboard และเลือก Project ของคุณ
2. ไปที่ **SQL Editor**
3. เปิดไฟล์ [`supabase/schema.sql`](./supabase/schema.sql)
4. คัดลอก SQL ทั้งหมดไปวาง แล้วกด **Run**

ไฟล์นี้จะสร้างตารางหลัก เช่น:

- `stocks` — ราคาปัจจุบันและข้อมูลหุ้น
- `stock_price_history` — ประวัติราคา
- `demo_accounts` — บัญชีจำลอง
- `demo_holdings` — หุ้นที่ถืออยู่
- `demo_orders` — ประวัติ Buy/Sell

นอกจากนี้ยังเปิด Realtime และสร้าง Function สำหรับคำสั่งซื้อจำลองแบบ atomic ด้วย

## การรันโปรเจกต์

เปิด Terminal แรกเพื่อรันเว็บไซต์:

```bash
npm run dev
```

เปิด Terminal ที่สองเพื่อรันตัวจำลองราคา:

```bash
npm run simulate
```

จากนั้นเปิด:

```text
http://localhost:3000
```

## วิธีทดสอบ Realtime

1. เปิดเว็บไซต์อย่างน้อย 2 แท็บ
2. ตรวจสอบว่าด้านล่างแสดง `Realtime connected`
3. รอให้ simulator ทำงาน ราคาควรเปลี่ยนทุกประมาณ 3.5 วินาที
4. แก้ราคาในส่วน `Simulator controls`
5. กด `Apply update`
6. ตรวจสอบว่าทุกแท็บอัปเดตพร้อมกัน

หลังจากแก้ราคาเอง หุ้นตัวนั้นจะหยุดการสุ่มชั่วคราวตามค่า `MANUAL_HOLD_SECONDS` เพื่อให้ตรวจสอบข้อมูลได้ง่ายขึ้น

## วิธีทดสอบกราฟ

กดปุ่มช่วงเวลา:

- `1D` — ข้อมูล 24 ชั่วโมงล่าสุด
- `1W` — ข้อมูล 7 วันล่าสุด
- `1M` — ข้อมูล 30 วันล่าสุด
- `1Y` — ข้อมูล 365 วันล่าสุด

แต่ละช่วงจะอ่านข้อมูลจาก `stock_price_history` คนละช่วงจริง ไม่ได้ใช้ข้อมูลชุดเดิมเพียงเปลี่ยนชื่อปุ่ม

## วิธีทดสอบการซื้อขายจำลอง

1. เลือกหุ้นที่ต้องการ
2. เลือก `Buy` หรือ `Sell`
3. ใส่จำนวนหุ้น
4. กดปุ่มคำสั่งซื้อ
5. ตรวจสอบ Cash, Holdings, Portfolio และ Recent orders

ระบบจะป้องกันกรณีซื้อเกินเงินสดหรือขายเกินจำนวนหุ้นที่ถืออยู่

## คำสั่งตรวจสอบโปรเจกต์

ตรวจสอบ production build:

```bash
npm run build
```

ตรวจสอบ syntax ของ simulator:

```bash
node --check scripts/simulate-prices.mjs
```

## การ Deploy ด้วย Cloudflare Workers

ใน Cloudflare Workers ให้ตั้งค่า Build command และ Deploy command ดังนี้:

```text
Build command: npm run cf:build
Deploy command: npm run cf:deploy
```

ไม่ควรใช้ `npx wrangler deploy` เป็น Deploy command โดยตรง เพราะต้องให้ OpenNext สร้าง `.open-next/worker.js` ก่อน แล้วจึง deploy Worker

## ขอบเขตและข้อจำกัด

- ไม่มีระบบ Login
- ใช้บัญชีจำลองร่วมกันหนึ่งบัญชี
- ไม่มีการเชื่อมต่อกับ Dime หรือโบรกเกอร์จริง
- ไม่มีการฝากหรือถอนเงินจริง
- ราคาหุ้นและ Portfolio เป็นข้อมูลจำลองเพื่อการศึกษา
- ระบบ Buy/Sell เป็นเพียงการจำลองการตัดเงินสดและปรับจำนวนหุ้น

โปรเจกต์นี้จัดทำขึ้นเพื่อศึกษาแนวคิด Database, API, Realtime Event และการอัปเดตข้อมูลบนหน้าเว็บแบบไม่ต้อง Refresh เป็นหลัก
