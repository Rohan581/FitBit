/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        page: 'var(--bg)',
        card: { DEFAULT: 'var(--card)', 2: 'var(--card-2)' },
        tx: { DEFAULT: 'var(--text)', 2: 'var(--text-2)', 3: 'var(--text-3)' },
        hair: 'var(--hair)',
        cal: 'var(--cal)',
        protein: 'var(--protein)',
        carbs: 'var(--carbs)',
        fat: 'var(--fat)',
        fiber: 'var(--fiber)',
        sugar: 'var(--sugar)',
        points: 'var(--points)',
        breakfast: 'var(--breakfast)',
        lunch: 'var(--lunch)',
        snack: 'var(--snack)',
        dinner: 'var(--dinner)',
        drinks: 'var(--drinks)',
        sweet: 'var(--sweet)',
        fried: 'var(--fried)',
        fast: 'var(--fast)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',
        star: 'var(--star)',
      },
      fontFamily: {
        sans: ['Hanken Grotesk', 'system-ui', 'sans-serif'],
        num: ['Space Grotesk', 'system-ui', 'sans-serif'],
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
