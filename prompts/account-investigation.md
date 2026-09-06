# Account Investigation Prompt

Investigate one company using only the supplied Vector event history.

## Return

### Company
- Company name
- Company domain, if present

### Observed People
List identified visitors from the company with:
- name / visitor ID
- job title
- number of visits
- distinct pages
- most recent visit

### Observed Interest
Summarize:
- total identified visits
- distinct identified visitors
- distinct pages
- page categories when evident from URLs/titles
- Vector intent events, if present

### Week-over-Week
If both periods are supplied, compare:
- visitors
- visits
- distinct pages
- intent events

### Interpretation
Separate:
- **Observed** facts
- **Derived** calculations
- **Hypothesis** about possible account interest

### Confidence
Use HIGH / MEDIUM / LOW.

### Priority
Use P1 / P2 / P3 / P4.

Never claim purchase intent solely from a page visit. A Vector intent event must be labeled as a Vector-provided signal, not independent proof of buying intent.
