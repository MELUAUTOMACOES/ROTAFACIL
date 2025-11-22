import { Button } from "@/components/ui/button";
import { Menu, Bell } from "lucide-react";
import { useLocation } from "wouter";

interface TopBarProps {
  onMenuClick: () => void;
}

const pageNames: Record<string, string> = {
  "/": "Dashboard",
  "/dashboard": "Dashboard", 
  "/appointments": "Agendamentos",
  "/routes-history": "Romaneios - Histórico de Rotas",
  "/clients": "Clientes",
  "/technicians": "Técnicos",
  "/vehicles": "Veículos",
  "/services": "Serviços",
};

export default function TopBar({ onMenuClick }: TopBarProps) {
  const [location] = useLocation();
  
  const getCurrentDate = () => {
    return new Date().toLocaleDateString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const pageName = pageNames[location] || "Dashboard";

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden text-gray-600 hover:text-gray-900 mr-4"
            onClick={onMenuClick}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <h2 className="text-2xl font-semibold text-gray-900">{pageName}</h2>
        </div>
        
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" className="text-gray-400 hover:text-gray-600">
            <Bell className="h-5 w-5" />
          </Button>
          <div className="text-sm text-gray-600 capitalize">
            {getCurrentDate()}
          </div>
        </div>
      </div>
    </header>
  );
}
