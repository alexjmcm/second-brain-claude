# CLAUDE.md

## Project Overview
AI Second Brain: Slack messages → OpenAI classification → Google Sheets storage. Everything runs on Google Apps Script (free, serverless, 24/7).

## Architecture
```
Slack (#brain-inbox) → Google Apps Script (doPost webhook) → OpenAI (gpt-4o-mini) → Google Sheets
                                                                                   ↓
                                                              Slack receipt + emoji reaction
```

## Key File
- `google-apps-script/Code.gs` — the single production script deployed in Google Sheets. All logic lives here.

## Categories (9 tabs in Google Sheet)
Inbox (master log), Tasks, Ideas, Projects, Reference, Decisions, Questions, People, Admin

## How It Works
1. User sends message in `#brain-inbox` Slack channel
2. Slack webhook hits Google Apps Script `doPost()`
3. Script deduplicates via CacheService, calls OpenAI to classify
4. Writes to Inbox tab + category-specific tab (if confidence >= 80%)
5. Sends threaded Slack receipt + emoji reaction (brain or question mark)
6. Daily nudge (6 AM) and weekly nudge (Sunday 5 PM) via time triggers

## Important Rules
- **Deployment**: ALWAYS use Deploy > New deployment. Never use "Manage deployments > edit > New version" — it's unreliable.
- **After deploying**: Update Slack Event Subscriptions Request URL with the new URL
- **Credentials**: Never commit API keys. They go in CONFIG inside the Apps Script editor, not in this repo.
- **Bouncer**: Low confidence items (< 80%) stay in Inbox only, not routed to category tabs.

## Config (in Code.gs, replaced in Apps Script editor)
- `CONFIG.OPENAI_API_KEY` — OpenAI key
- `CONFIG.SLACK_BOT_TOKEN` — Slack bot token (xoxb-...)
- `CONFIG.SHEET_NAME` — "Inbox"
- `CONFIG.CONFIDENCE_THRESHOLD` — 80
- `CONFIG.OPENAI_MODEL` — "gpt-4o-mini"

## Required Slack Bot Scopes
channels:history, groups:history, chat:write, reactions:write, channels:read, groups:read

## Other Files
- `src/` — Local Node.js CLI + Slack bot (independent, optional)
- `docs/` — Architecture, troubleshooting, porting guide
- `make/`, `zapier/`, `notion/` — Deprecated approaches, kept for reference

## Testing
- Run `testClassify` or `testFullFlow` from the Apps Script editor (no deployment needed)
- Run `findAndSaveChannelId` once after setting up a new Slack workspace
- Run `setupDailyNudge` and `setupWeeklyNudge` once to create time triggers
