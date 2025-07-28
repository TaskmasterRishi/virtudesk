import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <link rel="icon" href="/logo.svg"/>
        </head>
        <body>
          {children}</body>
      </html>
    </ClerkProvider>
  );
}
