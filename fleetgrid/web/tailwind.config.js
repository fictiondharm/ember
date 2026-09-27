/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter Variable', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        base: {
          DEFAULT: '#07090D',
          950: '#08090D',
          900: '#0B0C11',
          850: '#0E1015',
          800: '#101217',
          750: '#15181F',
          700: '#1B1E26',
          600: '#24272F',
          500: '#343845',
        },
        raised: '#0d1016',
        panel: '#11151c',
        line: {
          DEFAULT: '#252a33',
          soft: '#181c24',
        },
        route: '#2c333e',
        fg: '#f5f7fa',
        dim: '#8b93a1',
        faint: '#5a6270',
        signal: '#3be39b',
        caution: '#f2b33d',
        fault: '#f0544f',
        ink: {
          50: '#F4F6F8',
          100: '#E4E7EC',
          200: '#C3C8D2',
          300: '#98A0AE',
          400: '#6E7686',
          500: '#4C5361',
        },
        healthy: {
          DEFAULT: '#3DDC97',
          dim: '#1E7A56',
          glow: 'rgba(61, 220, 151, 0.14)',
        },
        warn: {
          DEFAULT: '#F5B544',
          dim: '#8A5F13',
          glow: 'rgba(245, 181, 68, 0.14)',
        },
        danger: {
          DEFAULT: '#FF5B5B',
          dim: '#8C2B2B',
          glow: 'rgba(255, 91, 91, 0.14)',
        },
        accent: {
          DEFAULT: '#5B8DEF',
          dim: '#2A4780',
        },
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.04em' }],
      },
      boxShadow: {
        panel: '0 1px 0 0 rgba(255,255,255,0.03) inset, 0 12px 40px -24px rgba(0,0,0,0.9)',
        incident: '0 0 0 1px rgba(255,91,91,0.35), 0 0 40px -12px rgba(255,91,91,0.45)',
      },
      keyframes: {
        'pulse-ring': {
          '0%': { transform: 'scale(0.9)', opacity: '0.8' },
          '70%': { transform: 'scale(1.6)', opacity: '0' },
          '100%': { transform: 'scale(1.6)', opacity: '0' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'flash-row': {
          '0%': { backgroundColor: 'rgba(61,220,151,0.16)' },
          '100%': { backgroundColor: 'rgba(61,220,151,0)' },
        },
        // A decline must never look like a success. Amber means "this went back",
        // red means "something is wrong here" — the original green is reserved
        // for progress the actor wanted.
        'flash-row-release': {
          '0%': { backgroundColor: 'rgba(240,178,72,0.20)' },
          '100%': { backgroundColor: 'rgba(240,178,72,0)' },
        },
        'flash-row-alert': {
          '0%': { backgroundColor: 'rgba(255,91,91,0.20)' },
          '100%': { backgroundColor: 'rgba(255,91,91,0)' },
        },
      },
      animation: {
        'pulse-ring': 'pulse-ring 2.4s cubic-bezier(0.22, 1, 0.36, 1) infinite',
        'slide-up': 'slide-up 220ms cubic-bezier(0.22, 1, 0.36, 1)',
        'flash-row': 'flash-row 1.4s ease-out',
        'flash-row-release': 'flash-row-release 1.4s ease-out',
        'flash-row-alert': 'flash-row-alert 1.4s ease-out',
      },
    },
  },
  plugins: [],
};
