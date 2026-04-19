import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Read → ClickUp Sync Engine',
  description: 'Syncs Read.ai meeting transcripts into ClickUp via Claude AI',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
