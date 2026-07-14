import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import AppLayout from "@/components/AppLayout";
import EntryGate from "@/components/EntryGate";

export const metadata: Metadata = {
  title: "Finance System",
  description: "Contabilidad y finanzas personales",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans">
        <Suspense fallback={<div className="p-4 text-sm text-zinc-500">Cargando interfaz...</div>}>
          <EntryGate>
            <AppLayout>{children}</AppLayout>
          </EntryGate>
        </Suspense>
      </body>
    </html>
  );
}
