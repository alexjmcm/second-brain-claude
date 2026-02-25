// ============================================
// AI Second Brain — Google Apps Script
// Webhook approach: instant processing
// ============================================

// --- CONFIGURATION ---
const CONFIG = {
  OPENAI_API_KEY: 'YOUR_OPENAI_API_KEY',
  OPENAI_MODEL: 'gpt-4o-mini',
  SLACK_BOT_TOKEN: 'YOUR_SLACK_BOT_TOKEN',
  SHEET_NAME: 'Inbox',
  CONFIDENCE_THRESHOLD: 70,
};

const SYSTEM_PROMPT = `You are a thought classifier for a personal second brain system. Your job is to take a raw thought, message, or note and classify it into a structured format.

You MUST respond with valid JSON only. No markdown, no explanation, no preamble.

Categories (pick exactly one):
- Task: Something the person needs to do. Has a clear action.
- Idea: Something to explore later. No immediate action.
- Project: A multi-step initiative, goal, or ongoing effort that spans multiple tasks.
- Reference: A fact, link, quote, or piece of info to store.
- Decision: Something the person decided. Record the reasoning.
- Question: Something to research or ask someone about.
- People: A note about a person — contact info, context, follow-ups, or something someone said.
- Admin: Bills, payments, appointments, errands, subscriptions, account management, or paperwork.

Priority rules:
- High: Time-sensitive, blocking other work, or explicitly urgent
- Medium: Important but not urgent, should be done this week
- Low: Nice to have, someday/maybe, background thought

JSON schema:
{
  "category": "Task|Idea|Project|Reference|Decision|Question|People|Admin",
  "priority": "High|Medium|Low",
  "summary": "One sentence summary (max 80 chars)",
  "next_action": "One concrete next step the person should take",
  "tags": ["tag1", "tag2"],
  "confidence": 0-100,
  "reasoning": "One sentence explaining your classification"
}

Rules:
- If the input is ambiguous, classify as "Idea" with lower confidence
- If you can't determine priority, default to "Medium"
- Tags should be lowercase, use hyphens not spaces, max 3 tags
- next_action should start with a verb
- confidence below 70 means you're unsure
- Keep summary shorter than the original text`;

// --- SLACK WEBHOOK HANDLER ---
function doPost(e) {
  var data = JSON.parse(e.postData.contents);

  // Handle Slack URL verification challenge
  if (data.type === 'url_verification') {
    return ContentService.createTextOutput(data.challenge);
  }

  // Handle event callbacks
  if (data.type === 'event_callback') {
    var event = data.event;

    // Skip bot messages, edits, and thread replies
    if (event.bot_id || event.subtype || event.thread_ts) {
      return ContentService.createTextOutput('ok');
    }

    // Deduplicate using cache
    var cache = CacheService.getScriptCache();
    var msgKey = 'msg_' + event.ts;
    if (cache.get(msgKey)) {
      return ContentService.createTextOutput('ok');
    }
    cache.put(msgKey, 'done', 600);

    // Process the message
    if (event.type === 'message' && event.text) {
      processMessage(event.text, event.channel, event.ts);
    }
  }

  return ContentService.createTextOutput('ok');
}

// --- CORE LOGIC ---
function processMessage(text, channel, timestamp) {
  try {
    var classification = classifyThought(text);
    writeToSheet(classification, text, 'Slack');

    var isLowConfidence = classification.confidence < CONFIG.CONFIDENCE_THRESHOLD;
    sendSlackReceipt(channel, timestamp, classification, isLowConfidence);

    if (isLowConfidence) {
      addSlackReaction(channel, timestamp, 'question');
      sendSlackWarning(channel, classification, text);
    } else {
      addSlackReaction(channel, timestamp, 'brain');
    }
  } catch (err) {
    Logger.log('Error processing message: ' + err.message);
  }
}

// --- OPENAI CLASSIFICATION ---
function classifyThought(text) {
  var url = 'https://api.openai.com/v1/chat/completions';

  var payload = {
    model: CONFIG.OPENAI_MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: 'Classify this thought:\n\n' + text },
    ],
    temperature: 0.1,
    max_tokens: 300,
    response_format: { type: 'json_object' },
  };

  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'Authorization': 'Bearer ' + CONFIG.OPENAI_API_KEY },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  var response = UrlFetchApp.fetch(url, options);
  var json = JSON.parse(response.getContentText());

  if (json.error) {
    throw new Error('OpenAI error: ' + json.error.message);
  }

  var content = json.choices[0].message.content;
  return JSON.parse(content);
}

// --- GOOGLE SHEETS ---

// Map categories to sheet tab names
var CATEGORY_TABS = {
  'Task': 'Tasks',
  'Idea': 'Ideas',
  'Project': 'Projects',
  'Reference': 'Reference',
  'Decision': 'Decisions',
  'Question': 'Questions',
  'People': 'People',
  'Admin': 'Admin',
};

function writeToSheet(classification, originalText, source) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var prefix = classification.confidence < CONFIG.CONFIDENCE_THRESHOLD ? '[?] ' : '';

  var row = [
    prefix + classification.summary,
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

  // Always write to Sheet1 (master log)
  var mainSheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (mainSheet) {
    mainSheet.appendRow(row);
  }

  // Only write to category tab if confidence is high enough (bouncer)
  if (classification.confidence < CONFIG.CONFIDENCE_THRESHOLD) {
    Logger.log('Low confidence (' + classification.confidence + '%) — kept in Inbox only');
    return;
  }

  // Also write to the category-specific tab
  var tabName = CATEGORY_TABS[classification.category];
  Logger.log('Category: "' + classification.category + '" → Tab: "' + tabName + '"');
  if (tabName) {
    var categorySheet = ss.getSheetByName(tabName);
    if (categorySheet) {
      categorySheet.appendRow(row);
      Logger.log('Wrote to category tab: ' + tabName);
    } else {
      // List all sheet names to help debug
      var allSheets = ss.getSheets().map(function(s) { return s.getName(); });
      Logger.log('Tab "' + tabName + '" NOT FOUND. Available tabs: ' + allSheets.join(', '));
    }
  } else {
    Logger.log('No tab mapping for category: "' + classification.category + '"');
  }
}

// --- SLACK RECEIPT (threaded reply) ---
function sendSlackReceipt(channel, threadTs, classification, isLowConfidence) {
  var label = isLowConfidence ? 'Captured (low confidence)' : 'Captured!';

  var text = label + '\n'
    + 'Category: ' + classification.category + ' | Priority: ' + classification.priority + '\n'
    + 'Summary: ' + classification.summary + '\n'
    + 'Next: ' + classification.next_action + '\n'
    + 'Confidence: ' + classification.confidence + '%';

  var url = 'https://slack.com/api/chat.postMessage';

  var payload = {
    channel: channel,
    thread_ts: threadTs,
    text: text,
  };

  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'Authorization': 'Bearer ' + CONFIG.SLACK_BOT_TOKEN },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  UrlFetchApp.fetch(url, options);
}

// --- SLACK WARNING FOR LOW CONFIDENCE ---
function sendSlackWarning(channel, classification, originalText) {
  var text = 'Low confidence (' + classification.confidence + '%): "' + originalText + '"\n'
    + 'Classified as: ' + classification.category + ' / ' + classification.priority + '\n'
    + 'Review in your Brain spreadsheet.';

  var url = 'https://slack.com/api/chat.postMessage';

  var payload = {
    channel: channel,
    text: text,
  };

  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'Authorization': 'Bearer ' + CONFIG.SLACK_BOT_TOKEN },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  UrlFetchApp.fetch(url, options);
}

// --- SLACK REACTION EMOJI ---
function addSlackReaction(channel, timestamp, emoji) {
  var url = 'https://slack.com/api/reactions.add';

  var payload = {
    channel: channel,
    timestamp: timestamp,
    name: emoji,
  };

  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'Authorization': 'Bearer ' + CONFIG.SLACK_BOT_TOKEN },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  UrlFetchApp.fetch(url, options);
}

// --- DAILY NUDGE ---
function dailyNudge() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  var data = sheet.getDataRange().getValues();
  var headers = data[0];

  var nameIdx = headers.indexOf('Name');
  var categoryIdx = headers.indexOf('Category');
  var priorityIdx = headers.indexOf('Priority');
  var nextActionIdx = headers.indexOf('Next Action');
  var statusIdx = headers.indexOf('Status');

  var inboxItems = data.slice(1).filter(function(row) {
    return row[statusIdx] === 'Inbox';
  });

  if (inboxItems.length === 0) {
    return;
  }

  var high = inboxItems.filter(function(row) { return row[priorityIdx] === 'High'; });
  var medium = inboxItems.filter(function(row) { return row[priorityIdx] === 'Medium'; });
  var low = inboxItems.filter(function(row) { return row[priorityIdx] === 'Low'; });

  var message = 'Good morning! Here\'s your brain inbox (' + inboxItems.length + ' items):\n\n';

  if (high.length > 0) {
    message += '--- HIGH PRIORITY ---\n';
    high.forEach(function(row) {
      message += '• ' + row[categoryIdx] + ' — ' + row[nameIdx] + '\n';
      message += '  Next: ' + row[nextActionIdx] + '\n';
    });
    message += '\n';
  }

  if (medium.length > 0) {
    message += '--- MEDIUM ---\n';
    medium.forEach(function(row) {
      message += '• ' + row[categoryIdx] + ' — ' + row[nameIdx] + '\n';
    });
    message += '\n';
  }

  if (low.length > 0) {
    message += '--- LOW ---\n';
    low.forEach(function(row) {
      message += '• ' + row[categoryIdx] + ' — ' + row[nameIdx] + '\n';
    });
  }

  // Need channel ID for daily nudge — find it from the sheet or hardcode
  var channelId = PropertiesService.getScriptProperties().getProperty('channelId');
  if (!channelId) {
    Logger.log('No channel ID set. Run setChannelId() first.');
    return;
  }

  var url = 'https://slack.com/api/chat.postMessage';

  var payload = {
    channel: channelId,
    text: message,
  };

  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'Authorization': 'Bearer ' + CONFIG.SLACK_BOT_TOKEN },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  UrlFetchApp.fetch(url, options);
}

// --- WEEKLY NUDGE (Sunday summary) ---
function weeklyNudge() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  var data = sheet.getDataRange().getValues();
  var headers = data[0];

  var nameIdx = headers.indexOf('Name');
  var categoryIdx = headers.indexOf('Category');
  var priorityIdx = headers.indexOf('Priority');
  var nextActionIdx = headers.indexOf('Next Action');
  var statusIdx = headers.indexOf('Status');

  // Get all items (not just Inbox)
  var allItems = data.slice(1).filter(function(row) {
    return row[nameIdx] && row[nameIdx].toString().trim() !== '';
  });

  var inboxItems = allItems.filter(function(row) { return row[statusIdx] === 'Inbox'; });

  if (allItems.length === 0) {
    return;
  }

  // Count by category
  var categoryCounts = {};
  allItems.forEach(function(row) {
    var cat = row[categoryIdx] || 'Unknown';
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  });

  var message = 'Happy Sunday! Here\'s your weekly brain summary:\n\n';
  message += 'Total items: ' + allItems.length + ' | Still in Inbox: ' + inboxItems.length + '\n\n';

  // Category breakdown
  message += '--- BY CATEGORY ---\n';
  Object.keys(categoryCounts).forEach(function(cat) {
    message += '• ' + cat + ': ' + categoryCounts[cat] + '\n';
  });
  message += '\n';

  // Pending high priority items
  var highInbox = inboxItems.filter(function(row) { return row[priorityIdx] === 'High'; });
  if (highInbox.length > 0) {
    message += '--- HIGH PRIORITY (still in Inbox) ---\n';
    highInbox.forEach(function(row) {
      message += '• ' + row[categoryIdx] + ' — ' + row[nameIdx] + '\n';
      message += '  Next: ' + row[nextActionIdx] + '\n';
    });
    message += '\n';
  }

  // Pending medium priority
  var mediumInbox = inboxItems.filter(function(row) { return row[priorityIdx] === 'Medium'; });
  if (mediumInbox.length > 0) {
    message += '--- MEDIUM PRIORITY (still in Inbox) ---\n';
    mediumInbox.forEach(function(row) {
      message += '• ' + row[categoryIdx] + ' — ' + row[nameIdx] + '\n';
    });
    message += '\n';
  }

  if (inboxItems.length === 0) {
    message += 'Inbox is clear — nice work!\n';
  }

  var channelId = PropertiesService.getScriptProperties().getProperty('channelId');
  if (!channelId) {
    Logger.log('No channel ID set. Run findAndSaveChannelId() first.');
    return;
  }

  var url = 'https://slack.com/api/chat.postMessage';

  var payload = {
    channel: channelId,
    text: message,
  };

  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'Authorization': 'Bearer ' + CONFIG.SLACK_BOT_TOKEN },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  UrlFetchApp.fetch(url, options);
}

// ============================================
// SETUP — Run these once manually
// ============================================

function setupDailyNudge() {
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'dailyNudge') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('dailyNudge')
    .timeBased()
    .everyDays(1)
    .atHour(8)
    .create();

  Logger.log('Daily nudge trigger created for 8 AM');
}

function setupWeeklyNudge() {
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'weeklyNudge') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('weeklyNudge')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.SUNDAY)
    .atHour(17)
    .create();

  Logger.log('Weekly nudge trigger created for Sunday 5 PM');
}

// Run this once to find and save your channel ID (needed for daily nudge)
function findAndSaveChannelId() {
  var url = 'https://slack.com/api/conversations.list?types=public_channel,private_channel&limit=100';

  var options = {
    method: 'get',
    headers: { 'Authorization': 'Bearer ' + CONFIG.SLACK_BOT_TOKEN },
    muteHttpExceptions: true,
  };

  var response = UrlFetchApp.fetch(url, options);
  var json = JSON.parse(response.getContentText());

  if (json.ok) {
    json.channels.forEach(function(ch) {
      Logger.log(ch.name + ' → ' + ch.id);
      if (ch.name === 'brain-inbox') {
        PropertiesService.getScriptProperties().setProperty('channelId', ch.id);
        Logger.log('Saved brain-inbox channel ID: ' + ch.id);
      }
    });
  } else {
    Logger.log('Error: ' + json.error);
  }
}

function testClassify() {
  var result = classifyThought('Need to submit the quarterly report by Friday');
  Logger.log(JSON.stringify(result, null, 2));
}

// Test the full flow: classify + write to sheets (run this manually)
function testFullFlow() {
  var text = 'I need to call the dentist tomorrow morning';
  var classification = classifyThought(text);
  Logger.log('Classification: ' + JSON.stringify(classification, null, 2));
  writeToSheet(classification, text, 'Test');
  Logger.log('Done — check Sheet1 and the category tab');
}
