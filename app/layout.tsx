import type { Metadata, Viewport } from "next";
import { getServerSession } from "next-auth";
import "./globals.css";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { isMissingAppearanceColumns } from "@/lib/appearance";
import { Providers } from "./providers";
import { ThemeProvider } from "./theme-provider";
import { ModalHost } from "./components/record-modal";
import { ToastProvider } from "./components/toast";
import { PwaRegistration } from "./components/pwa-registration";

const PALETTE_IDS = ["terracotta", "sage", "sky", "lavender", "honey", "rose"] as const;
type PaletteId = (typeof PALETTE_IDS)[number];
const DEFAULT_THEME = "light" as const;
const DEFAULT_PALETTE = "sage" as const;

function isPaletteId(value: string | null | undefined): value is PaletteId {
  return PALETTE_IDS.some((palette) => palette === value);
}

export const metadata: Metadata = {
  title: "Mi Ministerio",
  description: "Registro de actividad ministerial",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#9c4827",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as unknown as { id?: string } | undefined)?.id;
  let user: { appearanceTheme: string | null; appearancePalette: string | null } | null = null;
  if (userId) {
    try {
      user = await db.user.findUnique({
        where: { id: userId },
        select: { appearanceTheme: true, appearancePalette: true },
      });
    } catch (error) {
      if (!isMissingAppearanceColumns(error)) throw error;
    }
  }
  const theme = user?.appearanceTheme === "dark" ? "dark" : DEFAULT_THEME;
  // Sin sesión (login/registro): terracota claro fijo. El terracota es la
  // ausencia del atributo data-palette.
  const palette = !userId
    ? "terracotta"
    : isPaletteId(user?.appearancePalette)
      ? user.appearancePalette
      : DEFAULT_PALETTE;
  const themeScript = `(function(){var d=document.documentElement;d.classList.toggle('dark',${JSON.stringify(theme)}==='dark');var p=${JSON.stringify(palette)};if(p==='terracotta'){delete d.dataset.palette}else{d.dataset.palette=p}})()`;

  return (
    <html
      lang="es"
      suppressHydrationWarning
      className="h-full antialiased"
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <Providers>
          <ThemeProvider key={userId ?? "anonymous"} initialTheme={theme} initialPalette={palette} userKey={userId ?? "anonymous"}>
            <ToastProvider>
              {children}
              <ModalHost />
              <PwaRegistration />
            </ToastProvider>
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  );
}
