/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Lato', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      colors: {
        brand: {
          50:  '#f5f4f0',
          900: '#1a1a1a',
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
