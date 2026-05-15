<div align="center">

# FreeWANcer

**AI-Powered Freelance Management Bot for Discord**

Automates project intake, PRD generation, contract creation, and payment management for freelance design & web services.

[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Discord](https://img.shields.io/discord/1504721301317877780
)](https://discord.gg/eM2Y4Qr3)

Track: Main Build

</div>

---

## 📋 Table of Contents

- [Inspiration](#inspiration)
- [Features](#key-features)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Project Workflow](#project-workflow)
- [Commands](#commands)
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
- Version control—track changes and revisions
- Both parties must approve before moving forward

**Automated Contracts**
- PDF contracts auto-generated from approved PRD
- Professional legal formatting
- Digital signature collection (photo uploads)
- Embedded signatures on final document

**End-to-End Automation**
- From first message → signed contract in one workflow
- AI reduces back-and-forth communication
- Reduces project setup time from days to hours
- Clear documentation for disputes or reference

---

## Tech Stack

- Runtime: Node.js 20+
- Bot Framework: Discord.js 14.17
- AI API: QwenPaw
- Database: SQLite3 (better-sqlite3)
- PDF Generation: pdf-lib
- Environment: dotenv

---

## Quick Start

### 1. Prerequisites
- Node.js 20+
- Discord Server (for testing)
- Discord Bot Token
- QwenPaw API credentials

### 2. Installation

```bash
# Clone repository
git clone <repo-url>
cd FreeWANcer

# Install dependencies
npm install

# Create .env file
cp .env.example .env  # or manually create .env
```

### 3. Configuration

Create `.env` file in root directory:

```env
# Discord
DISCORD_TOKEN=your_bot_token_here
INTAKE_CHANNEL_ID=channel_id_for_intake
NOTIFICATIONS_CHANNEL_ID=channel_id_for_notifications
CLIENT_CHANNELS_CATEGORY_ID=category_id_for_private_channels
STAFF_ROLE_ID=role_id_for_freelancers

# AI API (QwenPaw)
QWENPAW_BASE_URL=https://api.qwenpaw.com
QWENPAW_API_KEY=your_api_key_here
QWENPAW_MODEL=qwen-max

# Database
DATABASE_PATH=./data/freewancer.sqlite
```

### 4. Run Bot

**Development (with auto-reload):**
```bash
npm run dev
```

**Production:**
```bash
npm start
```

---

## Project Workflow

```
┌─────────────────────────────────────────────────────────┐
│ 1. CLIENT INTAKE (Public Channel)                       │
│ • Client types: mulai-disini                            │
│ • Bot asks: jenis pekerjaan, deadline, budget           │
│ • Bot triggers [HANDOFF] when ready → Phase 2           │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ 2. PRIVATE CHANNEL CREATED                              │
│ • Client gets private channel                           │
│ • Freelancer joins to discuss                           │
│ • Both clarify scope, timeline, deliverables            │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ 3. PRD GENERATION (Freelancer)                          │
│ • Freelancer types: buat-prd                            │
│ • AI creates formal PRD from chat history               │
│ • Both must approve: setuju-prd                         │
│ • Revision cycle: revisi-prd <note>                     │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ 4. CONTRACT GENERATION                                  │
│ • Auto-generates PDF from approved PRD                  │
│ • Both sign (upload photo/digital signature)            │
│ • Final PDF with embedded signatures                    │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ 5. EXECUTION                                            │
│ • Project marked as active                              │
│ • Work begins per contract terms                        │
└─────────────────────────────────────────────────────────┘
```

---

## Commands

### Intake Phase (Client)
| Command | Purpose |
|---------|---------|
| `mulai-disini` | Create private project channel |
| `/ai <question>` | Ask AI about services |

### Discussion Phase (Freelancer & Client)
| Command | Purpose |
|---------|---------|
| `buat-prd` | Generate PRD from chat history |
| `setuju-prd` | Approve current PRD version |
| `revisi-prd <note>` | Request PRD revision |
| `/ai <question>` | Ask AI clarifying questions |

### Contract Phase
| Command | Purpose |
|---------|---------|
| *upload image* | Submit digital signature |

---

## Architecture

```
src/
├── index.js                    # Entry point
├── agent/
│   ├── qwenpaw.js             # AI API client
│   └── prompts.js             # System prompts (compressed for performance)
├── bot/
│   ├── client.js              # Discord client setup
│   └── handlers/
│       ├── onMessage.js       # Main message handler
│       └── onReady.js         # Bot ready event
├── db/
│   └── database.js            # SQLite queries + indexes
├── services/
│   ├── chatHistory.js         # Transcript fetching (with caching)
│   ├── channelManager.js      # Channel/role management
│   ├── contractService.js     # PDF contract generation
│   ├── handoff.js             # Intake → discussion transition
│   └── prdService.js          # PRD generation & revision
└── data/
    └── freewancer.sqlite      # Database file (created on first run)
```

### Database Schema

**clients** - Registered Discord users
- `discord_user_id` (unique)
- `private_channel_id`
- `created_at`

**projects** - Active projects per client
- `client_id` (FK)
- `channel_id` (unique)
- `name`, `phase` (intake/discussion/prd_review/contract_signing/execution)
- `allowed_revisions`

**prd_documents** - Project requirement versions
- `project_id` (FK)
- `version`, `content`
- `freelancer_approved`, `client_approved`

**prd_revision_notes** - Revision feedback
- `prd_id` (FK)
- `author_discord_id`, `note`

**contracts** - Generated contracts
- `project_id` (unique FK)
- `content_json` (contract terms)
- `draft_pdf_path`, `signed_pdf_path`
- `freelancer_signed`, `client_signed`

## Development

### Project Structure
```bash
npm run dev      # Auto-reload on file changes
npm start        # Run normally
npm test         # Run tests (if any)
```

### Testing on Discord

1. **Create test server** on Discord
2. **Create test bot** in Discord Developer Portal
3. **Update `.env`** with test token
4. **Run locally:** `npm run dev`
5. **Test workflows** in private test server

### Adding Features

- **New command?** Add handler in `src/bot/handlers/onMessage.js`
- **New AI prompt?** Add to `src/agent/prompts.js`
- **Database change?** Update `src/db/database.js`

### Debugging

```javascript
// Enable verbose logging
process.env.DEBUG = "freewancer:*"

// Check bot is ready
npm run dev  // Watch console for "Bot is ready!"
```

---

## 📊 Service Pricing

| Service | Starting Price |
|---------|---|
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
- Managing multi-step workflows between clients and freelancers
- Building automation while still keeping human collaboration natural
- Structuring Discord channels dynamically for project-based collaboration
- Designing scalable approval and document-generation workflows
- Maintaining project context and chat history for AI reasoning
- Preventing AI hallucinations when generating formal project documents

> _(More implementation details and technical learnings will be added later during development.)_

---

## 🤝 Contributing

Contributions aren't welcome, as it is not allowed as per the contest rule. But if you want to contribute, you can fork the repo and submit a pull request with your changes. Please ensure your code follows the existing style and includes tests where applicable.

---

## 📞 Support

- Discord: [Join community](https://discord.gg/eM2Y4Qr3)
- Issues: GitHub Issues
- Docs: See PLANNING.md for project roadmap

---

**Built with ❤️ for freelancers by DemiVPS**
