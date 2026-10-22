# Telegram Bulk Quiz Maker

A complete, production-grade, mobile-first web application designed to bulk import hundreds of Bengali and English multiple-choice questions (MCQs), validate their structure, preview native Telegram Quiz Polls, and publish them reliably to Telegram channels and groups.

---

## 🌟 Key Features

1. **High-Capacity Bulk Import**: Paste 100, 500, or more MCQs at once with 1-click deterministic extraction.
2. **Bengali & English Language Support**: Native Unicode handling for Bengali numerals (১, ২, ৩), option markers (ক, খ, গ, ঘ and A, B, C, D), questions (প্রশ্ন ১.), and answers (সঠিক উত্তর: B, উত্তর: খ).
3. **Multi-Format File Support**: Upload `.txt`, `.csv`, `.xlsx`, `.xls`, `.docx`, and `.pdf` files with intelligent column mapping and scanned PDF detection.
4. **Interactive Question Editor**: Fast radio selection to switch correct answers, reordering, duplication, character-limit validation, and bulk actions.
5. **Telegram Simulation Preview**: Experience quiz polls with live student answer feedback, explanations, and animations exactly as they appear on Telegram.
6. **Multi-Destination Publishing**: Configure channels and supergroups, test bot administrator permissions, and broadcast quiz sets to multiple destinations.
7. **Queue Worker & Delay Control**: Delay between polls (1–60s) to avoid Telegram rate limits, automatic exponential backoff on HTTP 429, pause, resume, cancel, and safe retry of failed/uncertain deliveries without duplicating successful ones.
8. **Question Bank**: Organize and save question sets by Subject and Topic, with JSON import/export.
9. **Delivery Audit Reports**: Comprehensive logs with actual Telegram message IDs, timestamps, and one-click CSV and JSON export.
10. **8-Step Setup Wizard**: Step-by-step instructions to create and connect your Telegram Bot safely.

---

## 📁 MCQ Formatting Examples

### Bengali Format (Sample)
```text
প্রশ্ন ১. সিন্ধু সভ্যতার প্রধান বন্দরনগরী কোনটি?
A) হরপ্পা
B) লোথাল
C) কালীবঙ্গান
D) মহেঞ্জোদারো
সঠিক উত্তর: B
ব্যাখ্যা: লোথাল সিন্ধু সভ্যতার একটি প্রাচীন বন্দর শহর ছিল।
```

### English Format (Sample)
```text
1. Which is the largest planet in our solar system?
A) Earth
B) Mars
C) Jupiter
D) Saturn
Answer: C
Explanation: Jupiter has the largest mass and volume of all planets.
```

### Separate Answer Key Format (Sample)
```text
১. সুন্দরবনকে রামসার সাইট হিসেবে কোন সালে ঘোষণা করা হয়?
A) ১৯৯২
B) ১৯৯৯
C) ১৯৯৭
D) ২০০১

২. ভিটামিন সি-এর রাসায়নিক নাম কি?
A) রেটিনল
B) অ্যাসকরবিক অ্যাসিড
C) ক্যালসিফেরল
D) থায়ামিন

সঠিক উত্তরমালা:
১-A, ২-B
```

---

## 🚀 Quick Start & Local Setup

### 1. Prerequisites
- Node.js 18+ (Node.js 20+ recommended)
- npm or pnpm

### 2. Installation
```bash
git clone <repository-url>
cd telegram-bulk-quiz-maker
npm install
```

### 3. Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Optionally configure `TELEGRAM_BOT_TOKEN="your_bot_token_here"` or configure it through the app's Settings wizard.

### 4. Running the Development Server
```bash
npm run dev
```
Open `http://localhost:3000` in your browser.

### 5. Running Automated Tests
```bash
npm test
```
Runs 7 comprehensive test suites covering:
- Bengali numeral conversion
- 20-question Bengali MCQ extraction
- English MCQ extraction
- Separate answer key mapping
- Wrapped line tolerance
- Telegram character limit validations (Question <= 300, Options <= 100, Explanation <= 200)
- 100-question bulk benchmark parsing in <1.5 seconds

---

## 🤖 8-Step Telegram Bot Setup

1. Open **@BotFather** in Telegram.
2. Send the `/newbot` command.
3. Choose a friendly display name (e.g., `BCS Exam Prep Bot`).
4. Choose a unique username ending in `bot` (e.g., `bcs_exam_quiz_bot`).
5. Copy the generated HTTP API token.
6. Open the app's **Settings** tab, paste the token, and click **Save & Verify Bot Token**.
7. In Telegram, open your channel or group, tap **Add Member**, search for your bot, and promote it to **Administrator** with permission to **Post Messages**.
8. Go to **Destinations** in the app, enter your `@channel_username` or numerical Chat ID, and click **Test Connection**.

---

## 🔒 Security Best Practices

- **Zero Client Token Exposure**: The Telegram Bot Token is stored strictly on the server in `data/storage.json` or loaded via `TELEGRAM_BOT_TOKEN` environment variable. The browser only sees masked indicators (`••••1234`).
- **File Upload Protection**: Content-type validation, 15MB file size limits, safe in-memory extraction, and temporary resource cleanup.
- **Rate-Limit Compliance**: Automatic handling of Telegram's HTTP 429 response using `parameters.retry_after` and configurable delays (1–60s).
- **Token Rotation**: If a token is compromised, run `/revoke` in @BotFather, generate a new token, and update it in Settings.

---

## 🚢 Low-Cost Production Deployment

This app is built to run at zero or near-zero cost:

- **Free-Tier PaaS**: Can be deployed to Render, Railway, Fly.io, or Google Cloud Run.
- **Persistence**: Mount a persistent volume to `/data` so `data/storage.json` persists across container restarts.
- **Build Command**: `npm run build`
- **Start Command**: `npm run start`

---

## 📄 License
Apache-2.0
