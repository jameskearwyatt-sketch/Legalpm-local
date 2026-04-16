import { useEffect } from 'react';

/**
 * Temporary palette preview page. Shows a mock Legal PM screen rendered
 * in four candidate palettes side by side so the team can pick a
 * design direction before we touch any theme tokens in src/index.css.
 *
 * Lives at /palette-preview (public route, no auth required so it can
 * be shared). Delete this file + the route + the font link once a
 * palette has been chosen and applied.
 */

const STYLES = `
:root {
  --pv-font-body: 'Inter', system-ui, -apple-system, sans-serif;
  --pv-font-heading-serif: 'Cormorant Garamond', 'Times New Roman', serif;
  --pv-font-heading-sans: 'Outfit', sans-serif;
}
.pv-root { font-family: var(--pv-font-body); background: #efefea; padding: 24px; color: #1a1a1a; line-height: 1.5; min-height: 100vh; }
.pv-root *, .pv-root *::before, .pv-root *::after { box-sizing: border-box; }
.pv-page-header { max-width: 1200px; margin: 0 auto 24px; }
.pv-page-header h1 { font-family: var(--pv-font-heading-serif); font-size: 36px; font-weight: 500; letter-spacing: -0.01em; margin: 0 0 6px; }
.pv-page-header p { font-size: 15px; color: #555; max-width: 680px; margin: 0; }
.pv-page-header .pv-legend { margin-top: 18px; font-size: 13px; color: #555; padding: 12px 16px; background: #fff; border-radius: 8px; border: 1px solid #e0ddd5; }
.pv-container { max-width: 1200px; margin: 0 auto; display: flex; flex-direction: column; gap: 32px; }
.pv-preview { display: flex; flex-direction: column; border-radius: 14px; overflow: hidden; box-shadow: 0 12px 40px -18px rgba(0,0,0,0.3); border: 1px solid rgba(0,0,0,0.08); }
.pv-preview-label { padding: 18px 24px; background: #fff; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
.pv-preview-label h2 { font-family: var(--pv-font-heading-serif); font-size: 22px; font-weight: 500; letter-spacing: -0.005em; margin: 0; }
.pv-preview-label .pv-tagline { font-size: 13px; color: #666; font-style: italic; }
.pv-app { display: grid; grid-template-columns: 220px 1fr; min-height: 520px; font-family: var(--pv-font-body); }
.pv-sidebar { padding: 22px 16px; display: flex; flex-direction: column; gap: 4px; background: var(--pv-sidebar-bg); color: var(--pv-sidebar-fg); }
.pv-sidebar .pv-logo { display: flex; align-items: center; gap: 10px; margin-bottom: 18px; padding: 0 8px; }
.pv-sidebar .pv-logo-icon { width: 22px; height: 22px; border-radius: 4px; background: var(--pv-sidebar-accent); }
.pv-sidebar .pv-logo-text { font-family: var(--pv-font-heading-serif); font-size: 18px; font-weight: 500; color: var(--pv-sidebar-fg); }
.pv-nav-item { padding: 9px 12px; border-radius: 6px; font-size: 13.5px; color: var(--pv-sidebar-fg-dim); display: flex; align-items: center; gap: 10px; }
.pv-nav-item.pv-active { background: var(--pv-sidebar-active-bg); color: var(--pv-sidebar-active-fg); font-weight: 500; }
.pv-nav-item .pv-dot { width: 5px; height: 5px; border-radius: 50%; background: currentColor; opacity: 0.6; }
.pv-main { background: var(--pv-bg); padding: 28px 32px; color: var(--pv-fg); }
.pv-main-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; flex-wrap: wrap; gap: 12px; }
.pv-main-header .pv-titles h3 { font-family: var(--pv-font-heading-serif); font-size: 28px; font-weight: 500; letter-spacing: -0.005em; color: var(--pv-fg); line-height: 1.15; margin: 0; }
.pv-main-header .pv-titles p { font-size: 13.5px; color: var(--pv-fg-muted); margin: 4px 0 0; }
.pv-btn { padding: 9px 18px; border-radius: 6px; font-size: 13.5px; font-weight: 500; cursor: pointer; border: none; font-family: var(--pv-font-body); }
.pv-btn:hover { opacity: 0.9; }
.pv-btn-primary { background: var(--pv-primary); color: var(--pv-primary-fg); }
.pv-btn-outline { background: transparent; color: var(--pv-fg); border: 1px solid var(--pv-border); }
.pv-card { background: var(--pv-card); border: 1px solid var(--pv-border); border-radius: 8px; padding: 20px 22px; box-shadow: 0 1px 3px 0 rgba(0,0,0,0.04); }
.pv-card h4 { font-family: var(--pv-font-heading-serif); font-size: 18px; font-weight: 500; margin: 0 0 4px; }
.pv-card .pv-subtitle { font-size: 12.5px; color: var(--pv-fg-muted); margin-bottom: 16px; }
.pv-card table { width: 100%; border-collapse: collapse; font-size: 13px; }
.pv-card thead th { text-align: left; padding: 8px 10px; font-weight: 500; font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--pv-fg-muted); border-bottom: 1px solid var(--pv-border); background: var(--pv-muted-bg); }
.pv-card tbody td { padding: 10px; border-bottom: 1px solid var(--pv-border); color: var(--pv-fg); }
.pv-card tbody tr:last-child td { border-bottom: none; }
.pv-badge { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 11.5px; font-weight: 500; letter-spacing: 0.01em; }
.pv-badge-accent { background: var(--pv-accent-soft); color: var(--pv-accent-strong); border: 1px solid var(--pv-accent-border); }
.pv-badge-success { background: var(--pv-success-soft); color: var(--pv-success-strong); border: 1px solid var(--pv-success-border); }
.pv-badge-warning { background: var(--pv-warning-soft); color: var(--pv-warning-strong); border: 1px solid var(--pv-warning-border); }
.pv-badge-danger { background: var(--pv-danger-soft); color: var(--pv-danger-strong); border: 1px solid var(--pv-danger-border); }
.pv-stat-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 18px; }
.pv-stat { padding: 14px 16px; background: var(--pv-card); border: 1px solid var(--pv-border); border-radius: 8px; }
.pv-stat .pv-stat-label { font-size: 11.5px; color: var(--pv-fg-muted); text-transform: uppercase; letter-spacing: 0.04em; }
.pv-stat .pv-stat-value { font-family: var(--pv-font-heading-serif); font-size: 24px; font-weight: 500; margin-top: 2px; color: var(--pv-fg); }
.pv-stat .pv-stat-delta { font-size: 11.5px; color: var(--pv-success-strong); margin-top: 2px; }
.pv-swatch-bar { display: flex; gap: 0; border-radius: 0 0 14px 14px; overflow: hidden; }
.pv-swatch { flex: 1; padding: 14px 10px; text-align: center; font-size: 10.5px; font-family: ui-monospace, Menlo, Consolas, monospace; color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,0.4); }
.pv-swatch.pv-light { color: #333; text-shadow: none; }

/* Palette 1: Cashmere & Cognac */
.pv-cashmere { --pv-bg: #FAF6EE; --pv-fg: #1F1A14; --pv-fg-muted: #6B5F4D; --pv-card: #FDFAF4; --pv-muted-bg: #F2EBDC; --pv-border: #D4C7B2; --pv-primary: #6B4A2C; --pv-primary-fg: #FDFAF4; --pv-accent-soft: #F0E5D0; --pv-accent-strong: #6B4A2C; --pv-accent-border: #C6AD82; --pv-success-soft: #E6E8D5; --pv-success-strong: #4E5A32; --pv-success-border: #B8BF8F; --pv-warning-soft: #F3E5C7; --pv-warning-strong: #7A5412; --pv-warning-border: #D9B66F; --pv-danger-soft: #EFD8D0; --pv-danger-strong: #6E2D1B; --pv-danger-border: #C58877; --pv-sidebar-bg: #1F1A14; --pv-sidebar-fg: #E8E0D2; --pv-sidebar-fg-dim: #B8AC96; --pv-sidebar-active-bg: #2F271E; --pv-sidebar-active-fg: #D4B88A; --pv-sidebar-accent: #B89968; }

/* Palette 2: Charcoal & Oatmeal */
.pv-charcoal { --pv-bg: #F5F1EA; --pv-fg: #1C1A18; --pv-fg-muted: #625F58; --pv-card: #FBF8F1; --pv-muted-bg: #ECE6D9; --pv-border: #CFC5B3; --pv-primary: #2B2925; --pv-primary-fg: #F5F1EA; --pv-accent-soft: #E5DBC6; --pv-accent-strong: #5C4623; --pv-accent-border: #BB9F6E; --pv-success-soft: #DDE3D1; --pv-success-strong: #425134; --pv-success-border: #A9B694; --pv-warning-soft: #EEE0C1; --pv-warning-strong: #735012; --pv-warning-border: #D2AE66; --pv-danger-soft: #E8D2C8; --pv-danger-strong: #6A2C1A; --pv-danger-border: #BC8170; --pv-sidebar-bg: #1C1A18; --pv-sidebar-fg: #D6CDB9; --pv-sidebar-fg-dim: #9A917F; --pv-sidebar-active-bg: #2B2925; --pv-sidebar-active-fg: #C4A574; --pv-sidebar-accent: #8A6F47; }

/* Palette 3: Ivory & Forest */
.pv-forest { --pv-bg: #F8F6F1; --pv-fg: #1A1D1A; --pv-fg-muted: #5A6159; --pv-card: #FDFCF8; --pv-muted-bg: #EDEBE1; --pv-border: #CCC8BC; --pv-primary: #2C3D2E; --pv-primary-fg: #F8F6F1; --pv-accent-soft: #DDE3CF; --pv-accent-strong: #465A39; --pv-accent-border: #9EAE82; --pv-success-soft: #D5DDC8; --pv-success-strong: #3E5131; --pv-success-border: #9CAB88; --pv-warning-soft: #EDE0C0; --pv-warning-strong: #725012; --pv-warning-border: #D1AE66; --pv-danger-soft: #E5D5CE; --pv-danger-strong: #6B2F1F; --pv-danger-border: #BB8876; --pv-sidebar-bg: #2C3D2E; --pv-sidebar-fg: #E6E3DA; --pv-sidebar-fg-dim: #A8AC98; --pv-sidebar-active-bg: #3A4E3C; --pv-sidebar-active-fg: #D9D2B6; --pv-sidebar-accent: #86996A; }

/* Current: Navy & Slate */
.pv-current { --pv-bg: #F6F8FA; --pv-fg: #0F172A; --pv-fg-muted: #64748B; --pv-card: #FFFFFF; --pv-muted-bg: #EEF2F6; --pv-border: #D5DCE4; --pv-primary: #1B2B4B; --pv-primary-fg: #FFFFFF; --pv-accent-soft: #DBE6FD; --pv-accent-strong: #1D4ED8; --pv-accent-border: #93B4F8; --pv-success-soft: #D1FAE5; --pv-success-strong: #047857; --pv-success-border: #6EE7B7; --pv-warning-soft: #FEF3C7; --pv-warning-strong: #B45309; --pv-warning-border: #FCD34D; --pv-danger-soft: #FEE2E2; --pv-danger-strong: #B91C1C; --pv-danger-border: #FCA5A5; --pv-sidebar-bg: #0F172A; --pv-sidebar-fg: #D0D7E2; --pv-sidebar-fg-dim: #94A3B8; --pv-sidebar-active-bg: #1E293B; --pv-sidebar-active-fg: #60A5FA; --pv-sidebar-accent: #3B82F6; }
.pv-current .pv-main-header .pv-titles h3,
.pv-current .pv-card h4,
.pv-current .pv-stat .pv-stat-value,
.pv-current .pv-preview-label h2,
.pv-current .pv-sidebar .pv-logo-text { font-family: var(--pv-font-heading-sans); font-weight: 600; }
.pv-current.pv-page-header h1 { font-family: var(--pv-font-heading-sans); font-weight: 600; }

@media (max-width: 720px) {
  .pv-app { grid-template-columns: 1fr; }
  .pv-sidebar { flex-direction: row; flex-wrap: wrap; padding: 14px; }
  .pv-stat-row { grid-template-columns: 1fr; }
}
`;

const PALETTES: Array<{
  key: string;
  className: string;
  title: string;
  tagline: string;
  swatches: Array<{ hex: string; label: string; light?: boolean }>;
}> = [
  {
    key: 'current',
    className: 'pv-current',
    title: 'Current — Navy & Slate',
    tagline: 'what the app looks like today',
    swatches: [
      { hex: '#F6F8FA', label: '#F6F8FA bg', light: true },
      { hex: '#1B2B4B', label: '#1B2B4B primary' },
      { hex: '#0F172A', label: '#0F172A sidebar' },
      { hex: '#3B82F6', label: '#3B82F6 accent' },
      { hex: '#FFFFFF', label: '#FFFFFF card', light: true },
    ],
  },
  {
    key: 'cashmere',
    className: 'pv-cashmere',
    title: 'Option A — Cashmere & Cognac',
    tagline: 'Loro Piana: warm cream, espresso, cognac, camel',
    swatches: [
      { hex: '#FAF6EE', label: '#FAF6EE bg', light: true },
      { hex: '#6B4A2C', label: '#6B4A2C primary' },
      { hex: '#1F1A14', label: '#1F1A14 sidebar' },
      { hex: '#B89968', label: '#B89968 camel', light: true },
      { hex: '#FDFAF4', label: '#FDFAF4 card', light: true },
    ],
  },
  {
    key: 'charcoal',
    className: 'pv-charcoal',
    title: 'Option B — Charcoal & Oatmeal',
    tagline: 'Zegna tailoring: oatmeal, charcoal, subtle bronze',
    swatches: [
      { hex: '#F5F1EA', label: '#F5F1EA bg', light: true },
      { hex: '#2B2925', label: '#2B2925 primary' },
      { hex: '#1C1A18', label: '#1C1A18 sidebar' },
      { hex: '#8A6F47', label: '#8A6F47 bronze' },
      { hex: '#FBF8F1', label: '#FBF8F1 card', light: true },
    ],
  },
  {
    key: 'forest',
    className: 'pv-forest',
    title: 'Option C — Ivory & Forest',
    tagline: 'English country-house: ivory, deep forest, sage',
    swatches: [
      { hex: '#F8F6F1', label: '#F8F6F1 bg', light: true },
      { hex: '#2C3D2E', label: '#2C3D2E primary' },
      { hex: '#2C3D2E', label: '#2C3D2E sidebar' },
      { hex: '#86996A', label: '#86996A sage', light: true },
      { hex: '#FDFCF8', label: '#FDFCF8 card', light: true },
    ],
  },
];

function MockScreen() {
  return (
    <div className="pv-app">
      <aside className="pv-sidebar">
        <div className="pv-logo">
          <span className="pv-logo-icon" />
          <span className="pv-logo-text">Legal PM</span>
        </div>
        <div className="pv-nav-item"><span className="pv-dot" />Dashboard</div>
        <div className="pv-nav-item pv-active"><span className="pv-dot" />Matters</div>
        <div className="pv-nav-item"><span className="pv-dot" />Pricing</div>
        <div className="pv-nav-item"><span className="pv-dot" />Contacts</div>
        <div className="pv-nav-item"><span className="pv-dot" />Growth</div>
        <div className="pv-nav-item"><span className="pv-dot" />Analysts</div>
      </aside>
      <div className="pv-main">
        <div className="pv-main-header">
          <div className="pv-titles">
            <h3>Matters</h3>
            <p>Active engagements, budgets, and WIP across your portfolio</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="pv-btn pv-btn-outline">Filter</button>
            <button className="pv-btn pv-btn-primary">+ New matter</button>
          </div>
        </div>
        <div className="pv-stat-row">
          <div className="pv-stat"><div className="pv-stat-label">Open matters</div><div className="pv-stat-value">47</div><div className="pv-stat-delta">+3 this month</div></div>
          <div className="pv-stat"><div className="pv-stat-label">WIP outstanding</div><div className="pv-stat-value">£412k</div><div className="pv-stat-delta">on track</div></div>
          <div className="pv-stat"><div className="pv-stat-label">Budget burn</div><div className="pv-stat-value">68%</div><div className="pv-stat-delta">avg across matters</div></div>
        </div>
        <div className="pv-card">
          <h4>Recent matters</h4>
          <div className="pv-subtitle">Sorted by last activity</div>
          <table>
            <thead>
              <tr><th>Client</th><th>Matter</th><th>Status</th><th>Budget</th></tr>
            </thead>
            <tbody>
              <tr><td>Aurora Energy Ltd</td><td>PPA renegotiation</td><td><span className="pv-badge pv-badge-success">On track</span></td><td>£48k / £60k</td></tr>
              <tr><td>Harbour Financial</td><td>Supply agreement review</td><td><span className="pv-badge pv-badge-warning">Near budget</span></td><td>£92k / £100k</td></tr>
              <tr><td>Willow Lake Capital</td><td>Tolling dispute</td><td><span className="pv-badge pv-badge-danger">Over budget</span></td><td>£187k / £150k</td></tr>
              <tr><td>Meridian Partners</td><td>Carbon credit offtake</td><td><span className="pv-badge pv-badge-accent">Proposal sent</span></td><td>—</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function PalettePreview() {
  useEffect(() => {
    // Load the Google Fonts used by the preview. Idempotent — only adds
    // once even if the page is navigated to and back.
    const id = 'palette-preview-fonts';
    if (!document.getElementById(id)) {
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href =
        'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=Outfit:wght@400;500;600;700&display=swap';
      document.head.appendChild(link);
    }
  }, []);

  return (
    <div className="pv-root">
      <style>{STYLES}</style>
      <div className="pv-page-header">
        <h1>Legal PM — Palette Preview</h1>
        <p>
          Each block below shows the same mock app screen rendered in a different palette.
          Sidebar, header, stats, table, badges, buttons — all the chrome you'd see day to
          day. Pick the one that feels right and I'll apply it site-wide.
        </p>
        <div className="pv-legend">
          <strong>Note:</strong> this is a static preview built from the real token values.
          Fonts and colours shown are exactly what the live app would use after the switch.
          Status badges (green / amber / red) are tuned so meaning stays clear while the
          palette changes around them.
        </div>
      </div>

      <div className="pv-container">
        {PALETTES.map((p) => (
          <div key={p.key} className={`pv-preview ${p.className}`}>
            <div className="pv-preview-label">
              <div>
                <h2>{p.title}</h2>
              </div>
              <div className="pv-tagline">{p.tagline}</div>
            </div>
            <MockScreen />
            <div className="pv-swatch-bar">
              {p.swatches.map((s, i) => (
                <div
                  key={i}
                  className={`pv-swatch${s.light ? ' pv-light' : ''}`}
                  style={{ background: s.hex }}
                >
                  {s.label}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
