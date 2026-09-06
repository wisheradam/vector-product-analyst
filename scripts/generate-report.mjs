import fs from 'node:fs/promises';
import path from 'node:path';

const currentPath = process.argv[2] || 'data/normalized/events-current.json';
const previousPath = process.argv[3] || '';
const outputPath = process.argv[4] || 'reports/vector-weekly-report.md';

const current = await readEvents(currentPath);
const previous = previousPath ? await readEvents(previousPath) : [];

const currentSummary = summarize(current);
const previousSummary = previous.length ? summarize(previous) : null;
const previousVisitors = new Set(previous.map(identityKey).filter(Boolean));
const currentVisitorGroups = groupBy(current.filter(e => e.eventType === 'contact.visited'), identityKey);
const companyGroups = groupBy(current.filter(e => e.eventType === 'contact.visited'), companyKey);

const report = [];
report.push('# Vector Weekly Product & Visitor Report');
report.push('');
report.push(`Generated: ${new Date().toISOString()}`);
report.push('');
report.push('## Executive Summary');
report.push('');
report.push(summarySentence(currentSummary, previousSummary));
report.push('');
report.push('## Core Metrics');
report.push('');
report.push('| Metric | This week | Previous week | WoW |');
report.push('|---|---:|---:|---:|');
addMetric(report, 'Identified visits', currentSummary.identifiedVisits, previousSummary?.identifiedVisits);
addMetric(report, 'Unique visitors', currentSummary.uniqueVisitors, previousSummary?.uniqueVisitors);
addMetric(report, 'Unique companies', currentSummary.uniqueCompanies, previousSummary?.uniqueCompanies);
addMetric(report, 'Repeat visitors', currentSummary.repeatVisitors, previousSummary?.repeatVisitors);
addMetric(report, 'Intent events', currentSummary.intentEvents, previousSummary?.intentEvents);

if (previous.length) {
  const currentIds = new Set(current.map(identityKey).filter(Boolean));
  const returning = [...currentIds].filter(id => previousVisitors.has(id)).length;
  const fresh = [...currentIds].filter(id => !previousVisitors.has(id)).length;
  report.push('');
  report.push(`New visitors vs previous week: **${fresh}**`);
  report.push(`Returning visitors from previous week: **${returning}**`);
}

report.push('');
report.push('## Top Companies');
report.push('');
report.push('| Company | Visits | Visitors | Distinct pages |');
report.push('|---|---:|---:|---:|');
for (const [key, events] of topGroups(companyGroups, 10)) {
  report.push(`| ${escapeCell(displayCompany(events, key))} | ${events.length} | ${unique(events.map(identityKey)).length} | ${unique(events.map(e => e.pageUrl || e.pageTitle).filter(Boolean)).length} |`);
}

report.push('');
report.push('## Top Roles');
report.push('');
report.push('| Job title / role | Identified visitors |');
report.push('|---|---:|');
for (const item of currentSummary.topRoles) {
  report.push(`| ${escapeCell(item.key)} | ${item.count} |`);
}

report.push('');
report.push('## Top Pages');
report.push('');
report.push('| Page | Visits | Unique visitors | Companies |');
report.push('|---|---:|---:|---:|');
for (const [key, events] of topGroups(groupBy(current.filter(e => e.eventType === 'contact.visited'), e => e.pageUrl || e.pageTitle || ''), 10)) {
  report.push(`| ${escapeCell(key)} | ${events.length} | ${unique(events.map(identityKey).filter(Boolean)).length} | ${unique(events.map(companyKey).filter(Boolean)).length} |`);
}

report.push('');
report.push('## Repeat Visitors');
report.push('');
const repeat = [...currentVisitorGroups.entries()]
  .filter(([key, events]) => key && events.length >= 2)
  .sort((a, b) => b[1].length - a[1].length);

if (!repeat.length) {
  report.push('No repeat visitors can be established from the available visitor identifiers.');
} else {
  for (const [, events] of repeat.slice(0, 15)) {
    const sample = events[0];
    const pages = unique(events.map(e => e.pageUrl || e.pageTitle).filter(Boolean));
    report.push(`- **${displayVisitor(sample)}** — ${events.length} visits, ${pages.length} distinct pages${sample.company ? `, ${sample.company}` : ''}.`);
  }
}

report.push('');
report.push('## Follow-up Candidates');
report.push('');
const candidates = buildCandidates(currentVisitorGroups, current);
if (!candidates.length) {
  report.push('No candidates met the rule-based follow-up criteria in the available data.');
} else {
  for (const candidate of candidates.slice(0, 15)) {
    report.push(`- **${candidate.label}** — ${candidate.reasons.join('; ')}. ${candidate.priority}.`);
  }
}

report.push('');
report.push('## Data Limitations');
report.push('');
report.push('- Metrics are calculated only from the supplied Vector webhook event history.');
report.push('- A page visit is not proof of purchase intent.');
report.push('- Missing visitor IDs, company fields, page URLs, or intent fields reduce the corresponding metrics.');
report.push('- Follow-up candidates are rule-based investigation suggestions, not confirmed leads.');

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, report.join('\n') + '\n', 'utf8');
console.log(`Report written -> ${outputPath}`);

async function readEvents(filename) {
  const parsed = JSON.parse(await fs.readFile(filename, 'utf8'));
  if (!Array.isArray(parsed)) throw new Error(`${filename} must contain a JSON array`);
  return parsed;
}

function summarize(events) {
  const visits = events.filter(e => e.eventType === 'contact.visited');
  const visitors = unique(events.map(identityKey).filter(Boolean));
  const companies = unique(events.map(companyKey).filter(Boolean));
  const groupedVisitors = groupBy(visits, identityKey);

  return {
    totalEvents: events.length,
    identifiedVisits: visits.length,
    uniqueVisitors: visitors.length,
    uniqueCompanies: companies.length,
    repeatVisitors: [...groupedVisitors.entries()].filter(([key, list]) => key && list.length >= 2).length,
    intentEvents: events.filter(e => e.eventType === 'contact.intentDetected').length,
    topRoles: topCount(events, e => e.title || '', 10)
  };
}

function buildCandidates(visitorGroups, events) {
  const intentIds = new Set(events.filter(e => e.eventType === 'contact.intentDetected').map(identityKey).filter(Boolean));
  const candidates = [];

  for (const [id, visits] of visitorGroups.entries()) {
    if (!id) continue;
    const pages = unique(visits.map(e => e.pageUrl || e.pageTitle).filter(Boolean));
    const reasons = [];

    if (visits.length >= 2) reasons.push(`${visits.length} repeat visits`);
    if (pages.length >= 3) reasons.push(`${pages.length} distinct pages`);
    if (pages.some(page => /contact|quote|request|demo/i.test(page))) reasons.push('visited a contact/request/quote page');
    if (intentIds.has(id)) reasons.push('Vector intent event present');

    if (!reasons.length) continue;

    const signalCount = reasons.length;
    candidates.push({
      label: displayVisitor(visits[0]),
      reasons,
      priority: signalCount >= 3 ? 'P1' : signalCount >= 2 ? 'P2' : 'P3',
      score: signalCount * 100 + visits.length
    });
  }

  return candidates.sort((a, b) => b.score - a.score);
}

function summarySentence(current, previous) {
  let text = `Observed ${current.identifiedVisits} identified visits from ${current.uniqueVisitors} unique visitors across ${current.uniqueCompanies} companies.`;
  if (previous) {
    text += ` Previous week: ${previous.identifiedVisits} identified visits, ${previous.uniqueVisitors} visitors, ${previous.uniqueCompanies} companies.`;
  }
  return text;
}

function addMetric(lines, label, current, previous) {
  const previousText = previous === undefined || previous === null ? '—' : String(previous);
  const wow = previous === undefined || previous === null ? '—' : formatChange(current, previous);
  lines.push(`| ${label} | ${current} | ${previousText} | ${wow} |`);
}

function formatChange(current, previous) {
  if (previous === 0) return current === 0 ? '0%' : 'new';
  const value = ((current - previous) / previous) * 100;
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
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

function groupBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

function topGroups(map, limit) {
  return [...map.entries()]
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .slice(0, limit);
}

function topCount(items, keyFn, limit) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    map.set(key, (map.get(key) || 0) + 1);
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }));
}

function displayVisitor(event) {
  const name = [event.firstName, event.lastName].filter(Boolean).join(' ').trim();
  return name || event.email || event.visitorId || 'Unknown visitor';
}

function displayCompany(events, key) {
  const named = events.find(e => e.company)?.company;
  return named || key;
}

function unique(values) {
  return [...new Set(values)];
}

function escapeCell(value) {
  return String(value || '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}
