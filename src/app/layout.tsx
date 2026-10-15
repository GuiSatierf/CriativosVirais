import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { themeCookie, themeSchema } from "@/lib/theme";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Criativos Virais",
  description:
    "Crie roteiros de anúncio em vídeo a partir da sua oferta e dos resultados dos seus criativos.",
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light dark",
  // Matches --background; the theme provider updates it for a forced theme.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#efeeea" },
    { media: "(prefers-color-scheme: dark)", color: "#232322" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const theme =
    themeSchema.safeParse(cookieStore.get(themeCookie)?.value).data ?? "system";
  return (
    <html lang="pt-BR" className={cn("font-sans", inter.variable, theme)}>
      <body>
        <a className="skip-link" href="#main-content">
          Ir para o conteúdo
        </a>
        <ThemeProvider initialTheme={theme}>
          <TooltipProvider delay={300}>{children}</TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
