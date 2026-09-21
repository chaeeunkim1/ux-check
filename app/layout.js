import "./globals.css";

export const metadata = { title: "UX Check", description: "업무 화면을 근거와 함께 검토하는 AI UI·UX 도구" };

export default function RootLayout({ children }) {
  return <html lang="ko"><body>{children}</body></html>;
}
