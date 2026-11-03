import type { Metadata } from "next";
import "./globals.css";
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";
import { AppPlaybackBar } from "@/components/playback-bar";
import { QueryProvider } from "@/lib/api/query-provider";

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "Frontend",
  description: "Frontend",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={cn("h-full antialiased", "font-sans", inter.variable)}>
      <body className="min-h-full flex flex-col">
        <QueryProvider>
          {children}
          {/* Every page but the landing and sign-in/sign-up ends with the playback bar */}
          <AppPlaybackBar />
        </QueryProvider>
      </body>
    </html>
  );
}
