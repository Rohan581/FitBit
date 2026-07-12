/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        warm: {
          50: '#FAF8F5',
          100: '#F3F0EB',
          200: '#E8E4DE',
          300: '#D8D4CC',
          400: '#A8A49C',
          500: '#78746C',
          600: '#504C46',
          700: '#3A3733',
          800: '#2C2925',
          900: '#1A1815',
        },
        accent: {
          DEFAULT: '#D85A30',
          hover: '#993C1D',
          tint: '#FAECE7',
        },
        success: {
          DEFAULT: '#1D9E75',
          tint: '#E8F8F2',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      borderRadius: {
        card: '16px',
      },
      boxShadow: {
        subtle: '0 1px 2px rgba(0,0,0,0.04)',
        sheet: '0 -4px 24px rgba(0,0,0,0.12)',
      },
    },
  },
  plugins: [],
};
