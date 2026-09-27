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
        swiss: {
          red: '#FF3000',
          'red-hover': '#E02A00',
          white: '#FFFFFF',
          black: '#000000',
          muted: '#F2F2F2',
          dark: '#050506',
          surface: '#0E0F12',
          border: '#22242B',
        },
        base: {
          950: '#050506',
          900: '#0A0B0E',
          850: '#0E0F12',
          800: '#12141A',
          750: '#171921',
          700: '#1E212B',
          600: '#2A2D3A',
          500: '#3A3E4F',
        },
        ink: {
          50: '#FFFFFF',
          100: '#F0F2F5',
          200: '#D1D5DB',
          300: '#9CA3AF',
          400: '#6B7280',
          500: '#4B5563',
        },
        healthy: {
          DEFAULT: '#27A644',
          dim: '#165B25',
          glow: 'rgba(39, 166, 68, 0.14)',
        },
        warn: {
          DEFAULT: '#F59E0B',
          dim: '#92400E',
          glow: 'rgba(245, 158, 11, 0.14)',
        },
        danger: {
          DEFAULT: '#FF3000',
          dim: '#991B1B',
          glow: 'rgba(255, 48, 0, 0.14)',
        },
        accent: {
          DEFAULT: '#FF3000',
          dim: '#991B1B',
        },
      },
      borderRadius: {
        none: '0px',
        DEFAULT: '0px',
        sm: '0px',
        md: '0px',
        lg: '0px',
        xl: '0px',
        '2xl': '0px',
        full: '0px',
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.06em' }],
        '3xs': ['0.625rem', { lineHeight: '0.875rem', letterSpacing: '0.08em' }],
      },
      boxShadow: {
        panel: '0 0 0 1px #2A2D3A',
        incident: '0 0 0 2px #FF3000',
        swiss: '4px 4px 0px 0px #000000',
        'swiss-red': '4px 4px 0px 0px #FF3000',
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
          '0%': { backgroundColor: 'rgba(255,48,0,0.25)' },
          '100%': { backgroundColor: 'rgba(255,48,0,0)' },
        },
        'flash-row-release': {
          '0%': { backgroundColor: 'rgba(245,158,11,0.25)' },
          '100%': { backgroundColor: 'rgba(245,158,11,0)' },
        },
        'flash-row-alert': {
          '0%': { backgroundColor: 'rgba(255,48,0,0.30)' },
          '100%': { backgroundColor: 'rgba(255,48,0,0)' },
        },
      },
      animation: {
        'pulse-ring': 'pulse-ring 2.4s cubic-bezier(0.22, 1, 0.36, 1) infinite',
        'slide-up': 'slide-up 180ms ease-out',
        'flash-row': 'flash-row 1.4s ease-out',
        'flash-row-release': 'flash-row-release 1.4s ease-out',
        'flash-row-alert': 'flash-row-alert 1.4s ease-out',
      },
    },
  },
  plugins: [],
};

