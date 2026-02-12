import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import TRPCProvider from "@/lib/trpc-provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Trading Bot SaaS - Automatiza tu trading",
  description: "SaaS de trading automatizado con backtesting avanzado",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <TRPCProvider>{children}</TRPCProvider>
      </body>
    </html>
  );
}
