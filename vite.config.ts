import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

const fallbackSupabaseUrl = "https://sdnunnmldefddezdsyqk.supabase.co";
const fallbackSupabasePublishableKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkbnVubm1sZGVmZGRlemRzeXFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxMDkzNTEsImV4cCI6MjA4MjY4NTM1MX0.xeQGrhMBpFHffxxUlF3DSlRFfusxPow__97hPS-ewL0";
const fallbackSupabaseProjectId = "sdnunnmldefddezdsyqk";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()],
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
