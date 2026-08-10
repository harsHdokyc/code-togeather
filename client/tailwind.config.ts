/** @type {import('tailwindcss').Config} */
export default {
    content: ["./src/**/*.{jsx,tsx}", "./*.html"],
    theme: {
        extend: {
            colors: {
                dark: "#0B1018",
                darkHover: "#1A202C",
                light: "#FFFFFF",
                primary: "#20D9A6",
                secondary: "#FFD21C",
                background: "#0B1018",
                white: "#FFFFFF",
                textMuted: "#D1D5DB",
                danger: "#ef4444",
            },
            fontFamily: {
                poppins: ["Poppins", "sans-serif"],
            },
            animation: {
                "up-down": "up-down 2s ease-in-out infinite alternate",
            },
        },
    },
    plugins: [],
}
