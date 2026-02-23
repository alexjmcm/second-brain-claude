const { google } = require('googleapis');

let sheets;

async function getClient(config) {
  if (sheets) return sheets;

  let auth;
  try {
    auth = new google.auth.GoogleAuth({
      keyFile: config.googleCredPath,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
  } catch (err) {
    console.error('Failed to load Google credentials.');
    console.error(`Expected file at: ${config.googleCredPath}`);
    console.error('See README.md for how to create a Google Service Account.');
    process.exit(1);
  }

  sheets = google.sheets({ version: 'v4', auth });
  return sheets;
}

async function appendRow(classification, originalText, source, config) {
  const client = await getClient(config);

  const row = [
    classification.summary,
    classification.category,
    classification.priority,
    classification.next_action,
    source,
    classification.confidence,
    'Inbox',
    (classification.tags || []).join(', '),
    originalText,
    classification.reasoning,
  ];

  try {
    await client.spreadsheets.values.append({
      spreadsheetId: config.sheetId,
      range: `${config.sheetName}!A:J`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [row] },
    });
  } catch (err) {
    if (err.code === 403) {
      console.error('Permission denied. Make sure you shared your "Brain" spreadsheet');
      console.error('with the service account email from your Google credentials JSON.');
    } else if (err.code === 404) {
      console.error(`Spreadsheet not found. Check GOOGLE_SHEET_ID in your .env file.`);
    } else {
      console.error('Google Sheets error:', err.message);
    }
    throw err;
  }
}

module.exports = { appendRow };
