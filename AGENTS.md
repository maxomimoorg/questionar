<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

- Preserve the imported QuestionAR TanStack routes and shared app frame; the uploaded app is the product, not a replacement landing page.
- Keep profile data in the existing browser IndexedDB store and PNG/P2P transport; no hosted persistence is required for this zero-server app.
- Reuse ProfileTagChip and nextTagState in tutorial demos so the demonstrated tag states match the editor.
- Keep heading/structural brand tokens separate from primary actions; use the shared Button default variant for solid CTAs so both theme modes retain consistent action colors and glow.
- Resolve QR ink from semantic CSS tokens into a hex canvas color for the QR library; use high-contrast structural ink rather than decorative accents to preserve scanning.
- Keep original graphics in public/ and the icon-generation master and script in src/logo.png and scripts/generate-icons.mjs; local static references keep GitHub/Cloudflare Pages deployments independent of Lovable asset hosting.
- Diagnostic mode lives in src/lib/diagnostics and is a no-op unless activated; app code may only call recordEvent with allow-listed technical events, keeping user data out of reports.
- The app version comes only from package.json, injected as VITE_APP_VERSION by vite.config.ts (and vitest.config.ts); never hardcode it in source.
- Everything sent or saved as ProfileSnapshot passes through sanitizeSnapshot in src/lib/types.ts; address-book data such as Contact.favorite must stay local and never enter snapshots, P2P messages or backups.
- Default question ids are derived from their original text; a reworded question keeps it via `legacy` in src/lib/questions.ts, so saved answers and older peers keep matching.
- Reciprocal (Fare/Ricevere) questions are flagged only in src/lib/questions.ts and looked up by id in compat; giveOf/receiveOf fall back to `value` only when neither side is set and return undefined for an unanswered side of a partial answer, and `value` stays the mean of the known sides, so single-value answers and older app versions remain compatible. Partial results go through the *Detail compat functions (score + partial flag) and are shown with formatCompat, so every total marks estimates the same way.
- Fonts ship via @fontsource imports at the top of src/styles.css, never remote font links, so startup needs no third-party network.
- Only src/lib/sw-register.ts registers /sw.js, refusing dev, iframes, Lovable preview hosts and ?sw=off; navigations stay network-first with a timeout fallback so cached pages never reference deleted build chunks.
