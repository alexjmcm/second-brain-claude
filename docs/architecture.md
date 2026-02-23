# System Architecture

## Overview

The AI Second Brain is a thought capture and classification pipeline:

```
INPUT                  PROCESSING               STORAGE              FEEDBACK
-----                  ----------               -------              --------
Slack message    ->    Google Apps Script   ->   Google Sheets   ->   Slack receipt
(#brain-inbox)         (calls OpenAI API)        (Inbox + tabs)       (thread reply + emoji)
```

All processing happens in a single Google Apps Script file (`Code.gs`) deployed as a Web App inside Google Sheets.

## Data Flow

### 1. Message Capture (doPost)

```
Slack Event Subscription
  |
  v
doPost(e) receives webhook POST
  |
  |--> If url_verification: return challenge (one-time setup)
  |
  |--> If event_callback:
       |
       |--> Skip if: bot message, edit, or thread reply
       |
       |--> Deduplicate using CacheService (key: msg_<timestamp>, TTL: 600s)
       |    (Slack retries webhooks after 3 seconds if script is slow)
       |
       |--> processMessage(text, channel, timestamp)
```

### 2. Classification (classifyThought)

```
processMessage
  |
  v
classifyThought(text)
  |
  |--> POST to OpenAI /v1/chat/completions
  |    Model: gpt-4o-mini
  |    Temperature: 0.1 (near-deterministic)
  |    response_format: { type: 'json_object' }
  |
  |--> Returns JSON:
       {
         category: "Task|Idea|Reference|Decision|Question|People",
         priority: "High|Medium|Low",
         summary: "One sentence (max 80 chars)",
         next_action: "Starts with a verb",
         tags: ["tag1", "tag2"],
         confidence: 0-100,
         reasoning: "Why this classification"
       }
```

### 3. Storage (writeToSheet)

```
writeToSheet(classification, originalText, source)
  |
  |--> Write to Inbox tab (master log, all items)
  |
  |--> Look up CATEGORY_TABS mapping:
  |    Task -> Tasks, Idea -> Ideas, Reference -> Reference,
  |    Decision -> Decisions, Question -> Questions, People -> People
  |
  |--> Write same row to category-specific tab
```

**Row format (10 columns):**
`[summary, category, priority, next_action, source, confidence, "Inbox", tags, originalText, reasoning]`

### 4. Feedback (Slack receipt + emoji)

```
After writeToSheet:
  |
  |--> sendSlackReceipt: threaded reply with classification summary
  |
  |--> If confidence >= 80 (CONFIDENCE_THRESHOLD):
  |    addSlackReaction: brain emoji
  |
  |--> If confidence < 80:
       addSlackReaction: question emoji
       sendSlackWarning: low confidence warning message
       Row gets [?] prefix on summary
```

### 5. Scheduled Nudges

```
Daily Nudge (6 AM, every day):
  |--> Read Inbox tab
  |--> Filter rows where Status = "Inbox"
  |--> Group by priority (High, Medium, Low)
  |--> Send formatted summary to #brain-inbox

Weekly Nudge (Sunday 5 PM):
  |--> Read Inbox tab
  |--> Count all items by category
  |--> Filter items still in "Inbox" status
  |--> Show category breakdown + pending high/medium items
  |--> Send formatted summary to #brain-inbox
```

## External Services

### OpenAI API
- Endpoint: `https://api.openai.com/v1/chat/completions`
- Model: `gpt-4o-mini` (cheapest, fastest, sufficient for classification)
- Auth: Bearer token (API key)
- Cost: ~$0.01-0.02 per classification

### Slack API
- Webhook: Event Subscriptions (Slack POSTs to our Web App URL)
- Send messages: `https://slack.com/api/chat.postMessage`
- Add reactions: `https://slack.com/api/reactions.add`
- List channels: `https://slack.com/api/conversations.list`
- Auth: Bearer token (Bot Token)

### Google Sheets
- Accessed via `SpreadsheetApp.getActiveSpreadsheet()` (native to Apps Script)
- No API key needed — the script runs inside the spreadsheet
- Sheet ID: bound to the spreadsheet where the script was created

## Configuration

All configuration is in the `CONFIG` object at the top of `Code.gs`:

```javascript
const CONFIG = {
  OPENAI_API_KEY: 'sk-...',      // OpenAI API key
  OPENAI_MODEL: 'gpt-4o-mini',   // Model for classification
  SLACK_BOT_TOKEN: 'xoxb-...',   // Slack Bot User OAuth Token
  SHEET_NAME: 'Inbox',           // Name of the master log tab
  CONFIDENCE_THRESHOLD: 80,      // Below this = low confidence
};
```

Channel ID for nudges is stored in Script Properties (set by running `findAndSaveChannelId`).

## Deduplication

Slack retries webhook calls if the response takes longer than 3 seconds. Since OpenAI calls take 2-5 seconds, duplicates can occur.

Current approach: CacheService with a 600-second TTL keyed on message timestamp (`msg_<event.ts>`). This prevents most duplicates but occasional ones may still appear if the cache is slow.

## Google Apps Script Limitations

- Max execution time: 6 minutes per call
- Daily URL fetch quota: 20,000 calls
- Daily trigger time: 90 minutes total
- Time triggers: whole hours only (e.g., `atHour(8)` fires between 8:00-8:59)
- No persistent state besides: Sheet data, Script Properties, CacheService
- Deployment: must create "New deployment" for code changes to take effect reliably
