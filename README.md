# FreeWANcer

Bot Discord untuk manajemen proyek freelance — dari diskusi kebutuhan, PRD, kontrak, hingga pembayaran, semuanya di satu channel.

---

## Fitur

- Intake klien otomatis dengan channel privat per proyek
- Pembuatan PRD (Project Requirements Document) berbasis AI
- Kontrak PDF otomatis + tanda tangan digital (upload foto)
- Invoice DP 50% dan pelunasan 50% via Virtual Account
- Debt collector otomatis: bot mengingatkan klien yang belum bayar
- Jadwal harian dan reminder deadline freelancer
- Notifikasi proyek baru ke channel jadwal

---

## Setup

### 1. Prasyarat

- Node.js >= 20
- Bot Discord (dari [Discord Developer Portal](https://discord.com/developers/applications))
- API LLM yang kompatibel OpenAI (misal: OpenRouter, Groq, dll.)

### 2. Install dependensi

```bash
npm install
```

### 3. Konfigurasi `.env`

Buat file `.env` di root project:

```env
# ── Discord ──────────────────────────────────────────────────────────────────
DISCORD_TOKEN=your_bot_token_here

# ── Channel IDs (salin dari Discord: klik kanan channel → Copy Channel ID) ──
INTAKE_CHANNEL_ID=         # Channel tempat klien ketik "mulai-disini"
NOTIFICATIONS_CHANNEL_ID=  # Channel notifikasi internal freelancer
JADWAL_HARIAN_CHANNEL_ID=  # Channel jadwal harian freelancer
REMINDER_CHANNEL_ID=       # Channel reminder deadline

# ── Role IDs (klik kanan role → Copy Role ID) ────────────────────────────────
FREELANCER_ROLE_ID=        # Role Discord untuk freelancer
STAFF_ROLE_ID=             # Role Discord untuk staff/admin (boleh sama dengan FREELANCER_ROLE_ID)

# ── Category (opsional) ───────────────────────────────────────────────────────
CLIENT_CHANNELS_CATEGORY_ID=  # ID category untuk channel proyek klien

# ── Pembayaran ────────────────────────────────────────────────────────────────
STATIC_VA_NUMBER=7000108979916425  # Nomor Virtual Account tujuan transfer
PAYMENT_DUE_DAYS=3                 # Jatuh tempo invoice (hari)

# ── AI (OpenAI-compatible endpoint) ──────────────────────────────────────────
QWENPAW_BASE_URL=https://openrouter.ai/api  # Base URL API LLM
QWENPAW_API_KEY=your_api_key_here
QWENPAW_MODEL=qwen/qwen-2.5-72b-instruct   # Nama model

# ── Jadwal (opsional, ada default) ───────────────────────────────────────────
SCHEDULE_TZ=Asia/Jakarta
SCHEDULE_DAILY_AT=08:00              # Jadwal harian (satu waktu)
# SCHEDULE_DAILY_CRON=0 8,13,18 * * *  # Atau pakai cron untuk beberapa jam
SCHEDULE_REMINDER_CRON=0 9,15 * * *  # Reminder deadline (jam 9 dan 15)
SCHEDULE_PAYMENT_POLL_CRON=0 */2 * * * # Cek invoice & kirim pengingat tiap 2 jam
REMINDER_DAYS_BEFORE=3               # Reminder deadline H-N hari

# ── Database ──────────────────────────────────────────────────────────────────
DATABASE_PATH=./data/freewancer.sqlite
```

### 4. Jalankan bot

```bash
# Development (auto-restart saat file berubah)
npm run dev

# Production
npm start

# Production dengan PM2
pm2 start src/index.js --name freewancer
pm2 save
```

### 5. Setup Discord Server

Buat channel-channel berikut di server Discord:
- **#mulai-disini** — intake klien (isi `INTAKE_CHANNEL_ID`)
- **#notifikasi** — notifikasi internal freelancer (isi `NOTIFICATIONS_CHANNEL_ID`)
- **#jadwal-harian** — jadwal harian (isi `JADWAL_HARIAN_CHANNEL_ID`)
- **#reminder** — reminder deadline (isi `REMINDER_CHANNEL_ID`)

Aktifkan **Developer Mode** di Discord (Pengaturan → Lanjutan → Mode Pengembang) untuk bisa copy ID channel dan role.

---

## Cara Pakai — Klien

### 1. Mulai proyek

Pergi ke channel **#mulai-disini**, ketik:
```
mulai-disini
```
Bot akan membuat channel privat khusus untuk proyekmu.

### 2. Ceritakan kebutuhan

Di channel privat, ceritakan proyek yang kamu inginkan — jenis pekerjaan, deadline, budget. Bot AI akan membantu mengklarifikasi detail.

### 3. Review dan setujui PRD

Setelah freelancer membuat PRD (dokumen scope proyek), baca dengan seksama lalu:
```
setuju-prd
```
Jika ada yang perlu diubah:
```
revisi-prd <catatan revisimu>
```

### 4. Tanda tangan kontrak

Setelah PRD disetujui kedua pihak, bot akan mengirim kontrak PDF. Upload foto tanda tanganmu (PNG/JPG) langsung di channel — cukup kirim sebagai pesan biasa dengan foto terlampir.

### 5. Bayar DP

Freelancer akan mengirim invoice DP 50%. Transfer ke nomor Virtual Account yang tertera, lalu beritahu freelancer dengan mengetik:
```
sudah-bayar
```
Sertakan bukti transfer sebagai lampiran (foto) jika diminta.

### 6. Review hasil & bayar pelunasan

Freelancer akan mengirim preview berversi watermark. Setelah puas, lakukan transfer pelunasan 50% dan ketik lagi:
```
sudah-bayar
```

### 7. Terima file final

Setelah freelancer mengkonfirmasi pelunasan, file final asli akan dikirim di channel.

---

## Cara Pakai — Freelancer

### Ringkasan command

| Command | Keterangan |
|---|---|
| `buat-prd` | Generate PRD dari riwayat diskusi dengan klien |
| `setuju-prd` | Menyetujui PRD (harus kedua pihak) |
| `revisi-prd <catatan>` | Revisi PRD dengan catatan perubahan |
| `deadline YYYY-MM-DD` | Set deadline proyek |
| `kirim-sketch` | Buat invoice DP 50% dan kirim ke klien |
| `dp-paid` | Konfirmasi pembayaran DP sudah diterima |
| `kirim-watermark` | Kirim preview watermark + buat invoice pelunasan |
| `lunas-final` | Konfirmasi pelunasan sudah diterima |

---

### Alur kerja lengkap

#### Fase 1 — Intake & diskusi

Klien akan masuk ke channel privatnya setelah ketik `mulai-disini`. Diskusikan kebutuhan proyek hingga scope jelas, lalu buat PRD:
```
buat-prd
```

#### Fase 2 — Review PRD

Bot akan mengirim PRD dalam format teks dan PDF. Jika klien meminta revisi:
```
revisi-prd <catatan perubahan>
```
Setelah kedua pihak setuju, ketik:
```
setuju-prd
```

#### Fase 3 — Kontrak

Bot otomatis membuat kontrak PDF. Upload foto tanda tanganmu di channel (kirim sebagai pesan dengan foto terlampir). Tunggu klien juga upload tanda tangannya.

#### Fase 4 — DP

Setelah kontrak ditandatangani kedua pihak, mulai pengerjaan dan kirim sketch/preview awal ke klien di channel, lalu ketik:
```
kirim-sketch
```
Bot akan mengirim invoice DP 50% dengan nomor VA ke klien.

Setelah klien transfer dan ketik `sudah-bayar`, cek rekening. Jika sudah masuk:
```
dp-paid
```

#### Fase 5 — Pengerjaan & pengiriman watermark

Kerjakan proyek. Setelah selesai, upload file berversi watermark ke channel lalu ketik:
```
kirim-watermark
```
Bot akan mengirim invoice pelunasan 50% ke klien.

Setelah klien transfer dan ketik `sudah-bayar`, cek rekening. Jika sudah masuk:
```
lunas-final
```

#### Fase 6 — Kirim file final

Setelah `lunas-final`, kirim file asli tanpa watermark langsung di channel. Proyek selesai.

---

### Set deadline

Supaya jadwal harian dan reminder berjalan, set deadline proyek:
```
deadline 2026-06-01
```
atau
```
deadline 01/06/2026
```

### Test jadwal (di channel jadwal atau reminder)

```
test-jadwal    — kirim jadwal harian sekarang
test-reminder  — kirim reminder deadline sekarang
```

---

## Alur Lengkap (Ringkasan)

```
Klien: mulai-disini
  └─ Channel privat dibuat

Diskusi kebutuhan proyek...

Freelancer: buat-prd
Freelancer: setuju-prd
Klien:      setuju-prd
  └─ Kontrak PDF dikirim

Upload foto tanda tangan (klien & freelancer)
  └─ Kontrak ditandatangani

Freelancer: kirim-sketch
  └─ Invoice DP 50% + nomor VA dikirim ke klien

Klien transfer → Klien: sudah-bayar
Freelancer cek rekening → Freelancer: dp-paid

Freelancer kerja...
Upload file watermark
Freelancer: kirim-watermark
  └─ Invoice pelunasan 50% + nomor VA dikirim ke klien

Klien transfer → Klien: sudah-bayar
Freelancer cek rekening → Freelancer: lunas-final

Freelancer kirim file final asli → Proyek selesai ✓
```

---

## Lisensi

MIT
