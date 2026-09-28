import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as ammonia from "https://deno.land/x/ammonia@0.3.1/mod.ts";

// Initialize ammonia (WASM-based HTML sanitizer)
await ammonia.init();

// Configuration
const MAX_HTML_SIZE = 1024 * 1024; // 1MB max HTML size
const MAX_FILENAME_LENGTH = 255;
const ALLOWED_ORIGINS = [
  'https://aidocflow.lovable.app',
  'https://id-preview--a4428561-76e8-4497-a404-11b28204503a.lovable.app',
];

// Dynamic CORS based on origin
function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = origin && (
    ALLOWED_ORIGINS.includes(origin) ||
    origin.endsWith('.lovable.app') ||
    // Lovable dev/preview domains
    origin.endsWith('.lovableproject.com')
  )
    ? origin
    : ALLOWED_ORIGINS[0];
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

// Sanitize HTML to prevent XSS and remove dangerous elements
function sanitizeHtml(html: string): string {
  // Use ammonia to clean the HTML - it removes script tags and dangerous attributes by default
  const cleaned = ammonia.clean(html);
  
  // Additional safety: remove any remaining event handlers and dangerous patterns
  return cleaned
    .replace(/on\w+\s*=/gi, '') // Remove any remaining event handlers
    .replace(/javascript:/gi, '') // Remove javascript: URLs
    .replace(/data:/gi, 'data-blocked:'); // Block data: URLs
}

// Validate and sanitize filename
function sanitizeFilename(filename: string): string {
  // Remove path traversal attempts and invalid characters
  const sanitized = filename
    .replace(/[\/\\:*?"<>|]/g, '_')
    .replace(/\.\./g, '_')
    .slice(0, MAX_FILENAME_LENGTH);
  
  // Ensure it ends with .pdf
  return sanitized.endsWith('.pdf') ? sanitized : `${sanitized}.pdf`;
}

serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await req.text();
    
    // Validate request body size
    if (body.length > MAX_HTML_SIZE) {
      console.warn('Request rejected: HTML content too large', { size: body.length });
      return new Response(
        JSON.stringify({ error: 'Content too large. Maximum size is 1MB.' }),
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { html, filename = 'document.pdf' } = JSON.parse(body);

    if (!html || typeof html !== 'string') {
      return new Response(
        JSON.stringify({ error: 'HTML content is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate HTML size
    if (html.length > MAX_HTML_SIZE) {
      console.warn('Request rejected: HTML content too large', { size: html.length });
      return new Response(
        JSON.stringify({ error: 'HTML content too large. Maximum size is 1MB.' }),
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sanitize inputs
    const sanitizedHtml = sanitizeHtml(html);
    const sanitizedFilename = sanitizeFilename(filename);

    // Full HTML document with print-optimized styling
    const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap">
  <style>
    @font-face {
      font-family: 'SolaimanLipi';
      src: url('https://fonts.maateen.me/solaiman-lipi/SolaimanLipi.woff2') format('woff2');
      font-weight: normal;
      font-style: normal;
      font-display: swap;
    }
    @page {
      size: A4;
      margin: 12.7mm;
    }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Plus Jakarta Sans', 'SolaimanLipi', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 12pt;
      line-height: 1.7;
      color: #1a1a2e;
      background: #ffffff;
      padding: 0;
      max-width: 100%;
    }
    h1, h2, h3, h4, h5, h6 {
      font-family: 'Plus Jakarta Sans', 'SolaimanLipi', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin-top: 1.5em;
      margin-bottom: 0.75em;
      line-height: 1.3;
      color: #0d1b2a;
      page-break-after: avoid;
    }
    h1 { font-size: 24pt; border-bottom: 2px solid #1a1a2e; padding-bottom: 8px; }
    h2 { font-size: 18pt; border-bottom: 1px solid #ccc; padding-bottom: 6px; }
    h3 { font-size: 14pt; }
    h4 { font-size: 12pt; }
    p { margin-bottom: 1em; text-align: justify; }
    ul, ol { margin: 1em 0; padding-left: 2em; }
    li { margin-bottom: 0.5em; }
    blockquote {
      margin: 1.5em 0;
      padding: 15px 20px;
      border-left: 4px solid #4a5568;
      background: #f8f9fa;
      font-style: italic;
      color: #4a5568;
    }
    code {
      font-family: 'Courier New', monospace;
      font-size: 10pt;
      background: #f4f4f5;
      padding: 2px 6px;
      border-radius: 3px;
    }
    pre {
      background: #1e293b;
      color: #e2e8f0;
      padding: 16px;
      border-radius: 6px;
      overflow-x: auto;
      margin: 1.5em 0;
      page-break-inside: avoid;
    }
    pre code {
      background: transparent;
      padding: 0;
      color: inherit;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1.5em 0;
      page-break-inside: avoid;
    }
    th, td {
      border: 1px solid #d1d5db;
      padding: 10px 12px;
      text-align: left;
    }
    th {
      background: #f3f4f6;
      font-weight: bold;
    }
    tr:nth-child(even) { background: #f9fafb; }
    a { color: #2563eb; text-decoration: underline; }
    hr {
      border: none;
      border-top: 1px solid #e5e7eb;
      margin: 2em 0;
    }
    img { max-width: 100%; height: auto; }
  </style>
</head>
<body>
  ${sanitizedHtml}
</body>
</html>`;

    // Use PDFBolt API for high-quality PDF generation (best quality, selectable text)
    const pdfboltApiKey = Deno.env.get('PDFBOLT_API_KEY');
    
    if (pdfboltApiKey) {
      try {
        // Base64 encode the HTML as required by PDFBolt
        const base64Html = btoa(unescape(encodeURIComponent(fullHtml)));
        
        // Use PDFBolt for production-quality PDFs
        // Docs: https://pdfbolt.com/docs/api-endpoints/direct
        const pdfResponse = await fetch('https://api.pdfbolt.com/v1/direct', {
          method: 'POST',
          headers: {
            // Some accounts accept Authorization, some accept API-KEY; send both.
            'Authorization': `Bearer ${pdfboltApiKey}`,
            'API-KEY': pdfboltApiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            // PDFBolt expects Base64-encoded HTML for the `html` field
            html: base64Html,
            filename: sanitizedFilename,
            format: 'A4',
            landscape: false,
            printBackground: true,
            margin: {
              top: '20mm',
              right: '20mm',
              bottom: '20mm',
              left: '20mm',
            },
          }),
        });

        if (pdfResponse.ok) {
          const pdfBuffer = await pdfResponse.arrayBuffer();
          return new Response(new Uint8Array(pdfBuffer), {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/pdf',
              'Content-Disposition': `attachment; filename="${sanitizedFilename}"`,
            },
          });
        }

        const errorText = await pdfResponse.text();
        console.error('PDFBolt API error:', pdfResponse.status, errorText);
        // Fall through to the next provider (no error details sent to client).
      } catch (e) {
        console.error('PDFBolt request failed:', e instanceof Error ? e.message : e);
        // Fall through to the next provider.
      }
    }
    
    // Optional fallback: html2pdf.app (requires an API key; do NOT call with an empty key)
    const html2pdfApiKey = Deno.env.get('HTML2PDF_APP_API_KEY');

    if (html2pdfApiKey) {
      const response = await fetch('https://api.html2pdf.app/v1/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          html: fullHtml,
          apiKey: html2pdfApiKey,
          format: 'A4',
          marginTop: 20,
          marginRight: 20,
          marginBottom: 20,
          marginLeft: 20,
        }),
      });

      if (response.ok) {
        const pdfBuffer = await response.arrayBuffer();
        return new Response(new Uint8Array(pdfBuffer), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${sanitizedFilename}"`,
          },
        });
      }

      const errorText = await response.text();
      console.error('html2pdf.app fallback error:', response.status, errorText);
      // Fall through to generic error (no error details sent to client).
    }

    // No provider available -> let the client fall back (image-based PDF) or show a friendly message.
    return new Response(
      JSON.stringify({
        error: 'PDF backend is not configured. Using client-side PDF fallback.',
      }),
      { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    // Log detailed error server-side for debugging
    console.error('PDF generation error:', error instanceof Error ? error.message : error);
    
    // Return generic error to client (no sensitive details)
    return new Response(
      JSON.stringify({ error: 'Unable to generate PDF. Please try again later.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
