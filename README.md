# AI Second Brain

An AI-powered thought capture and classification system. Send a message in Slack from your phone, and it gets classified by AI and stored in Google Sheets automatically. Runs 24/7 for free with no server needed.

Based on the "Second Brain" architecture by [Nate B Jones](https://natebjones.com) (8 building blocks).

## How It Works

```
You type in Slack (#brain-inbox)
  -> Slack sends webhook to Google Apps Script
  -> Script calls OpenAI (gpt-4o-mini) to classify
  -> Script writes row to Google Sheets (Inbox + category tab)
  -> Script sends threaded receipt in Slack
  -> Script adds emoji reaction (brain or question mark)
  -> If low confidence: sends warning message

Every morning at 6 AM:  -> Daily summary of pending items to Slack
Every Sunday at 5 PM:   -> Weekly summary with category breakdown to Slack
```

## The 8 Building Blocks

| # | Block | Description | Implementation |
|---|-------|-------------|----------------|
| 1 | Drop Box | Capture thoughts | Slack `#brain-inbox` channel |
| 2 | Sorter | AI classification | OpenAI gpt-4o-mini via Google Apps Script |
| 3 | Form | Structured schema | JSON: category, priority, summary, next_action, tags, confidence |
| 4 | Filing Cabinet | Storage | Google Sheets (Inbox tab + 6 category tabs) |
| 5 | Receipt | Confirmation | Threaded Slack reply + brain emoji |
| 6 | Bouncer | Quality filter | Low confidence (<80%) gets [?] prefix + question mark emoji |
| 7 | Daily Nudge | Morning summary | 6 AM Slack message with items grouped by priority |
| 8 | Weekly Nudge | Weekly review | Sunday 5 PM summary with category breakdown |
| 9 | Fix Button | Manual edits | Edit Google Sheets directly (change Status to "d" = done) |

## Architecture (Current — Production)

**Google Apps Script** (free, serverless, runs inside Google Sheets):
- `google-apps-script/Code.gs` — the single production script deployed in Google Sheets
- Receives Slack webhooks, calls OpenAI, writes to Sheets, sends Slack replies
- Time-based triggers for daily and weekly nudges

**Why this architecture?**
- Free (no paid tiers on any service)
- Runs 24/7 without a computer on
- Works from mobile Slack
- Single file, easy to maintain

## Google Sheets Structure

**Tabs:** Inbox (master log), Tasks, Ideas, People, Reference, Decisions, Questions

**Columns (all tabs):**

| Column | Description |
|--------|-------------|
| Name | AI-generated summary (prefixed with [?] if low confidence) |
| Category | Task, Idea, Reference, Decision, Question, or People |
| Priority | High, Medium, or Low |
| Next Action | One concrete next step |
| Source | "Slack" or "Test" |
| Confidence | 0-100 (how sure the AI is) |
| Status | "Inbox" initially — change to anything else (e.g., "d") to mark done |
| Tags | Up to 3 tags, comma-separated |
| Original Text | What you actually typed |
| AI Reasoning | Why the AI classified it this way |

## Quick Reference

### Deploying Code Changes

1. Copy `Code.gs` into Apps Script editor (Extensions > Apps Script)
2. Replace `YOUR_OPENAI_API_KEY` and `YOUR_SLACK_BOT_TOKEN` with real keys
3. Save (Ctrl+S)
4. Deploy > New deployment > Web app > Execute as "Me" > Access "Anyone" > Deploy
5. Copy new URL > paste in Slack app Event Subscriptions > Request URL
6. Wait for green "Verified" checkmark

### Running Setup Functions (one-time)

In the Apps Script editor, select function from dropdown > click play:
- `findAndSaveChannelId` — saves the `#brain-inbox` channel ID
- `setupDailyNudge` — creates the 6 AM daily trigger
- `setupWeeklyNudge` — creates the Sunday 5 PM weekly trigger

### Testing

- `testClassify` — tests OpenAI classification only
- `testFullFlow` — tests classify + write to sheets
- `dailyNudge` — sends daily summary immediately
- `weeklyNudge` — sends weekly summary immediately

## Project Structure

```
second-brain-claude/
|-- google-apps-script/
|   |-- Code.gs              # PRODUCTION script (deployed in Google Sheets)
|   |-- setup.md             # Step-by-step setup guide
|-- docs/
|   |-- architecture.md      # Detailed system architecture
|   |-- troubleshooting.md   # Known issues and fixes
|   |-- porting-guide.md     # How to migrate to other platforms
|-- src/                     # Local Node.js tools (optional, needs PC running)
|   |-- cli.js               # CLI: brain "your thought"
|   |-- bot.js               # Slack bot (Socket Mode, requires PC)
|   |-- classify.js          # OpenAI classifier (shared module)
|   |-- sheets.js            # Google Sheets writer (shared module)
|   |-- config.js            # Environment config loader
|-- prompts/
|   |-- classifier.md        # Classifier prompt reference
|   |-- examples.md          # Test cases and edge cases
|-- slack/
|   |-- setup.md             # Slack channel setup guide
|-- make/                    # Make.com guides (deprecated, kept for reference)
|-- zapier/                  # Zapier guides (deprecated, kept for reference)
|-- notion/                  # Notion schema (deprecated, kept for reference)
|-- .env                     # API keys (gitignored, for local Node.js only)
|-- .env.example             # Template for .env
|-- package.json             # Node.js dependencies (for local tools only)
```

## Services and Credentials

| Service | What it does | Credential | Where it's stored |
|---------|-------------|------------|-------------------|
| Slack | Capture + notifications | Bot Token (`xoxb-...`) | In Code.gs CONFIG |
| OpenAI | AI classification | API Key (`sk-...`) | In Code.gs CONFIG |
| Google Sheets | Storage | None needed (script runs inside the sheet) | N/A |
| Google Apps Script | Serverless runtime | None needed (tied to Google account) | N/A |

### Slack App Scopes (Bot Token Scopes)

- `channels:history` — read messages in public channels
- `groups:history` — read messages in private channels
- `chat:write` — send receipts and nudges
- `reactions:write` — add emoji reactions
- `channels:read` — list channels (for findAndSaveChannelId)
- `groups:read` — list private channels

### Slack Event Subscriptions

- `message.channels` — triggers on public channel messages
- `message.groups` — triggers on private channel messages

## Cost

- **OpenAI** (gpt-4o-mini): ~$0.01-0.02 per classification. At 20 thoughts/day = ~$0.18/month
- **Google Sheets**: Free
- **Google Apps Script**: Free (generous limits: 6 min/execution, 90 min/day total)
- **Slack**: Free plan works (bot, webhooks, and channels all work on free tier)

## Deprecated Approaches

These were tried before settling on Google Apps Script:

1. **Zapier** — hit free plan limits on Code step and Google Sheets step
2. **Make.com** — hit 1,000 operation/month limit (Daily Nudge consumed all operations)
3. **Local Node.js bot** (`npm run bot`) — works but requires PC to be running 24/7
4. **n8n** — requires self-hosting a server

All documentation for these is kept in their respective folders for reference.
