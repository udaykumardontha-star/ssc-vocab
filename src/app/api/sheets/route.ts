import { NextRequest, NextResponse } from 'next/server';

// ─── Valid sheet names (extended to include VOCAB_GROUPS) ─────────────────────
const VALID_SHEETS = ['OWS', 'VOCAB', 'IDIOMS', 'VOCAB_GROUPS'] as const;
type ValidSheet = typeof VALID_SHEETS[number];

// ─── GET — Fetch from Apps Script (combined endpoint) ────────────────────────
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const webAppUrl = searchParams.get('webAppUrl');
  const sheet = searchParams.get('sheet'); // optional

  if (!webAppUrl) {
    return NextResponse.json({ error: 'webAppUrl is required' }, { status: 400 });
  }

  try {
    const url = sheet
      ? `${webAppUrl}?action=getAll&sheet=${encodeURIComponent(sheet)}`
      : `${webAppUrl}?action=getAll`;

    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Apps Script responded with ${response.status}`);
    }

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (match) data = JSON.parse(match[0]);
      else throw new Error('Invalid response from Apps Script');
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch from Apps Script' },
      { status: 500 }
    );
  }
}

// ─── POST — Append rows to a specific sheet ───────────────────────────────────
export async function POST(request: NextRequest) {
  let body: { webAppUrl: string; sheet: string; rows: string[][]; action?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { webAppUrl, sheet, rows, action } = body;

  if (!webAppUrl) {
    return NextResponse.json({ error: 'webAppUrl is required' }, { status: 400 });
  }
  if (!sheet || !VALID_SHEETS.includes(sheet as ValidSheet)) {
    return NextResponse.json({ error: `Invalid sheet name: ${sheet}` }, { status: 400 });
  }
  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'rows array is required' }, { status: 400 });
  }

  // Determine Apps Script action:
  // - VOCAB_GROUPS → 'saveGroup'
  // - Everything else → 'append'
  const scriptAction = sheet === 'VOCAB_GROUPS' || action === 'saveGroup'
    ? 'saveGroup'
    : 'append';

  try {
    const response = await fetch(webAppUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: scriptAction, sheet, rows }),
      redirect: 'follow',
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Apps Script error: ${response.status} — ${text.slice(0, 200)}`);
    }

    const result = await response.json().catch(() => ({ success: true }));
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to write to Apps Script' },
      { status: 500 }
    );
  }
}
