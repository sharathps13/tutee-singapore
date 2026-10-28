# Website Leads — Google Sheets + email

Every enquiry from the Singapore page (the consultation pass and the Tutee AI chat) is added as a row to the
**Singapore Leads** tab of the **Website Leads** spreadsheet. It is also emailed, formatted as a table, to
business@tuteeconnect.com with Reply-To set to the student and the subject `New Singapore Lead – <name>`.

```
form / chat → /api/enquiry (netlify/functions/enquiry.mjs) → Apps Script web app → Singapore Leads tab + email
```

This is the **same Apps Script web app the Finland and New Zealand sites use**: it is already deployed, so nothing
needs creating here. [`Code.gs`](Code.gs) is a reference copy of it. The script makes the `Singapore Leads` tab
(header row formatted, frozen and filterable) the first time a Singapore lead arrives.

The browser only ever talks to the site's own `/api/enquiry`. The web-app URL and this site's token live in
Netlify's environment, so they never appear in the page source or this repo.

## Columns

Date · Time · Full Name · Phone Number · Email · State · Shortlisted Universities · Course · Lead Source ·
Preferred Call Time

- **Date / Time**: India time (IST) when the lead arrives.
- **Course**: study level, subject and start, e.g. `Master's degree – Data Science (Next intake)`.
- **Lead Source**: `Singapore Landing Page – Consultation form` (or `– Tutee AI chat`), plus any campaign tags,
  e.g. `(google / cpc / sg-oct)`.
- **Shortlisted Universities**: the institutions the visitor hearted on the page, in their order.

## Netlify environment variables (this site)

| Key | Value | Scopes |
|---|---|---|
| `APPS_SCRIPT_URL` | the same `/exec` URL as the Finland site | all deploy contexts |
| `APPS_SCRIPT_TOKEN` | this site's own token: the value saved as `LEADS_TOKEN_SINGAPORE` in the script (mark as secret) | Production, Deploy Previews |
| `SITE_COUNTRY` | `Singapore` | all deploy contexts |

Then **Deploys → Trigger deploy**. Check `https://<your-site>/api/enquiry` in a browser: it should show
`"sheet_configured": true` and `"country": "Singapore"`.

## Tokens

The script accepts a separate token per country, saved in its Script Properties as `LEADS_TOKEN_<COUNTRY>`
(Singapore: `LEADS_TOKEN_SINGAPORE`, set with `setSingaporeToken()`). Once a country has its own token, only that
token is accepted for its leads and it cannot write into another country's tab. Countries without one (Finland)
keep using the shared `LEADS_TOKEN`. Run `checkTokens()` in the editor to see which is which.

## Fallback

If the script can't be reached or rejects the token, the function emails the lead through Resend instead (needs
`RESEND_API_KEY`), so there is one email per lead, never two. The Netlify function log records `apps script failed`.
