// tailwind.config.js
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // WhatsApp inspired colors
        'whatsapp': {
          50: '#f0f9f0',
          100: '#dcf8e6',
          200: '#b9f0ce',
          300: '#85e5ad',
          400: '#00a884', // WhatsApp green
          500: '#008f75',
          600: '#007a65',
          700: '#005c4b',
          800: '#004539',
          900: '#002e26',
        },
        'whatsapp-dark': {
          50: '#f8f9fa',
          100: '#e9edef',
          200: '#d1d7db',
          300: '#b5bec5',
          400: '#8696a0',
          500: '#667781',
          600: '#54656f',
          700: '#3b4a54',
          800: '#2a3942', // WhatsApp dark sidebar
          900: '#111b21', // WhatsApp dark background
        }
      },
      animation: {
        'pulse-border': 'pulseBorder 2s infinite',
        'shimmer': 'shimmer 1.5s infinite',
        'fade-in': 'fadeIn 0.3s ease',
        'slide-up': 'slideUp 0.4s ease',
      },
      keyframes: {
        pulseBorder: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(0, 168, 132, 0.4)' },
          '70%': { boxShadow: '0 0 0 10px rgba(0, 168, 132, 0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        fadeIn: {
          'from': { opacity: 0 },
          'to': { opacity: 1 },
        },
        slideUp: {
          'from': { opacity: 0, transform: 'translateY(30px)' },
          'to': { opacity: 1, transform: 'translateY(0)' },
        },
      },
      boxShadow: {
        'whatsapp': '0 2px 8px rgba(0, 168, 132, 0.3)',
        'whatsapp-lg': '0 8px 20px rgba(0, 168, 132, 0.4)',
        'whatsapp-dark': '0 10px 30px rgba(0, 0, 0, 0.5)',
      },
      gradientColorStops: theme => ({
        ...theme('colors'),
        'whatsapp-start': '#00a884',
        'whatsapp-end': '#00d394',
        'whatsapp-dark-start': '#005c4b',
        'whatsapp-dark-end': '#007a65',
      }),
    },
  },
  plugins: [],
}