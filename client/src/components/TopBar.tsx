import { Button } from "@/components/ui/button";
import { Menu, Bell } from "lucide-react";
import { useLocation } from "wouter";
import { ThemeToggle } from "@/components/ThemeToggle";

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
  "/find-date": "Encontre uma Data",
  "/prestadores": "Prestadores",
  "/business-rules": "Regras de Negócio",
  "/users": "Gestão de Usuários",
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
    <header className="bg-white dark:bg-black shadow-sm border-b border-gray-200 dark:border-zinc-800 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-100 mr-4"
            onClick={onMenuClick}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-zinc-100">{pageName}</h2>
        </div>

        <div className="flex items-center space-x-4">
          <ThemeToggle />
          <Button variant="ghost" size="sm" className="text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300">
            <Bell className="h-5 w-5" />
          </Button>
          <div className="text-sm text-gray-600 dark:text-zinc-400 capitalize">
            {getCurrentDate()}
          </div>
        </div>
      </div>
    </header>
  );
}
