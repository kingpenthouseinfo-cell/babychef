import type { Config } from 'tailwindcss';

// Baby Chef Studio visual system ("4a · Colour-coded studio"): see app/globals.css for the CSS variables.
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Hanken Grotesk"', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        serif: ['Newsreader', 'Georgia', 'serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        bg: '#FFFFFF', paper: '#FFFFFF', surface: '#FFFFFF', sunken: '#F4F3F7',
        line: { DEFAULT: '#ECEAF0', strong: '#E7E4EC' },
        ink: { DEFAULT: '#1E1D22', 2: '#2A2830', secondary: '#6F6A75', muted: '#8C8792' },
        sage: { tint: '#EAF1E9', mid: '#BFD5C2', deep: '#4C6B52' },
        pink: { tint: '#F9ECEF', mid: '#EDBFCB', deep: '#9A4A60' },
        blue: { tint: '#EAF0F8', mid: '#BACFE8', light: '#D7E4F4', deep: '#3E6290', hover: '#34547C' },
        purple: { tint: '#F1EAFB', mid: '#DCCDEF', deep: '#6A4E98' },
        gold: { bg: '#F4ECDA', border: '#D9C59B', text: '#8A6A35' },
        accent: '#3E6290',
      },
      backgroundImage: {
        'grad-sage': 'linear-gradient(135deg,#EAF4EC 0%,#F1F7E8 100%)',
        'grad-pink': 'linear-gradient(135deg,#FDECF1 0%,#F9EEF7 100%)',
        'grad-blue': 'linear-gradient(135deg,#E5EFFB 0%,#ECEBFB 100%)',
        'grad-purple': 'linear-gradient(135deg,#F1EAFB 0%,#F6ECF8 100%)',
        'btn-blue': 'linear-gradient(135deg,#4670A8 0%,#6A55A2 100%)',
        'btn-sage': 'linear-gradient(135deg,#4C6B52 0%,#5E8C7E 100%)',
        logo: 'conic-gradient(from 200deg,#EDBFCB,#BACFE8,#CFC2EA,#BFD5C2,#EDBFCB)',
      },
      borderRadius: { xs: '4px', sm: '8px', md: '10px', lg: '14px', xl: '18px' },
      boxShadow: { sm: '0 1px 2px rgba(30,29,34,.05)', md: '0 1px 2px rgba(30,29,34,.06), 0 12px 40px rgba(30,29,34,.10)' },
      maxWidth: { text: '760px' },
    },
  },
  plugins: [],
};
export default config;
