# Confidence Filter (The Bouncer)

This is an optional but recommended addition to the core loop. It routes low-confidence items differently so the AI doesn't silently misfile things.

## How It Works

After the Claude classification step, add a Zapier **Paths** step that branches based on confidence:

```
Claude response
   ↓
[Path A] Confidence >= 70 → Create Notion item (Status: Inbox)
[Path B] Confidence < 70  → Create Notion item (Status: Inbox) + flag for review
```

## Zapier Paths Configuration

### Path A: High Confidence (auto-file)

- **Condition**: `{{Formatter confidence}}` (Number) Greater than `69`
- **Action**: Create Notion Database Item (same as core-loop.md Step 3)
- **Status field**: `Inbox`

### Path B: Low Confidence (flag for review)

- **Condition**: `{{Formatter confidence}}` (Number) Less than `70`
- **Action 1**: Create Notion Database Item
  - Same mapping as Path A, but:
  - **Status field**: `Inbox`
  - **Name prefix**: Add `[?] ` before the summary so it's visually obvious
- **Action 2** (optional): Send a Slack DM to yourself
  - **App**: Slack → Send Direct Message
  - **Message**: `Low confidence classification ({{Formatter confidence}}%): "{{Step 1 Message Text}}" → classified as {{Formatter category}}. Review in Notion.`

## Why 70%?

- Above 70%: The AI is reasonably sure. Let it file automatically.
- Below 70%: Something is ambiguous. A human glance takes 5 seconds and prevents compounding errors.
- You can adjust this threshold after a week of use. If you're correcting too many items, raise it. If almost everything is correct, lower it.
