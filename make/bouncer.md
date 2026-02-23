# Building Block 6: The Bouncer (Confidence Filter)

Flags low-confidence classifications so you can review them. High-confidence items go straight through; low-confidence items get a `[?]` prefix and you get a Slack DM.

## What to add in Make.com

After the **JSON Parse** step but before **Google Sheets**, add a **Router**:

### Step-by-step

1. In your scenario, hover over the line between **JSON Parse** and **Google Sheets**
2. Right-click the line → **Add a Router** (or click the wrench icon)
3. The Router creates two paths

### Path 1: High Confidence (>= 70)

1. Click the dotted line going to Google Sheets
2. Click **Set up a filter** → name it `High Confidence`
3. Condition: `confidence` (from JSON Parse) **Greater than or equal to** `70`
4. The Google Sheets step stays as-is — no changes needed

### Path 2: Low Confidence (< 70)

1. Click the second path from the Router → **Add a module**
2. Add **Google Sheets → Add a Row** (same spreadsheet, same sheet)
3. Map all fields the same as Path 1, EXCEPT:
   - **Name** → type `[?] ` then pick `summary` from JSON Parse
   - Everything else stays the same
4. Click the dotted line for this path → **Set up a filter** → name it `Low Confidence`
5. Condition: `confidence` (from JSON Parse) **Less than** `70`

### Add Slack DM for low confidence (optional but recommended)

1. After the low-confidence Google Sheets step, click **+**
2. Add **Slack → Send a Direct Message**
3. **User**: select yourself
4. **Text**:
   ```
   🔍 Low confidence classification ({{confidence}}%):
   "{{original text from Slack step}}"
   → Classified as: {{category}} / {{priority}}
   → Summary: {{summary}}

   Review in your Brain spreadsheet.
   ```
5. Map each variable from the appropriate step

## Result

- Confidence >= 70: silently filed in Google Sheets (business as usual)
- Confidence < 70: filed with `[?]` prefix + you get a Slack DM to review
