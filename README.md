# SSC Vocabulary Tracker

An AI-powered personal vocabulary database for SSC exam preparation. Automatically extracts, stores, searches, revises, and exports:

- **OWS** (One Word Substitutions)
- **Vocabulary** (words with synonyms)
- **Idioms & Phrases**

## Tech Stack

- **Next.js 15** — App Router, TypeScript
- **Tailwind CSS v4 + Shadcn UI** — Dark theme, glassmorphism
- **Google Gemini AI** — Text extraction & OCR
- **Google Apps Script** — Google Sheets read/write (no OAuth needed)
- **LocalStorage** — Settings storage only

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start development server
npm run dev

# 3. Open in browser
http://localhost:3000
```

---

## Setup Instructions

### Step 1 — Get Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Click **Create API Key**
3. Copy the key (starts with `AIza...`)

---

### Step 2 — Set Up Google Sheet

1. Go to [sheets.google.com](https://sheets.google.com) and create a new spreadsheet
2. Name it anything (e.g., "SSC Vocabulary")
3. The app will automatically add headers on first write

---

### Step 3 — Deploy Google Apps Script

1. Open your Google Sheet
2. Click **Extensions → Apps Script**
3. Delete all existing code in the editor
4. Paste this script:

```javascript
function doGet(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = sheet.getDataRange().getValues();
    return ContentService
      .createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var payload = JSON.parse(e.postData.contents);
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["Category", "Word", "Trigger", "CreatedAt"]);
    }
    if (payload.action === "append" && Array.isArray(payload.rows)) {
      payload.rows.forEach(function(row) {
        sheet.appendRow(row);
      });
    }
    return ContentService
      .createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

5. Click **Deploy → New Deployment**
6. Click the gear icon next to "Type" → select **Web App**
7. Set **"Execute as"**: `Me`
8. Set **"Who has access"**: `Anyone`
9. Click **Deploy** → authorize when prompted
10. Copy the **Web App URL** (looks like `https://script.google.com/macros/s/ABC.../exec`)

---

### Step 4 — Configure the App

1. Open the app at `http://localhost:3000`
2. Go to **Settings**
3. Paste your **Gemini API Key**
4. Paste your **Google Apps Script Web App URL**
5. Click **Save Settings**

---

## Features

| Feature | Description |
|---|---|
| **5 Extraction Modes** | OWS, Vocabulary, Idioms, Mixed, Auto |
| **Text Input** | Paste any text — word, passage, article, list |
| **Screenshot OCR** | Upload PNG/JPG/JPEG/WEBP — Gemini reads it |
| **Auto-Save** | Every extraction auto-saves unique entries to Sheets |
| **Duplicate Prevention** | Case-insensitive dedup before every save |
| **Dashboard** | Live stats: OWS, Vocab, Idioms, Today, This Week |
| **Real-time Search** | Search by word or trigger with category filter |
| **Revision Mode** | All entries in clean SSC exam format |
| **Export** | CSV, Excel (.xlsx), PDF — by category |
| **Settings** | Gemini key + Apps Script URL in LocalStorage |

---

## Google Sheet Structure

The sheet automatically gets these columns:

| Category | Word | Trigger | CreatedAt |
|---|---|---|---|
| OWS | Cynic | Human doubter | 2024-01-15T10:30:00.000Z |
| VOCAB | Esteem | Respect | 2024-01-15T10:30:00.000Z |
| IDIOM | Beat around the bush | Avoid topic | 2024-01-15T10:30:00.000Z |

---

## Folder Structure

```
src/
├── app/
│   ├── api/sheets/route.ts       # Proxy for Apps Script (avoids CORS)
│   ├── dashboard/page.tsx        # Stats overview
│   ├── extract/page.tsx          # AI extraction + OCR
│   ├── search/page.tsx           # Real-time search
│   ├── revision/page.tsx         # SSC format revision
│   ├── export/page.tsx           # CSV / Excel / PDF export
│   └── settings/page.tsx         # API key configuration
├── components/
│   ├── layout/Sidebar.tsx
│   ├── extract/
│   │   ├── ModeSelector.tsx
│   │   ├── ImageUpload.tsx
│   │   └── ResultsPanel.tsx
│   └── dashboard/StatCard.tsx
├── services/
│   ├── gemini.service.ts          # Gemini AI calls + OCR
│   └── googleSheets.service.ts   # Sheets read/write via API route
├── hooks/
│   ├── useSettings.ts             # LocalStorage settings
│   └── useVocabData.ts            # Data fetching + search + stats
├── types/index.ts
└── lib/
    ├── exportUtils.ts             # CSV / Excel / PDF
    └── utils.ts                  # Tailwind cn()
```

---

## How Auto-Save Works

```
User Input
↓
Gemini AI Processing
↓ (OCR if image)
Show OCR Preview
↓
Extract OWS / Vocab / Idioms
↓
Read existing entries from Sheets
↓
Compare (case-insensitive, trimmed)
↓
Insert only unique entries
↓
Refresh dashboard stats
↓
Show toast: "12 new entries added, 3 duplicates skipped"
```

---

## Troubleshooting

**"Failed to fetch entries"**
- Verify Apps Script URL is correct
- Re-deploy the Apps Script (Deploy → Manage Deployments → Edit)
- Make sure "Who has access" is set to "Anyone"

**"Gemini API error"**
- Verify your API key is valid
- Check API quota at [Google AI Studio](https://aistudio.google.com)

**"No entries found"**
- Try a different extraction mode (Auto is most flexible)
- Add more context to the input text

---

## Privacy

- API keys are stored **only in your browser's LocalStorage**
- No keys are sent to any external server except Google's APIs directly
- The Next.js API route (`/api/sheets`) only proxies your request to your own Apps Script
