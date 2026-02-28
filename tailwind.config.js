/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./*.{js,ts,jsx,tsx}",
        "./components/**/*.{js,ts,jsx,tsx}",
        "./services/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                cyber: {
                    black: '#07080a',
                    dark: '#0a0c10',
                    panel: '#101217',
                    cyan: '#00e5ff', // Slightly deeper
                    magenta: '#f43f5e', // Rose/Red instead of hot pink
                    green: '#10b981', // Emerald instead of pure green
                    dim: 'rgba(0, 229, 255, 0.1)',
                },
                brand: {
                    primary: '#f97316', // Orange
                    dark: '#0f1115'
                }
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
                display: ['Space Grotesk', 'sans-serif'],
                mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
            },
            boxShadow: {
                'neon-cyan': '0 0 10px rgba(0, 229, 255, 0.2)',
                'neon-magenta': '0 0 10px rgba(244, 63, 94, 0.2)',
                'neon-green': '0 0 10px rgba(16, 185, 129, 0.2)',
                'neon-red': '0 0 10px rgba(239, 68, 68, 0.2)',
                'panel': '0 8px 32px 0 rgba(0, 0, 0, 0.36)',
            },
            animation: {
                'pulse-fast': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'scanline': 'scanline 10s linear infinite',
                'float': 'float 6s ease-in-out infinite',
            },
            keyframes: {
                scanline: {
                    '0%': { transform: 'translateY(-100%)' },
                    '100%': { transform: 'translateY(100%)' },
                },
                float: {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-10px)' },
                }
            }
        },
    },
    plugins: [],
}
