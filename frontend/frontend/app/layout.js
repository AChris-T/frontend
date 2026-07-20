import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import Toaster from "@/components/ui/Toaster";
import { getSession } from "@/lib/session";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "UI Road Monitor",
  description: "GIS-Based Road Infrastructure Condition Monitoring System",
};

export default async function RootLayout({ children }) {
  const session = await getSession();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-surface-2">
        <Navbar user={session?.user || null} />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
