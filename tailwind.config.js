/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        platform: {
          xhs: '#FF2442',
          bilibili: '#00A1D6',
          douyin: '#111111'
        }
      },
      fontFamily: {
        sans: ['Inter', 'SF Pro', 'Microsoft YaHei', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
}
