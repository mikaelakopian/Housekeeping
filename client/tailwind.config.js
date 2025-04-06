import {heroui} from "@heroui/theme"

/** @type {import('tailwindcss').Config} */
const config = {
  content: [
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      screens: {
        'xs': '480px', // Добавляем экстра-маленький размер экрана
      },
    },
  },
  plugins: [heroui({
    themes: {
      light: {
        colors: {
          // Пастельный персиковый цвет как основной цвет
          primary: {
            50: "#FFF5F0",
            100: "#FFE6D9",
            200: "#FFCCB3",
            300: "#FFB38C",
            400: "#FF9966",
            500: "#FF8040", // основной оттенок персикового
            600: "#E66A33",
            700: "#CC5526",
            800: "#B34019",
            900: "#992B0D",
            DEFAULT: "#FFB38C", // персиковый цвет по умолчанию (пастельный)
            foreground: "#4D1F0D"
          },
          // Фон и текст
          background: "#FFF9F5", // очень светлый персиковый для фона
          foreground: "#4D3328", // темно-коричневый для текста
          
          // Второстепенный цвет
          secondary: {
            50: "#F0FFF5",
            100: "#D9FFEC",
            200: "#B3FFD9",
            300: "#8CFFC6",
            400: "#66FFB3",
            500: "#40FFA0",
            600: "#33E68C",
            700: "#26CC78",
            800: "#19B364",
            900: "#0D9950",
            DEFAULT: "#8CFFC6", // пастельный мятный зеленый
            foreground: "#0D4D28"
          },
          
          // Акцентный цвет
          focus: "#FF8040",
        }
      }
    }
  })],
}

export default config;