import { ClerkProvider } from "@clerk/nextjs";
import { LiveblocksProviderWrapper } from "@/components/LiveblocksProvider";
import "./globals.css";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <link rel="icon" href="/logo.svg" />
        <title>virtuOffice</title>
      </head>
      <body>
        <ClerkProvider>
          <LiveblocksProviderWrapper>
            {children}
          </LiveblocksProviderWrapper>
        </ClerkProvider>
      </body>
    </html>
  );
}
