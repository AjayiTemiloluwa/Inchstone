/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './src/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    // dark is the singular canonical theme; keep `class` so an override pass is possible later
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                // ── v2 canonical six tokens — wired to CSS vars so BOTH themes work.
                // The vars live in globals.css (:root = light, .dark = dark) and the
                // <html> class decides which set is active.
                ink: 'rgb(var(--ink-rgb) / <alpha-value>)', // background surface
                parchment: 'rgb(var(--parchment-rgb) / <alpha-value>)', // primary text
                gold: 'rgb(var(--gold-rgb) / <alpha-value>)', // the single accent
                'gold-dim': 'rgb(var(--gold-dim-rgb) / <alpha-value>)', // gold at rest
                ember: 'rgb(var(--ember-rgb) / <alpha-value>)', // warnings / destructive
                moss: 'rgb(var(--moss-rgb) / <alpha-value>)', // completed / achieved
                // ── deprecated aliases (mapped to token vars; components migrating off these) ──
                'gold-glow': 'rgb(var(--gold-glow-rgb) / <alpha-value>)', // hover brass
                sage: 'rgb(var(--moss-rgb) / <alpha-value>)', // → moss
                'sage-glow': 'rgb(var(--sage-glow-rgb) / <alpha-value>)',
                coral: 'rgb(var(--ember-rgb) / <alpha-value>)', // → ember
            },
            fontFamily: {
                sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
                mono: ['var(--font-jetbrains-mono)', 'monospace'],
                display: ['var(--font-playfair)', 'serif'],
            },
        },
    },
    plugins: [],
}
