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
  metadataBase: new URL("https://rowtopguild.vercel.app"),
  title: {
    default: "TopGuild - ระบบข้อมูลกิลด์",
    template: "%s | TopGuild",
  },
  description:
    "ระบบจัดการสมาชิกกิลด์ จัดทีมสนามหลัก-สนามรอง จองคิวดันเจี้ยน และเชื่อมต่อฐานข้อมูล Firebase Real-time",
  openGraph: {
    title: "TopGuild - ระบบข้อมูลกิลด์",
    description:
      "ระบบจัดการสมาชิกกิลด์ จัดทีมสนามหลัก-สนามรอง จองคิวดันเจี้ยน และเชื่อมต่อฐานข้อมูล Firebase Real-time",
    url: "https://rowtopguild.vercel.app",
    siteName: "TopGuild",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "TopGuild Banner",
      },
    ],
    locale: "th_TH",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "TopGuild - ระบบข้อมูลกิลด์",
    description:
      "ระบบจัดการสมาชิกกิลด์ จัดทีมสนามหลัก-สนามรอง จองคิวดันเจี้ยน และเชื่อมต่อฐานข้อมูล Firebase Real-time",
    images: ["/og-image.png"],
  },
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
