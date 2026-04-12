/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
      colors: {
        surface: {
          DEFAULT: '#ffffff',
          2: '#f9f8f6',
          3: '#f4f3f0',
        },
        border: {
          DEFAULT: '#e8e6e1',
          2: '#d4d1ca',
        },
        ink: {
          DEFAULT: '#1a1917',
          2: '#6b6860',
          3: '#9c9a94',
        },
      },
      animation: {
        'pulse-dot': 'pulse-dot 1.2s ease-in-out infinite',
        'fade-up': 'fade-up 0.3s ease both',
      },
      keyframes: {
        'pulse-dot': {
          '0%, 100%': { boxShadow: '0 0 0 2px #fef3c7' },
          '50%': { boxShadow: '0 0 0 4px #fde68a' },
        },
        'fade-up': {
          from: { opacity: 0, transform: 'translateY(8px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
