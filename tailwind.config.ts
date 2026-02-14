import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'ag-bg': '#0f172a',
        'ag-card': '#1e293b',
        'ag-card-lighter': '#334155',
        'ag-accent': '#f97316',
        'ag-accent-hover': '#ea580c',
        'ag-text': '#f8fafc',
        'ag-text-muted': '#94a3b8',
        'ag-border': '#475569',
        'ag-success': '#22c55e',
        'ag-warning': '#eab308',
        'ag-danger': '#ef4444',
      },
    },
  },
  plugins: [],
}
export default config
