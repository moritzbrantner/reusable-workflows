import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";
import { Providers } from "./providers";

const repository = process.env.NEXT_PUBLIC_REPOSITORY ?? "Repository";

export const metadata: Metadata = {
  title: `${repository} · Repository status`,
  description: `Static GitHub Pages status and output view for ${repository}.`,
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
