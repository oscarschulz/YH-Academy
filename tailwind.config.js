/** @type {import('tailwindcss').Config} */
module.exports = {
  prefix: 'tw-',
  important: '.yh-tw-scope',
  content: [
    './public/dashboard.html',
    './public/academy.html',
    './public/js/dashboard.js',
    './public/js/academy.js'
  ],
  corePlugins: {
    preflight: false
  },
  theme: {
    extend: {
      colors: {
        yhSpace: '#050816',
        yhDeep: '#07111f',
        yhPanel: 'rgba(13, 24, 42, 0.78)',
        yhPanelStrong: 'rgba(10, 22, 39, 0.88)',
        yhLine: 'rgba(96, 165, 250, 0.22)',
        yhLineStrong: 'rgba(96, 165, 250, 0.38)',
        yhNeon: '#38bdf8',
        yhText: '#f8fbff',
        yhMuted: '#94a3b8',
        yhSuccess: '#22c55e',
        yhGold: '#d3b270'
      },
      boxShadow: {
        yhGlow: '0 24px 80px rgba(56, 189, 248, 0.18)',
        yhCard: '0 25px 70px rgba(0, 0, 0, 0.38)'
      },
      borderRadius: {
        yhCard: '28px',
        yhPanel: '22px'
      }
    }
  },
  plugins: []
};