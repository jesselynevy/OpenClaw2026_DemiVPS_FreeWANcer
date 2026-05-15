<div align="center">

# FreeWANcer

**AI-Powered Freelance Management Bot for Discord**

Automates project intake, PRD generation, contract creation, and payment management for freelance design & web services.

[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Discord](https://img.shields.io/discord/1504721301317877780)](https://discord.gg/eM2Y4Qr3)

Track: Main Build

</div>

---

## 📋 Table of Contents

- [Inspiration](#inspiration)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Project Workflow](#project-workflow)
- [Commands](#commands)
- [How to Use](#how-to-use)
- [Architecture](#architecture)
- [Development](#development)

---

## Inspiration

Every day, freelancers are not only expected to create great work — they are also forced to become:
- admins,
- customer service,
- project managers,
- invoice collectors,
- and deadline reminders for themselves.

Research shows that:
- freelancers spend an average of **15.3 hours/week** on non-billable work,
- **72%** of freelance projects experience scope creep,
- **85%** of freelancers have experienced late payments from clients,
- and **43%** experience burnout due to long working hours and constant deadline pressure.

We realized that many freelancers are not struggling because they lack skill or creativity, but because they are overwhelmed by repetitive operational work.

That inspired us to build **FreeWANcer** — an AI-powered operational assistant that helps freelancers manage clients, projects, documentation, scheduling, and payments automatically so they can focus on what truly matters: creating meaningful work.

---

## Key Features

**Smart Client Intake**
- Conversational bot greets clients in Indonesian
- Asks smart questions about project type, timeline, and budget
- Instant pricing estimates for design & web services
- Auto-routes to freelancer team when client is ready

**Collaborative Workspace**
- Private Discord channels for each client-freelancer pair
- AI-powered scope clarification and discussion
- Full chat history for context and reference
- Real-time collaboration without email

**Intelligent PRD Generation**
- AI automatically creates formal Project Requirements Documents from chat
- Structured format: deliverables, timeline, revisions, scope limits
- Version control — track changes and revisions
- Both parties must approve before moving forward

**Automated Contracts**
- PDF contracts auto-generated from approved PRD
- Professional legal formatting
- Digital signature collection (photo uploads)
- Embedded signatures on final document

**Payment Management**
- Invoice DP 50% sent automatically when freelancer submits sketch
- Invoice pelunasan 50% sent automatically when freelancer sends watermarked preview
- Static Virtual Account — no third-party payment gateway required
- AI debt collector: bot automatically reminds unpaid clients daily

**Scheduling & Reminders**
- Daily schedule posted to freelancer channel at configured times
- Deadline reminders for approaching projects
- Instant schedule update when a new project comes in

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20+ |
| Bot Framework | Discord.js 14.17 |
| AI API | OpenAI-compatible (QwenPaw / OpenRouter / Groq) |
| Database | SQLite3 (better-sqlite3) |
| PDF Generation | pdf-lib |
| Scheduler | node-cron |
| Environment | dotenv |

---

## Quick Start

### 1. Prerequisites
- Node.js 20+
- Discord Server with Developer Mode enabled
- Discord Bot Token ([Discord Developer Portal](https://discord.com/developers/applications))
- OpenAI-compatible LLM API credentials

### 2. Installation

```bash
# Clone repository
git clone <repo-url>
cd FreeWANcer

# Install dependencies
npm install
```

### 3. Configuration

Create `.env` file in the root directory:

```env
# ── Discord ────────────────────────────────────────────────────────────────────
DISCORD_TOKEN=your_bot_token_here

# ── Channel IDs (right-click channel → Copy Channel ID) ───────────────────────
INTAKE_CHANNEL_ID=          # Where clients type "mulai-disini"
NOTIFICATIONS_CHANNEL_ID=   # Internal freelancer notifications
JADWAL_HARIAN_CHANNEL_ID=   # Daily schedule channel
REMINDER_CHANNEL_ID=        # Deadline reminder channel

# ── Role IDs (right-click role → Copy Role ID) ────────────────────────────────
FREELANCER_ROLE_ID=         # Discord role for freelancers
STAFF_ROLE_ID=              # Discord role for staff/admin

# ── Category (optional) ────────────────────────────────────────────────────────
CLIENT_CHANNELS_CATEGORY_ID=  # Category for private client channels

# ── AI API (OpenAI-compatible) ─────────────────────────────────────────────────
QWENPAW_BASE_URL=https://openrouter.ai/api
QWENPAW_API_KEY=your_api_key_here
QWENPAW_MODEL=qwen/qwen-2.5-72b-instruct

# ── Payment ────────────────────────────────────────────────────────────────────
STATIC_VA_NUMBER=7000108979916425   # Virtual Account number for transfers
PAYMENT_DUE_DAYS=3                  # Invoice due date (days)

# ── Scheduler ──────────────────────────────────────────────────────────────────
SCHEDULE_TZ=Asia/Jakarta
SCHEDULE_DAILY_AT=08:00                  # Daily schedule time (single time)
# SCHEDULE_DAILY_CRON=0 8,13,18 * * *   # OR use cron for multiple times a day
SCHEDULE_REMINDER_CRON=0 9,15 * * *     # Deadline reminders (9am and 3pm)
SCHEDULE_PAYMENT_POLL_CRON=0 */2 * * *  # Payment follow-up check every 2 hours
REMINDER_DAYS_BEFORE=3                  # Remind N days before deadline

# ── Database ───────────────────────────────────────────────────────────────────
DATABASE_PATH=./data/freewancer.sqlite
```

### 4. Discord Server Setup

Create these channels in your Discord server and copy their IDs into `.env`:

| Channel | Purpose | Env Variable |
|---|---|---|
| `#mulai-disini` | Client intake | `INTAKE_CHANNEL_ID` |
| `#notifikasi` | Internal alerts | `NOTIFICATIONS_CHANNEL_ID` |
| `#jadwal-harian` | Daily freelancer schedule | `JADWAL_HARIAN_CHANNEL_ID` |
| `#reminder` | Deadline reminders | `REMINDER_CHANNEL_ID` |

### 5. Run

```bash
# Development (auto-reload on file changes)
npm run dev

# Production
npm start

# Production with PM2
pm2 start src/index.js --name freewancer
pm2 save
```

---

## Project Workflow

```
┌─────────────────────────────────────────────────────────┐
│ 1. CLIENT INTAKE                                        │
│ • Client types: mulai-disini in #mulai-disini           │
│ • Private project channel created                       │
│ • AI chats with client to clarify needs                 │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ 2. PRD GENERATION                                       │
│ • Freelancer types: buat-prd                            │
│ • AI creates PRD from full chat history                 │
│ • Both must approve: setuju-prd                         │
│ • Revision cycle: revisi-prd <note>                     │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ 3. CONTRACT                                             │
│ • PDF contract auto-generated from approved PRD         │
│ • Both upload signature photo in channel                │
│ • Final signed PDF delivered                            │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ 4. DP PAYMENT (50%)                                     │
│ • Freelancer types: kirim-sketch                        │
│ • Bot sends DP invoice + Virtual Account number         │
│ • Client transfers → types: sudah-bayar                 │
│ • Freelancer verifies → types: dp-paid                  │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ 5. EXECUTION & WATERMARK                                │
│ • Freelancer works on the project                       │
│ • Freelancer uploads watermarked preview                │
│ • Freelancer types: kirim-watermark                     │
│ • Bot sends final invoice + Virtual Account number      │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ 6. FINAL PAYMENT & DELIVERY                             │
│ • Client transfers → types: sudah-bayar                 │
│ • Freelancer verifies → types: lunas-final              │
│ • Freelancer sends original files → Project complete ✓  │
└─────────────────────────────────────────────────────────┘
```

> **AI Debt Collector:** If a client hasn't paid, the bot automatically sends follow-up reminders to the project channel every few days — getting more firm as time passes.

---

## Commands

### Client Commands

| Command | Phase | Purpose |
|---|---|---|
| `mulai-disini` | Intake (public) | Create private project channel |
| `setuju-prd` | PRD Review | Approve the PRD |
| `revisi-prd <note>` | PRD Review | Request a PRD revision |
| `sudah-bayar` | DP / Final pending | Notify freelancer that transfer is done |
| `/ai <question>` | Any | Ask AI a question |

### Freelancer Commands

| Command | Phase | Purpose |
|---|---|---|
| `buat-prd` | Discussion | Generate PRD from chat history |
| `setuju-prd` | PRD Review | Approve the PRD |
| `revisi-prd <note>` | PRD Review | Revise PRD with a note |
| `deadline YYYY-MM-DD` | Any | Set project deadline |
| `kirim-sketch` | Execution | Create & send DP 50% invoice |
| `dp-paid` | DP Pending | Confirm DP payment received |
| `kirim-watermark` | DP Paid | Send watermark preview + final invoice |
| `lunas-final` | Final Pending | Confirm final payment received |
| `test-jadwal` | Jadwal channel | Post daily schedule now |
| `test-reminder` | Reminder channel | Post deadline reminders now |

---

## How to Use

### For Clients

1. Go to **#mulai-disini** and type `mulai-disini`
2. A private channel will be created — describe your project to the AI
3. Review the PRD and type `setuju-prd` when happy (or `revisi-prd <note>` for changes)
4. Upload a photo of your signature when the contract is sent
5. Transfer DP to the Virtual Account shown, then type `sudah-bayar`
6. Review the watermarked preview — transfer the final amount, then type `sudah-bayar` again
7. Receive the final files after freelancer confirms

### For Freelancers

1. Wait for the client to finish chatting — you'll get a ping in **#notifikasi**
2. Enter their private channel, discuss scope, then type `buat-prd`
3. After both approve, upload your signature photo
4. Set deadline: `deadline 2026-06-01`
5. Upload sketch → type `kirim-sketch` to send the DP invoice
6. Once client pays and you've verified: `dp-paid`
7. Finish the project → upload watermarked preview → type `kirim-watermark`
8. Once client pays and you've verified: `lunas-final`
9. Send the original files — done!

---

## Architecture

```
src/
├── index.js                    # Entry point
├── agent/
│   ├── qwenpaw.js             # OpenAI-compatible AI client
│   └── prompts.js             # System prompts for each phase
├── bot/
│   ├── client.js              # Discord client + event setup
│   └── handlers/
│       ├── onMessage.js       # Main message & command handler
│       ├── onInteraction.js   # Button interaction handler
│       └── onReady.js         # Bot ready event
├── db/
│   └── database.js            # SQLite schema + all queries
└── services/
    ├── channelManager.js      # Channel & role management
    ├── chatHistory.js         # Channel transcript fetching
    ├── contractService.js     # PDF contract generation + signatures
    ├── deadlineParser.js      # Natural language deadline parsing
    ├── handoff.js             # Intake → discussion transition
    ├── invoiceService.js      # Invoice creation + VA formatting
    ├── pdfService.js          # PDF rendering utilities
    ├── prdService.js          # PRD generation & revision
    └── schedulerService.js    # Cron jobs: schedule, reminders, debt collector
```

### Database Schema

**clients** — registered Discord users

**projects** — one per client channel; tracks current `phase`:
`intake` → `discussion` → `prd_review` → `contract_signing` → `execution` → `dp_pending` → `dp_paid` → `final_pending` → `completed`

**prd_documents** — versioned PRD content with approval flags

**prd_revision_notes** — revision feedback per version

**contracts** — generated PDF paths + signature status per role

**invoices** — DP and final invoices with status (`pending` / `paid`), due date, and reminder tracking

---

## Development

```bash
npm run dev    # Auto-reload on file changes
npm start      # Run normally
```

### Adding Features

- **New command** → `src/bot/handlers/onMessage.js`
- **New AI prompt** → `src/agent/prompts.js`
- **Database change** → `src/db/database.js`
- **New scheduled job** → `src/services/schedulerService.js`

### Debugging

```bash
pm2 logs freewancer   # Live logs (PM2)
npm run dev           # Watch console directly
```

---

## 📊 Service Pricing

| Service | Starting Price |
|---|---|
| Logo Design | Rp 300,000 |
| Brand Identity (Logo + Guideline) | Rp 800,000 |
| Landing Page (Design + HTML) | Rp 1,500,000 |
| Website (5 Pages) | Rp 3,000,000 |
| Additional Revisions | Rp 100,000 each |

*Prices are customizable in `src/agent/prompts.js`*

---

## ⚡ Challenges We Faced

Building FreeWANcer came with several technical and product-design challenges:

- Setting up AI Agents from scratch and connecting to Discord
- Transforming messy client conversations into structured PRDs and contracts
- Designing AI prompts that understand project scope and deliverables accurately
- Managing multi-step workflows across many phases (intake → payment → delivery)
- Building automation while still keeping human collaboration natural
- Structuring Discord channels dynamically for project-based collaboration
- Designing scalable approval and document-generation workflows
- Maintaining project context and chat history for AI reasoning
- Preventing AI hallucinations when generating formal project documents

---

## 🤝 Contributing

Contributions aren't welcome, as it is not allowed as per the contest rule. But if you want to contribute, you can fork the repo and submit a pull request with your changes. Please ensure your code follows the existing style and includes tests where applicable.

---

## 📞 Support

- Discord: [Join community](https://discord.gg/eM2Y4Qr3)
- Issues: GitHub Issues

---

<div align="center">

**Built with ❤️ for freelancers by DemiVPS**

</div>
