import type { Metadata } from "next";
import "./globals.css";
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";
import { PlaybackAudio } from "@/components/playback-audio";
import { LikedSongsSync } from "@/components/liked-songs-sync";
import { AppPlaybackBar } from "@/components/playback-bar";
import { QueryProvider } from "@/lib/api/query-provider";
import { CommentsPanelProvider } from "@/components/comments/comments-panel"

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "Zovic",
  description: "Streaming de música com busca, fila e playlists que têm a sua cara",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={cn("h-full antialiased", "font-sans", inter.variable)}>
      <body className="min-h-full flex flex-col">
        <QueryProvider>
          {/* One comments panel for the whole app: any track list, and the playback bar, opens it from its 💬 button */}
          <CommentsPanelProvider>
            {children}
            {/* Every page but the landing and sign-in/sign-up ends with the playback bar */}
            <AppPlaybackBar />
          </CommentsPanelProvider>
          {/* The sound plays on every page, the landing and sign-in included, so it never stops on a page change */}
          <PlaybackAudio />
          {/* The hearts this browser already had go into "Músicas Curtidas" (HU-34), once per session */}
          <LikedSongsSync />
        </QueryProvider>
      </body>
    </html>
  );
}