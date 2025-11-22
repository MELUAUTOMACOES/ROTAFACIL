import { useState } from "react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import { useAccessScheduleMonitor } from "@/hooks/useAccessScheduleMonitor";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Monitorar horário de acesso do usuário
  useAccessScheduleMonitor();

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
