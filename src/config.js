const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

function loadConfig({ requireSlack = false } = {}) {
  const missing = [];

  if (!process.env.OPENAI_API_KEY) missing.push('OPENAI_API_KEY');
  if (!process.env.GOOGLE_SHEET_ID) missing.push('GOOGLE_SHEET_ID');

  if (requireSlack) {
    if (!process.env.SLACK_BOT_TOKEN) missing.push('SLACK_BOT_TOKEN');
    if (!process.env.SLACK_APP_TOKEN) missing.push('SLACK_APP_TOKEN');
  }

  if (missing.length > 0) {
    console.error('Missing required environment variables:');
    missing.forEach(k => console.error(`  - ${k}`));
    console.error('\nCopy .env.example to .env and fill in your keys.');
    process.exit(1);
  }

  return {
    openaiKey: process.env.OPENAI_API_KEY,
    openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    sheetId: process.env.GOOGLE_SHEET_ID,
    sheetName: process.env.GOOGLE_SHEET_NAME || 'Sheet1',
    googleCredPath: path.resolve(
      __dirname,
      '..',
      process.env.GOOGLE_SERVICE_ACCOUNT_PATH || './credentials/google-service-account.json'
    ),
    slackBotToken: process.env.SLACK_BOT_TOKEN,
    slackAppToken: process.env.SLACK_APP_TOKEN,
  };
}

module.exports = { loadConfig };
