/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        leaf: {
          50: "#f5f7f1",
          100: "#e8ede0",
          200: "#d1dcc0",
          300: "#b0c79a",
          400: "#8ab370",
          500: "#6c942c",
          600: "#567a22",
          700: "#42601a",
          800: "#354a15",
          900: "#2a3a10",
          950: "#151f08",
        },
        gold: {
          50: "#fefcf5",
          100: "#fef6e6",
          200: "#fce8c8",
          300: "#fad599",
          400: "#f7c256",
          500: "#efb62e",
          600: "#d4941f",
          700: "#b07618",
          800: "#8d5d14",
          900: "#6a460f",
          950: "#3d2b08",
        },
        ink: "#1c1a15",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
      },
    },
  },
  plugins: [],
};
