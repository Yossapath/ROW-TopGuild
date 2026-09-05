import type { Metadata } from "next";
import { Prompt } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

const prompt = Prompt({
  subsets: ["latin", "thai"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-prompt",
});

export const metadata: Metadata = {
  title: "Topguild | ROW",
  description: "ระบบจัดการกิลด์ Ragnarok",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" className="dark" suppressHydrationWarning>
      <body className={`min-h-screen bg-background text-foreground antialiased ${prompt.variable} font-sans`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
