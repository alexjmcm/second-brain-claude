const { App } = require('@slack/bolt');
const { loadConfig } = require('./config');
const { classify } = require('./classify');
const { appendRow } = require('./sheets');

const config = loadConfig({ requireSlack: true });

const app = new App({
  token: config.slackBotToken,
  appToken: config.slackAppToken,
  socketMode: true,
});

app.message(async ({ message }) => {
  if (message.subtype || message.bot_id || message.thread_ts) return;

  const text = message.text;
  if (!text) return;

  try {
    const result = await classify(text, config);
    await appendRow(result, text, 'Slack', config);

    await app.client.reactions.add({
      token: config.slackBotToken,
      channel: message.channel,
      timestamp: message.ts,
      name: result.confidence >= 70 ? 'white_check_mark' : 'question',
    });

    console.log(`Classified: "${text}" → ${result.category} (${result.confidence}%)`);
  } catch (err) {
    console.error(`Error processing "${text}":`, err.message);
  }
});

(async () => {
  await app.start();
  console.log('Brain bot is running (Socket Mode)');
  console.log('Listening for messages in channels the bot is invited to...');
})();
