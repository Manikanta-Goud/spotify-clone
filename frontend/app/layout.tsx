import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Spotify Clone",
  description: "A full-stack music streaming app built with Next.js and Node.js",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full overflow-hidden bg-sp-black text-sp-text">
        {children}
      </body>
    </html>
  );
}
