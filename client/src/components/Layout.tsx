import { useState } from "react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps = {}) {
  if (!children) {
    console.warn("[Layout] Renderizado sem children!");
    return <div>Erro: Layout renderizado sem conteúdo.</div>;
  }
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="lg:pl-64 flex flex-col min-h-screen">
        <TopBar onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
