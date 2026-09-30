# DocFlow

DocFlow is a browser-based Markdown editor and document conversion tool built with React, TypeScript, Vite, and CodeMirror. It supports live preview, Markdown and HTML editing, document import, rich formatting tools, bilingual document mixing, and client-side export to common document formats.

## What it does

DocFlow provides two working modes:

- **DocFlow** for editing, previewing, importing, formatting, and exporting a single document.
- **DuoFlow** for combining English and Bangla source files into an interwoven or side-by-side bilingual document.

The application processes most document operations in the browser. The current Markdown-to-PDF flow opens a print-ready preview and uses the browser print dialog.

## Features

### Editing and preview

- CodeMirror Markdown editor
- HTML editing mode
- Live rendered preview
- Desktop and mobile layouts
- Editor/preview swipe support on mobile
- Find and replace
- Undo/redo toolbar actions
- Keyboard shortcuts
- Automatic localStorage save with a 3-second debounce
- Version snapshots and diff viewer
- Copy rendered content with formatting
- Zen reading mode
- Read-aloud support
- Haptic feedback on supported devices

### Markdown formatting

The Markdown renderer is configured for:

- Headings, lists, blockquotes, links, code blocks, tables, and task lists
- Footnotes, subscript, superscript, highlights, emoji, and table extensions
- Admonition containers: `info`, `warning`, `success`, `tip`, and `danger`
- LaTeX math rendered with KaTeX
- Mermaid diagrams in `mermaid` code fences
- Function plots in `plot` code fences
- Syntax highlighting
- Table building and LaTeX insertion tools

### Import

The upload menu accepts:

| Input | Extension | Limit | Processing |
|---|---|---:|---|
| Markdown/text | `.md`, `.txt`, `.markdown` | 5 MB | Loaded and formatted as Markdown |
| Digital PDF | `.pdf` | 10 MB | Text extracted to Markdown |
| Word document | `.docx` | 10 MB | DOCX → HTML → Markdown |
| Scanned PDF | `.pdf` | 10 MB | Browser OCR using Tesseract.js |

Digital PDF extraction uses `@opendocsg/pdf2md` with a `pdfjs-dist` text-extraction fallback. Scanned PDFs use Tesseract.js OCR with English language data.

### Export

Markdown content can be downloaded as:

- `.docx`
- `.pdf`
- `.html`
- `.md`
- `.txt`
- `.docx` containing the raw Markdown source (`md-docx`)

HTML input can be exported to PDF or DOCX.

DOCX export has a native Word-math pipeline with a TurboDocx fallback. Markdown PDF export currently uses the browser's native print flow rather than the Supabase PDF function.

### DuoFlow

DuoFlow accepts separate English and Bangla content, validates structural pairing, mixes the two sources, and produces a combined Markdown document. The preview supports:

- Interwoven mode
- Side-by-side mode
- The same Markdown export formats available to the main editor

## How it works

```text
Input
  ├─ Paste / type Markdown or HTML
  ├─ Upload Markdown / PDF / DOCX / scanned PDF
  └─ DuoFlow English + Bangla files
       ↓
Formatting / extraction
       ↓
CodeMirror editor + Markdown/HTML preview
       ↓
Optional formatting tools
       ├─ LaTeX / math
       ├─ tables
       ├─ callouts
       ├─ diagrams / plots
       ├─ find & replace
       └─ version snapshots
       ↓
Export
  ├─ Markdown
  ├─ Plain text
  ├─ HTML
  ├─ DOCX
  └─ PDF via browser print
```

Content is automatically saved to browser `localStorage` under `docflow-autosave` while the main DocFlow editor is in use.

## Project structure

```text
.
├── public/                         # Static assets, PWA files, icons, robots.txt
├── src/
│   ├── components/                # Main UI components and shadcn/ui primitives
│   │   └── duoflow/               # Bilingual DuoFlow interface
│   ├── contexts/                  # App mode and DuoFlow state
│   ├── hooks/                     # Reusable React hooks
│   ├── integrations/supabase/     # Supabase client and generated database types
│   ├── lib/                       # Markdown, HTML, DOCX, PDF, OCR, math, clipboard, and utility logic
│   ├── pages/                     # Route pages
│   └── test/                      # Vitest setup and tests
├── supabase/
│   ├── config.toml                # Supabase project configuration
│   └── functions/generate-pdf/    # Edge Function for optional server-side PDF generation
├── package.json                   # Scripts and dependencies
├── package-lock.json              # npm dependency lockfile
├── bun.lock / bun.lockb           # Bun lockfiles present in the repository
├── vite.config.ts                 # Vite server and build configuration
├── tailwind.config.ts             # Tailwind configuration
├── vitest.config.ts               # Vitest configuration
├── playwright.config.ts           # Playwright configuration
└── index.html                     # Application HTML shell
```

## Requirements

- Node.js with npm. No Node.js version is pinned in `package.json`.
- A modern browser with support for the APIs used by the application, including `localStorage`, clipboard access, print dialogs, and browser speech features where applicable.
- Internet access may be required for externally hosted fonts, PDF.js worker files, KaTeX assets, and OCR runtime assets.

The repository also contains Bun lockfiles, so Bun can be used as an alternative package manager, but the documented commands below use npm because `package-lock.json` is included.

## Installation

```bash
git clone <repository-url>
cd aimarkdown-main
npm ci
```

For a fresh dependency installation without enforcing the lockfile:

```bash
npm install
```

No separate backend server is required for the main frontend application.

## Environment variables

### Frontend

The local environment file currently contains these Vite variables. The Supabase client itself reads the URL and publishable key; the project ID is also present in the repository's environment configuration.

| Variable | Purpose | Used directly by the client |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL | Yes |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable/anon key | Yes |
| `VITE_SUPABASE_PROJECT_ID` | Supabase project ID | No |

Create or update a local `.env` file when these values are needed:

```dotenv
VITE_SUPABASE_PROJECT_ID=<project-id>
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
VITE_SUPABASE_URL=https://<project-id>.supabase.co
```

The current frontend source initializes the Supabase client, but the main DocFlow/DuoFlow flows do not currently invoke a Supabase API directly.

### Supabase PDF function

The edge function at `supabase/functions/generate-pdf/index.ts` reads these server-side secrets:

| Secret | Role |
|---|---|
| `PDFBOLT_API_KEY` | Primary PDF provider |
| `HTML2PDF_APP_API_KEY` | Optional fallback provider |

The function accepts `POST` requests containing HTML and an optional filename, sanitizes the input, limits HTML/request size to 1 MB, and attempts PDFBolt first, followed by html2pdf.app. If neither provider is configured or succeeds, it returns HTTP 503.

Do not place these server-side API keys in `VITE_*` variables or client-side code.

## Development

Start the Vite development server:

```bash
npm run dev
```

The Vite configuration uses port `8080` by default.

Open the local application at:

```text
http://localhost:8080
```

Other package scripts:

```bash
npm run dev
npm run build
npm run build:dev
npm run lint
npm run preview
npm test
npm run test:watch
```

## Usage

### DocFlow

1. Open the application in DocFlow mode.
2. Enter Markdown directly, paste formatted content, or upload a supported file.
3. Use the editor toolbar for formatting, tables, math, callouts, find/replace, and related tools.
4. Switch between **Editor** and **Preview**.
5. Select an export format from the Download action.
6. For PDF export, complete the browser print dialog.

### Importing a digital PDF

1. Choose PDF upload.
2. Select a PDF with selectable text.
3. Run text extraction.
4. DocFlow cleans and formats the extracted text as Markdown.

### Importing a scanned PDF

1. Choose **Scanned PDF (OCR)**.
2. Select the PDF.
3. Run OCR extraction.
4. Wait for the per-page OCR process to complete.

OCR currently uses the English Tesseract language model.

### DuoFlow

1. Switch to DuoFlow.
2. Provide the English/source content.
3. Provide the Bangla/target content.
4. Run the mix operation.
5. Review the structural validation result.
6. Choose interwoven or side-by-side preview where needed.
7. Export the mixed Markdown content.

## Configuration

### Vite

`vite.config.ts` defines:

- Development host `::`
- Development port `8080`
- React SWC integration
- `@` path alias to `src/`
- Manual production chunks for React, editor, Markdown, export, UI, and diagram dependencies

### TypeScript

The application uses separate TypeScript configuration files for application and Node/Vite code. The main application config is intentionally non-strict.

### Tailwind

Tailwind CSS is configured with CSS variables, dark mode, custom editor/preview colors, typography settings, and animation utilities.

## PDF function deployment

The repository contains a Supabase Edge Function, but there is no GitHub Actions deployment workflow and no package script for deploying it.

When using the Supabase CLI, the function directory is:

```text
supabase/functions/generate-pdf
```

A typical Supabase CLI deployment command is:

```bash
supabase functions deploy generate-pdf
```

Set the function secrets in the Supabase project before expecting the function to generate PDFs through PDFBolt or html2pdf.app.

The current browser Markdown PDF export does not call this function. It uses the browser print flow in `src/lib/markdown-converter.ts`.

## GitHub Actions and deployment

No `.github/workflows/` directory is present in the repository, so no GitHub Actions workflow is currently defined.

The frontend is a standard Vite application with provider-specific deployment configuration included for both Netlify and Vercel. The application uses `BrowserRouter`, so both providers are configured with an SPA fallback to `index.html`.

### Netlify

`netlify.toml` defines the production build command (`npm run build`), publish directory (`dist`), Node 22, and the SPA fallback. `public/_redirects` is also included as a second fallback mechanism in the generated site.

### Vercel

`vercel.json` defines the Vite framework, production build command, `dist` output directory, `npm ci` install command, SPA fallback rewrite, and immutable caching for generated assets.

Both deployment packages include `.nvmrc` and pin the Node major version to 22.

## Testing and validation

Run the existing automated checks with:

```bash
npm test
npm run lint
npm run build
```

The repository currently contains a minimal Vitest test suite under `src/test/`. Playwright configuration is present, but there is no project-specific end-to-end test suite in the repository at this time.

For a local production preview:

```bash
npm run build
npm run preview
```

## Troubleshooting

### `npm ci` fails

Use a current Node.js/npm installation and make sure the working tree matches `package-lock.json`. If the lockfile needs to be regenerated intentionally, use `npm install` instead.

### The app does not start on the expected port

Check `vite.config.ts`. The configured development port is `8080`.

### Clipboard paste or copy does not work

Allow clipboard permissions in the browser and use a context where clipboard APIs are available.

### PDF import returns a scanned-PDF warning

Use the dedicated **Scanned PDF (OCR)** upload path for image-based PDFs. The normal PDF extractor expects selectable text.

### OCR is slow

OCR runs page by page in the browser using Tesseract.js. Processing time increases with page count and rendering resolution.

### PDF export does not produce a file

The Markdown PDF export opens a browser print window. Allow pop-ups for the site and complete the print dialog.

### Server-side PDF generation returns 503

The Supabase function requires at least one configured provider key. Check `PDFBOLT_API_KEY` first, then `HTML2PDF_APP_API_KEY`, and review the deployed function logs.

### DOCX export falls back or fails

The primary DOCX path generates Word content directly, including structured tables and math. A TurboDocx HTML conversion fallback is used if the primary pipeline fails. Check the browser console for conversion errors when diagnosing unusual Markdown input.

### Styling or external assets are missing

Some features load resources from external URLs, including Google Fonts, the SolaimanLipi font, PDF.js worker files, and KaTeX-related assets. Check network access and browser console errors.

## Maintenance

- Keep `package.json` and the lockfiles synchronized when dependency versions change.
- Run `npm test`, `npm run lint`, and `npm run build` after meaningful code changes.
- Keep Supabase function secrets out of client-side source code.
- Review the HTML sanitization paths before changing import or export behavior.
- Preserve the file-size checks for uploads and server-side PDF requests unless the limits are intentionally changed.
- Update this README when implemented user-facing behavior, scripts, environment variables, or deployment structure changes.

## Repository notes

- The repository contains both `package-lock.json` and Bun lockfiles.
- No GitHub Actions workflows are included.
- The only application route currently defined is `/`; unmatched routes render the `NotFound` page.
- The application is a client-heavy browser tool. Most conversion and extraction work happens locally in the user's browser.
