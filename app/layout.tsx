import type { Metadata } from "next";
import { Suspense } from "react";
import { Nav } from "@/components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "ECR Monitor",
  description: "GA4 Shopping + Checkout ECR monitoring dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Suspense fallback={<div className="h-[49px] border-b border-ink-100" />}>
          <Nav />
        </Suspense>
        <main className="mx-auto max-w-[1400px] px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
