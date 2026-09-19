// Exhaustive test of transformRequestBody
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MAPPING_FILE = path.join(__dirname, 'mapping.tsv');

// Load mapping from TSV. Each non-comment, non-empty line is "<real>\t<masked>".
const user2llm = {};
{
  const raw = fs.readFileSync(MAPPING_FILE, 'utf-8');
  for (const original of raw.split(/\r?\n/)) {
    const line = original.replace(/^\uFEFF/, '').trim();
    if (!line || line.startsWith('#')) continue;
    const tabIdx = line.indexOf('\t');
    if (tabIdx === -1) {
      throw new Error(`missing TAB separator in line: "${line}"`);
    }
    const real = line.substring(0, tabIdx).trim();
    const masked = line.substring(tabIdx + 1).trim();
    if (!real || !masked) {
      throw new Error(`both columns required in line: "${line}"`);
    }
    user2llm[real] = masked;
  }
}

console.log(`Loaded ${Object.keys(user2llm).length} mapping entries from ${MAPPING_FILE}\n`);

const escape = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const toLLM = (text) => {
  if (!text || typeof text !== 'string') return text;
  let result = text;
  for (const [userText, llmText] of Object.entries(user2llm)) {
    result = result.replace(new RegExp(escape(userText), 'g'), llmText);
  }
  return result;
};

const transformRequestBody = (body) => {
  const out = { ...body };

  if (Array.isArray(out.messages)) {
    out.messages = out.messages.map(m => {
      const newMsg = { ...m };

      if (typeof newMsg.content === 'string') {
        newMsg.content = toLLM(newMsg.content);
      } else if (Array.isArray(newMsg.content)) {
        newMsg.content = newMsg.content.map(part => {
          if (part && part.type === 'text' && typeof part.text === 'string') {
            return { ...part, text: toLLM(part.text) };
          }
          if (part && part.type === 'image_url' && part.image_url && typeof part.image_url.url === 'string') {
            return { ...part, image_url: { ...part.image_url, url: toLLM(part.image_url.url) } };
          }
          return part;
        });
      }

      if (typeof newMsg.name === 'string') {
        newMsg.name = toLLM(newMsg.name);
      }

      if (typeof newMsg.tool_call_id === 'string') {
        newMsg.tool_call_id = toLLM(newMsg.tool_call_id);
      }

      if (Array.isArray(newMsg.tool_calls)) {
        newMsg.tool_calls = newMsg.tool_calls.map(tc => ({
          ...tc,
          id: typeof tc.id === 'string' ? toLLM(tc.id) : tc.id,
          function: tc.function ? {
            ...tc.function,
            name: typeof tc.function.name === 'string' ? toLLM(tc.function.name) : tc.function.name,
            arguments: typeof tc.function.arguments === 'string' ? toLLM(tc.function.arguments) : tc.function.arguments
          } : tc.function
        }));
      }

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

  if (Array.isArray(out.tools)) {
    out.tools = out.tools.map(t => {
      if (!t.function) return t;
      return {
        ...t,
        function: {
          ...t.function,
          name: typeof t.function.name === 'string' ? toLLM(t.function.name) : t.function.name,
          description: typeof t.function.description === 'string' ? toLLM(t.function.description) : t.function.description
        }
      };
    });
  }

  return out;
};

// Test with a realistic OpenCode-style request
const testBody = {
  model: 'MiniMax-M2.7',
  stream: true,
  temperature: 0,
  messages: [
    {
      role: 'system',
      content: 'You are an AI coding assistant called opencode. The user is working on a project. Files involved: XXWW.cs.'
    },
    {
      role: 'user',
      content: 'Please create the XXWW class in XXWW.cs file with the following requirements.'
    },
    {
      role: 'assistant',
      content: 'I will create XXWW.cs with the XXWW class.',
      tool_calls: [
        {
          id: 'toolu_XXWW_001',
          type: 'function',
          function: {
            name: 'write',
            arguments: '{"content": "public class XXWW { }", "filePath": "XXWW.cs"}'
          }
        }
      ]
    },
    {
      role: 'tool',
      tool_call_id: 'toolu_XXWW_001',
      content: 'File XXWW.cs created successfully'
    },
    {
      role: 'user',
      content: 'Now add a method to XXWW class'
    }
  ],
  tools: [
    {
      type: 'function',
      function: {
        name: 'bash',
        description: 'Run a bash command. Example: rm XXWW.cs to delete the file.'
      }
    },
    {
      type: 'function',
      function: {
        name: 'write',
        description: 'Write content to a file. The XXWW.cs file is at the root.'
      }
    }
  ]
};

const result = transformRequestBody(testBody);
const stringified = JSON.stringify(result);

console.log('=== TRANSFORMED BODY ===');
console.log(JSON.stringify(result, null, 2));

console.log('\n=== LEAK CHECK ===');
const leaks = Object.keys(user2llm).filter(k => stringified.includes(k));
if (leaks.length > 0) {
  console.log('!!! LEAKS DETECTED !!!');
  for (const leak of leaks) {
    console.log(`  - "${leak}" still present`);

    const lines = stringified.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(leak)) {
        console.log(`    line ${i + 1}: ${lines[i].trim().substring(0, 150)}`);
      }
    }
  }
  process.exit(1);
} else {
  console.log('✓ NO LEAKS - all user2llm mappings successfully applied');
}
