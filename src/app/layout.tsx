import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="pt-BR">
      <body className="bg-[#0a0a0f] text-white antialiased">{children}</body>
    </html>
  );
}
