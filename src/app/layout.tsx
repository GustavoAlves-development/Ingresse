import type { Metadata } from "next";
import "./globals.css";
import { JetBrains_Mono, Space_Grotesk, Work_Sans } from "next/font/google";
import { cn } from "@/lib/utils";

const workSans = Work_Sans({ subsets: ["latin"], variable: "--font-sans" });
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-heading",
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Plataforma de Ingressos",
  description: "SaaS de venda de ingressos e controle de portaria",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="pt-BR"
      className={cn(
        "font-sans",
        workSans.variable,
        spaceGrotesk.variable,
        jetbrainsMono.variable,
      )}
    >
      <body className="bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
