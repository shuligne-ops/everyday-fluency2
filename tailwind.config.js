/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'france': {
          'blue': '#002395',
          'red': '#ED2939',
          'cream': '#FFF8F0',
          'warm': '#F5E6D3',
          'dark': '#1a1a2e',
          'gold': '#C9A96E',
        }
      },
      fontFamily: {
        'display': ['Georgia', 'serif'],
        'body': ['system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
