/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './src/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                gold: '#D4AF37',
                'gold-glow': '#f5d76e',
                sage: '#7BA05B',
                'sage-glow': '#a4d47e',
                coral: '#E8686A',
            },
            fontFamily: {
                sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
                mono: ['var(--font-geist-mono)', 'monospace'],
                display: ['var(--font-lora)', 'serif'],
            },
        },
    },
    plugins: [],
}