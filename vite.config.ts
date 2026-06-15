import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

function securityHeadersPlugin(): Plugin {
  const csp = [
    "default-src 'self'",
    // PGlite runs PostgreSQL as WebAssembly in the browser; WASM compilation
    // requires 'wasm-unsafe-eval'. Without it the database never starts and all
    // data screens hang on a loading spinner.
    "script-src 'self' 'wasm-unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
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
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
