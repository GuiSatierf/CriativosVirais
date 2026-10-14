"use client";

import { createContext, useContext, useState } from "react";
import { Toaster } from "sonner";
import { themeCookie, themeSchema, type Theme } from "@/lib/theme";

const ThemeContext = createContext<{
  theme: Theme;
  toggleTheme: () => void;
} | null>(null);

export function ThemeProvider({
  initialTheme,
  children,
}: {
  initialTheme: Theme;
  children: React.ReactNode;
}) {
  const [theme, setTheme] = useState(initialTheme);

  function toggleTheme() {
    const nextTheme = themeSchema.parse(theme === "dark" ? "light" : "dark");
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${themeCookie}=${nextTheme}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
    setTheme(nextTheme);
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
      <Toaster theme={theme} richColors />
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme requires ThemeProvider");
  return context;
}
