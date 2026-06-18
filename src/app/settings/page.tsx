'use client';

import { useState, useEffect } from 'react';
import { useSettings } from '@/hooks/useSettings';
import { Settings } from '@/types';
import {
  KeyRound,
  Link2,
  Eye,
  EyeOff,
  Save,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const APPS_SCRIPT_CODE = `// ═══════════════════════════════════════════════════════════════
// SSC Vocabulary Tracker — Google Apps Script (3-Sheet Version)
// Paste this in your Google Sheet: Extensions → Apps Script
// Then deploy as Web App: Execute as "Me", Access "Anyone"
//
// Sheet Structure (auto-created):
//   OWS   sheet → Col A: Word   | Col B: Trigger | Col C: CreatedAt (hidden)
//   VOCAB sheet → Col A: Word   | Col B: Trigger | Col C: CreatedAt (hidden)
//   IDIOMS sheet → Col A: Idiom | Col B: Trigger | Col C: CreatedAt (hidden)
// ═══════════════════════════════════════════════════════════════

var SHEET_NAMES = ["OWS", "VOCAB", "IDIOMS"];

function getOrCreateSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    // Set visible header row
    sheet.getRange("A1").setValue(name === "IDIOMS" ? "Idiom" : "Word");
    sheet.getRange("B1").setValue("Trigger");
    sheet.getRange("C1").setValue("CreatedAt");
    // Hide column C (CreatedAt — internal use only)
    sheet.hideColumns(3);
    // Style header row
    var header = sheet.getRange("A1:B1");
    header.setFontWeight("bold");
    header.setBackground("#f3f4f6");
  }
  return sheet;
}

function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetParam = e.parameter.sheet;

    if (sheetParam && SHEET_NAMES.indexOf(sheetParam) !== -1) {
      // Return data from a specific sheet
      var sheet = getOrCreateSheet(ss, sheetParam);
      var data = sheet.getDataRange().getValues();
      return ContentService
        .createTextOutput(JSON.stringify({ sheet: sheetParam, data: data }))
        .setMimeType(ContentService.MimeType.JSON);
    } else {
      // Return data from all 3 sheets
      var result = {};
      SHEET_NAMES.forEach(function(name) {
        var s = getOrCreateSheet(ss, name);
        result[name] = s.getDataRange().getValues();
      });
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
  } catch(err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var payload = JSON.parse(e.postData.contents);
    var sheetName = payload.sheet;

    if (!sheetName || SHEET_NAMES.indexOf(sheetName) === -1) {
      return ContentService
        .createTextOutput(JSON.stringify({ error: "Invalid sheet: " + sheetName }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var sheet = getOrCreateSheet(ss, sheetName);

    if (payload.action === "append" && Array.isArray(payload.rows)) {
      payload.rows.forEach(function(row) {
        // row = [Word, Trigger, CreatedAt]
        sheet.appendRow(row);
      });
    }

    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        added: payload.rows ? payload.rows.length : 0
      }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`;

export default function SettingsPage() {
  const { settings, saveSettings } = useSettings();
  const [form, setForm] = useState<Settings>({ geminiApiKey: '', webAppUrl: '' });
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showScript, setShowScript] = useState(false);
  const [scriptCopied, setScriptCopied] = useState(false);

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  const handleSave = () => {
    if (!form.geminiApiKey.trim()) {
      toast.error('Gemini API key is required');
      return;
    }
    if (!form.webAppUrl.trim()) {
      toast.error('Google Apps Script URL is required');
      return;
    }
    if (!form.webAppUrl.includes('script.google.com')) {
      toast.warning('URL should be a Google Apps Script deployment URL');
    }
    saveSettings(form);
    setSaved(true);
    toast.success('Settings saved successfully');
    setTimeout(() => setSaved(false), 3000);
  };

  const handleCopyScript = () => {
    navigator.clipboard.writeText(APPS_SCRIPT_CODE).then(() => {
      setScriptCopied(true);
      setTimeout(() => setScriptCopied(false), 2000);
    });
  };

  const isConfigured = Boolean(settings.geminiApiKey && settings.webAppUrl);

  return (
    <div className="max-w-2xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Configure your API keys — stored locally in your browser, never sent to any server
        </p>
      </div>

      {/* Status */}
      <div className={cn(
        'rounded-xl border p-4 flex gap-3',
        isConfigured
          ? 'border-emerald-500/30 bg-emerald-600/10'
          : 'border-amber-500/30 bg-amber-600/10'
      )}>
        {isConfigured ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        ) : (
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        )}
        <p className={cn('text-sm', isConfigured ? 'text-emerald-300' : 'text-amber-300')}>
          {isConfigured
            ? 'App is configured and ready to use.'
            : 'Complete both fields below to start using the app.'}
        </p>
      </div>

      {/* API Keys Form */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-6">
        <div className="text-sm font-semibold text-foreground border-b border-border pb-3">
          API Configuration
        </div>

        {/* Gemini API Key */}
        <div className="space-y-2">
          <Label htmlFor="gemini-key" className="flex items-center gap-2 text-sm">
            <KeyRound className="w-4 h-4 text-violet-400" />
            Gemini API Key
            <span className="ml-auto text-xs text-muted-foreground font-normal">Required</span>
          </Label>
          <div className="relative">
            <Input
              id="gemini-key"
              type={showKey ? 'text' : 'password'}
              value={form.geminiApiKey}
              onChange={(e) => setForm({ ...form, geminiApiKey: e.target.value })}
              placeholder="AIza..."
              className="pr-10 bg-card border-border font-mono text-sm"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Get your key from{' '}
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-400 hover:text-violet-300 underline inline-flex items-center gap-0.5"
            >
              Google AI Studio <ExternalLink className="w-3 h-3" />
            </a>
          </p>
        </div>

        {/* Web App URL */}
        <div className="space-y-2">
          <Label htmlFor="webapp-url" className="flex items-center gap-2 text-sm">
            <Link2 className="w-4 h-4 text-emerald-400" />
            Google Apps Script Web App URL
            <span className="ml-auto text-xs text-muted-foreground font-normal">Required</span>
          </Label>
          <Input
            id="webapp-url"
            type="url"
            value={form.webAppUrl}
            onChange={(e) => setForm({ ...form, webAppUrl: e.target.value })}
            placeholder="https://script.google.com/macros/s/..."
            className="bg-card border-border font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Deploy the Apps Script code below in your Google Sheet and paste the deployment URL here.
          </p>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          className="w-full flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-sm font-semibold transition-all shadow-lg shadow-violet-500/20 hover:scale-[1.01]"
        >
          {saved ? (
            <><CheckCircle2 className="w-4 h-4" />Saved!</>
          ) : (
            <><Save className="w-4 h-4" />Save Settings</>
          )}
        </button>
      </div>

      {/* Google Apps Script Setup Guide */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <button
          onClick={() => setShowScript(!showScript)}
          className="w-full flex items-center justify-between px-6 py-4 text-sm font-semibold text-foreground hover:bg-accent transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-emerald-600/20 text-emerald-400 flex items-center justify-center text-xs">✦</span>
            Setup Guide: Google Apps Script
          </div>
          {showScript ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showScript && (
          <div className="border-t border-border px-6 py-5 space-y-6">
            {/* Steps */}
            <ol className="space-y-4 text-sm">
              {[
                {
                  step: 1,
                  title: 'Create a Google Sheet',
                  desc: 'Go to sheets.google.com and create a new blank spreadsheet. The script will auto-create 3 tabs: OWS, VOCAB, IDIOMS.',
                },
                {
                  step: 2,
                  title: 'Open Apps Script',
                  desc: 'In your Google Sheet, click Extensions → Apps Script.',
                },
                {
                  step: 3,
                  title: 'Paste the Code',
                  desc: 'Select all existing code (Ctrl+A), delete it, then paste the script below.',
                },
                {
                  step: 4,
                  title: 'Deploy as Web App',
                  desc: 'Click Deploy → New Deployment → Web App. Set "Execute as": Me. Set "Who has access": Anyone. Click Deploy. Allow permissions.',
                },
                {
                  step: 5,
                  title: 'Copy the Web App URL',
                  desc: 'Copy the deployment URL (starts with https://script.google.com/macros/s/...) and paste it in the field above.',
                },
              ].map(({ step, title, desc }) => (
                <li key={step} className="flex gap-3">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-violet-600/20 text-violet-400 flex items-center justify-center text-xs font-bold">
                    {step}
                  </span>
                  <div>
                    <p className="font-medium text-foreground">{title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                  </div>
                </li>
              ))}
            </ol>

            {/* Script Code */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Apps Script Code
                </span>
                <button
                  onClick={handleCopyScript}
                  className="text-xs text-violet-400 hover:text-violet-300 underline transition-colors"
                >
                  {scriptCopied ? '✓ Copied!' : 'Copy Code'}
                </button>
              </div>
              <pre className="bg-[oklch(0.1_0.02_270)] rounded-lg p-4 text-xs text-emerald-300/90 font-mono overflow-x-auto whitespace-pre border border-border leading-relaxed max-h-80 overflow-y-auto">
                {APPS_SCRIPT_CODE}
              </pre>
            </div>
          </div>
        )}
      </div>

      {/* Privacy Note */}
      <div className="text-xs text-muted-foreground/60 text-center">
        🔒 All credentials are stored only in your browser's LocalStorage. Nothing is sent to any third-party server.
      </div>
    </div>
  );
}
