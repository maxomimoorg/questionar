<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Preserve the imported QuestionAR TanStack routes and shared app frame; the uploaded app is the product, not a replacement landing page.
- Keep profile data in the existing browser IndexedDB store and PNG/P2P transport; no hosted persistence is required for this zero-server app.
- Reuse ProfileTagChip and nextTagState in tutorial demos so the demonstrated tag states match the editor.
- Keep heading/structural brand tokens separate from primary actions; use the shared Button default variant for solid CTAs so both theme modes retain consistent action colors and glow.
- Resolve QR ink from semantic CSS tokens into a hex canvas color for the QR library; use high-contrast structural ink rather than decorative accents to preserve scanning.
- Keep original graphics in public/ and the icon-generation master and script in src/logo.png and scripts/generate-icons.mjs; local static references keep GitHub/Cloudflare Pages deployments independent of Lovable asset hosting.
- Diagnostic mode lives in src/lib/diagnostics and is a no-op unless activated; app code may only call recordEvent with allow-listed technical events, keeping user data out of reports.
