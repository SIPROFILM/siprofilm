/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans:    ['DM Sans', 'Helvetica Neue', 'Arial', 'sans-serif'],
        display: ['Clash Display', 'DM Sans', 'sans-serif'],
        mono:    ['DM Mono', 'monospace'],
      },
      colors: {
        sf: {
          bg:       '#141213',
          surface:  '#1c1a1b',
          surface2: '#242122',
          surface3: '#2e2a2b',
          border:   'rgba(199,191,239,0.08)',
          border2:  'rgba(199,191,239,0.15)',
          text:     '#F0E7E4',
          muted:    'rgba(240,231,228,0.35)',
          muted2:   'rgba(240,231,228,0.5)',
          pink:     '#F92D97',
          blue:     '#4B52EB',
          lime:     '#D0ED40',
          lavender: '#C7BFEF',
          cream:    '#F0E7E4',
        },
        capro: {
          red:      '#BE1E2D',
          'red-dark': '#9a1824',
        }
      }
    },
  },
  plugins: [],
}
