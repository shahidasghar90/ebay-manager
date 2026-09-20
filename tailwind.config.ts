import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        navy: '#0f172a',
        blue: '#2563eb',
        'blue-dark': '#1d4ed8',
        page: '#f4f7fb',
        card: '#ffffff',
        border: '#e5e7eb',
        text: '#172033',
        muted: '#64748b',
        green: '#15803d',
        orange: '#c2410c',
        red: '#b91c1c'
      },
      borderRadius: {
        card: '12px'
      }
    }
  },
  plugins: []
};

export default config;
