# Google Apps Script collector

`Code.gs` is the webhook receiver between Vector.co and a private Google Sheet.

## Setup

1. Create a Google Apps Script project in the approved company Google Workspace.
2. Replace the default code with `Code.gs`.
3. Open **Project Settings → Script properties**.
4. Add `VECTOR_WEBHOOK_SECRET` with a strong random value.
5. Optional: add `VECTOR_SHEET_ID` if you want to use an existing private spreadsheet. If omitted, the script creates `Vector Website Analytics Data` automatically on the first accepted event.
6. Deploy the script as a **Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
7. In Vector, configure the endpoint as:

```text
https://script.google.com/macros/s/DEPLOYMENT_ID/exec?token=YOUR_SECRET
```

Do not commit the real deployment URL or secret to this repository.

## Recommended Vector events

- `contact.visited`
- `visitor.identified`
- `contact.intentDetected`

`general.heartbeat` is intentionally excluded from the analytics collector.

## Storage

The sheet `Events` contains normalized columns plus the original raw JSON payload. The raw JSON is preserved because Vector payload fields may evolve and the normalization mapping should be validated against real production events.

## Security notes

The Web app is publicly reachable because Vector must be able to POST to it. Access is therefore protected with a secret query parameter stored only in Apps Script Script Properties.

Rotate the secret if the endpoint URL is exposed. Never place production visitor data, the sheet ID, or the secret in GitHub.
