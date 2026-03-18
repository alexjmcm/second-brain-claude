import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const TOOLS = [
  {
    name: "search_thoughts",
    description:
      "Semantic search across all thoughts using vector embeddings. Use this to find thoughts by meaning, not just keywords.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Natural language search query",
        },
        limit: {
          type: "number",
          description: "Max results to return (default 5)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "list_thoughts",
    description:
      "List thoughts filtered by category, priority, or status. Returns most recent first.",
    inputSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          enum: [
            "Task",
            "Idea",
            "Project",
            "Reference",
            "Decision",
            "Question",
            "People",
            "Admin",
          ],
          description: "Filter by category",
        },
        priority: {
          type: "string",
          enum: ["High", "Medium", "Low"],
          description: "Filter by priority",
        },
        status: {
          type: "string",
          enum: ["active", "done"],
          description: "Filter by status (default: active)",
        },
        limit: {
          type: "number",
          description: "Max results to return (default 10)",
        },
      },
    },
  },
  {
    name: "add_thought",
    description:
      "Add a new thought to the brain. It will be classified automatically by AI into a category with priority, summary, and next action.",
    inputSchema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "The thought to capture",
        },
      },
      required: ["text"],
    },
  },
  {
    name: "mark_done",
    description: "Mark a thought as done by its ID.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "The thought ID to mark as done",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "daily_summary",
    description:
      "Get a daily summary of all active thoughts grouped by priority.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

// --- MCP Protocol Handler ---
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }

  // Only accept POST
  if (req.method !== "POST") {
    return jsonResponse(
      { jsonrpc: "2.0", error: { code: -32600, message: "Use POST" }, id: null },
      405
    );
  }

  try {
    const body = await req.json();
    const { method, params, id } = body;

    let result;

    switch (method) {
      case "initialize":
        result = {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: {
            name: "open-brain-mcp",
            version: "1.0.0",
          },
        };
        break;

      case "notifications/initialized":
        return jsonResponse({ jsonrpc: "2.0", result: {}, id });

      case "tools/list":
        result = { tools: TOOLS };
        break;

      case "tools/call":
        result = await handleToolCall(params.name, params.arguments || {});
        break;

      case "ping":
        result = {};
        break;

      default:
        return jsonResponse({
          jsonrpc: "2.0",
          error: { code: -32601, message: `Unknown method: ${method}` },
          id,
        });
    }

    return jsonResponse({ jsonrpc: "2.0", result, id });
  } catch (err) {
    console.error("MCP error:", err);
    return jsonResponse({
      jsonrpc: "2.0",
      error: { code: -32603, message: String(err) },
      id: null,
    });
  }
});

// --- Tool Execution ---
async function handleToolCall(
  name: string,
  args: Record<string, any>
): Promise<any> {
  switch (name) {
    case "search_thoughts":
      return await searchThoughts(args.query, args.limit || 5);
    case "list_thoughts":
      return await listThoughts(args);
    case "add_thought":
      return await addThought(args.text);
    case "mark_done":
      return await markDone(args.id);
    case "daily_summary":
      return await dailySummary();
    default:
      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      };
  }
}

// --- search_thoughts ---
async function searchThoughts(query: string, limit: number) {
  const embedding = await getEmbedding(query);

  const { data, error } = await supabase.rpc("match_thoughts", {
    query_embedding: embedding,
    match_threshold: 0.3,
    match_count: limit,
  });

  if (error) {
    return {
      content: [{ type: "text", text: `Search error: ${error.message}` }],
      isError: true,
    };
  }

  if (!data || data.length === 0) {
    return {
      content: [{ type: "text", text: "No matching thoughts found." }],
    };
  }

  const results = data.map(
    (t: any) =>
      `[${t.category}] ${t.metadata?.summary || t.raw_text}\n  Priority: ${t.priority} | Status: ${t.status} | Similarity: ${(t.similarity * 100).toFixed(0)}%\n  ID: ${t.id}`
  );

  return {
    content: [
      { type: "text", text: `Found ${data.length} results:\n\n${results.join("\n\n")}` },
    ],
  };
}

// --- list_thoughts ---
async function listThoughts(args: Record<string, any>) {
  let query = supabase
    .from("thoughts")
    .select("id, raw_text, category, priority, status, metadata, created_at")
    .order("created_at", { ascending: false })
    .limit(args.limit || 10);

  if (args.category) query = query.eq("category", args.category);
  if (args.priority) query = query.eq("priority", args.priority);
  query = query.eq("status", args.status || "active");

  const { data, error } = await query;

  if (error) {
    return {
      content: [{ type: "text", text: `Error: ${error.message}` }],
      isError: true,
    };
  }

  if (!data || data.length === 0) {
    return { content: [{ type: "text", text: "No thoughts found." }] };
  }

  const results = data.map(
    (t: any) =>
      `[${t.category}] ${t.metadata?.summary || t.raw_text}\n  Priority: ${t.priority} | Created: ${t.created_at?.substring(0, 10)}\n  Next: ${t.metadata?.next_action || "N/A"}\n  ID: ${t.id}`
  );

  return {
    content: [
      {
        type: "text",
        text: `${data.length} thoughts:\n\n${results.join("\n\n")}`,
      },
    ],
  };
}

// --- add_thought ---
async function addThought(text: string) {
  const classification = await classifyThought(text);
  const embedding = await getEmbedding(text);

  const isLowConfidence = classification.confidence < 70;
  const prefix = isLowConfidence ? "[?] " : "";

  const { data, error } = await supabase
    .from("thoughts")
    .insert({
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
        source: "MCP",
      },
      status: "active",
    })
    .select("id")
    .single();

  if (error) {
    return {
      content: [{ type: "text", text: `Insert error: ${error.message}` }],
      isError: true,
    };
  }

  return {
    content: [
      {
        type: "text",
        text: `Captured!\nCategory: ${classification.category} | Priority: ${classification.priority}\nSummary: ${classification.summary}\nNext: ${classification.next_action}\nConfidence: ${classification.confidence}%\nID: ${data.id}`,
      },
    ],
  };
}

// --- mark_done ---
async function markDone(id: string) {
  const { data, error } = await supabase
    .from("thoughts")
    .update({ status: "done" })
    .eq("id", id)
    .select("metadata")
    .single();

  if (error || !data) {
    return {
      content: [{ type: "text", text: "Could not find that thought." }],
      isError: true,
    };
  }

  return {
    content: [
      {
        type: "text",
        text: `Marked as done: ${data.metadata?.summary || "Item"} ✓`,
      },
    ],
  };
}

// --- daily_summary ---
async function dailySummary() {
  const { data, error } = await supabase
    .from("thoughts")
    .select("raw_text, category, priority, metadata")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error || !data || data.length === 0) {
    return { content: [{ type: "text", text: "No active items." }] };
  }

  const high = data.filter((r: any) => r.priority === "High");
  const medium = data.filter((r: any) => r.priority === "Medium");
  const low = data.filter((r: any) => r.priority === "Low");

  let msg = `Daily Summary — ${data.length} active items:\n\n`;

  if (high.length > 0) {
    msg += "--- HIGH PRIORITY ---\n";
    high.forEach((r: any) => {
      msg += `• ${r.category} — ${r.metadata?.summary || r.raw_text}\n`;
      msg += `  Next: ${r.metadata?.next_action || "N/A"}\n`;
    });
    msg += "\n";
  }

  if (medium.length > 0) {
    msg += "--- MEDIUM ---\n";
    medium.forEach((r: any) => {
      msg += `• ${r.category} — ${r.metadata?.summary || r.raw_text}\n`;
    });
    msg += "\n";
  }

  if (low.length > 0) {
    msg += "--- LOW ---\n";
    low.forEach((r: any) => {
      msg += `• ${r.category} — ${r.metadata?.summary || r.raw_text}\n`;
    });
  }

  return { content: [{ type: "text", text: msg }] };
}

// --- OpenAI helpers ---
async function classifyThought(text: string) {
  const SYSTEM_PROMPT = `You are a thought classifier for a personal second brain system. Respond with valid JSON only.

Categories: Task, Idea, Project, Reference, Decision, Question, People, Admin
Priority: High (urgent/blocking), Medium (important, this week), Low (someday/maybe)

JSON schema:
{"category":"...","priority":"...","summary":"max 80 chars","next_action":"starts with verb","tags":["max 3"],"confidence":0-100,"reasoning":"one sentence"}`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
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

// --- Helpers ---
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function jsonResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(),
    },
  });
}
