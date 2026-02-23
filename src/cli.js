#!/usr/bin/env node

const { loadConfig } = require('./config');
const { classify } = require('./classify');
const { appendRow } = require('./sheets');

async function main() {
  const text = process.argv.slice(2).join(' ');

  if (!text) {
    console.log('Usage: brain "your thought here"');
    console.log('Example: brain "buy groceries after work"');
    process.exit(1);
  }

  const config = loadConfig();

  console.log('Classifying...');
  const result = await classify(text, config);

  console.log();
  console.log(`  Category:    ${result.category}`);
  console.log(`  Priority:    ${result.priority}`);
  console.log(`  Summary:     ${result.summary}`);
  console.log(`  Next Action: ${result.next_action}`);
  console.log(`  Tags:        ${(result.tags || []).join(', ')}`);
  console.log(`  Confidence:  ${result.confidence}%`);
  console.log();

  await appendRow(result, text, 'CLI', config);
  console.log('Saved to Google Sheets.');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
