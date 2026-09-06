import fs from 'node:fs/promises';
import path from 'node:path';

const currentPath = process.argv[2] || 'data/normalized/events-current.json';
const previousPath = process.argv[3] || 'data/normalized/events-previous.json';
const outputPath = process.argv[4] || 'data/history/comparison.json';

const [current, previous] = await Promise.all([
  readEvents(currentPath),
  readEvents(previousPath)
]);

const currentSummary = summarize(current);
const previousSummary = summarize(previous);

const previousVisitors = new Set(previous.map(identityKey).filter(Boolean));
const currentVisitors = new Set(current.map(identityKey).filter(Boolean));
const newVisitors = [...currentVisitors].filter(id => !previousVisitors.has(id));
const returningVisitors = [...currentVisitors].filter(id => previousVisitors.has(id));

const comparison = {
  generatedAt: new Date().toISOString(),
  current: currentSummary,
  previous: previousSummary,
  visitorStatus: {
    newVisitors: newVisitors.length,
    returningVisitors: returningVisitors.length
  },
  wow: {
    identifiedVisitsPct: percentChange(currentSummary.identifiedVisits, previousSummary.identifiedVisits),
    uniqueVisitorsPct: percentChange(currentSummary.uniqueVisitors, previousSummary.uniqueVisitors),
    uniqueCompaniesPct: percentChange(currentSummary.uniqueCompanies, previousSummary.uniqueCompanies),
    intentEventsPct: percentChange(currentSummary.intentEvents, previousSummary.intentEvents)
  }
};

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, JSON.stringify(comparison, null, 2) + '\n', 'utf8');

console.log(`Comparison written -> ${outputPath}`);

async function readEvents(filename) {
  const parsed = JSON.parse(await fs.readFile(filename, 'utf8'));
  if (!Array.isArray(parsed)) throw new Error(`${filename} must contain a JSON array`);
  return parsed;
}

function summarize(events) {
  const visits = events.filter(event => event.eventType === 'contact.visited');
  const intents = events.filter(event => event.eventType === 'contact.intentDetected');
  const visitors = new Set(events.map(identityKey).filter(Boolean));
  const companies = new Set(events.map(companyKey).filter(Boolean));

  const visitCountByVisitor = countBy(visits, identityKey);
  const repeatVisitors = [...visitCountByVisitor.values()].filter(count => count >= 2).length;

  return {
    totalEvents: events.length,
    identifiedVisits: visits.length,
    uniqueVisitors: visitors.size,
    uniqueCompanies: companies.size,
    repeatVisitors,
    intentEvents: intents.length,
    topCompanies: topCounts(visits, companyKey, 10),
    topPages: topCounts(visits, event => event.pageUrl || event.pageTitle || '', 10),
    topRoles: topCounts(events, event => event.title || '', 10)
  };
}

function identityKey(event) {
  return normalize(event.visitorId) || normalize(event.email);
}

function companyKey(event) {
  return normalize(event.companyDomain) || normalize(event.company);
}

function normalize(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function countBy(items, keyFn) {
  const counts = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

function topCounts(items, keyFn, limit) {
  return [...countBy(items, keyFn).entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }));
}

function percentChange(current, previous) {
  if (previous === 0) return current === 0 ? 0 : null;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}
