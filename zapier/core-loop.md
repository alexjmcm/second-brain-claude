# Zapier Core Loop: Slack → Claude → Notion

This is the main automation. One Zap, three steps.

## Overview

```
Trigger: New message in Slack #brain-inbox
   ↓
Action 1: Send message to Claude for classification
   ↓
Action 2: Create page in Notion database with structured data
```

---

## Step 1: Trigger — Slack: New Message Posted to Channel

- **App**: Slack
- **Event**: New Message Posted to Channel
- **Account**: Connect your Slack workspace
- **Channel**: Select `#brain-inbox`
- **Trigger for Bot Messages?**: No (avoid loops)

**Output fields you'll use:**
- `Message Text` — the raw thought
- `User Real Name` — who sent it (useful if shared workspace)
- `Timestamp` — when it was sent

---

## Step 2: Action — Claude (Anthropic): Send Message

- **App**: Claude (Anthropic) — available as a native Zapier integration
- **Event**: Send Message
- **Account**: Connect with your Anthropic API key

### Configuration

| Field | Value |
|---|---|
| **Model** | `claude-sonnet-4-20250514` (best cost/quality for classification) |
| **System Prompt** | Copy the full system prompt from `prompts/classifier.md` |
| **User Message** | `Classify this thought: {{Step 1 Message Text}}` |
| **Max Tokens** | `300` |
| **Temperature** | `0.1` (low = more consistent classification) |

**Output:** Claude returns a JSON string. You'll parse it in the next step.

### Important: Parse the JSON

Add a **Formatter by Zapier** step (or use Zapier's built-in JSON parse) between Claude and Notion:

- **App**: Formatter by Zapier
- **Event**: Utilities → JSON Parse
- **Input**: `{{Step 2 Response}}`

This gives you named fields: `category`, `priority`, `summary`, `next_action`, `tags`, `confidence`, `reasoning`.

---

## Step 3: Action — Notion: Create Database Item

- **App**: Notion
- **Event**: Create Database Item
- **Account**: Connect your Notion integration
- **Database**: Select your "Brain" database

### Field Mapping

| Notion Property | Zapier Value |
|---|---|
| **Name** (Title) | `{{Formatter summary}}` |
| **Category** | `{{Formatter category}}` |
| **Priority** | `{{Formatter priority}}` |
| **Next Action** | `{{Formatter next_action}}` |
| **Source** | `Slack` (static text) |
| **Confidence** | `{{Formatter confidence}}` |
| **Status** | `Inbox` (static text) |
| **Tags** | `{{Formatter tags}}` (Zapier handles array → multi-select) |
| **Original Text** | `{{Step 1 Message Text}}` |
| **AI Reasoning** | `{{Formatter reasoning}}` |

---

## Testing

1. Send a test message in `#brain-inbox`: "Need to review the Q1 budget proposal by Thursday"
2. Run the Zap manually in Zapier's editor
3. Check your Notion database — you should see a new entry:
   - Category: Task
   - Priority: High
   - Summary: "Review Q1 budget proposal by Thursday"
   - Next Action: "Open the Q1 budget proposal and review key line items"
4. Test an ambiguous message: "hmm interesting"
   - Confidence should be low (< 50)
   - Should appear in your "Low Confidence Review" view

## Cost Estimate

- Claude Sonnet: ~$0.003 per classification (input + output tokens)
- At 20 thoughts/day: ~$0.06/day, ~$1.80/month
- Zapier: Free plan handles 100 tasks/month; Starter plan for more
