# Porting Guide

How to migrate this system to different platforms or swap out components. The architecture has 4 independent pieces — you can swap any one without touching the others.

```
INPUT          PROCESSING              STORAGE           FEEDBACK
-----          ----------              -------           --------
Slack    ->    Google Apps Script  ->   Google Sheets ->  Slack
(swap A)       (swap B)                (swap C)          (swap D)
```

## A. Moving to a Different Slack Workspace

**When:** Your Slack trial expires, you switch teams, or you want a fresh workspace.

**What stays the same:** The Google Apps Script code, Google Sheet, and OpenAI API — nothing changes there.

**Steps:**

1. Create a new Slack workspace (or use an existing one)
2. Create the `#brain-inbox` channel
3. Create a new Slack app at https://api.slack.com/apps:
   - Add Bot Token Scopes: `channels:history`, `groups:history`, `chat:write`, `reactions:write`, `channels:read`, `groups:read`
   - Enable Event Subscriptions with your existing Web App URL
   - Subscribe to bot events: `message.channels`, `message.groups`
   - Install the app to the workspace
4. Copy the new Bot Token (`xoxb-...`)
5. In Apps Script editor: update `CONFIG.SLACK_BOT_TOKEN` with the new token
6. Create a **New deployment** (Deploy > New deployment)
7. Copy the new URL into the Slack app's Event Subscriptions Request URL
8. Wait for green "Verified" checkmark
9. Run `findAndSaveChannelId` to save the new channel ID
10. Invite the bot to `#brain-inbox` in the new workspace

**Important:** The Slack free plan supports everything this system needs. No paid plan required.

## B. Swapping the AI Provider

### B1. Switching OpenAI Models

**When:** You want to use a different OpenAI model (cheaper, better, newer).

**Steps:**
1. Change `CONFIG.OPENAI_MODEL` in `Code.gs` (e.g., `gpt-4o`, `gpt-4o-mini`, `gpt-3.5-turbo`)
2. Create a New deployment

**Compatible models (must support `response_format: { type: 'json_object' }`):**
- `gpt-4o-mini` — current, cheapest, fast, works well
- `gpt-4o` — more capable, slightly more expensive
- `gpt-3.5-turbo` — older, cheapest, less reliable for classification
- Any future OpenAI model that supports JSON mode

### B2. Switching to a Different AI Provider (e.g., Anthropic Claude, Google Gemini)

**When:** OpenAI pricing changes, or you prefer a different provider.

**What to change:** Only the `classifyThought()` function in `Code.gs`.

**Steps:**
1. Replace the `classifyThought()` function with one that calls your new provider's API
2. The function must return the same JSON structure:
   ```json
   {
     "category": "Task|Idea|Reference|Decision|Question|People",
     "priority": "High|Medium|Low",
     "summary": "...",
     "next_action": "...",
     "tags": ["..."],
     "confidence": 0-100,
     "reasoning": "..."
   }
   ```
3. Keep the same `SYSTEM_PROMPT` — it's provider-agnostic
4. Update `CONFIG` to hold the new API key instead of (or alongside) the OpenAI key

**Example for Anthropic Claude:**
```javascript
function classifyThought(text) {
  var url = 'https://api.anthropic.com/v1/messages';

  var payload = {
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    system: SYSTEM_PROMPT,
    messages: [
      { role: 'user', content: 'Classify this thought:\n\n' + text }
    ],
  };

  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'x-api-key': CONFIG.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  var response = UrlFetchApp.fetch(url, options);
  var json = JSON.parse(response.getContentText());
  var content = json.content[0].text;
  return JSON.parse(content);
}
```

**Example for Google Gemini:**
```javascript
function classifyThought(text) {
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + CONFIG.GEMINI_API_KEY;

  var payload = {
    contents: [{
      parts: [{
        text: SYSTEM_PROMPT + '\n\nClassify this thought:\n\n' + text
      }]
    }],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1,
    }
  };

  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  var response = UrlFetchApp.fetch(url, options);
  var json = JSON.parse(response.getContentText());
  var content = json.candidates[0].content.parts[0].text;
  return JSON.parse(content);
}
```

## C. Swapping the Storage Backend

### C1. Moving to a Different Google Sheet

**Steps:**
1. Create the new spreadsheet with the same tabs: `Inbox`, `Tasks`, `Ideas`, `People`, `Reference`, `Decisions`, `Questions`
2. Add the header row to each tab: `Name | Category | Priority | Next Action | Source | Confidence | Status | Tags | Original | Reasoning`
3. In the new spreadsheet, go to Extensions > Apps Script
4. Paste `Code.gs`, add your API keys
5. Deploy as Web App
6. Update Slack Event Subscriptions with the new URL

### C2. Moving to Notion

**What to change:** Replace the `writeToSheet()` function with Notion API calls.

**Steps:**
1. Create a Notion database with properties matching the columns
2. Get a Notion integration token (https://www.notion.so/my-integrations)
3. Share the database with your integration
4. Replace `writeToSheet()`:

```javascript
function writeToSheet(classification, originalText, source) {
  var url = 'https://api.notion.com/v1/pages';
  var prefix = classification.confidence < CONFIG.CONFIDENCE_THRESHOLD ? '[?] ' : '';

  var payload = {
    parent: { database_id: CONFIG.NOTION_DATABASE_ID },
    properties: {
      'Name': { title: [{ text: { content: prefix + classification.summary } }] },
      'Category': { select: { name: classification.category } },
      'Priority': { select: { name: classification.priority } },
      'Next Action': { rich_text: [{ text: { content: classification.next_action } }] },
      'Source': { select: { name: source } },
      'Confidence': { number: classification.confidence },
      'Status': { select: { name: 'Inbox' } },
      'Tags': { multi_select: (classification.tags || []).map(function(t) { return { name: t }; }) },
      'Original': { rich_text: [{ text: { content: originalText } }] },
      'Reasoning': { rich_text: [{ text: { content: classification.reasoning } }] },
    }
  };

  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Authorization': 'Bearer ' + CONFIG.NOTION_TOKEN,
      'Notion-Version': '2022-06-28',
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  UrlFetchApp.fetch(url, options);
}
```

**Note:** You'd also need to update `dailyNudge()` and `weeklyNudge()` to read from Notion instead of Google Sheets.

### C3. Moving to Airtable

Similar approach to Notion — replace `writeToSheet()` with Airtable API calls. Airtable's API is simpler but the free plan has a 1,000 record limit.

## D. Swapping the Input Source

### D1. Adding Email Capture

You could add a time-based trigger that reads from Gmail:

```javascript
function checkEmail() {
  var threads = GmailApp.search('label:brain-inbox is:unread', 0, 10);
  threads.forEach(function(thread) {
    var msg = thread.getMessages()[0];
    var text = msg.getPlainBody();
    processMessage(text, null, null); // no Slack channel/timestamp
    thread.markRead();
  });
}
```

Set up with a time trigger (every 5 minutes). Label emails with "brain-inbox" to capture them.

### D2. Adding a Web Form

Create a simple Google Form linked to a trigger, or build a small web page that POSTs to your Web App URL.

### D3. Using a Different Chat Platform (Discord, Telegram, etc.)

Replace the `doPost()` webhook handler with one that understands the new platform's event format. The rest of the pipeline (classify, store, feedback) stays the same.

## E. Moving Off Google Apps Script Entirely

### E1. To a Node.js Server (e.g., on Railway, Render, or a VPS)

**When:** You need more power, longer execution times, or want to use npm packages.

The `src/` folder in this repo already has a working Node.js implementation:
- `src/classify.js` — OpenAI classifier
- `src/sheets.js` — Google Sheets writer (via googleapis npm package)
- `src/bot.js` — Slack bot (Socket Mode, no public URL needed)
- `src/cli.js` — CLI tool

**Trade-offs:**
- Requires a server running 24/7 (not free unless you find a free tier)
- More flexible (npm packages, longer timeouts, background jobs)
- The local `src/bot.js` uses Socket Mode so no public URL is needed

### E2. To Cloudflare Workers or AWS Lambda

Similar to Google Apps Script but with more generous limits. You'd rewrite the webhook handler for the platform's format but keep the same logic.

## Summary: What to Change for Each Migration

| Migration | Files to change | Effort |
|-----------|----------------|--------|
| New Slack workspace | CONFIG.SLACK_BOT_TOKEN + new Slack app | 30 min |
| Different OpenAI model | CONFIG.OPENAI_MODEL | 2 min |
| Different AI provider | `classifyThought()` function | 30 min |
| Different Google Sheet | New sheet + new deployment | 20 min |
| To Notion storage | `writeToSheet()` + nudge functions | 1-2 hours |
| Add email capture | New function + trigger | 30 min |
| Full Node.js migration | Use existing `src/` folder | 1-2 hours |
