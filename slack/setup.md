# Slack Setup Guide

Slack is the capture layer — the "Drop Box" of your Second Brain. You type a thought in `#brain-inbox`, and the system handles everything else.

## Part 1: Create the Channel

1. In your Slack workspace, create a new channel: `#brain-inbox`
2. Set the channel description: "Drop thoughts here. AI classifies and files them to Google Sheets automatically."
3. Set the channel topic: "Just type. The system handles the rest."
4. **Make it private** if you want (recommended for personal use)

## Part 2: Create a Slack App

1. Go to https://api.slack.com/apps
2. Click **Create New App** > **From scratch**
3. Name it something like "Brain Bot"
4. Select your workspace
5. Click **Create App**

## Part 3: Add Bot Token Scopes

1. In the left sidebar, go to **OAuth & Permissions**
2. Scroll to **Bot Token Scopes** and add all of these:

| Scope | Why it's needed |
|-------|----------------|
| `channels:history` | Read messages in public channels |
| `groups:history` | Read messages in private channels |
| `chat:write` | Send receipt replies and nudge summaries |
| `reactions:write` | Add brain/question emoji reactions |
| `channels:read` | List channels (for setup) |
| `groups:read` | List private channels (for setup) |

3. Click **Install to Workspace** (or **Reinstall** if already installed)
4. Copy the **Bot User OAuth Token** (`xoxb-...`) — you'll need this for `Code.gs`

## Part 4: Enable Event Subscriptions

1. In the left sidebar, go to **Event Subscriptions**
2. Toggle **Enable Events** to ON
3. In **Request URL**, paste your Google Apps Script Web App URL
   - This is the URL from Deploy > New deployment in the Apps Script editor
   - It looks like: `https://script.google.com/macros/s/.../exec`
4. Wait for the green **Verified** checkmark
5. Under **Subscribe to bot events**, add:
   - `message.channels` (messages in public channels)
   - `message.groups` (messages in private channels)
6. Click **Save Changes**

## Part 5: Invite the Bot to Your Channel

1. Open `#brain-inbox` in Slack
2. Type `/invite @BrainBot` (or whatever you named your app)
3. The bot should now appear in the channel members

## Part 6: Test It

1. Send a message in `#brain-inbox`, like: "Need to call the dentist tomorrow"
2. Within a few seconds, you should see:
   - A threaded reply with the classification summary
   - A brain emoji reaction (or question mark if low confidence)
3. Check your Google Sheet — a new row should appear in both the Inbox tab and the category tab (e.g., Tasks)

## Mobile Shortcut (Recommended)

On your phone:
1. Open Slack
2. Long-press the `#brain-inbox` channel
3. Star it / pin it to your sidebar

Now capturing a thought is: open Slack > tap starred channel > type > send. Under 5 seconds.

## Pin a Welcome Message (Optional)

Pin this to the channel so you remember how it works:

> **How to use this channel:**
> - Type any thought, task, idea, question, or thing you want to remember
> - The AI will classify it and file it in Google Sheets within a few seconds
> - Brain emoji = captured with high confidence
> - Question mark emoji = low confidence, review in the spreadsheet
>
> **Tips:**
> - Be natural. "buy milk" works as well as a full paragraph.
> - Include context when possible: "cancel gym membership before the 15th" beats "cancel gym"
> - One thought per message works best (the AI classifies each message separately)

## Updating the Bot Token

If you regenerate the bot token (e.g., after adding new scopes):

1. Go to api.slack.com > your app > OAuth & Permissions
2. Click **Reinstall to Workspace**
3. Copy the new `xoxb-...` token
4. Update `CONFIG.SLACK_BOT_TOKEN` in the Apps Script editor
5. Create a **New deployment** (Deploy > New deployment)
6. Update the Request URL in Event Subscriptions with the new deployment URL

## Free Plan Compatibility

Everything works on Slack's free plan:
- Bot users and apps work on free plans
- Event Subscriptions (webhooks) work on free plans
- Channel history, emoji reactions, and message posting all work
- The only free plan limitation is 90 days of message history, which doesn't affect the bot

## What NOT to Do

- Don't create multiple capture channels yet. Start with one.
- Don't worry about formatting. The AI handles messy input.
- Don't send multiple thoughts in one message — send them as separate messages for better classification.
