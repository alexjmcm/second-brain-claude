# Google Apps Script Setup Guide

One script, zero hosting, zero cost. Everything runs inside your Google Sheet.

## Prerequisites

- A Google account
- An OpenAI API account with credits (https://platform.openai.com)
- A Slack workspace with a Slack app (see `slack/setup.md`)

## Setup Steps

### Step 1: Prepare the Google Sheet

1. Open your **Brain** Google Sheet
2. Make sure you have these tabs (exact names matter):
   - `Inbox` (master log — all items go here)
   - `Tasks`
   - `Ideas`
   - `People`
   - `Reference`
   - `Decisions`
   - `Questions`
3. Each tab should have this header row (row 1):
   **Name | Category | Priority | Next Action | Source | Confidence | Status | Tags | Original | Reasoning**

### Step 2: Open the Script Editor

1. In your Brain Google Sheet, click **Extensions > Apps Script**
2. This opens the script editor in a new tab
3. Delete any code already there (usually a blank `myFunction`)

### Step 3: Paste the Code

1. Open `Code.gs` from this folder
2. Copy the entire contents
3. Paste it into the Apps Script editor

### Step 4: Add Your API Keys

At the top of the script, replace the placeholder values in `CONFIG`:

```javascript
const CONFIG = {
  OPENAI_API_KEY: 'sk-your-actual-openai-key',
  OPENAI_MODEL: 'gpt-4o-mini',
  SLACK_BOT_TOKEN: 'xoxb-your-actual-slack-bot-token',
  SHEET_NAME: 'Inbox',
  CONFIDENCE_THRESHOLD: 80,
};
```

**IMPORTANT:** Never commit real API keys to git. The `Code.gs` in this repo has placeholder values. You add real keys only in the Apps Script editor.

### Step 5: Deploy as Web App

1. Click **Deploy > New deployment**
2. Click the gear icon > select **Web app**
3. Settings:
   - Description: `Second Brain`
   - Execute as: **Me**
   - Who has access: **Anyone**
4. Click **Deploy**
5. **Authorize** when prompted (click through the "unsafe" warning — it's your own script)
6. Copy the **Web app URL** — you'll need this for Slack

### Step 6: Connect Slack to the Script

1. Go to https://api.slack.com/apps > your Brain Bot app
2. Go to **Event Subscriptions** in the left sidebar
3. Toggle **Enable Events** ON
4. In **Request URL**, paste your Web app URL from Step 5
5. Slack will send a verification challenge — the script handles this automatically
6. You should see a green "Verified" checkmark
7. Under **Subscribe to bot events**, make sure you have:
   - `message.channels`
   - `message.groups`
8. Click **Save Changes**

### Step 7: Required Slack Bot Scopes

Go to **OAuth & Permissions** and ensure these Bot Token Scopes are added:
- `channels:history` — read messages in public channels
- `groups:history` — read messages in private channels
- `chat:write` — send receipt replies and nudge summaries
- `reactions:write` — add emoji reactions to messages
- `channels:read` — list channels (needed for findAndSaveChannelId)
- `groups:read` — list private channels

If you added new scopes, click **Reinstall to Workspace** and update `SLACK_BOT_TOKEN` in the script if the token changed.

### Step 8: Set Up Channel ID (for nudges)

1. In the Apps Script editor, select `findAndSaveChannelId` from the function dropdown
2. Click play
3. Check the execution log — it should say "Saved brain-inbox channel ID: C..."

### Step 9: Set Up Daily Nudge

1. Select `setupDailyNudge` from the dropdown > click play
2. This creates a daily trigger that sends your morning summary at 6 AM
3. To change the hour, edit the `atHour(6)` value in `setupDailyNudge` and re-run

### Step 10: Set Up Weekly Nudge

1. Select `setupWeeklyNudge` from the dropdown > click play
2. This creates a Sunday 5 PM weekly summary trigger
3. To change day/time, edit `onWeekDay()` and `atHour()` in `setupWeeklyNudge` and re-run

### Step 11: Test Everything

1. Select `testClassify` > click play > check logs for classification result
2. Select `testFullFlow` > click play > check Inbox tab and category tab for new rows
3. Send a message in `#brain-inbox` in Slack
4. Check Google Sheet for a new row
5. Check Slack for a threaded receipt and brain emoji
6. Send a vague message like "hmm" to test the bouncer (should get question mark emoji)

## Updating the Code

When you need to deploy code changes:

1. Paste updated Code.gs into the Apps Script editor
2. Add your API keys in CONFIG
3. Save (Ctrl+S)
4. **Deploy > New deployment** > Web app > Execute as "Me" > Access "Anyone" > Deploy
5. Copy the new URL
6. Go to Slack app > Event Subscriptions > paste new URL in Request URL
7. Wait for green "Verified" checkmark

**IMPORTANT:** Always create a **New deployment**. Using "Manage deployments > edit > New version" is unreliable and often serves old code. New deployments generate a new URL but always work.

## How It Works

```
You send Slack message
  > Slack sends webhook to your Google Apps Script
  > Script deduplicates using CacheService (prevents Slack retry duplicates)
  > Script calls OpenAI to classify into JSON
  > Script writes row to Inbox tab + category-specific tab
  > Script sends threaded receipt in Slack
  > Script adds brain emoji (or question mark if low confidence)
  > If low confidence: sends warning message too

Every morning at 6 AM:
  > Script reads all items with Status = "Inbox"
  > Groups by priority (High, Medium, Low)
  > Sends one summary message to #brain-inbox

Every Sunday at 5 PM:
  > Script reads all items
  > Shows category breakdown + pending inbox items
  > Sends weekly summary to #brain-inbox
```

## Limits (generous, you won't hit these)

- Google Apps Script: 6 minutes per execution, 90 minutes total per day
- Each classification takes ~2-3 seconds
- You'd need to send ~1,800 messages per day to hit the limit
- URL Fetch calls: 20,000 per day
- CacheService entries: 600-second TTL for dedup

## Managing Items

- **Mark as done:** Change the Status column from "Inbox" to "d" (or anything else)
- **Fix misclassification:** Edit the Category, Priority, or any other column directly
- **Items with Status = "Inbox"** appear in daily and weekly nudges
- **Items with any other Status** are excluded from nudges
