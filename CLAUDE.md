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
4. Writes to Inbox tab + category-specific tab (all items route to category tabs)
5. Sends threaded Slack receipt + emoji reaction (✅ for high confidence, ❓ for low)
6. Daily nudge (8 AM) and weekly nudge (Sunday 5 PM) via time triggers

## Slack Commands
- **fix** — Shows a dropdown to reclassify the last item into a different category. Updates both Inbox and category tabs.
- **done** — Shows a dropdown of recent Inbox items. Selecting one marks it as "Done" in both Inbox and category tabs.
- **daily** — Triggers the daily nudge on demand (all Inbox items grouped by priority).
- **inbox** — Lists all active items from the Inbox tab.
- **tasks / ideas / projects / reference / decisions / questions / people / admin** — Lists active items from the corresponding category tab.

## Important Rules
- **Deployment**: ALWAYS use Deploy > New deployment. Never use "Manage deployments > edit > New version" — it's unreliable.
- **After deploying**: Update BOTH Slack URLs — Event Subscriptions Request URL AND Interactivity & Shortcuts Request URL.
- **Credentials**: Never commit API keys. They go in CONFIG inside the Apps Script editor, not in this repo.
- **Confidence threshold**: Items below 70% get ❓ emoji + `[?]` prefix. All items route to category tabs regardless of confidence.

## Config (in Code.gs, replaced in Apps Script editor)
- `CONFIG.OPENAI_API_KEY` — OpenAI key
- `CONFIG.SLACK_BOT_TOKEN` — Slack bot token (xoxb-...)
- `CONFIG.SHEET_NAME` — "Inbox"
- `CONFIG.CONFIDENCE_THRESHOLD` — 70
- `CONFIG.OPENAI_MODEL` — "gpt-4o-mini"

## Required Slack Bot Scopes
channels:history, groups:history, chat:write, reactions:write, channels:read, groups:read

## Required Slack App Settings
- **Event Subscriptions**: Enabled, Request URL points to Apps Script deployment
- **Interactivity & Shortcuts**: Enabled, Request URL points to same Apps Script deployment (required for fix/done dropdowns)

## Branches
- **main** — Second Brain (stable backup)
- **open-brain-main** — Open Brain stable (receives PRs from dev)
- **open-brain-dev** — Open Brain development (active development)

## Other Files
- `src/` — Local Node.js CLI + Slack bot (independent, optional)
- `docs/` — Architecture, troubleshooting, porting guide
- `make/`, `zapier/`, `notion/` — Deprecated approaches, kept for reference

## Testing
- Run `testClassify` or `testFullFlow` from the Apps Script editor (no deployment needed)
- Run `findAndSaveChannelId` once after setting up a new Slack workspace
- Run `setupDailyNudge` and `setupWeeklyNudge` once to create time triggers
