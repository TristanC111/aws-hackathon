/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#FEF9F4',
          100: '#F8E4D0',
          200: '#F0C8A8',
          500: '#C05733',
          600: '#9B4228',
          700: '#74301D',
        },
        forest: {
          50:  '#EEF5F1',
          100: '#C8DDD4',
          500: '#1B4332',
          600: '#133126',
          700: '#0C2019',
        },
        warm: {
          50:  '#FBF7F0',
          100: '#F5EDE0',
          200: '#E8D9C8',
          300: '#C4B5A0',
          600: '#6B5744',
          800: '#3D2B1F',
          900: '#1C1410',
        },
        risk: {
          high:   '#D63C2A',
          medium: '#C4820A',
          low:    '#1A7A4A',
        },
      },
      fontFamily: {
        sans:  ['DM Sans', 'system-ui', 'sans-serif'],
        serif: ['Lora', 'Georgia', 'serif'],
      },
      boxShadow: {
        'warm-sm': '0 2px 12px rgba(28, 20, 16, 0.07)',
        'warm':    '0 4px 24px rgba(28, 20, 16, 0.10)',
        'warm-lg': '0 8px 40px rgba(28, 20, 16, 0.15)',
      },
    },
  },
  plugins: [],
}
