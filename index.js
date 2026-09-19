/**
 * ============================================================================
 * LLM PROXY MAPPER - Bidirectional confidential data mapping proxy
 * ============================================================================
 *
 * PURPOSE:
 * This Node.js HTTP proxy sits between OpenCode (or any OpenAI-compatible client)
 * and MiniMax LLM. It performs bidirectional string mapping to hide confidential
 * identifiers from the LLM provider.
 *
 * FLOW EXAMPLE:
 *   User types: "create class SECOJB"  →  Proxy sends: "create class SJBDR"
 *   LLM responds: "class SJBDR {...}"  →  Proxy returns: "class SECOJB {...}"
 *
 * KEY FEATURES:
 *   - No API key storage (extracted from request headers)
 *   - Native HTTP/HTTPS modules (no Express, no external dependencies)
 *   - Full SSE streaming support (no buffering)
 *   - Maps messages, tool calls, tools definitions, content
 *   - Accumulates fragmented tool_calls across SSE chunks
 *   - Leak detection in transformed requests
 *
 * ============================================================================
 */

// Node.js native modules for HTTP server (OpenCode client) and HTTPS client (MiniMax LLM)
// Using native modules avoids external dependencies and gives full control over streaming
import http from 'http';
import https from 'https';

// File system and path utilities for reading mapping.tsv and config.json at startup
import fs from 'fs';
import path from 'path';

// ES module helper to get __dirname (not available natively in ESM scope)
import { fileURLToPath } from 'url';

// ============================================================================
// FILE PATHS AND CONFIGURATION LOADING
// ============================================================================

// Resolve absolute paths to the config files relative to this script's location
// Example: if script is at /app/proxy/index.js, then:
//   __dirname = /app/proxy
//   MAPPING_FILE = /app/proxy/mapping.tsv
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MAPPING_FILE = path.join(__dirname, 'mapping.tsv');

// Load mapping file synchronously at startup.
// Format: TSV (tab-separated) with two columns per line:
//   <real_value>\t<masked_value>
// Lines starting with '#' are treated as comments. Empty lines are ignored.
// The inverse table (llm2user) is derived automatically from the primary table.
const loadMappingTSV = (filePath) => {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const user2llm = {};
  const llm2user = {};
  const lines = raw.split(/\r?\n/);
  let lineNo = 0;
  for (const original of lines) {
    lineNo++;
    // Strip BOM, trailing CR, then trim outer whitespace
    const line = original.replace(/^\uFEFF/, '').trim();
    if (!line) continue;                  // Skip empty lines
    if (line.startsWith('#')) continue;   // Skip comments

    // Split on first tab only to allow tabs inside a value (not common but tolerated)
    const tabIdx = line.indexOf('\t');
    if (tabIdx === -1) {
      throw new Error(`[mapping.tsv:${lineNo}] missing TAB separator: "${line}"`);
    }
    const real = line.substring(0, tabIdx).trim();
    const masked = line.substring(tabIdx + 1).trim();

    if (!real || !masked) {
      throw new Error(`[mapping.tsv:${lineNo}] both columns required: "${line}"`);
    }
    if (real === masked) {
      throw new Error(`[mapping.tsv:${lineNo}] real and masked values are identical: "${real}"`);
    }
    if (user2llm[real] !== undefined) {
      throw new Error(`[mapping.tsv:${lineNo}] duplicate real value: "${real}"`);
    }
    if (llm2user[masked] !== undefined) {
      throw new Error(`[mapping.tsv:${lineNo}] duplicate masked value: "${masked}" (inverse collision)`);
    }

    user2llm[real] = masked;
    llm2user[masked] = real;
  }
  return { user2llm, llm2user };
};

const mapping = loadMappingTSV(MAPPING_FILE);

// ============================================================================
// CONSTANTS - Target LLM endpoint and listening port
// ============================================================================

// The LLM provider we are proxying requests to. Currently only MiniMax is supported.
// If you want to add other providers (OpenAI, Anthropic), you'd add conditional routing here.
const TARGET_HOST = 'api.minimax.io';
const TARGET_PATH = '/v1/chat/completions';

// Port precedence: env variable > config.json > default 45823
// Example: PORT=8080 node index.js will listen on port 8080
const LISTEN_PORT = 45823;

// size of chunk before and after mapping ocurrence
const aroundChunkLength = 27; // Number of chars before/after to include in snippet

// ============================================================================
// LOGGING HELPER
// ============================================================================

/**
 * Logs a message with ISO timestamp prefix to stderr (console.error).
 * Uses stderr because stdout might be piped elsewhere; stderr is for diagnostics.
 *
 * @param {...any} msg - Arguments to log, joined with spaces
 *
 * Example:
 *   log('Server started');
 *   log('Status:', 200, 'OK');
 *   // Output: [2026-08-07T19:48:06.731Z] Status: 200 OK
 */
const log = (...msg) => console.error(`[${new Date().toISOString()}]`, ...msg);

// ============================================================================
// MAPPING TABLES - Loaded once at startup from mapping.tsv
// ============================================================================

// Extract bidirectional mapping tables derived from the TSV file.
// user2llm: maps user-side names (confidential) to LLM-side aliases
// llm2user: maps LLM-side aliases back to user-side names (confidential)
// IMPORTANT: llm2user is the perfect inverse of user2llm. Enforced by loadMappingTSV()
// (each real value is unique and each masked value is unique, so the inverse is bijective).
const user2llm = mapping.user2llm || {};
const llm2user = mapping.llm2user || {};

// Defensive cross-check: confirm the tables are exact inverses of each other.
// Should never fail given loadMappingTSV()'s validation, but kept as belt-and-suspenders.
for (const [real, masked] of Object.entries(user2llm)) {
  if (llm2user[masked] !== real) {
    throw new Error(`mapping.tsv is not a valid bijection: user2llm["${real}"]="${masked}" but llm2user["${masked}"]="${llm2user[masked]}"`);
  }
}

// ============================================================================
// REGEX ESCAPE HELPER
// ============================================================================

/**
 * Counts how many mappings from a mapping table were actually applied to a text.
 * A mapping is "applied" if its key exists in the text.
 *
 * @param {string} text - The text to check
 * @param {object} mappingTable - Object with key->value mappings
 * @returns {number} - Count of mappings whose keys appear in the text
 *
 * Example with mapping {"SECOJB": "SJBDR", "QWER": "OPDF"}:
 *   countMappings("class SECOJB uses QWER", {"SECOJB": "SJBDR", "QWER": "OPDF"})
 *   => 2
 *
 *   countMappings("class SJBDR uses OPDF", {"SECOJB": "SJBDR", "QWER": "OPDF"})
 *   => 0
 */
const countMappings = (text, mappingTable) => {
  if (!text || typeof text !== 'string') return 0;
  return Object.keys(mappingTable).filter(k => text.includes(k)).length;
};

/**
 * Extracts context snippets around mapped words in text.
 * Shows 20 chars before and 20 chars after each mapped word found.
 *
 * @param {string} text - The text to search
 * @param {object} mappingTable - Mapping table to find keys in text
 * @returns {string} - Snippets like "...s is USRBOO from the..." or ""
 */
const extractMappedContext = (text, mappingTable) => {
  if (!text || typeof text !== 'string') return '';
  const keys = Object.keys(mappingTable).filter(k => text.includes(k));
  if (keys.length === 0) return '';
  const snippets = keys.map(k => {
    const idx = text.indexOf(k);
    const start = Math.max(0, idx - aroundChunkLength);
    const end = Math.min(text.length, idx + k.length + aroundChunkLength);
    const before = start > 0 ? '...' : '';
    const after = end < text.length ? '...' : '';
    return `${before}${text.substring(start, end)}${after}`;
  });
  return snippets.join(', ');
};

/**
 * Extracts context snippets around the VALUES of a mapping table.
 * Shows 20 chars before and 20 chars after each mapped value found.
 * Used to show transformed text (what the original words became).
 *
 * @param {string} text - The text to search
 * @param {object} mappingTable - Mapping table with key->value pairs
 * @returns {string} - Snippets showing the mapped values in context
 */
const extractTransformedContext = (text, mappingTable) => {
  if (!text || typeof text !== 'string') return '';
  const values = Object.values(mappingTable);
  const found = values.filter(v => text.includes(v));
  if (found.length === 0) return '';
  const snippets = found.map(v => {
    const idx = text.indexOf(v);
    const start = Math.max(0, idx - aroundChunkLength);
    const end = Math.min(text.length, idx + v.length + aroundChunkLength);
    const before = start > 0 ? '...' : '';
    const after = end < text.length ? '...' : '';
    return `${before}${text.substring(start, end)}${after}`;
  });
  return snippets.join(', ');
};

/**
 * Extracts a short text sample from messages array for logging purposes.
 * Returns the first non-empty content found, truncated to maxLen chars.
 *
 * @param {Array} messages - Array of message objects
 * @param {number} maxLen - Maximum length of returned sample (default 150)
 * @returns {string} - A text sample suitable for logging
 */
const extractTextSample = (messages, maxLen = 150) => {
  if (!Array.isArray(messages)) return 'none';
  for (const m of messages) {
    let text = '';
    if (typeof m.content === 'string') {
      text = m.content;
    } else if (Array.isArray(m.content)) {
      for (const part of m.content) {
        if (part && part.type === 'text' && part.text) {
          text = part.text;
          break;
        }
      }
    }
    if (text) {
      return text.length > maxLen ? text.substring(0, maxLen) + '...' : text;
    }
  }
  return 'empty';
};

/**
 * Escapes special regex characters in a string so it can be safely used
 * as a literal pattern in a RegExp constructor.
 *
 * Why needed: If a mapping key contains characters like ".", "*", "+" or "(",
 * using it directly in a regex would treat them as metacharacters.
 *
 * @param {string} str - The string to escape
 * @returns {string} - The escaped string safe for regex pattern use
 *
 * Example:
 *   escape("file.cs")   => "file\\.cs"
 *   escape("name(v2)")  => "name\\(v2\\)"
 *   escape("plain")     => "plain"
 */
const escape = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ============================================================================
// BIDIRECTIONAL TEXT MAPPING FUNCTIONS
// ============================================================================

/**
 * Transforms text from user-side to LLM-side by applying all user2llm mappings.
 * Iterates over every mapping key and replaces all occurrences globally.
 *
 * @param {string} text - The original text containing user-side identifiers
 * @returns {string} - The text with all user-side identifiers replaced by LLM-side aliases
 *
 * Example with mapping {"SECOJB": "SJBDR", "QWER": "OPDF"}:
 *   toLLM("class SECOJB uses QWER")
 *   => "class SJBDR uses OPDF"
 *
 * Example with phrase mapping:
 *   toLLM("CorporativaUnidasDesarrollo is great")
 *   => "CorporativaUnidasDesarrollo is great" (unchanged, not mapped)
 *
 * Edge cases:
 *   - Non-string input is returned unchanged
 *   - Empty/null text is returned unchanged
 *   - Order of mappings matters if one output contains another's input
 */
const toLLM = (text) => {
  // Guard clause: only operate on strings; return other types as-is (numbers, null, etc.)
  if (!text || typeof text !== 'string') return text;

  let result = text;
  // Iterate every mapping entry and apply global replacement
  // Using 'g' flag means ALL occurrences in the string are replaced, not just first
  for (const [userText, llmText] of Object.entries(user2llm)) {
    // new RegExp with escape() treats userText as a literal pattern
    result = result.replace(new RegExp(escape(userText), 'g'), llmText);
  }
  return result;
};

/**
 * Transforms text from LLM-side to user-side by applying all llm2user mappings.
 * Inverse operation of toLLM. Iterates over every mapping key and replaces globally.
 *
 * @param {string} text - The text from LLM containing LLM-side aliases
 * @returns {string} - The text with all LLM-side aliases replaced by user-side identifiers
 *
 * Example with mapping {"SJBDR": "SECOJB", "OPDF": "QWER"}:
 *   fromLLM("class SJBDR uses OPDF")
 *   => "class SECOJB uses QWER"
 *
 * IMPORTANT: This function must perfectly inverse toLLM. If user2llm has {"A": "B"},
 * then llm2user MUST have {"B": "A"}. Validate this at startup.
 */
const fromLLM = (text) => {
  // Guard clause: only operate on strings; return other types as-is
  if (!text || typeof text !== 'string') return text;

  let result = text;
  // Same iteration pattern as toLLM but with reversed mapping table
  for (const [llmText, userText] of Object.entries(llm2user)) {
    result = result.replace(new RegExp(escape(llmText), 'g'), userText);
  }
  return result;
};

// ============================================================================
// SAFE JSON PARSING HELPER
// ============================================================================

/**
 * Attempts to parse a JSON string, returning null on failure instead of throwing.
 * Used throughout the proxy where we receive potentially malformed JSON from
 * network streams or external sources.
 *
 * @param {string} str - The string to parse as JSON
 * @returns {object|null} - The parsed object, or null if parsing fails
 *
 * Example:
 *   parseJSONSafe('{"a":1}')  => {a: 1}
 *   parseJSONSafe('invalid')  => null
 *   parseJSONSafe('')         => null
 *   parseJSONSafe(null)       => null
 *
 * Why not just try/catch around JSON.parse?
 *   This is a reusable wrapper that provides consistent null-on-failure semantics,
 *   avoiding repetitive try/catch blocks throughout the codebase.
 */
const parseJSONSafe = (str) => {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
};

// ============================================================================
// REQUEST BODY TRANSFORMER (outgoing: user → LLM)
// ============================================================================

/**
 * Recursively transforms the outgoing request body before forwarding to LLM.
 * Applies toLLM mapping to ALL text fields that might contain user-side identifiers,
 * ensuring the LLM NEVER sees confidential names.
 *
 * Fields transformed:
 *   - messages[].content (string and array of multimodal parts)
 *   - messages[].content[].text (text parts in multimodal content)
 *   - messages[].content[].image_url.url (URLs in image parts)
 *   - messages[].name (function name in tool messages)
 *   - messages[].tool_call_id (tool call ID in tool messages)
 *   - messages[].tool_calls[].id (previous assistant tool calls)
 *   - messages[].tool_calls[].function.name (function names)
 *   - messages[].tool_calls[].function.arguments (function arguments as JSON string)
 *   - messages[].function_call (legacy function calling)
 *   - tools[].function.name (tool function definitions)
 *   - tools[].function.description (tool descriptions)
 *
 * @param {object} body - The OpenAI-format request body from OpenCode
 * @returns {object} - A new body object with all user-side identifiers mapped to LLM-side aliases
 *
 * Example input:
 *   {
 *     model: "MiniMax-M2.7",
 *     messages: [
 *       {role: "user", content: "Use SECOJB class"},
 *       {role: "assistant", tool_calls: [{function: {name: "write", arguments: '{"path": "SECOJB.cs"}'}}]}
 *     ],
 *     tools: [{function: {name: "bash", description: "Run SECOJB scripts"}}]
 *   }
 *
 * Example output (with mapping {"SECOJB": "SJBDR"}):
 *   {
 *     model: "MiniMax-M2.7",
 *     messages: [
 *       {role: "user", content: "Use SJBDR class"},
 *       {role: "assistant", tool_calls: [{function: {name: "write", arguments: '{"path": "SJBDR.cs"}'}}]}
 *     ],
 *     tools: [{function: {name: "bash", description: "Run SJBDR scripts"}}]
 *   }
 *
 * IMPORTANT: This function must NOT mutate the original body. Always use spread
 * operators ({...obj}, .map, .filter) to create new objects/arrays.
 */
const transformRequestBody = (body) => {
  // Shallow copy top-level fields (model, stream, temperature, etc. pass through unchanged)
  const out = { ...body };

  // Transform messages array if present. OpenAI format: [{role, content, ...}, ...]
  if (Array.isArray(out.messages)) {
    out.messages = out.messages.map(m => {
      // Shallow copy each message to avoid mutating original
      const newMsg = { ...m };

      // CASE 1: Simple string content (most common case)
      // Example: {role: "user", content: "hello world"}
      if (typeof newMsg.content === 'string') {
        newMsg.content = toLLM(newMsg.content);
      }
      // CASE 2: Multimodal content array (text + images, etc.)
      // Example: [{type: "text", text: "..."}, {type: "image_url", image_url: {url: "..."}}]
      else if (Array.isArray(newMsg.content)) {
        newMsg.content = newMsg.content.map(part => {
          // Text parts: apply toLLM to the text field
          if (part && part.type === 'text' && typeof part.text === 'string') {
            return { ...part, text: toLLM(part.text) };
          }
          // Image URL parts: apply toLLM to the URL (in case it contains confidential paths)
          if (part && part.type === 'image_url' && part.image_url && typeof part.image_url.url === 'string') {
            return { ...part, image_url: { ...part.image_url, url: toLLM(part.image_url.url) } };
          }
          // Other part types (audio, etc.) pass through unchanged
          return part;
        });
      }

      // Transform 'name' field (used in tool role messages to identify the tool)
      if (typeof newMsg.name === 'string') {
        newMsg.name = toLLM(newMsg.name);
      }

      // Transform 'tool_call_id' (links tool response to the original tool call)
      // IDs may contain user-side identifiers if the LLM echoes them back
      if (typeof newMsg.tool_call_id === 'string') {
        newMsg.tool_call_id = toLLM(newMsg.tool_call_id);
      }

      // Transform previous tool_calls in assistant messages (conversation history)
      // These contain function names and arguments from previous turns
      if (Array.isArray(newMsg.tool_calls)) {
        newMsg.tool_calls = newMsg.tool_calls.map(tc => ({
          ...tc,
          // Transform tool call ID (may contain user-side identifiers)
          id: typeof tc.id === 'string' ? toLLM(tc.id) : tc.id,
          function: tc.function ? {
            ...tc.function,
            // Transform function name (e.g., "write_FILE_SECOJB" -> "write_FILE_SJBDR")
            name: typeof tc.function.name === 'string' ? toLLM(tc.function.name) : tc.function.name,
            // Transform arguments (JSON string that may contain user-side identifiers)
            arguments: typeof tc.function.arguments === 'string' ? toLLM(tc.function.arguments) : tc.function.arguments
          } : tc.function
        }));
      }

      // Transform legacy function_call field (pre-tools API, still supported by some models)
      if (newMsg.function_call) {
        newMsg.function_call = {
          ...newMsg.function_call,
          name: typeof newMsg.function_call.name === 'string' ? toLLM(newMsg.function_call.name) : newMsg.function_call.name,
          arguments: typeof newMsg.function_call.arguments === 'string' ? toLLM(newMsg.function_call.arguments) : newMsg.function_call.arguments
        };
      }

      return newMsg;
    });
  }

  // Transform tools definitions (function schemas provided to the LLM)
  // These tell the LLM what tools/functions are available to call
  if (Array.isArray(out.tools)) {
    out.tools = out.tools.map(t => {
      // Skip non-function tools (some providers support other tool types)
      if (!t.function) return t;
      return {
        ...t,
        function: {
          ...t.function,
          // Transform function name (in case it's a custom tool with user-side naming)
          name: typeof t.function.name === 'string' ? toLLM(t.function.name) : t.function.name,
          // Transform description (may mention user-side identifiers in examples)
          description: typeof t.function.description === 'string' ? toLLM(t.function.description) : t.function.description
        }
      };
    });
  }

  return out;
};

// ============================================================================
// DEEP RECURSIVE TRANSFORMER (for tool_call arguments after JSON parsing)
// ============================================================================

/**
 * Recursively transforms every string within a nested object/array structure.
 * Used when tool_call arguments come as JSON strings and need deep transformation
 * to catch user-side identifiers nested in complex data structures.
 *
 * @param {*} value - Any value: string, number, array, object, null, boolean
 * @returns {*} - The same structure with all strings transformed via fromLLM
 *
 * Example input (with mapping {"SJBDR": "SECOJB"}):
 *   {
 *     path: "SJBDR.cs",
 *     options: {
 *       encoding: "utf8",
 *       flags: ["SJBDR", "QWER"]
 *     },
 *     count: 42
 *   }
 *
 * Example output:
 *   {
 *     path: "SECOJB.cs",
 *     options: {
 *       encoding: "utf8",
 *       flags: ["SECOJB", "QWER"]
 *     },
 *     count: 42
 *   }
 *
 * Note: Non-string primitives (numbers, booleans, null) are returned unchanged.
 * Only string values are transformed via fromLLM.
 */
const transformValueDeep = (value) => {
  // BASE CASE: Transform string via fromLLM (inverse of toLLM)
  if (typeof value === 'string') {
    return fromLLM(value);
  }
  // RECURSIVE CASE: Transform each element in an array
  if (Array.isArray(value)) {
    return value.map(item => transformValueDeep(item));
  }
  // RECURSIVE CASE: Transform each value in an object
  if (typeof value === 'object' && value !== null) {
    const result = {};
    for (const key of Object.keys(value)) {
      result[key] = transformValueDeep(value[key]);
    }
    return result;
  }
  // PRIMITIVE: Numbers, booleans, null, undefined pass through unchanged
  return value;
};

// ============================================================================
// NON-STREAMING RESPONSE CHUNK TRANSFORMER
// ============================================================================

/**
 * Transforms a single non-streaming response chunk from the LLM.
 * Applies fromLLM to all string fields in the response.
 *
 * Note: This is called for non-streaming responses only. Streaming responses
 * are handled differently in handleChatCompletions (with accumulation logic).
 *
 * @param {object} chunk - A complete response object from the LLM
 * @returns {object} - The same chunk with all LLM-side aliases replaced by user-side names
 *
 * Example input (from LLM):
 *   {
 *     choices: [{
 *       message: {
 *         content: "class SJBDR created",
 *         tool_calls: [{function: {name: "write", arguments: '{"path": "SJBDR.cs"}'}}]
 *       }
 *     }]
 *   }
 *
 * Example output (to OpenCode):
 *   {
 *     choices: [{
 *       message: {
 *         content: "class SECOJB created",
 *         tool_calls: [{function: {name: "write", arguments: '{"path": "SECOJB.cs"}'}}]
 *       }
 *     }]
 *   }
 */
const transformChunk = (chunk) => {
  const choice = chunk.choices?.[0];
  // No choices means this is not a standard response chunk; return as-is
  if (!choice) return chunk;

  // Transform streaming content (delta.content in SSE chunks)
  if (choice.delta?.content) {
    choice.delta.content = fromLLM(choice.delta.content);
  }

  // Transform complete message content (non-streaming responses)
  if (choice.message?.content) {
    choice.message.content = fromLLM(choice.message.content);
  }

  // Transform streaming tool_calls (delta.tool_calls in SSE chunks)
  // Arguments come as JSON strings that may contain user-side identifiers
  if (choice.delta?.tool_calls) {
    for (const tc of choice.delta.tool_calls) {
      if (tc.function?.name) {
        tc.function.name = fromLLM(tc.function.name);
      }
      // Parse JSON, transform deeply, re-serialize
      // try/catch handles cases where arguments is not valid JSON yet (partial stream)
      if (tc.function?.arguments) {
        try {
          const args = JSON.parse(tc.function.arguments);
          const transformed = transformValueDeep(args);
          tc.function.arguments = JSON.stringify(transformed);
        } catch {}
      }
    }
  }

  // Transform complete tool_calls in message (non-streaming responses)
  if (choice.message?.tool_calls) {
    for (const tc of choice.message.tool_calls) {
      if (tc.function?.name) {
        tc.function.name = fromLLM(tc.function.name);
      }
      if (tc.function?.arguments) {
        try {
          const args = JSON.parse(tc.function.arguments);
          const transformed = transformValueDeep(args);
          tc.function.arguments = JSON.stringify(transformed);
        } catch {}
      }
    }
  }

  return chunk;
};

/**
 * Extracts <think>...</think> content from a string.
 * Returns the content without the tags and the extracted think text separately.
 *
 * opencode's SDK recognizes `reasoning_content` in OpenAI Chat streaming format
 * and renders it natively with textMuted color (gray) in its ReasoningPart component.
 * By extracting the think content and sending it as reasoning_content, we get
 * the native gray "thinking" appearance.
 *
 * @param {string} text - The text potentially containing think tags
 * @returns {{text: string, thinkContent: string|null}} - Text without tags and extracted think content
 */
const extractThinkContent = (text) => {
  if (!text || typeof text !== 'string') return { text, thinkContent: null };
  const thinkMatch = text.match(/<think>([\s\S]*?)<\/think>/);
  if (!thinkMatch) return { text, thinkContent: null };
  const before = text.substring(0, thinkMatch.index);
  const after = text.substring(thinkMatch.index + thinkMatch[0].length);
  return { text: before + after, thinkContent: thinkMatch[1].trim() };
};

// ============================================================================
// CHUNK CLEANER - Removes unnecessary fields before forwarding to client
// ============================================================================

/**
 * Creates a clean copy of a response chunk with only the fields needed by OpenCode.
 * Strips internal/proprietary fields from the LLM provider that the client doesn't need.
 * Also serves as a defensive measure to avoid leaking provider-specific metadata.
 *
 * @param {object} chunk - The raw chunk from the LLM
 * @returns {object} - A clean chunk with only essential fields
 *
 * Fields kept:
 *   - id: Response ID for tracking
 *   - object: Type identifier ("chat.completion.chunk")
 *   - created: Unix timestamp of creation
 *   - model: Model identifier
 *   - choices: Array of completion choices (with delta/finish_reason)
 *   - usage: Token usage statistics (if present)
 *   - system_fingerprint: Provider version identifier (if present)
 *
 * Example:
 *   Input:  {id, object, created, model, choices, usage, system_fingerprint, internal_stuff, ...}
 *   Output: {id, object, created, model, choices, usage?, system_fingerprint?}
 */
const cleanChunk = (chunk) => {
  // Guard: only operate on objects
  if (!chunk || typeof chunk !== 'object') return chunk;

  // Build new object with only the fields we want to forward
  const cleaned = {
    id: chunk.id,
    object: chunk.object,
    created: chunk.created,
    model: chunk.model,
    choices: chunk.choices || []
  };

  // Include usage stats if present (important for billing/cost tracking)
  if (chunk.usage) {
    cleaned.usage = chunk.usage;
  }

  // Include system_fingerprint if present (helps with debugging model versions)
  if (chunk.system_fingerprint) {
    cleaned.system_fingerprint = chunk.system_fingerprint;
  }

  return cleaned;
};

// ============================================================================
// FORWARDED HEADERS LIST
// ============================================================================

/**
 * Whitelist of HTTP headers that are safe and useful to forward from the client
 * to the LLM provider. We DON'T forward all headers because:
 *   - Authorization/x-api-key are handled separately (we add our own)
 *   - Host/Content-Length/Connection are connection-specific (must be set per request)
 *   - Cookie/Set-Cookie could leak session info
 *
 * Categories:
 *   - Content negotiation: accept, accept-encoding, accept-language
 *   - Client identification: user-agent
 *   - Request tracking: x-request-id
 *   - OpenAI/Stainless SDK metadata: x-stainless-*
 *   - Browser security headers: sec-fetch-*, sec-ch-ua*
 *
 * Match is case-insensitive (lowercased before comparison).
 */
const FORWARDED_HEADERS = [
  'accept',
  'accept-encoding',
  'accept-language',
  'user-agent',
  'x-request-id',
  'x-stainless-arch',
  'x-stainless-lang',
  'x-stainless-os',
  'x-stainless-package-version',
  'x-stainless-runtime',
  'x-stainless-runtime-version',
  'x-stainless-timeout',
  'sec-fetch-mode',
  'sec-fetch-site',
  'sec-ch-ua',
  'sec-ch-ua-mobile',
  'sec-ch-ua-platform'
];

// ============================================================================
// MAIN HANDLER: Chat Completions endpoint
// ============================================================================

/**
 * Handles POST /v1/chat/completions requests from OpenCode.
 * This is the core function that:
 *   1. Extracts API key from request headers (no storage)
 *   2. Parses the request body
 *   3. Transforms it to hide confidential identifiers from LLM
 *   4. Forwards to MiniMax
 *   5. Streams the response back, transforming chunks in real-time
 *   6. Handles both streaming (SSE) and non-streaming responses
 *
 * @param {http.IncomingMessage} req - The incoming request from OpenCode
 * @param {http.ServerResponse} res - The response object to send back to OpenCode
 * @returns {Promise<void>}
 *
 * Error handling:
 *   - 401: Missing API key
 *   - 400: Invalid JSON body
 *   - 502: Proxy/gateway error (network issues)
 *   - 504: Timeout (>120s)
 *   - Passthrough: LLM provider errors (4xx, 5xx from MiniMax)
 *
 * Streaming note:
 *   The response is streamed chunk-by-chunk to maintain low latency.
 *   Tool calls may be fragmented across multiple SSE chunks, so we
 *   accumulate them and send a complete tool_call at the end.
 */
const handleChatCompletions = async (req, res) => {
  // STEP 1: Extract API key from request headers (we never store keys)
  let apiKey = '';
  // OpenAI format: "Authorization: Bearer sk-..."
  if (req.headers['authorization']) {
    apiKey = req.headers['authorization'].replace(/^Bearer\s+/i, '');
  }
  // Anthropic/MiniMax format: "x-api-key: ..."
  else if (req.headers['x-api-key']) {
    apiKey = req.headers['x-api-key'];
  }

  // Reject requests without API key
  if (!apiKey) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'API key required (Authorization or x-api-key header)' }));
    return;
  }

  // STEP 2: Accumulate the request body chunks into a single buffer
  // (Node.js streams the body in multiple chunks, we need to reassemble)
  const chunks = [];
  req.on('data', chunk => chunks.push(chunk));

  // STEP 3: Process the complete request once 'end' event fires
  req.on('end', async () => {
    // Combine all chunks into a single string
    const bodyRaw = Buffer.concat(chunks).toString();
    const body = parseJSONSafe(bodyRaw);

    // Validate JSON
    if (!body) {
      log('[ERROR] Invalid JSON body:', bodyRaw.substring(0, 200));
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON body' }));
      return;
    }

    // LOG: Original request (before transformation)
    const rawMessagesStr = Array.isArray(body.messages) ? JSON.stringify(body.messages) : '';
    const rawMappingsCount = countMappings(rawMessagesStr, user2llm);
    log('[1/4] REQUEST RAW');
    log('   model:', body.model);
    log('   messages:', Array.isArray(body.messages) ? body.messages.length : 'none');
    log('   mappings in messages:', rawMappingsCount > 0 ? `${rawMappingsCount} mapped items` : '0 mapped items');
    if (rawMappingsCount > 0) {
      log('   chunk to map:', extractMappedContext(rawMessagesStr, user2llm));
    }
    log('   stream:', body.stream !== false);
    log('   tools:', Array.isArray(body.tools) ? body.tools.length : 'none');

    // STEP 4: Transform the request body to hide confidential identifiers
    const transformed = transformRequestBody(body);

    // LOG: Transformed request (after mapping user→LLM)
    const transformedMessagesStr = JSON.stringify(transformed.messages);
    const transformedMappingsCount = countMappings(transformedMessagesStr, user2llm);
    log('[2/4] REQUEST TRANSFORMED');
    log('   model:', transformed.model);
    log('   mappings remaining in transformed:', transformedMappingsCount > 0 ? `${transformedMappingsCount} mapped items (WARNING: possible leak)` : '0 mapped items');
    if (rawMappingsCount > 0) {
      log('   chunk mapped:', extractTransformedContext(transformedMessagesStr, user2llm));
    }

    // STEP 5: LEAK DETECTION - Verify no user-side identifiers leaked through
    // Serializes the entire transformed body and checks for any user2llm keys
    // This catches bugs where transformation is incomplete (e.g., new field types)
    const transformedStr = JSON.stringify(transformed);
    const leaks = Object.keys(user2llm).filter(k => transformedStr.includes(k));
    if (leaks.length > 0) {
      // Log warning with details about WHERE the leak occurred
      log('   !!! LEAK DETECTED in REQUEST !!! Still contains:', leaks.join(', '));
      // Identify which message(s) contain the leaked identifier
      if (Array.isArray(transformed.messages)) {
        for (let i = 0; i < transformed.messages.length; i++) {
          const m = transformed.messages[i];
          const mStr = JSON.stringify(m);
          for (const leakKey of leaks) {
            if (mStr.includes(leakKey)) {
              log(`      message[${i}] (${m.role}) contains "${leakKey}"`);
            }
          }
        }
      }
      // Identify which tool(s) contain the leaked identifier
      if (Array.isArray(transformed.tools)) {
        for (let i = 0; i < transformed.tools.length; i++) {
          const t = transformed.tools[i];
          const tStr = JSON.stringify(t);
          for (const leakKey of leaks) {
            if (tStr.includes(leakKey)) {
              log(`      tools[${i}] (${t.function?.name}) contains "${leakKey}"`);
            }
          }
        }
      }
    }

    // STEP 6: Determine if streaming is requested and prepare the payload
    const isStream = transformed.stream !== false;
    const postData = JSON.stringify(transformed);

    // STEP 7: Build forwarded headers (whitelist approach for security)
    const forwardHeaders = { ...req.headers };
    // Remove headers that must NOT be forwarded or must be set by us
    delete forwardHeaders['host'];         // Will be set to TARGET_HOST
    delete forwardHeaders['content-length']; // Will be recalculated
    delete forwardHeaders['connection'];   // Connection management is per-hop
    delete forwardHeaders['authorization']; // We add our own with extracted apiKey
    delete forwardHeaders['x-api-key'];    // We add our own with extracted apiKey

    // STEP 8: Configure the HTTPS request to MiniMax
    const proxyOptions = {
      hostname: TARGET_HOST,
      port: 443,
      path: TARGET_PATH,
      method: 'POST',
      headers: {
        // Only forward whitelisted headers, plus our own required headers
        ...Object.fromEntries(
          Object.entries(forwardHeaders).filter(([k]) => FORWARDED_HEADERS.includes(k.toLowerCase()))
        ),
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(postData),
        // Request SSE format if streaming, otherwise JSON
        'Accept': isStream ? 'text/event-stream' : 'application/json'
      },
      timeout: 120000 // 2 minute timeout for slow LLM responses
    };

    log('[2/4] Forwarding request to MiniMax...');

    // STEP 9: Send the request to MiniMax
    const proxyReq = https.request(proxyOptions, (proxyRes) => {
      log('[3/4] RESPONSE RAW from MiniMax');
      log('   status:', proxyRes.statusCode);
      log('   content-type:', proxyRes.headers['content-type']);

      // Handle HTTP errors from MiniMax (4xx, 5xx)
      if (proxyRes.statusCode < 200 || proxyRes.statusCode >= 300) {
        let errorBody = '';
        proxyRes.on('data', c => errorBody += c);
        proxyRes.on('end', () => {
          log('[ERROR] MiniMax error:', proxyRes.statusCode, errorBody);
          res.writeHead(proxyRes.statusCode, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          });
          res.end(JSON.stringify({ error: errorBody || `HTTP ${proxyRes.statusCode}` }));
        });
        return;
      }

      // STEP 10: Build response headers to send back to OpenCode
      const responseHeaders = {
        'Content-Type': proxyRes.headers['content-type'] || 'text/event-stream',
        'Cache-Control': 'no-cache',           // Prevent caching of streaming responses
        'X-Accel-Buffering': 'no',             // Disable nginx buffering
        'Connection': 'keep-alive',            // Keep connection open for streaming
        'Access-Control-Allow-Origin': '*'     // Allow browser/extension access
      };

      // Forward request ID if present (useful for debugging)
      if (proxyRes.headers['x-request-id']) {
        responseHeaders['X-Request-Id'] = proxyRes.headers['x-request-id'];
      }

      res.writeHead(200, responseHeaders);

      // NON-STREAMING PATH: Wait for full response, transform, send
      if (!isStream) {
        let responseBody = '';
        proxyRes.on('data', c => responseBody += c);
        proxyRes.on('end', () => {
          try {
            const json = parseJSONSafe(responseBody);
            if (json) {
              const transformed = transformChunk(json);
              // Extract <think>...</think> and send as reasoning_content
              // so opencode renders it natively with textMuted (gray) color
              if (transformed.choices?.[0]?.message?.content) {
                const { text, thinkContent } = extractThinkContent(transformed.choices[0].message.content);
                transformed.choices[0].message.content = text;
                if (thinkContent) {
                  transformed.choices[0].message.reasoning_content = thinkContent;
                }
              }
              const rawContext = extractMappedContext(responseBody, llm2user);
              const unmappedContext = extractTransformedContext(JSON.stringify(transformed), llm2user);
              log('[3/4] RESPONSE RAW');
              if (rawContext) {
                log('   chunk to unmap:', rawContext);
              } else {
                log('   chunk to unmap: 0 mapped items');
              }
              res.end(JSON.stringify(transformed));
              log('[4/4] RESPONSE TRANSFORMED (non-stream)');
              if (unmappedContext) {
                log('   chunk unmapped:', unmappedContext);
              } else {
                log('   chunk unmapped: 0 mapped items');
              }
            } else {
              // Not valid JSON, send as-is (edge case)
              res.end(responseBody);
            }
          } catch {
            // Error during transformation, send raw
            res.end(responseBody);
          }
        });
        return;
      }

      // STREAMING PATH: Process SSE chunks in real-time
      log('[3/4] RESPONSE RAW (streaming...)');
      log('   waiting for chunks...');

      // Buffer for incomplete SSE chunks (data may arrive split across TCP packets)
      let buffer = '';
      let chunkCount = 0;
      let responseMappingsCount = 0;
      let firstRawContext = '';
      let firstUnmappedContext = '';
      // Buffer for <think>...</think> tags that may span multiple SSE chunks
      let thinkBuffer = '';

      // Accumulator for fragmented tool_calls (see explanation below)
      const pendingToolCalls = new Map();
      let hasToolCalls = false;

      /**
       * Flushes accumulated tool_calls as complete chunks.
       *
       * Why this is needed:
       *   LLMs stream tool_calls across MULTIPLE SSE chunks. Each chunk may contain:
       *     - A fragment of the function name
       *     - A fragment of the JSON arguments
       *     - Just metadata (id, index)
       *   The client (OpenCode) expects each tool_call to arrive ONCE as a complete unit.
       *   So we accumulate fragments and emit a single complete chunk at the end.
       *
       * Triggered by:
       *   - finish_reason === 'tool_calls' (LLM finished emitting the tool call)
       *   - data: [DONE] (end of stream)
       *   - proxyRes.on('end') (connection closed)
       */
      const flushToolCalls = () => {
        for (const [index, pending] of pendingToolCalls) {
          // Skip already-sent tool calls (idempotent)
          if (!pending.sent) {
            let transformedArgs = pending.args;
            try {
              // Parse the accumulated JSON arguments string
              const parsedArgs = JSON.parse(pending.args);
              // Deep transform to catch nested user-side identifiers
              const transformed = transformValueDeep(parsedArgs);
              // Re-serialize with mapped values
              transformedArgs = JSON.stringify(transformed);
              // LOG: Show RAW vs UNMAPPED for debugging
              log(`[4/4] TOOL CALL #${index} unmapping: ${pending.name}`);
              log(`   RAW args: ${pending.args.substring(0, 200)}`);
              log(`   UNMAPPED args: ${transformedArgs.substring(0, 200)}`);
            } catch (e) {
              // If arguments aren't valid JSON, apply fromLLM to raw string as fallback
              log(`[4/4] TOOL CALL #${index} WARN: args not valid JSON, applying fromLLM on raw: ${e.message}`);
              transformedArgs = fromLLM(pending.args);
            }

            // Build a complete tool_call chunk to send to OpenCode
            const finalChunk = {
              id: pending.chunkId,
              object: 'chat.completion.chunk',
              created: pending.created,
              model: pending.model,
              choices: [{
                index: 0,
                delta: {
                  tool_calls: [{
                    index: pending.index,
                    id: pending.id,
                    function: {
                      name: pending.name,
                      arguments: transformedArgs
                    }
                  }]
                }
              }]
            };
            // Send as SSE-formatted data line
            res.write(`data: ${JSON.stringify(finalChunk)}\n\n`);
            pending.sent = true;
          }
        }
      };

      /**
       * Processes a single line from the SSE stream.
       * SSE format: "data: <json>" or "data: [DONE]" or other (event:, id:, etc.)
       *
       * @param {string} line - A single line from the SSE stream (without trailing \n)
       *
       * Handles:
       *   - data: [DONE] - End of stream marker
       *   - data: <json> - Actual content chunk
       *   - Other SSE fields (event:, id:, retry:) - Forwarded as-is
       */
      const processLine = (line) => {
        const trimmed = line.trim();
        if (!trimmed) return; // Skip empty lines

        // CASE 1: End of stream marker
        if (trimmed === 'data: [DONE]') {
          // Flush any pending tool calls before signaling end
          if (hasToolCalls) {
            flushToolCalls();
          }
          res.write('data: [DONE]\n\n');
          return;
        }

        // CASE 2: Non-data SSE fields (event:, id:, etc.) - forward as-is
        if (!trimmed.startsWith('data: ')) {
          res.write(line + '\n');
          return;
        }

        // CASE 3: JSON data chunk - parse, transform, forward
        // Strip "data: " prefix to get the JSON string
        const jsonStr = trimmed.slice(6);
        const parsed = parseJSONSafe(jsonStr);

        if (parsed) {
          const choice = parsed.choices?.[0];

          // CASE 3a: Tool call fragment - accumulate, don't send yet
          if (choice?.delta?.tool_calls) {
            hasToolCalls = true;

            for (const tc of choice.delta.tool_calls) {
              // Each tool call has an index (0, 1, 2...) for parallel calls
              const idx = tc.index !== undefined ? tc.index : 0;

              // Initialize accumulator for new tool calls
              if (!pendingToolCalls.has(idx)) {
                pendingToolCalls.set(idx, {
                  index: idx,
                  id: '',
                  name: '',
                  args: '',
                  sent: false,
                  chunkId: parsed.id,
                  created: parsed.created,
                  model: parsed.model
                });
              }

              const pending = pendingToolCalls.get(idx);

              // Accumulate fields as they arrive (may be in separate chunks)
              if (tc.id) pending.id = tc.id;
              if (tc.function?.name) pending.name = fromLLM(tc.function.name);
              // Arguments are JSON strings that arrive in fragments - concat them
              if (tc.function?.arguments) pending.args += tc.function.arguments;
            }

            return; // Don't forward this chunk; we're accumulating
          }

          // CASE 3b: LLM finished emitting tool calls - flush accumulated calls
          if (hasToolCalls && choice?.finish_reason === 'tool_calls') {
            flushToolCalls();
            // Forward the finish_reason chunk so client knows tool calls are done
            const finalChunk = {
              id: parsed.id,
              object: parsed.object,
              created: parsed.created,
              model: parsed.model,
              choices: [{
                index: 0,
                delta: {},
                finish_reason: 'tool_calls'
              }]
            };
            res.write(`data: ${JSON.stringify(finalChunk)}\n\n`);
            return;
          }

          // CASE 3c: Regular content chunk - transform and forward
          const transformed = transformChunk(parsed);
          const cleaned = cleanChunk(transformed);
          if (!firstRawContext) {
            firstRawContext = extractMappedContext(jsonStr, llm2user);
          }
          if (!firstUnmappedContext) {
            firstUnmappedContext = extractTransformedContext(JSON.stringify(cleaned), llm2user);
          }
          // Extract <think>...</think> and send as reasoning_content
          // so opencode renders it natively with textMuted (gray) color
          const content = cleaned.choices?.[0]?.delta?.content || '';
          if (content) {
            thinkBuffer += content;
            const thinkStartIdx = thinkBuffer.indexOf('<think>');
            const thinkEndIdx = thinkBuffer.indexOf('</think>');
            if (thinkStartIdx === -1) {
              // No think tag - send as regular content
              cleaned.choices[0].delta.content = thinkBuffer;
              res.write(`data: ${JSON.stringify(cleaned)}\n\n`);
              thinkBuffer = '';
            } else if (thinkEndIdx !== -1 && thinkEndIdx > thinkStartIdx) {
              // Complete think block found
              const before = thinkBuffer.substring(0, thinkStartIdx);
              const thinkContent = thinkBuffer.substring(thinkStartIdx + 7, thinkEndIdx);
              const after = thinkBuffer.substring(thinkEndIdx + 8);
              if (before) {
                cleaned.choices[0].delta.content = before;
                res.write(`data: ${JSON.stringify(cleaned)}\n\n`);
              }
              // Send think content as reasoning_content (opencode renders gray)
              cleaned.choices[0].delta.content = null;
              cleaned.choices[0].delta.reasoning_content = thinkContent;
              res.write(`data: ${JSON.stringify(cleaned)}\n\n`);
              thinkBuffer = '';
              if (after) {
                cleaned.choices[0].delta = { content: after };
                res.write(`data: ${JSON.stringify(cleaned)}\n\n`);
                thinkBuffer = '';
              }
            } else if (thinkStartIdx > 0) {
              // Content before think tag - send it, buffer the rest
              cleaned.choices[0].delta.content = thinkBuffer.substring(0, thinkStartIdx);
              res.write(`data: ${JSON.stringify(cleaned)}\n\n`);
              thinkBuffer = thinkBuffer.substring(thinkStartIdx);
            }
            // else: think tag started but not complete yet - wait for more chunks
          } else {
            res.write(`data: ${JSON.stringify(cleaned)}\n\n`);
          }
        } else {
          // Invalid JSON in data line - forward as-is (shouldn't happen normally)
          res.write(line + '\n');
        }
      };

      // STEP 11: Handle incoming SSE data chunks from MiniMax
      proxyRes.on('data', (chunk) => {
        chunkCount++;
        const data = chunk.toString();
        buffer += data;
        responseMappingsCount += countMappings(data, llm2user);

        // SSE events are separated by "\n\n" (blank line)
        // Process all complete events in the buffer
        let boundary;
        while ((boundary = buffer.indexOf('\n\n')) !== -1) {
          // Extract one complete SSE event
          const block = buffer.substring(0, boundary);
          buffer = buffer.substring(boundary + 2);

          // Split event into individual lines and process each
          const lines = block.split('\n');
          for (const line of lines) {
            processLine(line);
          }
        }
      });

      // STEP 12: Handle end of stream from MiniMax
      proxyRes.on('end', () => {
        // Process any remaining buffered data (incomplete final event)
        if (buffer.trim()) {
          const lines = buffer.split('\n');
          for (const line of lines) {
            processLine(line);
          }
        }
        // Flush any pending tool calls that weren't triggered by [DONE]
        if (hasToolCalls) {
          flushToolCalls();
        }
        // Send final [DONE] marker to OpenCode
        res.write('data: [DONE]\n\n');
        res.end();
        log('[3/4] RESPONSE RAW');
        log('   chunk to unmap:', firstRawContext || '0 mapped items');
        log(`[4/4] RESPONSE TRANSFORMED total chunks: ${chunkCount}, tool_calls: ${pendingToolCalls.size}`);
        log('   chunk unmapped:', firstUnmappedContext || '0 mapped items');
      });

      // Handle network errors during streaming
      proxyRes.on('error', (err) => {
        log('[ERROR] Proxy response error:', err.message);
        if (!res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        } else {
          // Headers already sent, just end the stream
          res.end();
        }
      });
    });

    // Handle errors in the outgoing request to MiniMax
    proxyReq.on('error', (err) => {
      log('[ERROR] Proxy request error:', err.message);
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });

    // Handle request timeout (configured as 120s in proxyOptions)
    proxyReq.on('timeout', () => {
      log('[ERROR] Proxy request timeout (120s)');
      proxyReq.destroy(); // Force-close the connection
      if (!res.headersSent) {
        res.writeHead(504, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Timeout' }));
      }
    });

    // Send the transformed body to MiniMax
    proxyReq.write(postData);
    proxyReq.end();
  });

  // Handle errors in the incoming request from OpenCode
  req.on('error', (err) => {
    log('[ERROR] Request error:', err.message);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
};

// ============================================================================
// HTTP SERVER - Routes incoming requests to appropriate handlers
// ============================================================================

/**
 * Creates the HTTP server that listens on LISTEN_PORT.
 * Routes:
 *   - OPTIONS *           → CORS preflight (returns 200 with CORS headers)
 *   - POST /v1/chat/completions → handleChatCompletions (main proxy logic)
 *   - GET  /v1/models     → Returns mock model list (for OpenCode compatibility)
 *   - GET  /health        → Health check endpoint
 *   - *                   → 404 Not Found
 *
 * The server also sets Access-Control-Allow-Origin: * to allow browser-based
 * clients (e.g., browser extensions, web UIs) to use the proxy.
 */
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${LISTEN_PORT}`);

  // Set CORS header for all responses
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Handle CORS preflight requests (browsers send OPTIONS before POST)
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Max-Age': '86400' // Cache preflight for 24 hours
    });
    res.end();
    return;
  }

  // Main proxy route: forward chat completion requests to MiniMax
  if (url.pathname === '/v1/chat/completions' && req.method === 'POST') {
    handleChatCompletions(req, res);
    return;
  }

  // Mock /v1/models endpoint for OpenCode compatibility
  // OpenCode may query this to discover available models
  if (url.pathname === '/v1/models' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      object: 'list',
      data: [{ id: 'MiniMax-M3', object: 'model', owned_by: 'minimax' }]
    }));
    return;
  }

  // Health check endpoint for monitoring/load balancers
  if (url.pathname === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  // 404 for any other route
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

// ============================================================================
// SERVER STARTUP - Listen on configured port and log startup info
// ============================================================================

/**
 * Starts the HTTP server and logs diagnostic information.
 * This callback runs once when the server successfully binds to the port.
 *
 * Logs include:
 *   - Confirmation that proxy started
 *   - Listening URL
 *   - Target LLM endpoint
 *   - Number of mappings loaded (for both directions)
 *   - Auth method (extracted from request headers)
 *   - Full mapping tables (for verification at startup)
 *
 * To stop the server: Ctrl+C (SIGINT) or kill the process
 */
server.listen(LISTEN_PORT, () => {
  log(`=== Proxy Started ===`);
  log(`Listening on port ${LISTEN_PORT}`);
  log(`Target: https://${TARGET_HOST}${TARGET_PATH}`);
  log(`Mapping source: ${MAPPING_FILE}`);
  log(`Mappings: ${Object.keys(user2llm).length} user2llm, ${Object.keys(llm2user).length} llm2user`);
  log(`Auth: from request headers (Authorization or x-api-key)`);
  // Print every mapping entry for verification at startup.
  // Format mirrors the TSV: "<real>\t<masked>" so operators can eyeball the table.
  if (Object.keys(user2llm).length > 0) {
    log(`Loaded mapping entries (real -> masked):`);
    const longestReal = Math.max(...Object.keys(user2llm).map(k => k.length));
    for (const [real, masked] of Object.entries(user2llm)) {
      log(`   ${real.padEnd(longestReal)}  →  ${masked}`);
    }
  } else {
    log(`WARNING: no mappings loaded. The proxy will pass traffic through unmodified.`);
  }
});
