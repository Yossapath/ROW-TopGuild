import type { Metadata } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://row-topguild.vercel.app";

export const metadata: Metadata = {
  title: "เข้าสู่ระบบ | TopGuild",
  description: "ระบบจัดการกิลด์ TopGuild เข้าสู่ระบบสำหรับสมาชิกและผู้ดูแล",
  openGraph: {
    title: "เข้าสู่ระบบ | TopGuild",
    description: "ระบบจัดการกิลด์ TopGuild เข้าสู่ระบบสำหรับสมาชิกและผู้ดูแล",
    url: `${siteUrl}/login`,
    siteName: "TopGuild",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "TopGuild Login",
        type: "image/png",
      },
    ],
    locale: "th_TH",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "เข้าสู่ระบบ | TopGuild",
    description: "ระบบจัดการกิลด์ TopGuild เข้าสู่ระบบสำหรับสมาชิกและผู้ดูแล",
    images: ["/og-image.png"],
  },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
