# Building Block 5: The Receipt (Audit Trail)

After every classification, the bot sends a reply in Slack confirming what it did. This builds trust — you can see at a glance whether the AI got it right.

## What to add in Make.com

Add a **Slack → Send a Reply** step at the END of each path (after Google Sheets).

### Step-by-step

1. After your Google Sheets step, click **+**
2. Search for **Slack** → select **Create a Message** (or **Send a Message**)
3. Fill in:
   - **Channel**: pick the `channel` variable from the Slack trigger step (Step 1)
   - **Thread timestamp**: pick the `ts` (timestamp) variable from the Slack trigger step — this makes it a **threaded reply** so it doesn't clutter the channel
   - **Text**: paste this (map the variables from JSON Parse):

```
✅ Captured!
📁 {{category}} | ⚡ {{priority}}
📝 {{summary}}
👉 Next: {{next_action}}
🏷️ {{tags}}
💯 Confidence: {{confidence}}%
```

4. Save and test

### If you added the Bouncer

You need this step at the end of **both** paths (high confidence and low confidence). For the low-confidence path, change the emoji:

```
❓ Captured (low confidence — please review)
📁 {{category}} | ⚡ {{priority}}
📝 {{summary}}
👉 Next: {{next_action}}
💯 Confidence: {{confidence}}%
```

## Result

Every time you drop a thought in `#brain-inbox`, you get a threaded reply showing exactly how it was classified. If something looks wrong, you fix it in Google Sheets.

## Slack Permissions

You may need to add the `chat:write` scope to your Slack app:
1. Go to api.slack.com → your app → OAuth & Permissions
2. Add `chat:write` under Bot Token Scopes
3. Reinstall the app to your workspace
