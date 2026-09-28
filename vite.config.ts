import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-editor': ['@codemirror/state', '@codemirror/view', '@codemirror/commands', '@codemirror/lang-markdown', '@codemirror/language'],
          'vendor-markdown': ['markdown-it', 'katex', 'highlight.js', 'dompurify', 'turndown'],
          'vendor-export': ['docx', 'file-saver', 'jspdf', 'html2canvas', 'pdfmake', 'html-to-pdfmake'],
          'vendor-ui': ['framer-motion', '@radix-ui/react-dialog', '@radix-ui/react-popover', '@radix-ui/react-tooltip', '@radix-ui/react-dropdown-menu'],
          'vendor-diagrams': ['mermaid'],
        },
      },
    },
  },
}));
