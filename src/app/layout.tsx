import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import { AuthProvider } from "@/components/AuthProvider";
import "katex/dist/katex.min.css";
import "./globals.css";

// Variable Archivo with its width axis: condensed for chapter headings, normal for reading.
const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"], axes: ["wdth"] });

export const metadata: Metadata = {
  title: "Recall",
  icons: { icon: { url: "/recall-mark.svg", type: "image/svg+xml", sizes: "any" } },
  description: "Search your documents and voice notes, and let an agent act on them with your approval.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${archivo.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
