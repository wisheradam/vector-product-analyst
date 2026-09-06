import fs from 'node:fs/promises';
import path from 'node:path';

const inputPath = process.argv[2] || 'data/raw/events.csv';
const outputPath = process.argv[3] || 'data/normalized/events.json';

const text = await fs.readFile(inputPath, 'utf8');
const rows = loadRows(text, inputPath);
const normalized = rows.map(normalizeRow).filter(Boolean);

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, JSON.stringify(normalized, null, 2) + '\n', 'utf8');

console.log(`Normalized ${normalized.length} events -> ${outputPath}`);

function loadRows(text, filename) {
  const ext = path.extname(filename).toLowerCase();

  if (ext === '.json') {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed.events)) return parsed.events;
    return [parsed];
  }

  if (ext === '.ndjson' || ext === '.jsonl') {
    return text
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => JSON.parse(line));
  }

  return parseCsvObjects(text);
}

function normalizeRow(row) {
  const rawText = pick(row, 'Raw JSON', 'rawJson', 'raw');
  const raw = parseJsonMaybe(rawText) || (typeof row === 'object' ? row : {});
  const payload = firstObject(raw.data, raw.payload, raw);
  const contact = firstObject(payload.contact, raw.contact, payload.visitor, payload);
  const companyObj = firstObject(contact.company, payload.company, raw.company, {});
  const pageObj = firstObject(contact.page, payload.page, raw.page, {});
  const intentObj = firstObject(payload.intent, raw.intent, {});

  return {
    receivedAt: firstValue(
      pick(row, 'Received At', 'receivedAt'),
      raw.receivedAt,
      raw.timestamp
    ),
    eventType: firstValue(
      pick(row, 'Event Type', 'eventType'),
      raw.type,
      raw.event,
      raw.eventType,
      payload.type,
      payload.eventType
    ),
    eventId: firstValue(
      pick(row, 'Event ID', 'eventId'),
      raw.id,
      raw.eventId,
      payload.id,
      payload.eventId
    ),
    visitorId: firstValue(
      pick(row, 'Visitor ID', 'visitorId'),
      contact.vvid,
      contact.visitorId,
      payload.vvid,
      payload.visitorId,
      raw.vvid,
      raw.visitorId
    ),
    firstName: firstValue(pick(row, 'First Name', 'firstName'), contact.firstName, contact.first_name),
    lastName: firstValue(pick(row, 'Last Name', 'lastName'), contact.lastName, contact.last_name),
    email: firstValue(pick(row, 'Email', 'email'), contact.email),
    title: firstValue(pick(row, 'Job Title', 'title'), contact.title, contact.jobTitle, contact.job_title),
    company: firstValue(
      pick(row, 'Company', 'company'),
      companyObj.name,
      contact.companyName,
      typeof contact.company === 'string' ? contact.company : ''
    ),
    companyDomain: firstValue(
      pick(row, 'Company Domain', 'companyDomain'),
      companyObj.domain,
      contact.companyDomain,
      contact.company_domain
    ),
    linkedinUrl: firstValue(
      pick(row, 'LinkedIn', 'linkedinUrl'),
      contact.linkedinUrl,
      contact.linkedin,
      contact.linkedin_url
    ),
    location: stringifyValue(firstValue(pick(row, 'Location', 'location'), contact.location, payload.location, raw.location)),
    pageTitle: firstValue(
      pick(row, 'Page Title', 'pageTitle'),
      pageObj.title,
      contact.pageTitle,
      payload.pageTitle,
      raw.pageTitle
    ),
    pageUrl: firstValue(
      pick(row, 'Page URL', 'pageUrl'),
      pageObj.url,
      contact.pageUrl,
      payload.pageUrl,
      raw.pageUrl
    ),
    referrer: firstValue(
      pick(row, 'Referrer', 'referrer'),
      pageObj.referrer,
      contact.referrer,
      payload.referrer,
      raw.referrer
    ),
    lastVisitAt: firstValue(
      pick(row, 'Last Visit At', 'lastVisitAt'),
      contact.lastVisitAt,
      payload.lastVisitAt,
      raw.lastVisitAt
    ),
    intentTopic: firstValue(
      pick(row, 'Intent Topic', 'intentTopic'),
      intentObj.topic,
      intentObj.keyword,
      payload.intentTopic,
      raw.intentTopic
    ),
    intentScore: firstValue(
      pick(row, 'Intent Score', 'intentScore'),
      intentObj.score,
      payload.intentScore,
      raw.intentScore
    ),
    raw
  };
}

function parseCsvObjects(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  if (field.length || row.length) {
    row.push(field.replace(/\r$/, ''));
    rows.push(row);
  }

  if (!rows.length) return [];

  const headers = rows.shift().map((h, i) => (i === 0 ? h.replace(/^\uFEFF/, '') : h).trim());

  return rows
    .filter(values => values.some(value => value !== ''))
    .map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
}

function pick(object, ...keys) {
  if (!object || typeof object !== 'object') return '';
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(object, key)) {
      const value = object[key];
      if (value !== undefined && value !== null && value !== '') return value;
    }
  }
  return '';
}

function firstObject(...values) {
  return values.find(value => value && typeof value === 'object' && !Array.isArray(value)) || {};
}

function firstValue(...values) {
  return values.find(value => value !== undefined && value !== null && value !== '') ?? '';
}

function parseJsonMaybe(value) {
  if (!value || typeof value !== 'string') return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function stringifyValue(value) {
  if (value === undefined || value === null) return '';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}
