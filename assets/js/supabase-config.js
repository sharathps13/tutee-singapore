/* Supabase configuration for the Singapore site.
 *
 * Both values below are PUBLIC by design — the anon key is the one browsers
 * use, and under RLS it can read the `universities` table and nothing else. It
 * cannot see a single lead. Never put the service_role key here; that one lives
 * only in the Netlify environment, server-side.
 *
 * While these are empty the site simply uses the dataset bundled in
 * universities-data.js, so it deploys and works before Supabase exists. Fill
 * them in to switch the directory over to live data.
 *
 *   Supabase dashboard -> Project Settings -> API
 *     url     = Project URL
 *     anonKey = Project API keys -> anon / public
 */
window.TC_SUPABASE = {
  country: 'Singapore',
  url: '',
  anonKey: '',
};
