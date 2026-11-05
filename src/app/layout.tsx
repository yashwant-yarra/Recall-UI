import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import { AuthProvider } from "@/components/AuthProvider";
import "katex/dist/katex.min.css";
import "./globals.css";

// Variable Archivo with its width axis: condensed for chapter headings, normal for reading.
const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"], axes: ["wdth"] });

const THEME_INIT = `try{var t=localStorage.getItem("recall-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export const metadata: Metadata = {
  title: "Recall",
  icons: { icon: { url: "/recall-mark.svg", type: "image/svg+xml", sizes: "any" } },
  description: "Search your documents and voice notes, and let an agent act on them with your approval.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${archivo.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        {/* Apply a saved light/dark choice before first paint so the page never flashes the other theme. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="min-h-full font-sans">
        <AuthProvider>{children}</AuthProvider>
      </body>
      {/* Loads GA4 only when an ID is configured, so local dev without one sends nothing. */}
      {process.env.NEXT_PUBLIC_GA_ID && <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} />}
    </html>
  );
}
