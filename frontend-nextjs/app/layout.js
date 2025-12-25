import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { Toaster } from "sonner";

export const metadata = {
  title: "WhyBuy Platform",
  description: "E-commerce content generation platform",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/* Load runtime environment variables (injected by Cloud Run) */}
        <script src="/env.js" />
      </head>
      <body className="antialiased">
        <AuthProvider>
          {children}
          <Toaster position="top-right" />
        </AuthProvider>
      </body>
    </html>
  );
}
