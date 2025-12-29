/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0c4a6e', // sky-900
          dark: '#082f49',    // sky-950
          light: '#0369a1',   // sky-700
        }
      }
    },
  },
  plugins: [require("tailwindcss-animate")],
}
