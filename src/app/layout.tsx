import type { Metadata, Viewport } from "next";
import { cookies, headers } from "next/headers";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { themeCookie, themeSchema } from "@/lib/theme";
import { panelReloadScript } from "@/components/panel-reload-script";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  // Each page names itself; the template adds the product so tabs and history stay distinguishable.
  title: { default: "Criativos Virais", template: "%s · Criativos Virais" },
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
  // The Content-Security-Policy only runs inline scripts carrying this request's nonce.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    // The panel reload script marks <html> before hydration (src/components/panel-reload-script.ts).
    <html lang="pt-BR" className={cn("font-sans", inter.variable, theme)} suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        {/* Here and not in the app layout: a script rendered on a client navigation never runs and React warns about it. */}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: panelReloadScript }} />
      </head>
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
