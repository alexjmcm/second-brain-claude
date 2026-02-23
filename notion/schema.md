# Notion Database Schema: Second Brain

Create a single Notion database called **"Brain"** with the following properties.

## Database Properties

| Property | Type | Options / Notes |
|---|---|---|
| **Name** | Title | The raw thought or a short summary |
| **Category** | Select | `Task`, `Idea`, `Reference`, `Decision`, `Question` |
| **Priority** | Select | `High`, `Medium`, `Low` |
| **Next Action** | Rich Text | One concrete next step (from AI) |
| **Source** | Rich Text | Where the thought came from (auto-filled: "Slack") |
| **Confidence** | Number | 0-100, AI's confidence in its classification |
| **Status** | Select | `Inbox`, `Active`, `Done`, `Archived` |
| **Created** | Created time | Auto |
| **Tags** | Multi-select | Freeform tags assigned by AI (e.g., `work`, `health`, `finance`, `project-x`) |
| **Original Text** | Rich Text | Full unedited Slack message |
| **AI Reasoning** | Rich Text | Brief explanation of why the AI classified it this way |

## Categories Explained

Keep this list **painfully small** (Principle 9). Start with these 5:

- **Task** — Something you need to do. Has a clear next action.
- **Idea** — Something to explore later. No immediate action required.
- **Reference** — A fact, link, quote, or piece of information to remember.
- **Decision** — Something you decided. Record it so future-you knows why.
- **Question** — Something you need to find out. Needs research or asking someone.

## Views to Create

### 1. Inbox View (Default)
- Filter: `Status = Inbox`
- Sort: `Created` descending
- Purpose: Review new items, fix any misclassifications

### 2. Actions View
- Filter: `Category = Task` AND `Status = Active`
- Sort: `Priority` (High first), then `Created` descending
- Purpose: Your working task list

### 3. Low Confidence Review
- Filter: `Confidence < 70` AND `Status = Inbox`
- Sort: `Confidence` ascending
- Purpose: The "Bouncer" — items the AI wasn't sure about

### 4. Daily Review
- Filter: `Created` is within the past 24 hours
- Sort: `Category` grouped, then `Priority`
- Purpose: Morning nudge — what came in yesterday

## Setup Steps

1. Create a new Notion database (full page, not inline)
2. Add each property from the table above
3. Create the 4 views listed above
4. Copy the database ID from the URL (you'll need it for Zapier)
   - URL format: `https://notion.so/yourworkspace/DATABASE_ID?v=...`
   - The DATABASE_ID is the 32-character hex string before the `?`
5. Create a Notion integration at https://www.notion.so/my-integrations
   - Give it a name like "Second Brain Zapier"
   - Copy the API key
   - Share the database with the integration (click "..." on the database → Connections → add your integration)
