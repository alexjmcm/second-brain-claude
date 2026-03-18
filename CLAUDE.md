# CLAUDE.md

## Project Overview
Two AI second brain systems in one repo:
- **Second Brain** — Slack → OpenAI → Google Sheets (Google Apps Script)
- **Open Brain** — Slack → OpenAI → Supabase with vector embeddings (Supabase Edge Functions)

Both use the same Slack workspace (SB) with separate channels and separate Slack apps.

---

## Second Brain (Google Apps Script)

### Architecture
```
Slack (#brain-inbox) → Google Apps Script (doPost webhook) → OpenAI (gpt-4o-mini) → Google Sheets
                                                                                   ↓
                                                              Slack receipt + emoji reaction
```

### Key File
- `google-apps-script/Code.gs` — the single production script deployed in Google Sheets.

### Storage
Google Sheets with 9 tabs: Inbox (master log), Tasks, Ideas, Projects, Reference, Decisions, Questions, People, Admin

### How It Works
1. User sends message in `#brain-inbox` Slack channel
2. Slack webhook hits Google Apps Script `doPost()`
3. Script deduplicates via CacheService, calls OpenAI to classify
4. Writes to Inbox tab + category-specific tab
5. Sends threaded Slack receipt + emoji reaction (✅ high confidence, ❓ low)
6. Daily nudge (8 AM) and weekly nudge (Sunday 5 PM) via time triggers

### Config (in Code.gs, set in Apps Script editor)
- `CONFIG.OPENAI_API_KEY`, `CONFIG.SLACK_BOT_TOKEN`, `CONFIG.SHEET_NAME`, `CONFIG.CONFIDENCE_THRESHOLD`, `CONFIG.OPENAI_MODEL`

### Second Brain Deployment Rules
- ALWAYS use Deploy > New deployment. Never "Manage deployments > edit > New version".
- After deploying: update BOTH Slack URLs (Event Subscriptions + Interactivity).
- Never commit API keys. They go in CONFIG inside the Apps Script editor.

### Second Brain Testing
- Run `testClassify` or `testFullFlow` from the Apps Script editor
- Run `findAndSaveChannelId` once after setting up a new Slack workspace
- Run `setupDailyNudge` and `setupWeeklyNudge` once to create time triggers

---

## Open Brain (Supabase)

### Architecture
```
Slack (#open-brain-inbox) → Supabase Edge Function → OpenAI (gpt-4o-mini) → Supabase Postgres
                                                                             ↓
                                                          Slack receipt + emoji reaction
                                                          + vector embeddings for semantic search
```

### Key Files
- `supabase/functions/slack-webhook/index.ts` — Edge Function handling Slack webhook + all logic.
- `supabase/functions/mcp-server/index.ts` — MCP server Edge Function for AI-client access.

### Storage
Single `thoughts` table in Supabase Postgres with columns: raw_text, category, priority, confidence, embedding (vector), metadata (JSON), status

### How It Works
1. User sends message in `#open-brain-inbox` Slack channel (private)
2. Slack webhook hits Supabase Edge Function
3. Function deduplicates, calls OpenAI to classify + generate embedding
4. Inserts into `thoughts` table with vector embedding
5. Sends threaded Slack receipt + emoji reaction (✅ high confidence, ❓ low)

### Supabase Secrets (set via `npx supabase secrets set`)
- `OPENAI_API_KEY`, `SLACK_BOT_TOKEN` — set manually
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — auto-provided by Supabase

### Open Brain Deployment
```bash
npx supabase functions deploy slack-webhook --project-ref euldvkqagvvvxfzbgpxj
npx supabase functions deploy mcp-server --project-ref euldvkqagvvvxfzbgpxj
```
After deploying slack-webhook: update BOTH Slack URLs in the "Open Brain" Slack app (Event Subscriptions + Interactivity).

### MCP Server
- URL: `https://euldvkqagvvvxfzbgpxj.supabase.co/functions/v1/mcp-server`
- Protocol: MCP over HTTP (JSON-RPC), protocol version `2024-11-05`
- Tools: `search_thoughts` (semantic search via vector embeddings), `list_thoughts` (filter by category/priority/status), `add_thought` (classify + embed + store), `mark_done`, `daily_summary`
- Config: `.mcp.json` in project root (used by Claude Code and other MCP clients)
- Any MCP-compatible AI client (Claude Code, Claude Desktop, ChatGPT, Cursor) can connect using the URL above

---

## Shared: Slack Commands (both systems)
- **fix** — Dropdown to reclassify the last item into a different category.
- **done** — Dropdown of recent items. Selecting one marks it as "Done".
- **daily** — Triggers the daily nudge (all items grouped by priority).
- **inbox** — Lists all active items.
- **tasks / ideas / projects / reference / decisions / questions / people / admin** — Lists active items from the corresponding category.

## Shared: Categories (8)
Task, Idea, Project, Reference, Decision, Question, People, Admin

## Shared: Confidence Threshold
Items below 70% get ❓ emoji + `[?]` prefix. All items route to their category regardless of confidence.

## Required Slack Bot Scopes (both apps)
channels:history, groups:history, chat:write, reactions:write, channels:read, groups:read

## Slack Apps
- **Second Brain** — Event Subscriptions + Interactivity URLs point to Google Apps Script deployment
- **Open Brain** — Event Subscriptions + Interactivity URLs point to Supabase Edge Function URL

## Branches
- **main** — Second Brain (stable backup)
- **open-brain-main** — Open Brain stable (receives PRs from dev)
- **open-brain-dev** — Open Brain development (active development)

## Other Files
- `src/` — Local Node.js CLI + Slack bot (independent, optional)
- `docs/` — Architecture, troubleshooting, porting guide
- `make/`, `zapier/`, `notion/` — Deprecated approaches, kept for reference
