import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { URL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_FILE = path.join(__dirname, 'minimax_raw_output.txt');

const API_KEY = process.env.MINIMAX_API_KEY || '';
const MODEL = 'MiniMax-M2.7';
const TEST_MESSAGE = 'Di hola en una oración';

if (!API_KEY) {
  console.error('Error: MINIMAX_API_KEY environment variable not set');
  process.exit(1);
}

const body = JSON.stringify({
  model: MODEL,
  messages: [{ role: 'user', content: TEST_MESSAGE }],
  stream: true
});

const url = new URL('https://api.minimax.io/v1/chat/completions');

const options = {
  hostname: url.hostname,
  port: url.port || 443,
  path: url.pathname,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Length': Buffer.byteLength(body)
  }
};

console.log('Fetching from MiniMax...');
console.log(`URL: ${options.hostname}${options.path}`);
console.log(`Model: ${MODEL}`);
console.log(`Message: "${TEST_MESSAGE}"`);
console.log(`Output will be saved to: ${OUTPUT_FILE}`);
console.log('');

const req = https.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Headers: ${JSON.stringify(res.headers, null, 2)}`);
  console.log('');
  console.log('--- RAW OUTPUT START ---');
  console.log('');

  let output = '';
  let chunkCount = 0;

  res.on('data', (chunk) => {
    chunkCount++;
    const text = chunk.toString();
    output += text;
    process.stdout.write(text);
  });

  res.on('end', () => {
    console.log('');
    console.log('--- RAW OUTPUT END ---');
    console.log('');
    console.log(`Total chunks received: ${chunkCount}`);
    console.log(`Total bytes: ${output.length}`);

    fs.writeFileSync(OUTPUT_FILE, output);
    console.log(`Raw output saved to: ${OUTPUT_FILE}`);

    console.log('');
    console.log('--- ANALYSIS ---');
    console.log('');

    const lines = output.split('\n').filter(l => l.trim() && l.startsWith('data: '));
    console.log(`SSE lines with "data:": ${lines.length}`);

    if (lines.length > 0) {
      try {
        const firstChunk = JSON.parse(lines[0].slice(6));
        console.log('First chunk keys:', Object.keys(firstChunk));
        console.log('First chunk structure:');
        console.log(JSON.stringify(firstChunk, null, 2).substring(0, 500));

        if (firstChunk.choices?.[0]?.delta) {
          console.log('');
          console.log('Delta keys:', Object.keys(firstChunk.choices[0].delta));
        }
      } catch (e) {
        console.log('Could not parse first chunk:', e.message);
      }
    }
  });
});

req.on('error', (e) => {
  console.error('Request error:', e.message);
});

req.write(body);
req.end();
