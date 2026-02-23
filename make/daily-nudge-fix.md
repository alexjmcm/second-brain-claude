# Fix: Daily Nudge Sending Too Many Messages

## Problem
The Daily Nudge sends one Slack message per row, which triggers Slack's rate limit.

## Solution: Combine all rows into one message

### Step-by-step

1. Open your Daily Nudge scenario in Make.com

2. **Delete** the Slack module (we'll re-add it after the aggregator)

3. After **Google Sheets → Search Rows**, click **+** → search for **Text Aggregator**
   - It might be under **Tools → Text Aggregator** or just **Text Aggregator**
   - **Source module**: select the Google Sheets module
   - **Row separator**: type `\n` (newline)
   - **Text**: format each row like this — pick the column variables from Google Sheets:
     ```
     {{Category}} | {{Priority}} — {{Name}}
     Next: {{Next Action}}
     ```

4. After the Text Aggregator, click **+** → add **Slack → Send a Message**
   - **Channel**: `#brain-inbox` or DM yourself
   - **Text**:
     ```
     Good morning! Here's your brain inbox:

     {{text from aggregator step}}
     ```
   - Pick the aggregated text output from the Text Aggregator step

5. **Save** the scenario

### Result
One single Slack message each morning with all your inbox items listed, instead of one message per item.

### Optional: Add OpenAI Summary
For an even better nudge, add an **OpenAI** step between the Text Aggregator and Slack:

1. After Text Aggregator, click **+** → **OpenAI → Generate a Chat Completion**
2. System message: `You are a daily briefing assistant. Given a list of captured thoughts, create a short actionable morning summary. Lead with high-priority tasks. Keep it under 10 lines. No fluff.`
3. User message: pick the aggregated text from the Text Aggregator
4. Then the Slack step sends OpenAI's summary instead of the raw list

This costs ~$0.001 per morning and gives you an AI-curated briefing instead of a raw dump.
