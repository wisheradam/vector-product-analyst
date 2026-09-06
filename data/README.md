# Data directories

Production Vector visitor data is intentionally excluded from GitHub.

- `raw/` — private exports or webhook-derived source data used locally for processing
- `normalized/` — normalized event JSON generated from raw exports
- `history/` — week-over-week comparison artifacts

The `.gitignore` rules keep these directories empty in the public repository except for `.gitkeep` placeholders.

Do not remove those privacy rules unless the repository is moved to an approved private company environment and the data-governance requirements are reviewed.
