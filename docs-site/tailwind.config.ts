import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,tsx,md,mdx}',
    './src/**/*.{ts,tsx}',
    './theme.config.tsx',
    './styles/**/*.css',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0A0A0A',
        surface: '#141414',
        elevated: '#1E1E1E',
        border: '#2A2A2A',
        accent: '#C8F55A',
        text: '#FFFFFF',
        muted: '#A3A3A3',
        dim: '#525252',
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(200, 245, 90, 0.25), 0 0 30px rgba(200, 245, 90, 0.08)',
      },
    },
  },
  plugins: [],
}

export default config
