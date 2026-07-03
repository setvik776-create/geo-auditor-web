import "./globals.css";

export const metadata = {
  title: "GEO Auditor — Generative Engine Optimization & Semantic Search Auditor",
  description: "Optimize your brand copy and digital assets for indexing, citation, and recommendation visibility in Perplexity, Gemini, and SearchGPT.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="lt">
      <body>
        <div className="bg-mesh"></div>
        {children}
      </body>
    </html>
  );
}
