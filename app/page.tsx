import type { Metadata } from "next";
import ClientRedirect from "./client-redirect";

export const metadata: Metadata = {
  title: "TopGuild - ระบบข้อมูลกิลด์",
  description:
    "ระบบจัดการสมาชิกกิลด์ จัดทีมสนามหลัก-สนามรอง จองคิวดันเจี้ยน และเชื่อมต่อฐานข้อมูล Firebase Real-time",
};

export default function Home() {
  return <ClientRedirect />;
}

