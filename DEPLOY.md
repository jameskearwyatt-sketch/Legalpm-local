# Deploying the hosted (static) build

This app is a pure static SPA — no backend. Hosting it just serves the files;
**all data still lives only in each visitor's own browser** (IndexedDB), and the
app makes no outbound network calls. So hosting is safe for confidential data.

## Build

```sh
npm install
npm run build      # outputs the static site to ./dist
```

## Easiest deploy: Netlify Drop (no account/CLI needed)

1. Run `npm run build`.
2. Go to https://app.netlify.com/drop
3. Drag the whole **`dist`** folder onto the page.
4. You get a public URL (e.g. `https://random-name.netlify.app`). Send it to testers.

The included `dist/_redirects` file makes client-side routing work (so refreshing
on a page like `/matters` won't 404).

## Alternative: Vercel

- CLI: `npm i -g vercel`, then `vercel deploy --prod ./dist`.
- Or connect the GitHub repo in the Vercel dashboard (build command `npm run build`,
  output dir `dist`). `vercel.json` already provides the SPA rewrite.

## Notes

- **Each browser is its own data store.** A tester's data does not sync to you or
  to other testers. They should use **Settings → Data Management** to back up.
- To update testers, rebuild and re-deploy (drag the new `dist` to Netlify Drop
  again, or push to the connected Git repo).
- GitHub Pages also works but needs extra setup (a `base` path for project sites
  and a 404.html SPA fallback) — Netlify/Vercel are simpler.
