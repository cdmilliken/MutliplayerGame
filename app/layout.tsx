import type { Metadata } from "next";
import "./globals.css";
import "./solo.css";

export const metadata: Metadata = {
  title: "Split Decision — Less is more.",
  description: "Pick a side. Dodge the crowd. An instant multiplayer party game for 3–12 friends. No downloads, no accounts, just a room code.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
