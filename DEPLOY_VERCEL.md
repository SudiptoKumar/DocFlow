# Vercel deployment

This package is configured for a Vite + React SPA on Vercel.

- Framework: Vite
- Install command: `npm ci`
- Build command: `npm run build`
- Output directory: `dist`
- Node: 22 via `engines` and `.nvmrc`
- SPA fallback: configured in `vercel.json`

The included `.env` contains the client-side Vite/Supabase configuration used by the current project. For production, the same `VITE_*` variables can be set in Vercel Project Settings instead.
