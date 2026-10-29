import "@fontsource-variable/plus-jakarta-sans";
import "./globals.css";

import type { Metadata, Viewport } from "next";

import { Providers } from "./providers";

export const metadata: Metadata = {
  title: { default: "CareerOS", template: "%s · CareerOS" },
  description: "Find jobs, build your resume, prepare for interviews and grow your skills, all in one place.",
};

export const viewport: Viewport = { themeColor: "#0E1030" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
