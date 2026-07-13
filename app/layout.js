import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"]
});

export const metadata = {
  title: "SprintFlow - Jira 업무 보고서 자동화 대시보드",
  description: "지라 API를 분석하여 간편하게 일일/주간 업무 보고서를 생성하고 컨플루언스에 등록하세요.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={plusJakartaSans.className} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
