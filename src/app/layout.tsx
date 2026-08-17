import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ERP CINERGIA",
  description: "Sistema interno de gestión de CINERGIA — Universidad Científica del Sur",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
