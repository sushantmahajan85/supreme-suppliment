/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './privacy.html', './refund-policy.html', './shipping-policy.html', './terms.html','./assets/js/**/*.js'],
  theme: {
    extend: {
      colors: {
        // semi-light base
        paper: '#F6F5F2',
        paper2: '#ECEAE5',
        mist: '#DEDBD5',
        // semi-dark accents (charcoal, never pure black)
        ink: '#16171A',
        night: '#1B1C20',
        char: '#212226',
        char2: '#2B2C31',
        char3: '#36383E',
        // red is an accent only
        brand: '#F20D18',
        brand2: '#C40812',
        blush: '#FDEDEE',
        // text
        silver: '#EDEDED',
        smoke: '#5E6068',
        mute: '#A4A6AE',
        // tone-aware (set per section by .tone-light / .tone-dark)
        fg: 'var(--fg)',
        fg2: 'var(--fg2)',
        line: 'var(--line)',
        surface: 'var(--surface)',
        surface2: 'var(--surface2)',
      },
      fontFamily: {
        sans: ['Poppins', 'system-ui', 'sans-serif'],
        display: ['Archivo', 'Poppins', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 30px 60px -32px rgba(22,23,26,.28), 0 0 0 1px rgba(22,23,26,.06)',
        lift: '0 40px 70px -36px rgba(22,23,26,.38), 0 0 0 1px rgba(22,23,26,.06)',
        glow: '0 12px 34px -12px rgba(242,13,24,.55)',
      },
      maxWidth: { page: '1280px' },
    },
  },
  plugins: [],
};
