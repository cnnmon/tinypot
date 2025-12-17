/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        // Define a custom font family named 'dm-sans'
        'dm-sans': ['"DM Sans"', 'sans-serif'],
      },
      colors: {
        accent: {
          DEFAULT: '#a76eb2',
          dark: '#8a5595',
          light: '#c999d6',
        },
      },
    },
  },
  plugins: [],
};
