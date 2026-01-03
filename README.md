# Discord AI Moderation Bot

A production-grade, AI-powered Discord moderation system featuring intelligent risk assessment, CAPTCHA-first verification, automated enforcement, and full audit logging powered by Supabase.

Designed for **high-risk public servers**, this bot prioritizes **server safety, false-positive reduction, and transparency** over aggressive punishment.

---

## 🚀 Overview

This bot continuously monitors server activity and applies **AI-assisted moderation decisions** based on behavioral analysis, account trust signals, and historical context.
Instead of instantly punishing users, it follows a **CAPTCHA-first, risk-aware security model**, significantly reducing server nukes, raid damage, and token-leak abuse scenarios.

---

## ✨ Core Features

### 🧠 AI-Driven Moderation Engine

* Detects **spam, phishing, scams, impersonation, harassment, and raid patterns**
* Uses contextual message analysis instead of keyword-only filtering
* Produces explainable moderation decisions

### 📊 Risk Scoring System (0–100)

| Risk Level | Score Range | Behavior                  |
| ---------- | ----------- | ------------------------- |
| SAFE       | 0–30        | No action                 |
| SUSPICIOUS | 31–65       | Warning / message removal |
| DANGEROUS  | 66–100      | Timeout / kick / ban      |

### 🧩 CAPTCHA-First Protection Model

Users are **verified before punishment**, preventing false bans:

* New Discord accounts
* Recently joined members
* Previously warned users
* High-risk but unverified activity

### 🗄️ Supabase-Powered Logging & Analytics

* Complete moderation audit trail
* User behavior history
* Warning escalation tracking
* Server-specific configuration support

### ⚙️ Automated Enforcement

* Message deletion
* Warning issuance
* Timeout / mute
* Kick or ban (configurable)

### 🕒 Trust & Context Awareness

* Discord account age analysis
* Server join time evaluation
* Prior warning history
* CAPTCHA verification status

---

## 🛠️ Technology Stack

* **Node.js 18+**
* **Discord.js**
* **Groq AI API**
* **Supabase (PostgreSQL + RLS)**
* **Environment-based secure configuration**

---

## 📦 Setup Guide

### 1️⃣ Prerequisites

* Node.js **v18 or higher**
* Discord Bot Token
  → [https://discord.com/developers/applications](https://discord.com/developers/applications)
* Supabase Project
  → [https://supabase.com](https://supabase.com)

---

### 2️⃣ Install Dependencies

```bash
npm install
```

---

### 3️⃣ Environment Configuration

Copy the example file and configure secrets:

```bash
cp .env.example .env
```

**Required variables**

* `DISCORD_BOT_TOKEN`
* `SUPABASE_URL`
* `SUPABASE_SERVICE_ROLE_KEY`
* `GROQ_API_KEY`

> ⚠️ Never commit `.env` to GitHub

---

### 4️⃣ Required Discord Permissions

The bot requires the following permissions:

* View Channels
* Read Message History
* Send Messages
* Manage Messages
* Timeout Members
* Kick Members

**Invite URL template**

```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=1099511627830&scope=bot
```

---

### 5️⃣ Start the Bot

```bash
npm start
```

---

## 🧠 System Architecture

### Message Processing Flow

1. Capture message metadata (content, links, embeds)
2. Fetch user & server history from Supabase
3. Run AI-based risk evaluation
4. Determine enforcement level
5. Apply moderation action
6. Persist logs & reasoning to database

---

## 🔐 CAPTCHA-First Verification Logic

A CAPTCHA challenge is triggered when **any** of the following conditions are met:

* Discord account age < **7 days**
* Server join time < **10 minutes**
* Existing warning history
* Suspicious AI risk score
* User not yet verified

### CAPTCHA Outcome

* ✔️ Verified → restrictions lifted
* ❌ Failed / timeout → automated removal (optional)

This prevents:

* Bot raids
* Token-leak exploitation
* Instant server nukes
* False bans on legitimate users

---

## 🗃️ Database Schema (Supabase)

| Table                | Purpose                         |
| -------------------- | ------------------------------- |
| `discord_users`      | CAPTCHA status & trust flags    |
| `server_members`     | Server-specific user data       |
| `messages`           | Privacy-safe message metadata   |
| `moderation_actions` | Decisions, reasons & timestamps |
| `user_warnings`      | Escalation history              |

---

## 🔒 Security Design

* All secrets stored via environment variables
* **Service role key never exposed**
* Message content hashed (no plaintext storage)
* Supabase **Row Level Security (RLS)** enforced
* Abuse-resistant by design for public servers

---

## 🧪 Ideal Use Cases

* Public Discord communities
* Security-focused servers
* Bots & developer servers
* Crypto / NFT communities
* High-traffic entertainment servers

---

## 📄 License

MIT License 

---

