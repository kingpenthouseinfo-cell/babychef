import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Inter', 'sans-serif'] },
      colors: { ink: '#1c1b19', paper: '#f6f5f2', line: '#e3e0d8', accent: '#9a3412' },
    },
  },
  plugins: [],
};
export default config;
