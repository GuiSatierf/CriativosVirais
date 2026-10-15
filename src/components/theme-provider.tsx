"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { themeCookie, themeSchema, type Theme } from "@/lib/theme";

const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (theme: Theme) => void;
} | null>(null);

export function ThemeProvider({
  initialTheme,
  children,
}: {
  initialTheme: Theme;
  children: React.ReactNode;
}) {
  const [theme, updateTheme] = useState(initialTheme);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    function apply() {
      const resolved =
        theme === "system" ? (media.matches ? "dark" : "light") : theme;
      document.documentElement.classList.remove("light", "dark", "system");
      document.documentElement.classList.add(resolved);
      // Browser chrome (mobile address bar) follows the chosen theme.
      for (const meta of document.querySelectorAll<HTMLMetaElement>(
        'meta[name="theme-color"]',
      ))
        meta.content = resolved === "dark" ? "#232322" : "#efeeea";
    }
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);

  function setTheme(value: Theme) {
    const nextTheme = themeSchema.parse(value);
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${themeCookie}=${nextTheme}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
    updateTheme(nextTheme);
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
      <Toaster theme={theme} />
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme requires ThemeProvider");
  return context;
}
