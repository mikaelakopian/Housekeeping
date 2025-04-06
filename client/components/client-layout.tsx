"use client";

import { Link } from "@heroui/react";
import clsx from "clsx";

import { Providers } from "@/app/providers";
import { fontSans } from "@/config/fonts";
import { Navbar } from "@/components/navbar";

interface ClientLayoutProps {
  children: React.ReactNode;
}

export function ClientLayout({ children }: ClientLayoutProps) {
  return (
    <div
      className={clsx(
        "min-h-screen bg-background font-sans antialiased",
        fontSans.variable,
      )}
    >
      <Providers>
        <div className="relative flex flex-col h-screen bg-gradient-to-b from-primary-50 to-background">
          <Navbar />
          <main className="container mx-auto max-w-7xl pt-16 px-6 flex-grow">
            {children}
          </main>
          <footer className="w-full flex items-center justify-center py-3 bg-primary-100">
            <Link
              isExternal
              className="flex items-center gap-1 text-primary-600 hover:text-primary-700"
              href="https://heroui.com?utm_source=next-app-template"
              title="heroui.com homepage"
            >
              <span className="text-primary-700">Powered by</span>
              <p className="text-primary-900 font-semibold">HeroUI</p>
            </Link>
          </footer>
        </div>
      </Providers>
    </div>
  );
}
