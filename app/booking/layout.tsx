import type { Metadata } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://row-topguild.vercel.app";

export const metadata: Metadata = {
  title: "จองคิวดันเจี้ยน",
  description: "ระบบจองคิวดันเจี้ยนกิลด์ ตรวจสอบสถานะ คิวที่กำลังลง และเวลาประมาณการ Real-time",
  openGraph: {
    title: "จองคิวดันเจี้ยน | TopGuild",
    description: "ระบบจองคิวดันเจี้ยนกิลด์ ตรวจสอบสถานะ คิวที่กำลังลง และเวลาประมาณการ Real-time",
    url: `${siteUrl}/booking`,
    siteName: "TopGuild",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "TopGuild Dungeon Booking",
        type: "image/png",
      },
    ],
    locale: "th_TH",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "จองคิวดันเจี้ยน | TopGuild",
    description: "ระบบจองคิวดันเจี้ยนกิลด์ ตรวจสอบสถานะ คิวที่กำลังลง และเวลาประมาณการ Real-time",
    images: ["/og-image.png"],
  },
};

export default function BookingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
