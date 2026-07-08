import { Outfit, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata = {
  title: "Workflow - Jira 업무 보고서 자동화 대시보드",
  description: "지라 티켓을 분석하고 간편하게 일일/주간 보고서를 생성하세요.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko" className={`${plusJakartaSans.variable} ${outfit.variable}`}>
      <body>{children}</body>
    </html>
  );
}
