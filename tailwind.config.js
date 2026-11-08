/** @type {import('tailwindcss').Config} */
export default {
  // assets/ obsahujú len dáta (napr. kolíska Hermle) – ich dlhé riadky čísel by skenovanie tried spomalili na minúty
  content: ['./index.html', './src/**/*.{js,jsx}', '!./src/**/assets/**'],
  theme: { extend: {} },
  plugins: [],
};
