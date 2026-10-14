import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";
import { themeCookie, themeSchema } from "@/lib/theme";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Criativos Virais",
  description: "Roteiros de anúncios em vídeo para a sua operação.",
};
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const theme =
    themeSchema.safeParse(cookieStore.get(themeCookie)?.value).data ?? "dark";
  return (
    <html
      lang="pt-BR"
      className={cn("font-sans", geist.variable, theme === "dark" && "dark")}
    >
      <body>
        <ThemeProvider initialTheme={theme}>{children}</ThemeProvider>
      </body>
    </html>
  );
}
