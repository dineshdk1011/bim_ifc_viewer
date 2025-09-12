// app/layout.tsx
import "./globals.css";

export const metadata = {
  title: "IFC Viewer",
  description: "Sidebar + Canvas",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="h-full">{children}</body>
    </html>
  );
}
