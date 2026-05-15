# FreeWANcer — AI-Powered Freelance Operations Platform
> Planning Document v1.0 | 15 Mei 2026

---

## 1. Problem Statement

Freelancer Indonesia menghadapi beban administratif yang berat dan berulang setiap harinya:

| Masalah | Dampak |
|---|---|
| Brief dari klien tidak jelas / tidak terdokumentasi | Scope creep, revisi tak terbatas |
| Tidak ada kontrak standar yang melindungi kedua pihak | Dispute tanpa landasan hukum |
| Revisi tidak terlacak | Freelancer kerja lebih dari yang dibayar |
| Invoice manual dan follow-up pembayaran memakan waktu | Cash flow terganggu |
| Deadline beberapa proyek bertabrakan | Burnout, kualitas kerja menurun |
| Tidak ada komunikasi proaktif ke klien | Klien merasa tidak diperhatikan |

**Core Pain:** Freelancer menghabiskan 30–40% waktunya untuk hal non-kreatif (admin, komunikasi, follow-up) yang seharusnya bisa diotomasi.

---

## 2. Solution Overview

**FreeWANcer** adalah platform AI Agent yang bekerja sebagai "asisten operasional" freelancer — menangani seluruh siklus hidup proyek dari negosiasi awal hingga pembayaran lunas, sehingga freelancer hanya perlu fokus pada pekerjaan kreatif.

```
Klien ←→ [AI Agent] ←→ Freelancer
              ↕
    [Kontrak | Invoice | Kalender | Memori]
```

**Prinsip desain:**
- AI Agent adalah titik kontak pertama dengan klien, bukan freelancer
- Semua dokumen (PRD, kontrak, invoice) di-generate otomatis
- Freelancer hanya membaca, memvalidasi, dan mengerjakan
- Semua komunikasi tercatat dan menjadi dasar audit trail

---

## 3. AI Agent Workflow

### Fase 0 — Client Discovery
```
Klien kirim pesan pertama
        ↓
AI Agent menjawab:
  - Pricelist layanan
  - Scope yang bisa dikerjakan
  - Estimasi waktu
  - Pertanyaan klarifikasi (jika perlu)
        ↓
Klien tertarik → lanjut ke Fase 1
Klien tidak jadi → AI Agent simpan lead ke Mem9
```

---

### Fase 1 — Handoff ke Freelancer
```
Klien konfirmasi mau pakai layanan
        ↓
AI Agent notifikasi freelancer:
  - Ringkasan kebutuhan klien
  - Budget & timeline estimasi
  - Tingkat urgensi
        ↓
Freelancer chat langsung dengan klien (natural conversation)
        ↓
AI Agent memantau percakapan di background
```

---

### Fase 2 — PRD Generation
```
Percakapan freelancer ↔ klien selesai
        ↓
AI Agent membaca seluruh chat history
        ↓
AI Agent generate PRD otomatis:
  ┌─────────────────────────────────┐
  │ Project Requirements Document   │
  │ - Nama proyek & klien           │
  │ - Deliverables yang disepakati  │
  │ - Jumlah revisi yang diizinkan  │
  │ - Timeline & milestone          │
  │ - Format file output            │
  │ - Hal-hal yang TIDAK termasuk   │
  └─────────────────────────────────┘
        ↓
PRD dikirim ke freelancer untuk review
        ↓
Freelancer setuju → Fase 3
Freelancer revisi PRD → AI Agent update → kirim ulang
```

---

### Fase 3 — Kontrak Generation & Signing
```
PRD final disetujui freelancer
        ↓
AI Agent generate kontrak berdasarkan PRD:
  - Scope of work (dari PRD)
  - Harga & metode pembayaran
  - Batas revisi (dari PRD)
  - Klausul deadline & penalti
  - Klausul hak cipta
        ↓
Kontrak dikirim ke klien dan freelancer
        ↓
Kedua pihak tandatangan → Pengerjaan dimulai
```

---

### Fase 4 — Pengerjaan & Revision Tracking
```
Pengerjaan oleh freelancer
        ↓
Klien request revisi
        ↓
AI Agent cek kontrak:

  Revisi ke-N ≤ batas kontrak?
  ├── YA  → catat revisi, lanjutkan
  └── TIDAK → 
      ├── Alert ke klien: "Revisi ini melebihi batas kontrak (N revisi).
      │    Biaya tambahan: Rp X atau perpanjang timeline Y hari"
      └── Notif ke freelancer: "Revisi ke-(N+1) butuh persetujuan klien"
```

---

### Fase 5 — Selesai & Invoice
```
Freelancer kirim hasil final
        ↓
AI Agent generate invoice via DOKU MCP:
  - Detail layanan (dari PRD)
  - Total biaya (dari kontrak)
  - Nomor invoice unik
  - Metode pembayaran (transfer, QRIS, dll)
  - Due date
        ↓
Invoice dikirim ke klien
        ↓
Status pembayaran dipantau DOKU MCP

  Belum bayar di hari ke-3?
  └── AI Agent follow-up: "Hai [Nama], invoice #XXX sudah jatuh tempo..."

  Belum bayar di hari ke-7?
  └── AI Agent follow-up lebih tegas + opsi metode pembayaran lain

  Melewati deadline pembayaran?
  └── AI Agent reminder SETIAP HARI hingga lunas
  └── Notif ke freelancer untuk eskalasi manual jika perlu
```

---

### Fase 6 — Daily Schedule & Time Blocking
```
Setiap hari pukul 07.00 WIB:
        ↓
AI Agent baca semua proyek aktif freelancer dari Mem9:
  - Proyek A: deadline 20 Mei, progress 60%
  - Proyek B: deadline 25 Mei, progress 20%
  - Proyek C: deadline 18 Mei, progress 80%
        ↓
AI Agent hitung prioritas berdasarkan:
  - Kedekatan deadline
  - Estimasi sisa waktu pengerjaan
  - Jumlah revisi pending
        ↓
AI Agent generate time block di Google Calendar:
  ┌─────────────────────────────────────────┐
  │ Hari ini — Kamis 15 Mei                 │
  │ 09:00–11:00  Proyek C (urgent, 80%)     │
  │ 11:00–12:00  Review PRD Proyek D        │
  │ 13:00–16:00  Proyek B (catch up)        │
  │ 16:00–17:00  Buffer / revisi            │
  └─────────────────────────────────────────┘
        ↓
AI Agent kirim daily briefing ke freelancer:
  "Hari ini fokus di Proyek C dulu ya,
   deadline-nya 3 hari lagi dan tinggal sedikit.
   Proyek B perlu digas karena masih 20%."
```

---

## 4. Key Features

| # | Fitur | Deskripsi |
|---|---|---|
| F1 | **Client Intake Bot** | AI menjawab semua pertanyaan klien: harga, scope, estimasi |
| F2 | **PRD Auto-Generator** | Baca chat history → output PRD terstruktur |
| F3 | **Contract Generator** | Generate kontrak dari PRD, kirim ke kedua pihak |
| F4 | **Revision Tracker** | Hitung revisi, alert jika melebihi batas kontrak |
| F5 | **Invoice Automation** | Generate & kirim invoice via DOKU MCP |
| F6 | **Payment Follow-Up** | Reminder otomatis hari ke-3, 7, dan harian jika overdue |
| F7 | **Daily Briefing** | Ringkasan harian dan prioritas proyek ke freelancer |
| F8 | **Smart Time Blocking** | Auto-susun Google Calendar berdasarkan semua deadline aktif |
| F9 | **Project Memory** | Semua konteks proyek tersimpan di Mem9 untuk continuity |
| F10 | **Check-in Personal** | AI kirim pesan proaktif ke klien di tengah pengerjaan |

---

## 5. Tech Stack

### Core Infrastructure
```
┌─────────────────────────────────────────────────────┐
│                   SUMOPOD VPS                        │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐  │
│  │  AI Agent    │  │   Backend    │  │  Database │  │
│  │  (QwenPaw)   │  │   (Node.js)  │  │  (SQLite/ │  │
│  │              │  │              │  │  Postgres) │  │
│  └──────────────┘  └──────────────┘  └───────────┘  │
└─────────────────────────────────────────────────────┘
```

| Layer | Teknologi | Fungsi |
|---|---|---|
| **AI Agent** | QwenPaw | Core reasoning, generate PRD/kontrak/brief |
| **Memory** | Mem9.ai | Menyimpan konteks proyek, klien, history |
| **Payment** | DOKU MCP | Generate invoice, track status pembayaran |
| **Calendar** | Google Calendar API | Time blocking otomatis |
| **IDE / Dev** | Cursor | Development environment |
| **VPS** | Sumopod | Hosting backend + AI agent |
| **Domain / Hosting Alt** | Jetorbit | Domain & hosting backup |
| **Communication** | Repliz | WhatsApp/messaging automation ke klien & freelancer |
| **Messaging Storage** | Internal DB | Simpan semua chat history untuk PRD generation |

### Data Flow
```
Chat Klien (Repliz/WA)
      ↓
AI Agent (QwenPaw + Mem9 context)
      ↓
Backend API (Sumopod VPS)
      ↓
┌─────────────────────────────────┐
│  PRD Generator    │ DOKU MCP    │
│  Contract Engine  │ Google Cal  │
│  Revision Counter │ Mem9 Store  │
└─────────────────────────────────┘
      ↓
Output ke Klien & Freelancer (via Repliz)
```

---

## 6. Milestone Development

### Sprint 1 — Foundation (Minggu 1–2)
- [x] Setup VPS Sumopod + environment
- [ ] Integrasikan QwenPaw sebagai AI Agent core
- [ ] Setup Mem9 untuk project memory
- [ ] Build client intake bot (FAQ, pricelist, scope)
- [ ] Koneksi Repliz untuk messaging

### Sprint 2 — PRD & Contract Engine (Minggu 3–4)
- [ ] Build chat parser untuk ekstrak kebutuhan
- [ ] PRD auto-generator dari chat history
- [ ] Template kontrak yang bisa di-customize
- [ ] Alur review PRD oleh freelancer
- [ ] Send kontrak ke kedua pihak

### Sprint 3 — Billing & Revision (Minggu 5–6)
- [ ] Integrasi DOKU MCP untuk invoice generation
- [ ] Revision counter per proyek
- [ ] Alert sistem jika revisi over limit
- [ ] Payment follow-up scheduler (hari 3, 7, harian)

### Sprint 4 — Scheduling & Calendar (Minggu 7–8)
- [ ] Integrasi Google Calendar API
- [ ] Time blocking algorithm (priority scoring)
- [ ] Daily briefing generator ke freelancer
- [ ] Dashboard sederhana untuk overview semua proyek

### Sprint 5 — Polish & Deploy (Minggu 9–10)
- [ ] End-to-end testing seluruh workflow
- [ ] Edge case handling (klien kabur, proyek batal, dll)
- [ ] Onboarding flow untuk freelancer baru
- [ ] Dokumentasi & user guide

---

## 7. Future Development

| Prioritas | Fitur | Deskripsi |
|---|---|---|
| High | **Multi-freelancer** | Satu agent kelola team freelancer |
| High | **Portfolio Generator** | Auto-generate portofolio dari proyek selesai |
| Medium | **Client Portal** | Dashboard klien untuk lihat progress real-time |
| Medium | **Rating System** | Review mutual antara klien dan freelancer |
| Medium | **Template Library** | Koleksi PRD & kontrak per jenis layanan |
| Low | **Analytics** | Insight: klien mana yang sering revisi, proyek mana yang paling profitable |
| Low | **AI Price Estimator** | Sarankan harga berdasarkan scope & kompleksitas |

---

## 8. Impact

### Untuk Freelancer
- **Hemat 10–15 jam/minggu** dari tugas administratif
- **Tidak ada lagi dispute** karena semua terdokumentasi di PRD & kontrak
- **Cash flow lebih sehat** karena invoice dan follow-up otomatis
- **Tidak ada missed deadline** karena time blocking cerdas

### Untuk Klien
- **Respons cepat** di luar jam kerja (AI siap 24/7)
- **Transparansi penuh** via dokumen terstruktur
- **Pengalaman profesional** sejak kontak pertama

### Potensi Bisnis
- Target: freelancer desain, copywriter, developer, video editor Indonesia
- Model: SaaS bulanan per freelancer (Rp 99k–299k/bulan)
- Monetisasi tambahan: komisi dari DOKU payment processing

---

## 9. Glossary

| Istilah | Definisi |
|---|---|
| **PRD** | Project Requirements Document — dokumen yang mendefinisikan scope pekerjaan |
| **AI Agent** | Sistem AI yang bertindak secara otonom berdasarkan konteks |
| **Time Blocking** | Teknik produktivitas dengan mengalokasikan blok waktu spesifik per tugas |
| **Mem9** | Platform memory untuk AI agent agar konteks tidak hilang antar sesi |
| **DOKU MCP** | Integrasi DOKU untuk payment via Model Context Protocol |
| **Repliz** | Platform untuk otomasi pesan ke WhatsApp/channel lain |

---

*Dokumen ini akan berkembang seiring development. Lihat commit history untuk changelog.*
