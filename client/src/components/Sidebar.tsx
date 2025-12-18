import { Link, useLocation } from "wouter";
import logoImg from "@assets/SEM FUNDO_1750819798590.png";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  Car,
  Users,
  Settings,
  LayoutDashboard,
  UserCog,
  Wrench,
  LogOut,
  X,
  FileText,
  Search,
  History,
  Shield,
  Clock,
  ChevronLeft,
  ChevronRight,
  Truck
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isCollapsed?: boolean;
  toggleCollapse?: () => void;
}

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Agendamentos", href: "/appointments", icon: Calendar },
  { name: "Ache uma data", href: "/find-date", icon: Search },
  { name: "Romaneios - Histórico de Rotas", href: "/routes-history", icon: History },
  { name: "Clientes", href: "/clients", icon: Users },
  { name: "Técnicos/Equipes", href: "/technicians", icon: UserCog },
  { name: "Veículos", href: "/vehicles", icon: Car },
  { name: "Serviços", href: "/services", icon: Wrench },
  { name: "Regras de Negócio", href: "/business-rules", icon: FileText },
  { name: "Prestadores", href: "/prestadores", icon: Truck },
];

export default function Sidebar({ isOpen, onClose, isCollapsed = false, toggleCollapse }: SidebarProps) {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const isActive = (href: string) => {
    if (href === "/dashboard" && (location === "/" || location === "/dashboard")) {
      return true;
    }
    return location === href;
  };

  // Adicionar gestão de usuários e tabelas de horário apenas para admins
  const navItems = user?.role === 'admin'
    ? [
      ...navigation,
      { name: "Gestão de Usuários", href: "/users", icon: Shield },
      { name: "Tabelas de Horário", href: "/access-schedules", icon: Clock }
    ]
    : navigation;

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 bg-white shadow-lg transform transition-all duration-300 ease-in-out flex flex-col
        ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
        ${isCollapsed ? 'w-20' : 'w-64'}
      `}>
        {/* Toggle Button (Desktop only) */}
        <div className="hidden lg:block absolute -right-3 top-20 z-10">
          <Button
            variant="secondary"
            size="icon"
            className="h-6 w-6 rounded-full shadow-md border border-gray-200 bg-white hover:bg-gray-100"
            onClick={toggleCollapse}
          >
            {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
          </Button>
        </div>

        {/* Header */}
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} h-16 bg-black px-4 transition-all duration-300 flex-shrink-0`}>
          <Link href="/dashboard">
            <div className="flex items-center space-x-2 cursor-pointer hover:opacity-80 transition-opacity">
              <img src={logoImg} alt="RotaFácil Logo" className="h-8 w-8" />
              {!isCollapsed && (
                <h1 className="text-xl font-bold text-white whitespace-nowrap overflow-hidden">
                  Rota<span className="text-burnt-yellow">Fácil</span>
                </h1>
              )}
            </div>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden text-white hover:bg-gray-800"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Navigation - Scrollable Area */}
        <nav className="flex-1 overflow-y-auto mt-8 px-3 pb-4">
          <ul className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);

              const LinkContent = (
                <Link
                  href={item.href}
                  className={`
                    flex items-center ${isCollapsed ? 'justify-center px-2' : 'px-4'} py-3 text-sm font-medium rounded-lg transition-colors
                    ${active
                      ? "bg-gray-100 text-burnt-yellow"
                      : "text-gray-700 hover:bg-gray-100"
                    }
                  `}
                  title={isCollapsed ? item.name : undefined}
                >
                  <Icon className={`h-5 w-5 ${isCollapsed ? '' : 'mr-3'} ${active ? "text-burnt-yellow" : "text-gray-600"}`} />
                  {!isCollapsed && <span className="truncate">{item.name}</span>}
                </Link>
              );

              return (
                <li key={item.name}>
                  {isCollapsed ? (
                    <TooltipProvider delayDuration={0}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          {LinkContent}
                        </TooltipTrigger>
                        <TooltipContent side="right" className="bg-black text-white border-black">
                          {item.name}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    LinkContent
                  )}
                </li>
              );
            })}
          </ul>

          {/* Plan info */}
          {!isCollapsed && (
            <div className="mt-8 pt-8 border-t border-gray-200 mx-4">
              <div className="py-2">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Plano Atual
                </p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900 capitalize">
                    {user?.plan || "Básico"}
                  </span>
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-burnt-yellow bg-opacity-10 text-burnt-yellow">
                    Upgrade
                  </span>
                </div>
              </div>
            </div>
          )}
        </nav>

        {/* User info - Fixed at bottom */}
        <div className={`p-4 border-t border-gray-200 bg-white flex-shrink-0 ${isCollapsed ? 'flex justify-center' : ''}`}>
          <div className="flex items-center w-full">
            <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-medium text-gray-600">
                {user?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
              </span>
            </div>
            {!isCollapsed && (
              <div className="ml-3 flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-700 truncate">{user?.name}</p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              </div>
            )}
            {!isCollapsed && (
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-400 hover:text-gray-600 ml-1"
                onClick={logout}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
