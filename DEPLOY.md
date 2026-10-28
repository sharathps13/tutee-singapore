# Deploying the Singapore page to Netlify

## What's in this folder

| File | What it is |
|---|---|
| `index.html` | The Study in Singapore landing page (served at `/`) |
| `institutions.html` | The universities and institutions page |
| `assets/css/sg-*.css`, `assets/js/sg-*.js` | The page styles and scripts. There are no inline scripts, so the strict security policy in `netlify.toml` works unchanged |
| `assets/img/hero/hero-<day|night>-*.mp4`, `.webp` | The hero's looped videos, Jewel's Rain Vortex (light mode) and the Supertree Grove at night (dark mode), at 1920 and 1280 px, with their first-frame stills; made by `_source/hero/make_hero_video.py` (credited in the footer) |
| `assets/fonts/*.woff2` | Self-hosted fonts: Fraunces, Quicksand and JetBrains Mono. No Google Fonts calls are made |
| `_redirects` | Sends the old `/universities.html` and `/tutee-singapore-landing.html` to the new pages |
| `netlify/functions/enquiry.mjs` | Receives the consultation form and the Tutee AI callback requests at `/api/enquiry` and forwards each lead to the shared Apps Script (the same copy as the Finland and New Zealand sites; only the fallback country differs) |
| `apps-script/` | A reference copy of the shared Apps Script web app (`Code.gs`) and how it is set up (`README.md`) |
| `supabase/leads.sql` | Optional: SQL for a Supabase `leads` table, if `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are ever set |

There is no build step: Netlify publishes the folder as it is.

## How a lead travels

```
consultation form / Tutee AI chat → /api/enquiry (this site) → Apps Script web app → "Singapore Leads" tab + email
```

- The page only ever posts to its own `/api/enquiry`. The Apps Script URL and this site's token live in Netlify's
  environment, so they never reach the browser or this repo. `netlify.toml` has **no** redirect for `/api/enquiry`:
  the function claims that path itself.
- The script adds a row to the **Singapore Leads** tab of the **Website Leads** sheet (Date, Time, Full Name, Phone
  Number, Email, State, Shortlisted Universities, Course, Lead Source, Preferred Call Time) and emails a formatted
  summary to business@tuteeconnect.com with Reply-To set to the student and the subject `New Singapore Lead – <name>`.
- Lead Source reads `Singapore Landing Page – Consultation form` or `Singapore Landing Page – Tutee AI chat`, plus
  any campaign tags, e.g. `(google / cpc / sg-oct)`.
- If the script can't be reached, the function emails the lead through Resend instead (when `RESEND_API_KEY` is
  set): one email per lead, never two. If neither works the visitor sees "We could not send your enquiry right now",
  and nothing is marked as sent.

## Netlify environment variables

| Key | Value | Scopes |
|---|---|---|
| `APPS_SCRIPT_URL` | the same `/exec` URL as the Finland site | all deploy contexts |
| `APPS_SCRIPT_TOKEN` | this site's own token, saved as `LEADS_TOKEN_SINGAPORE` in the script (mark as secret) | Production, Deploy Previews |
| `SITE_COUNTRY` | `Singapore` | all deploy contexts |
| `RESEND_API_KEY` | optional: the fallback email, if you use Resend | Production |

Variables only apply to new deploys, so trigger one after changing them. Setting up the token in the script is in
[`apps-script/README.md`](apps-script/README.md).

## Check it works

1. Open `https://<your-site>/api/enquiry` in a browser. It should show `"sheet_configured": true` and
   `"country": "Singapore"`.
2. Send one test enquiry through the consultation pass and one through Tutee AI ("Request a callback").
3. Both appear in the **Singapore Leads** tab and arrive at business@tuteeconnect.com.

## How the form behaves

- Email and phone are checked as the visitor types or leaves a field (Indian mobiles: 10 digits starting 6–9;
  elsewhere 7–15 digits); name, state and level are required. The server re-checks everything, whatever the
  browser sent.
- A hidden honeypot field drops bot submissions.
- Visitors can heart institutions on either page. The list (in their order of preference) travels with the form as
  `shortlist`.
- After a successful submit the pass shows "Form completed" instead of the form, remembered in this browser for 30
  days; "+ Submit another enquiry" brings back a fresh form.

## Test before going live

Create `.env.local` in this folder (it is in `.gitignore`, so it is never committed) with the same values as Netlify:

```
APPS_SCRIPT_URL=https://script.google.com/macros/s/.../exec
APPS_SCRIPT_TOKEN=this site's own token
SITE_COUNTRY=Singapore
```

Run `node _source/dev/form-test-server.mjs`, open http://localhost:8888, and send a test enquiry. A row appears in
the Singapore Leads tab and the email arrives at business@tuteeconnect.com.
