import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        theme: {
          bg: "var(--theme-bg)",
          sidebar: "var(--theme-sidebar)",
          sidebarActive: "var(--theme-sidebar-active)",
          sidebarTextActive: "var(--theme-sidebar-text-active)",
          sidebarTextInactive: "var(--theme-sidebar-text)",
          panel: "var(--theme-panel)",
          input: "var(--theme-input)",
          border: "var(--theme-border)",
          borderHover: "var(--theme-border-hover)",
          divider: "var(--theme-divider)",
          text: "var(--theme-text)",
          textSecondary: "var(--theme-text-secondary)",
          textMuted: "var(--theme-text-muted)",
          primary: "var(--theme-primary)",
          primaryHover: "var(--theme-primary-hover)",
          success: "var(--theme-success)",
          warning: "var(--theme-warning)",
          danger: "var(--theme-danger)",
          purple: "var(--theme-purple)",
        },
        // Guild Blue theme (สีเดิมของ Topguild)
        guild: {
          50:  "#eff6ff",
          100: "#dbeeff",
          300: "#8fc4ef",
          500: "#2f8fd6",
          700: "#14588f",
          900: "#0b3d63",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["var(--font-prompt)", "sans-serif"],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
