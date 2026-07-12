/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        warm: {
          50: 'rgb(var(--warm-50) / <alpha-value>)',
          100: 'rgb(var(--warm-100) / <alpha-value>)',
          200: 'rgb(var(--warm-200) / <alpha-value>)',
          300: 'rgb(var(--warm-300) / <alpha-value>)',
          400: 'rgb(var(--warm-400) / <alpha-value>)',
          500: 'rgb(var(--warm-500) / <alpha-value>)',
          600: 'rgb(var(--warm-600) / <alpha-value>)',
          700: 'rgb(var(--warm-700) / <alpha-value>)',
          800: 'rgb(var(--warm-800) / <alpha-value>)',
          900: 'rgb(var(--warm-900) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          hover: 'rgb(var(--accent-hover) / <alpha-value>)',
          tint: 'var(--accent-tint)',
        },
        success: {
          DEFAULT: 'rgb(var(--success) / <alpha-value>)',
          tint: 'var(--success-tint)',
        },
        surface: 'rgb(var(--surface) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      borderRadius: {
        card: '16px',
      },
      boxShadow: {
        subtle: 'var(--shadow-subtle)',
        sheet: 'var(--shadow-sheet)',
      },
    },
  },
  plugins: [],
};
