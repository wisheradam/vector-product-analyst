# Visitor Investigation Prompt

Investigate one identified visitor using only the supplied Vector event history.

## Return

### Identity
- Visitor ID
- Name, if present
- Job title, if present
- Company, if present
- LinkedIn URL, if present

### Observed Journey
List visits chronologically with:
- timestamp
- page URL
- page title
- event type
- intent signal, if present

### Derived Behavior
Calculate only when supported:
- total visits
- distinct pages
- first observed visit
- most recent observed visit
- repeat-visit status

### Interpretation
Separate:
- **Observed** facts
- **Derived** calculations
- **Hypothesis** about possible interest

### Confidence
Use HIGH / MEDIUM / LOW.

### Priority
Use P1 / P2 / P3 / P4.

Do not call the person a lead, prospect, buyer, decision-maker, or customer unless another trusted source explicitly establishes that status.
