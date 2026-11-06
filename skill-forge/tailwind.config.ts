import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Palette calda in OKLCH, ogni neutro tinto verso l'ambra (hue ~55)
        ember: {
          50: 'oklch(97% 0.012 65)',
          100: 'oklch(94% 0.024 62)',
          200: 'oklch(88% 0.045 58)',
          300: 'oklch(80% 0.075 55)',
          400: 'oklch(71% 0.115 52)',
          500: 'oklch(62% 0.148 48)',
          600: 'oklch(52% 0.142 42)',
          700: 'oklch(42% 0.118 38)',
          800: 'oklch(32% 0.086 35)',
          900: 'oklch(23% 0.058 33)',
          950: 'oklch(16% 0.038 32)',
        },
        sand: {
          50: 'oklch(98% 0.006 70)',
          100: 'oklch(95% 0.012 68)',
          200: 'oklch(90% 0.018 66)',
          300: 'oklch(83% 0.022 64)',
          400: 'oklch(72% 0.024 62)',
          500: 'oklch(60% 0.022 60)',
          600: 'oklch(48% 0.02 58)',
          700: 'oklch(37% 0.018 56)',
          800: 'oklch(27% 0.016 54)',
          900: 'oklch(19% 0.014 52)',
          950: 'oklch(13% 0.012 50)',
        },
        clay: 'oklch(58% 0.128 35)',
        ochre: 'oklch(74% 0.132 78)',
        terra: 'oklch(55% 0.155 32)',
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      maxWidth: {
        prose: '68ch',
      },
      animation: {
        'fade-up': 'fadeUp 480ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'fade-in': 'fadeIn 320ms cubic-bezier(0.16, 1, 0.3, 1) both',
      },
      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
