# Troubleshooting Guide

Common issues and their fixes, organized by symptom.

## Deployment Issues

### Code changes aren't taking effect

**Symptom:** You updated `Code.gs` in the Apps Script editor, but the behavior hasn't changed.

**Fix:** Always use **Deploy > New deployment** (not "Manage deployments > edit > New version"). The "New version" approach is unreliable and often serves old code.

Steps:
1. Save your code (Ctrl+S)
2. Click **Deploy > New deployment**
3. Select **Web app** > Execute as "Me" > Access "Anyone"
4. Click **Deploy**
5. Copy the **new URL**
6. Go to Slack app > **Event Subscriptions** > paste the new URL in Request URL
7. Wait for the green "Verified" checkmark

**Why:** Google Apps Script caches deployed versions aggressively. New deployments get a completely new URL and always serve the latest code.

### Slack says "Your URL didn't respond" when verifying

**Symptom:** Pasting the Web App URL into Slack Event Subscriptions doesn't get a green checkmark.

**Possible causes:**
- You pasted the wrong URL (make sure it ends in `/exec`)
- The code has a syntax error (check for red underlines in the editor)
- You're using an old deployment URL that's been superseded

**Fix:** Create a brand new deployment and use that URL.

## Message Processing Issues

### Messages not being captured at all

**Symptom:** You send a message in `#brain-inbox` but nothing happens — no row in the sheet, no Slack reply, no emoji.

**Check these in order:**

1. **Is the bot in the channel?** In Slack, check channel members. If the bot isn't there, invite it: `/invite @YourBotName`
2. **Is the Event Subscription URL correct?** Go to api.slack.com > your app > Event Subscriptions. The URL should match your latest deployment.
3. **Are bot events subscribed?** Under "Subscribe to bot events", you need `message.channels` (public) and/or `message.groups` (private).
4. **Check Apps Script executions:** Go to the Apps Script editor > Executions (left sidebar). Look for recent `doPost` runs and any errors.

### Duplicate rows appearing in Google Sheets

**Symptom:** Each Slack message creates 2 (or more) rows in the spreadsheet.

**Likely causes (check in order):**

1. **Multiple Slack apps pointing to the same script:** Go to api.slack.com/apps and check if you have more than one app with Event Subscriptions pointing to your Web App URL. Disable or delete any duplicates.

2. **Multiple Event Subscription URLs:** Within a single Slack app, make sure there's only one active Request URL.

3. **Slack retries:** Slack retries webhooks after 3 seconds if the script doesn't respond quickly. The script has CacheService-based deduplication (600-second TTL), but if the cache is slow, a retry might slip through. This is rare and usually means something else is wrong (like cause #1 above).

**How to check:** Look at the Apps Script execution log. If you see two `doPost` calls within 3 seconds of each other for the same message, it's a Slack retry. If they're from different times or different apps, it's cause #1.

### Classification seems wrong

**Symptom:** Messages are being classified into the wrong category or with wrong priority.

**Options:**
- The classifier uses `gpt-4o-mini` which is fast and cheap but occasionally makes mistakes. This is expected.
- If confidence is below 80%, the row gets a `[?]` prefix and a question mark emoji — review these in the spreadsheet.
- You can manually edit any column in the spreadsheet to fix misclassifications.
- If a specific type of message is consistently misclassified, you could adjust the `SYSTEM_PROMPT` in `Code.gs` to add more guidance for that case.

## Slack Feature Issues

### No threaded receipt reply

**Symptom:** Message gets captured in the sheet but no threaded reply appears in Slack.

**Check:**
- Bot Token Scope `chat:write` is required. Go to api.slack.com > your app > OAuth & Permissions > Bot Token Scopes.
- If you added the scope, click **Reinstall to Workspace** and update `SLACK_BOT_TOKEN` in the script if the token changed.
- Create a **New deployment** after updating the token.

### No emoji reaction (brain or question mark)

**Symptom:** Message gets captured and receipt appears, but no emoji reaction on the original message.

**Check:**
- Bot Token Scope `reactions:write` is required. Go to api.slack.com > your app > OAuth & Permissions > Bot Token Scopes.
- If you added the scope, click **Reinstall to Workspace** and update `SLACK_BOT_TOKEN` in the script if the token changed.
- Create a **New deployment** after updating the token.

### Low confidence items not getting question mark emoji

**Symptom:** Vague messages get the brain emoji instead of the question mark.

**Explanation:** OpenAI tends to give generous confidence scores. The threshold is set to 80 (`CONFIG.CONFIDENCE_THRESHOLD`). Very short or genuinely ambiguous messages (like "hmm" or "ugh") will get flagged, but semi-clear messages may still score above 80.

**Options:**
- Raise `CONFIDENCE_THRESHOLD` to 85 or 90 for stricter filtering
- Remember to create a **New deployment** after changing the value

## Nudge Issues

### Daily/weekly nudge not sending

**Symptom:** It's past the scheduled time but no nudge message appeared in Slack.

**Check these:**

1. **Was the trigger set up?** In Apps Script editor, go to Triggers (clock icon in left sidebar). You should see entries for `dailyNudge` and/or `weeklyNudge`.

2. **Is the channel ID saved?** Run `findAndSaveChannelId` from the Apps Script editor. Check the log for "Saved brain-inbox channel ID: C...".

3. **Timing:** Google Apps Script triggers fire within a 1-hour window. `atHour(8)` fires sometime between 8:00 and 8:59. `atHour(17)` fires between 5:00 and 5:59 PM. If you just created the trigger, it may have already passed today's window.

4. **Are there items in Inbox status?** The daily nudge only sends if there are rows with Status = "Inbox". If all items are marked done (or have any status other than "Inbox"), no nudge is sent.

5. **Check execution log:** Go to Apps Script editor > Executions. Look for `dailyNudge` or `weeklyNudge` runs. If they show errors, the log will tell you what went wrong.

### "Next" shows as undefined in daily nudge

**Symptom:** The daily nudge message shows "Next: undefined" for items.

**Cause:** The column header in your spreadsheet doesn't exactly match what the code expects. The code looks for `Next Action` (with a space, capital N and A).

**Fix:** Check that your header row (row 1) in the Inbox tab says exactly: `Name | Category | Priority | Next Action | Source | Confidence | Status | Tags | Original | Reasoning`

## Google Sheets Issues

### Category tab not receiving rows

**Symptom:** Rows appear in the Inbox tab but not in the category-specific tab (e.g., Tasks, Ideas).

**Check:**
- Tab names must match exactly: `Tasks`, `Ideas`, `Reference`, `Decisions`, `Questions`, `People`
- These are case-sensitive and plural where noted
- Check the Apps Script execution log — it logs the category and tab name for each write

### Row format looks wrong

**Expected column order (10 columns):**
`Name | Category | Priority | Next Action | Source | Confidence | Status | Tags | Original | Reasoning`

If columns are shifted, make sure your header row matches this order exactly. The script uses `appendRow` which adds columns in the order defined in the code.

## Required Slack Bot Scopes (Complete List)

If something isn't working, make sure all these scopes are present in OAuth & Permissions > Bot Token Scopes:

| Scope | What it enables |
|-------|----------------|
| `channels:history` | Read messages in public channels |
| `groups:history` | Read messages in private channels |
| `chat:write` | Send receipt replies and nudge summaries |
| `reactions:write` | Add brain/question emoji reactions |
| `channels:read` | List channels (for findAndSaveChannelId) |
| `groups:read` | List private channels |

After adding any scope, click **Reinstall to Workspace**. The bot token may change — update it in `Code.gs` CONFIG if so.

## Quick Checklist for "Nothing Works"

If the whole system seems broken, run through this:

1. Open Apps Script editor > check for syntax errors (red underlines)
2. Check Executions log for recent errors
3. Verify Event Subscriptions URL matches your latest deployment
4. Verify bot is in the `#brain-inbox` channel
5. Run `testFullFlow` from the editor — does it write to the sheet?
6. Run `testClassify` — does it return valid JSON?
7. If test functions work but Slack doesn't trigger: the issue is deployment or Slack configuration
8. When in doubt: create a **New deployment**, update the Slack Request URL, wait for green checkmark
