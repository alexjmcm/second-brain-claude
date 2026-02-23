# Building Block 7: The Tap on the Shoulder (Daily Nudge)

Every morning, you get a Slack DM with a summary of what came in yesterday and your open tasks. This is a **separate Make.com scenario** from the core loop.

## Create a new scenario in Make.com

### Step 1: Schedule Trigger

1. Click **Create a new scenario**
2. Click the **+** → search for **Schedule** → select it
3. Set it to run **once per day** at your preferred time (e.g., 8:00 AM)

### Step 2: Read from Google Sheets

1. Click **+** → **Google Sheets** → **Search Rows**
2. Connect to your Google account
3. Select your **Brain** spreadsheet and **Sheet1**
4. Filter: you want rows where **Status** = `Inbox`
5. This returns all unprocessed items

### Step 3: Summarize with OpenAI

1. Click **+** → **OpenAI** → **Generate a Chat Completion**
2. Model: `gpt-4o-mini`
3. System message:
   ```
   You are a daily briefing assistant. Given a list of captured thoughts, create a concise morning summary. Group items by category. Highlight high-priority tasks first. Keep it brief and actionable. Use emoji for visual scanning.
   ```
4. User message: Pass all the rows from Google Sheets as text. Use Make.com's **Iterator** + **Text Aggregator** if needed to combine multiple rows into one message. Or just pass the raw data.
5. Temperature: `0.3`
6. Max tokens: `500`

### Step 4: Send Slack DM

1. Click **+** → **Slack** → **Send a Direct Message**
2. Select yourself as the user
3. Text: pick the response from the OpenAI step

## Simpler Alternative (no OpenAI step)

If you want to save on API calls, skip the OpenAI summarization and just list the items:

1. **Schedule** → daily at 8 AM
2. **Google Sheets** → Search Rows where Status = Inbox
3. **Slack** → Send DM with a formatted list:
   ```
   🧠 Good morning! Here's your brain inbox:

   {{row 1: category}} | {{row 1: priority}} — {{row 1: summary}}
   {{row 2: category}} | {{row 2: priority}} — {{row 2: summary}}
   ...

   Open your Brain spreadsheet to review.
   ```

The simpler version is harder to set up with multiple rows in Make.com (requires an Iterator + Aggregator), but costs nothing extra.

## Make.com Free Plan Note

The daily nudge uses 3-4 operations per run. At once per day, that's ~90-120 operations/month out of your 1,000 free allowance. Plenty of room.

## Result

Every morning you get a nudge with your open items. No need to remember to check the spreadsheet — the system reminds you.
