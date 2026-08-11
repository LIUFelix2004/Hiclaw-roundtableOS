import type { Metadata } from "next";
import "./globals.css";
import { SocketProvider } from "@/hooks/useSocket";
import { Shell } from "@/components/shell/Shell";

export const metadata: Metadata = {
  title: "Hermes AgentOS",
  description: "Multi-agent orchestration workspace",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full"><SocketProvider><Shell>{children}</Shell></SocketProvider></body>
    </html>
  );
}
