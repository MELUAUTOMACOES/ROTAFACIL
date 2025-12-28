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

  ChevronLeft,
  ChevronRight,
  Truck,
  BarChart3,
  FileSearch
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
  { name: "Prestadores", href: "/prestadores", icon: Truck },
  { name: "Clientes", href: "/clients", icon: Users },
  { name: "Técnicos/Equipes", href: "/technicians", icon: UserCog },
  { name: "Veículos", href: "/vehicles", icon: Car },
  { name: "Serviços", href: "/services", icon: Wrench },
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
  // Adicionar métricas apenas para superadmin
  let navItems = user?.role === 'admin'
    ? [
      ...navigation,
      { name: "Gestão de Usuários", href: "/users", icon: Shield },
      { name: "Auditoria", href: "/admin/audit", icon: FileSearch },
      { name: "Regras de Negócio", href: "/business-rules", icon: FileText }
    ]
    : navigation;

  // Link de métricas apenas para superadmin (fundador)
  // Fallback: verifica flag OU email hardcoded para garantir acesso imediato
  const isSuperAdmin = user?.isSuperAdmin || user?.email === 'lucaspmastaler@gmail.com';

  if (isSuperAdmin) {
    navItems = [
      ...navItems,
      { name: "Métricas", href: "/admin/metrics", icon: BarChart3 }
    ];
  }

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
        fixed inset-y-0 left-0 z-50 bg-white dark:bg-black shadow-lg transform transition-all duration-300 ease-in-out flex flex-col border-r border-gray-200 dark:border-zinc-800
        ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
        ${isCollapsed ? 'w-20' : 'w-64'}
      `}>
        <div className="hidden lg:block absolute -right-3 top-20 z-10">
          <Button
            variant="secondary"
            size="icon"
            className="h-6 w-6 rounded-full shadow-md border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-700"
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
                  <span className="text-gray-400 font-normal ml-1">Frotas</span>
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
                      ? "bg-gray-100 dark:bg-zinc-800 text-amber-600 dark:text-amber-500"
                      : "text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800"
                    }
                  `}
                  title={isCollapsed ? item.name : undefined}
                >
                  <Icon className={`h-5 w-5 ${isCollapsed ? '' : 'mr-3'} ${active ? "text-amber-600 dark:text-amber-500" : "text-gray-500 dark:text-zinc-400"}`} />
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
            <div className="mt-8 pt-8 border-t border-gray-200 dark:border-zinc-700 mx-4">
              <div className="py-2">
                <p className="text-xs font-medium text-gray-500 dark:text-zinc-500 uppercase tracking-wide">
                  Plano Atual
                </p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900 dark:text-zinc-100 capitalize">
                    {user?.plan || "Básico"}
                  </span>
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-500 text-black">
                    Upgrade
                  </span>
                </div>
              </div>
            </div>
          )}
        </nav>

        {/* User info - Fixed at bottom */}
        <div className={`p-4 border-t border-gray-200 dark:border-zinc-700 bg-white dark:bg-black flex-shrink-0 ${isCollapsed ? 'flex justify-center' : ''}`}>
          <div className="flex items-center w-full">
            <div className="w-8 h-8 bg-gray-200 dark:bg-zinc-700 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-medium text-gray-600 dark:text-zinc-300">
                {user?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
              </span>
            </div>
            {!isCollapsed && (
              <div className="ml-3 flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-700 dark:text-zinc-200 truncate">{user?.name}</p>
                <p className="text-xs text-gray-500 dark:text-zinc-400 truncate">{user?.email}</p>
              </div>
            )}
            {!isCollapsed && (
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 ml-1"
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
