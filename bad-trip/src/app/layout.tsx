import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bad'Trip — itinéraires de voyage par l'IA",
  description:
    "Dépose textes, images et documents. L'IA analyse et crée l'itinéraire. Projets collaboratifs entre amis.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
