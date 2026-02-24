---
name: add-category
description: Add a new category tab to the Second Brain system. Use when the user wants to add a new classification category (e.g., "Add a Finance tab", "Add Health category"). Updates the classifier prompt, JSON schema, and tab routing in Code.gs.
---

# Add Category Skill

When the user provides a category name and description, make these 3 changes in `google-apps-script/Code.gs`:

## 1. Add to SYSTEM_PROMPT categories list
Add a new line after the last category entry:
```
- CategoryName: Brief description of what belongs in this category.
```

## 2. Add to JSON schema
Update the `"category"` line to include the new category name in the pipe-separated list.

## 3. Add to CATEGORY_TABS mapping
Add a new entry mapping the category name to its tab name:
```javascript
'CategoryName': 'TabName',
```

## After making changes

Remind the user to:
1. Create the new tab in Google Sheets with header row: `Name | Category | Priority | Next Action | Source | Confidence | Status | Tags | Original | Reasoning`
2. Copy updated Code.gs to the Apps Script editor
3. Deploy > **New deployment** (never use Manage deployments)
4. Update Slack Event Subscriptions Request URL with the new deployment URL
5. Provide a test sentence to verify the new category works

## If the user asks to commit
Stage and commit `google-apps-script/Code.gs` with message describing the new category, then push to origin main.
