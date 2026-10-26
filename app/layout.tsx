import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { getLang, getT } from "@/lib/lang";
import { LangProvider } from "./lang-provider";
import { RegisterSW } from "./register-sw";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: "Auth Signature",
    description: t("Verification codes for scanned client numbers"),
    applicationName: "Auth Signature",
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#4f46e5" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0e14" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const lang = await getLang();
  return (
    <html lang={lang} className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="min-h-full">
        <LangProvider lang={lang}>
          {children}
          <RegisterSW />
        </LangProvider>
      </body>
    </html>
  );
}
