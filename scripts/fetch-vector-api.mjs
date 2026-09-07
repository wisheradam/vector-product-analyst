import fs from 'node:fs/promises';
import path from 'node:path';

const API_BASE_URL = 'https://api.vector.co';
const PAGE_SIZE = 100;

const apiKey = process.env.VECTOR_API_KEY?.trim();
const orgId = process.env.VECTOR_ORG_ID?.trim();

if (!apiKey) {
  throw new Error('VECTOR_API_KEY is missing. Add it to the local .env file.');
}

const { start, end } = parseArguments(process.argv.slice(2));
const startDate = israelBoundary(start, 'start');
const endDate = israelBoundary(end, 'end');
const outputPath = path.join('data', 'raw', `vector-visitors-${start}_${end}.json`);

const headers = {
  Accept: 'application/json',
  Authorization: `Bearer ${apiKey}`,
  'Content-Type': 'application/json',
};

if (orgId) headers['X-Vector-Org'] = orgId;

const visitors = [];
let offset = 0;

while (true) {
  const response = await fetch(`${API_BASE_URL}/visitors/feed`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      offset,
      limit: PAGE_SIZE,
      startDate,
      endDate,
      isRepeatedVisitor: false,
      companySearch: '',
      utmCampaignFilter: [],
      utmSourceFilter: [],
      utmMediumFilter: [],
      vectorCampaignIdFilter: [],
      isIcpFilter: false,
      sourceTypeFilter: [],
    }),
  });

  if (!response.ok) {
    const details = await safeError(response);
    throw new Error(`Vector API returned ${response.status} ${response.statusText}${details ? `: ${details}` : ''}`);
  }

  const payload = await response.json();
  const page = extractArray(payload);
  visitors.push(...page);

  if (page.length < PAGE_SIZE) break;
  offset += PAGE_SIZE;
}

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(visitors, null, 2)}\n`, 'utf8');

console.log(`Downloaded ${visitors.length} Vector visitor records.`);
console.log(`Saved locally -> ${outputPath}`);
console.log('The API key and visitor records were not printed.');

function parseArguments(args) {
  const values = new Map();

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (!argument.startsWith('--')) continue;
    values.set(argument.slice(2), args[index + 1]);
    index += 1;
  }

  const startValue = values.get('start');
  const endValue = values.get('end');

  if (!isDate(startValue) || !isDate(endValue)) {
    throw new Error('Usage: npm run fetch -- --start YYYY-MM-DD --end YYYY-MM-DD');
  }

  if (startValue > endValue) {
    throw new Error('--start must be earlier than or equal to --end.');
  }

  return { start: startValue, end: endValue };
}

function isDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function israelBoundary(date, boundary) {
  const time = boundary === 'start' ? '00:00:00.000' : '23:59:59.999';
  return `${date}T${time}+03:00`;
}

function extractArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.visitors)) return payload.visitors;
  if (Array.isArray(payload?.results)) return payload.results;
  throw new Error('Vector API returned an unexpected response shape.');
}

async function safeError(response) {
  const text = await response.text();
  if (!text) return '';

  try {
    const parsed = JSON.parse(text);
    return parsed.message || parsed.error || `response body omitted (${text.length} characters)`;
  } catch {
    return `response body omitted (${text.length} characters)`;
  }
}

