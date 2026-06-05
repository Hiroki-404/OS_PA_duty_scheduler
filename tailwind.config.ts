import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        'toss-blue': '#3182F6',
        'toss-blue-hover': '#1B64DA',
        'toss-gray': {
          100: '#F2F4F6',
          200: '#E8EBED',
          300: '#D1D6DB',
          400: '#B0B8C1',
          500: '#8B95A1',
          600: '#6B7684',
          700: '#4E5968',
          800: '#333D4B',
          900: '#191F28',
        },
      },
    },
  },
  plugins: [],
}
export default config
