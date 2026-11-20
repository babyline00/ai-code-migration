import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI-Powered Code Migration Tool",
  description:
    "Describe a migration (e.g. 'CRA to Vite', 'CommonJS to ESM', 'moment to date-fns'). The LLM generates a codemod spec; a regex-based transform applies it; verification + diff/rollback UI let you review and persist.",
  keywords: [
    "codemod",
    "code migration",
    "AST",
    "regex transform",
    "Next.js",
    "LLM",
    "automation",
  ],
  authors: [{ name: "AI-Powered Code Migration Tool" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
