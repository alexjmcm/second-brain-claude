import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// --- CONFIGURATION (from environment secrets) ---
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const SLACK_BOT_TOKEN = Deno.env.get("SLACK_BOT_TOKEN")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_MODEL = "gpt-4o-mini";
const CONFIDENCE_THRESHOLD = 70;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// --- SYSTEM PROMPT (same as Code.gs) ---
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

// --- DEDUPLICATION (in-memory, resets on cold start) ---
const processedMessages = new Set<string>();

// --- MAIN HANDLER ---
Deno.serve(async (req) => {
  try {
    const contentType = req.headers.get("content-type") || "";

    // Handle Slack interactive payloads (Block Kit dropdown selections)
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      const payloadStr = formData.get("payload") as string;
      if (payloadStr) {
        const interaction = JSON.parse(payloadStr);
        if (interaction.type === "block_actions") {
          await handleInteraction(interaction);
        }
        return new Response("ok", { status: 200 });
      }
    }

    // Handle JSON payloads (Slack events)
    const data = await req.json();

    // Slack URL verification challenge
    if (data.type === "url_verification") {
      return new Response(data.challenge, {
        headers: { "Content-Type": "text/plain" },
      });
    }

    // Handle event callbacks
    if (data.type === "event_callback") {
      const event = data.event;

      // Skip bot messages, edits, and thread replies
      if (event.bot_id || event.subtype || event.thread_ts) {
        return new Response("ok", { status: 200 });
      }

      // Deduplicate
      const msgKey = `msg_${event.ts}`;
      if (processedMessages.has(msgKey)) {
        return new Response("ok", { status: 200 });
      }
      processedMessages.add(msgKey);

      // Process the message (non-blocking so Slack gets a quick response)
      if (event.type === "message" && event.text) {
        // Use EdgeRuntime.waitUntil to process in background
        const promise = processMessage(event.text, event.channel, event.ts);
        // @ts-ignore: EdgeRuntime is available in Supabase Edge Functions
        if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
          EdgeRuntime.waitUntil(promise);
        } else {
          await promise;
        }
      }
    }

    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error("Error in handler:", err);
    return new Response("ok", { status: 200 });
  }
});

// --- INTERACTIVE PAYLOAD HANDLER ---
async function handleInteraction(interaction: any) {
  const action = interaction.actions[0];
  const channel = interaction.channel.id;
  const messageTs = interaction.message.ts;

  if (action.action_id === "mark_done") {
    const thoughtId = action.selected_option.value;
    const summary = await markItemDone(thoughtId);
    const responseText = summary
      ? `Marked as done: *${summary.toString().substring(0, 30)}* ✓`
      : "Could not find the item.";
    await updateSlackMessage(channel, messageTs, responseText);
  }

  if (action.action_id === "reclassify_category") {
    const [newCategory, thoughtId] = action.selected_option.value.split("|");
    const success = await reclassifyItem(thoughtId, newCategory);
    const responseText = success
      ? `Reclassified as *${newCategory}* ✓`
      : "Could not find the item to reclassify.";
    await updateSlackMessage(channel, messageTs, responseText);
  }
}

// --- CORE LOGIC ---
async function processMessage(text: string, channel: string, timestamp: string) {
  const cmd = text.trim().toLowerCase();

  // Command routing
  if (cmd === "fix") return handleFixCommand(channel, timestamp);
  if (cmd === "done") return handleDoneCommand(channel, timestamp);
  if (cmd === "daily") return handleDailyCommand(channel, timestamp);
  if (cmd === "inbox") return handleListCommand(channel, timestamp, undefined);

  const tabCommands: Record<string, string> = {
    tasks: "Task", ideas: "Idea", projects: "Project", reference: "Reference",
    decisions: "Decision", questions: "Question", people: "People", admin: "Admin",
  };
  if (tabCommands[cmd]) return handleListCommand(channel, timestamp, tabCommands[cmd]);

  // Classify and store
  try {
    const classification = await classifyThought(text);
    const embedding = await getEmbedding(text);

    const isLowConfidence = classification.confidence < CONFIDENCE_THRESHOLD;
    const prefix = isLowConfidence ? "[?] " : "";

    // Insert into Supabase
    const { error } = await supabase.from("thoughts").insert({
      raw_text: text,
      category: classification.category,
      priority: classification.priority,
      confidence: classification.confidence,
      embedding: embedding,
      metadata: {
        summary: prefix + classification.summary,
        next_action: classification.next_action,
        tags: classification.tags || [],
        reasoning: classification.reasoning,
        source: "Slack",
      },
      status: "active",
    });

    if (error) {
      console.error("Supabase insert error:", error);
    }

    // Send Slack receipt
    await sendSlackReceipt(channel, timestamp, classification, isLowConfidence);

    if (isLowConfidence) {
      await addSlackReaction(channel, timestamp, "question");
      await sendSlackWarning(channel, classification, text);
    } else {
      await addSlackReaction(channel, timestamp, "white_check_mark");
    }
  } catch (err) {
    console.error("Error processing message:", err);
  }
}

// --- OPENAI CLASSIFICATION ---
async function classifyThought(text: string) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Classify this thought:\n\n${text}` },
      ],
      temperature: 0.1,
      max_tokens: 300,
      response_format: { type: "json_object" },
    }),
  });

  const json = await response.json();
  if (json.error) throw new Error(`OpenAI error: ${json.error.message}`);
  return JSON.parse(json.choices[0].message.content);
}

// --- OPENAI EMBEDDINGS ---
async function getEmbedding(text: string): Promise<number[]> {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text,
    }),
  });

  const json = await response.json();
  if (json.error) throw new Error(`Embedding error: ${json.error.message}`);
  return json.data[0].embedding;
}

// --- FIX COMMAND ---
async function handleFixCommand(channel: string, timestamp: string) {
  const { data, error } = await supabase
    .from("thoughts")
    .select("id, raw_text, category, metadata")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    await sendSlackReply(channel, timestamp, "Nothing to fix — no active items.");
    return;
  }

  const summary = data.metadata?.summary || data.raw_text.substring(0, 50);
  const categories = ["Task", "Idea", "Project", "Reference", "Decision", "Question", "People", "Admin"];

  const options = categories.map((cat) => ({
    text: { type: "plain_text" as const, text: cat },
    value: `${cat}|${data.id}`,
  }));

  const initialOption = options.find((o) => o.text.text === data.category) || options[0];

  const blocks = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Fix classification for:*\n>${summary}\n_Currently: ${data.category}_`,
      },
    },
    {
      type: "actions",
      block_id: "fix_action",
      elements: [
        {
          type: "static_select",
          action_id: "reclassify_category",
          placeholder: { type: "plain_text", text: "Pick correct category" },
          options,
          initial_option: initialOption,
        },
      ],
    },
  ];

  await slackPost("chat.postMessage", {
    channel,
    thread_ts: timestamp,
    text: `Fix classification for: ${summary}`,
    blocks,
  });
}

// --- DONE COMMAND ---
async function handleDoneCommand(channel: string, timestamp: string) {
  const { data, error } = await supabase
    .from("thoughts")
    .select("id, raw_text, metadata")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(10);

  if (error || !data || data.length === 0) {
    await sendSlackReply(channel, timestamp, "No active items to mark as done.");
    return;
  }

  const options = data.map((item: any) => {
    const label = (item.metadata?.summary || item.raw_text).substring(0, 15);
    return {
      text: { type: "plain_text" as const, text: label.length < (item.metadata?.summary || item.raw_text).length ? label + "…" : label },
      value: item.id,
    };
  });

  const blocks = [
    {
      type: "section",
      text: { type: "mrkdwn", text: "*Mark as done:*\nPick an item:" },
    },
    {
      type: "actions",
      block_id: "done_action",
      elements: [
        {
          type: "static_select",
          action_id: "mark_done",
          placeholder: { type: "plain_text", text: "Pick an item" },
          options,
        },
      ],
    },
  ];

  await slackPost("chat.postMessage", {
    channel,
    thread_ts: timestamp,
    text: "Mark an item as done",
    blocks,
  });
}

// --- DAILY COMMAND ---
async function handleDailyCommand(channel: string, timestamp: string) {
  const message = await buildDailyMessage();
  if (!message) {
    await sendSlackReply(channel, timestamp, "No active items — inbox is empty.");
    return;
  }
  await sendSlackReply(channel, timestamp, message);
}

// --- LIST COMMAND ---
async function handleListCommand(channel: string, timestamp: string, category?: string) {
  let query = supabase
    .from("thoughts")
    .select("raw_text, category, priority, metadata")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (category) {
    query = query.eq("category", category);
  }

  const { data, error } = await query;

  if (error || !data || data.length === 0) {
    const label = category || "Inbox";
    await sendSlackReply(channel, timestamp, `No active items in ${label}.`);
    return;
  }

  const label = category || "All";
  const high = data.filter((r: any) => r.priority === "High");
  const medium = data.filter((r: any) => r.priority === "Medium");
  const low = data.filter((r: any) => r.priority === "Low");

  let message = `${label} — ${data.length} active items:\n\n`;

  if (high.length > 0) {
    message += "--- HIGH PRIORITY ---\n";
    high.forEach((r: any) => {
      message += `• ${r.category} — ${r.metadata?.summary || r.raw_text}\n`;
      message += `  Next: ${r.metadata?.next_action || "N/A"}\n`;
    });
    message += "\n";
  }

  if (medium.length > 0) {
    message += "--- MEDIUM ---\n";
    medium.forEach((r: any) => {
      message += `• ${r.category} — ${r.metadata?.summary || r.raw_text}\n`;
    });
    message += "\n";
  }

  if (low.length > 0) {
    message += "--- LOW ---\n";
    low.forEach((r: any) => {
      message += `• ${r.category} — ${r.metadata?.summary || r.raw_text}\n`;
    });
  }

  await sendSlackReply(channel, timestamp, message);
}

// --- HELPER: build daily message ---
async function buildDailyMessage(): Promise<string | null> {
  const { data, error } = await supabase
    .from("thoughts")
    .select("raw_text, category, priority, metadata")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error || !data || data.length === 0) return null;

  const high = data.filter((r: any) => r.priority === "High");
  const medium = data.filter((r: any) => r.priority === "Medium");
  const low = data.filter((r: any) => r.priority === "Low");

  let message = `Good morning! Here's your brain inbox (${data.length} items):\n\n`;

  if (high.length > 0) {
    message += "--- HIGH PRIORITY ---\n";
    high.forEach((r: any) => {
      message += `• ${r.category} — ${r.metadata?.summary || r.raw_text}\n`;
      message += `  Next: ${r.metadata?.next_action || "N/A"}\n`;
    });
    message += "\n";
  }

  if (medium.length > 0) {
    message += "--- MEDIUM ---\n";
    medium.forEach((r: any) => {
      message += `• ${r.category} — ${r.metadata?.summary || r.raw_text}\n`;
    });
    message += "\n";
  }

  if (low.length > 0) {
    message += "--- LOW ---\n";
    low.forEach((r: any) => {
      message += `• ${r.category} — ${r.metadata?.summary || r.raw_text}\n`;
    });
  }

  return message;
}

// --- DATABASE OPERATIONS ---
async function markItemDone(thoughtId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("thoughts")
    .update({ status: "done" })
    .eq("id", thoughtId)
    .select("metadata")
    .single();

  if (error || !data) return null;
  return data.metadata?.summary || "Item";
}

async function reclassifyItem(thoughtId: string, newCategory: string): Promise<boolean> {
  const { error } = await supabase
    .from("thoughts")
    .update({ category: newCategory })
    .eq("id", thoughtId);

  return !error;
}

// --- SLACK HELPERS ---
async function slackPost(method: string, payload: any) {
  await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
    },
    body: JSON.stringify(payload),
  });
}

async function sendSlackReply(channel: string, timestamp: string, text: string) {
  await slackPost("chat.postMessage", { channel, thread_ts: timestamp, text });
}

async function sendSlackReceipt(channel: string, threadTs: string, classification: any, isLowConfidence: boolean) {
  const label = isLowConfidence ? "Captured (low confidence)" : "Captured!";
  const text = `${label}\nCategory: ${classification.category} | Priority: ${classification.priority}\nSummary: ${classification.summary}\nNext: ${classification.next_action}\nConfidence: ${classification.confidence}%`;
  await sendSlackReply(channel, threadTs, text);
}

async function sendSlackWarning(channel: string, classification: any, originalText: string) {
  const text = `Low confidence (${classification.confidence}%): "${originalText}"\nClassified as: ${classification.category} / ${classification.priority}\nReview in your Brain database.`;
  await slackPost("chat.postMessage", { channel, text });
}

async function addSlackReaction(channel: string, timestamp: string, emoji: string) {
  await slackPost("reactions.add", { channel, timestamp, name: emoji });
}

async function updateSlackMessage(channel: string, ts: string, text: string) {
  await slackPost("chat.update", {
    channel,
    ts,
    text,
    blocks: [{ type: "section", text: { type: "mrkdwn", text } }],
  });
}
