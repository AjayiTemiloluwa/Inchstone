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
                // ── v2 canonical six tokens ──
                ink: '#0A0908', // background (warm near-black)
                parchment: '#F3EFE6', // primary text / light surfaces
                gold: '#B8935A', // the single accent (muted brass)
                'gold-dim': '#8A6D42', // gold at rest / secondary
                ember: '#7A3B2E', // warnings / overdue / destructive
                moss: '#4A5D45', // completed / rollup-achieved
                // ── deprecated aliases (mapped to tokens; components migrating off these) ──
                'gold-glow': '#cbaa6f', // hover brass
                sage: '#4A5D45', // → moss
                'sage-glow': '#7fa871',
                coral: '#7A3B2E', // → ember
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
