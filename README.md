# Vector Product Analyst

AI-assisted website visitor and account-intent analytics pipeline for **Vector.co**.

The project turns Vector webhook events into a repeatable weekly Product / Marketing / Sales intelligence report while keeping production visitor data outside GitHub.

## Goal

Vector can identify website visitors and companies and emit events such as visits and intent signals. The goal of this project is to transform those raw events into useful weekly insights:

```text
innova.co
   ↓
Vector Pixel
   ↓
Vector.co
   ↓
Webhook events
   ↓
Google Apps Script
   ↓
Google Sheets (private event history)
   ↓
Normalization & weekly comparison
   ↓
AI-assisted analysis
   ↓
Vector Weekly Product Report
```

The workflow is designed to answer:

- Who visited the website?
- Which companies are showing repeated interest?
- Which pages attract identified visitors?
- Which visitors returned during the week?
- Which accounts show stronger intent signals?
- What changed compared with the previous week?
- Which people or companies may deserve Sales follow-up?

## Events

The collector is designed for Vector webhook events such as:

- `contact.visited`
- `visitor.identified`
- `contact.intentDetected`

`general.heartbeat` is not required for the weekly analytics workflow.

## Weekly report

When the underlying data contains the required fields, the report can include:

- Identified visitors
- Unique visitors
- Unique companies
- New vs returning visitors
- Repeat visitors
- Top companies
- Top job titles / roles
- Most-viewed pages
- Intent signals
- High-interest / repeat visitors
- Week-over-week changes
- Accounts worth investigating

Unavailable metrics must be omitted rather than inferred.

## Evidence model

The analysis separates three types of statements:

### Observed
Facts directly present in Vector / webhook data.

### Derived
Simple calculations based on observed data, such as unique company counts or visits per visitor.

### Hypothesis
Possible business interpretation of observed behavior. A hypothesis must never be presented as fact.

## Repository structure

```text
vector-product-analyst/
├── apps-script/
│   ├── Code.gs
│   └── README.md
├── data/
│   ├── raw/
│   ├── normalized/
│   └── history/
├── prompts/
│   ├── weekly-analysis.md
│   ├── visitor-investigation.md
│   └── account-investigation.md
├── reports/
├── scripts/
│   ├── normalize-vector.mjs
│   ├── compare-history.mjs
│   └── generate-report.mjs
├── .gitignore
├── package.json
└── README.md
```

## Privacy and security

This repository contains **code only**.

Do not commit:

- Visitor names
- Email addresses
- LinkedIn URLs
- Company-level visitor histories
- Raw webhook payloads
- Google Sheet IDs
- Webhook secrets
- Production endpoint URLs containing authentication tokens

Production visitor data should remain in the approved company Google Workspace or another approved private data store.

The Apps Script collector supports a webhook secret stored in **Script Properties** so the secret never needs to be committed to GitHub.

## Status

- [x] Vector webhook endpoint design
- [x] Google Apps Script collector
- [x] Private Google Sheets event storage
- [x] Repository scaffold
- [ ] Validate first real Vector webhook payload
- [ ] Finalize normalization mapping
- [ ] Build weekly comparison
- [ ] Generate first weekly report
- [ ] Automate weekly report delivery

## Author

**Adam Wisher**

Product Management · AI-assisted Analytics · Digital Transformation
