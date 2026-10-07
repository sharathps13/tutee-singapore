# Deploying the Singapore page to Netlify (with Supabase)

## What's in this folder

| File | What it is |
|---|---|
| `index.html` | The Study in Singapore landing page (served at `/`) |
| `institutions.html` | The universities and institutions page |
| `assets/css/sg-*.css`, `assets/js/sg-*.js` | The page styles and scripts. There are no inline scripts, so the strict security policy in `netlify.toml` works unchanged |
| `assets/fonts/*.woff2` | Self-hosted fonts: Fraunces, Quicksand and JetBrains Mono. No Google Fonts calls are made |
| `_redirects` | Sends the old `/universities.html` and `/tutee-singapore-landing.html` to the new pages |
| `netlify/functions/enquiry.mjs` | Unchanged. It receives the form, saves the lead in Supabase, then emails it |
| `supabase/leads.sql` | One-time SQL that creates the `leads` table the function writes to |

`netlify.toml` is unchanged. There is no build step: Netlify publishes the folder as it is.

## 1. Netlify

1. Push this folder to the GitHub repo, then in Netlify choose **Add new site, then Import an existing project** and pick the repo.
2. Leave the build command empty and set the publish directory to `.`. `netlify.toml` already sets both.
3. Go to **Site configuration, then Environment variables**, and add:

| Variable | Value |
|---|---|
| `SITE_COUNTRY` | `Singapore` |
| `SUPABASE_URL` | `https://owjioobpcdipxnkpanyg.supabase.co` (Supabase, then Project Settings, then API) |
| `SUPABASE_SERVICE_ROLE_KEY` | The **service_role** key from the same page. This one is secret: never put it in a page or a commit |
| `RESEND_API_KEY` | Your Resend key, which starts with `re_`. Needed for the email alert to business@tuteeconnect.com |
| `MAIL_FROM` | Optional, e.g. `Tutee Connect Website <enquiries@tuteeconnect.com>`. Its domain must be verified in Resend |

4. Redeploy so the function picks up the variables. Variables only apply to new deploys.

## 2. Supabase

1. Go to **Supabase, then SQL Editor, then New query**, paste the contents of `supabase/leads.sql`, and click **Run**.
   - It is safe to run again. It only creates what is missing.
2. This creates:
   - **`public.leads`**: every form submission, from every country page.
   - **`public.leads_singapore`**: a view of the Singapore leads, with the form's extra answers as their own columns (study level, call slot, country, note).
3. Row Level Security is on with no public policies. The public anon key used by the website cannot read leads. Only the Netlify function, which uses the service role key, can write them, and you see them in the Supabase dashboard.

## 3. Check it works

1. Open `https://<your-site>.netlify.app/api/enquiry` in a browser. You should see `"supabase_configured": true` and `"resend_configured": true`.
2. Fill in the form on the live page with test details.
3. In Supabase, run `select * from public.leads_singapore limit 5;`. Your test row should be there.
4. Check the business@tuteeconnect.com inbox for the email.

## What one submission looks like in `leads`

```
country      Singapore
name         Test Student
email        test@example.com
phone        +91 9876543210
destination  Singapore
source       Tutee Connect Singapore
page         <your-domain>/
extras       {"study_level":"Bachelor's degree","call_slot":"Evening, 4–8pm",
              "origin_city":"India","description":"Interested in NUS computing"}
status       new
```

## How the form behaves

- If Supabase saves the lead but the email fails, the student still sees "reserved". The lead is safe, and the failure shows in the Netlify function log.
- If both fail, the student sees an error asking them to try again or WhatsApp +91 73583 64959.
- A hidden honeypot field drops bot submissions.
- The server re-checks every field, whatever the browser sent.
