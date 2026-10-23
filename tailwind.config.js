/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './assets/js/**/*.js'],
  theme: {
    extend: {
      colors: {
        ink: '#050505',
        night: '#0A0A0A',
        char: '#141414',
        char2: '#1E1E1E',
        brand: '#F20D18',
        brand2: '#A8000A',
        silver: '#E6E6E6',
        mute: '#A3A3A3',
      },
      fontFamily: { sans: ['Poppins', 'sans-serif'] },
      boxShadow: {
        card: '0 1px 0 rgba(255,255,255,.06) inset, 0 20px 50px -20px rgba(0,0,0,.9)',
        glow: '0 10px 40px -10px rgba(242,13,24,.55)',
      },
      maxWidth: { page: '1240px' },
    },
  },
  plugins: [],
};
