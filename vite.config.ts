import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

const fallbackSupabaseUrl = "https://sdnunnmldefddezdsyqk.supabase.co";
const fallbackSupabasePublishableKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkbnVubm1sZGVmZGRlemRzeXFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxMDkzNTEsImV4cCI6MjA4MjY4NTM1MX0.xeQGrhMBpFHffxxUlF3DSlRFfusxPow__97hPS-ewL0";
const fallbackSupabaseProjectId = "sdnunnmldefddezdsyqk";

function securityHeadersPlugin(): Plugin {
  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? fallbackSupabaseUrl;
  let supabaseWss: string;
  try {
    const parsed = new URL(supabaseUrl);
    supabaseWss = `wss://${parsed.host}`;
  } catch {
    supabaseWss = "wss://*.supabase.co";
  }

  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self' ${supabaseUrl} ${supabaseWss}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");

  return {
    name: "security-headers",
    transformIndexHtml(html) {
      const metaTags = [
        `<meta http-equiv="Content-Security-Policy" content="${csp}">`,
        `<meta http-equiv="X-Content-Type-Options" content="nosniff">`,
        `<meta name="referrer" content="strict-origin-when-cross-origin">`,
      ].join("\n    ");
      return html.replace("</head>", `    ${metaTags}\n  </head>`);
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), securityHeadersPlugin()],
  define: {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(
      process.env.VITE_SUPABASE_URL ?? fallbackSupabaseUrl,
    ),
    "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? fallbackSupabasePublishableKey,
    ),
    "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify(
      process.env.VITE_SUPABASE_PROJECT_ID ?? fallbackSupabaseProjectId,
    ),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
