import { Link, useLocation } from "wouter";
import { useState, useEffect } from "react";
import logoImg from "@assets/SEM FUNDO_1750819798590.png";
import { useAuth } from "@/lib/auth";
import { usePendingAppointments } from "@/hooks/usePendingAppointments";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  Briefcase,
  Database,
  Lock,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Truck,
  BarChart3,
  FileSearch,
  TrendingUp
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isCollapsed?: boolean;
  toggleCollapse?: () => void;
}

type NavItem = {
  name: string;
  href: string;
  icon: any;
};

type NavGroup = {
  title: string;
  icon: any; // Icon for the group
  items?: NavItem[]; // If it has subitems
  href?: string; // If it's a direct link (like Dashboard)
  permission?: 'all' | 'admin' | 'superadmin';
};

export default function Sidebar({ isOpen, onClose, isCollapsed = false, toggleCollapse }: SidebarProps) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { pendingCount } = usePendingAppointments();

  // State for open submenus
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    "Operações": true, // Default open
    "Cadastros": false,
    "Administração": false,
    "Super Admin": true
  });

  const toggleGroup = (groupTitle: string) => {
    if (isCollapsed && toggleCollapse) {
      toggleCollapse();
      // Wait a bit for expanding animation if needed, but here sync update is fine
      setOpenGroups(prev => ({ ...prev, [groupTitle]: true }));
    } else {
      setOpenGroups(prev => ({ ...prev, [groupTitle]: !prev[groupTitle] }));
    }
  };

  const isActive = (href: string) => {
    if (href === "/dashboard" && (location === "/" || location === "/dashboard")) {
      return true;
    }
    return location === href;
  };

  // Check if any child of a group is active to auto-expand or highlight
  const isGroupActive = (group: NavGroup) => {
    if (group.href) return isActive(group.href);
    return group.items?.some(item => isActive(item.href));
  };

  // Auto-expand groups based on active route on mount or location change
  useEffect(() => {
    if (isCollapsed) return;

    navigationGroups.forEach(group => {
      if (group.items && isGroupActive(group)) {
        setOpenGroups(prev => ({ ...prev, [group.title]: true }));
      }
    });
  }, [location, isCollapsed]);

  // Permissions logic
  const isSuperAdmin = user?.isSuperAdmin || user?.email === 'lucaspmastaler@gmail.com';
  const isAdmin = user?.role === 'admin' || isSuperAdmin;

  const navigationGroups: NavGroup[] = [
    {
      title: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
      permission: 'all'
    },
    {
      title: "Operações",
      icon: Briefcase,
      permission: 'all',
      items: [
        { name: "Agendamentos", href: "/appointments", icon: Calendar },
        { name: "Encontre uma data", href: "/find-date", icon: Search },
        { name: "Romaneios – Execução & Histórico", href: "/routes-history", icon: History },
        { name: "Prestadores", href: "/prestadores", icon: Truck },
      ]
    },
    {
      title: "Cadastros",
      icon: Database,
      permission: 'all',
      items: [
        { name: "Serviços", href: "/services", icon: Wrench },
        { name: "Veículos", href: "/vehicles", icon: Car },
        { name: "Técnicos / Equipes", href: "/technicians", icon: UserCog },
        { name: "Clientes", href: "/clients", icon: Users },
      ]
    },
    {
      title: "Administração",
      icon: Settings,
      permission: 'admin',
      items: [
        { name: "Gestão de Usuários", href: "/users", icon: Shield },
        { name: "Regras de Negócio", href: "/business-rules", icon: FileText },
        { name: "Auditoria", href: "/admin/audit", icon: FileSearch },
      ]
    },
    {
      title: "Super Admin",
      icon: Lock,
      permission: 'superadmin',
      items: [
        { name: "ADS", href: "/ads", icon: TrendingUp },
        { name: "Métricas", href: "/admin/metrics", icon: BarChart3 },
      ]
    }
  ];

  const visibleGroups = navigationGroups.filter(group => {
    if (group.permission === 'superadmin') return isSuperAdmin;
    if (group.permission === 'admin') return isAdmin;
    return true;
  });

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
        <nav className="flex-1 overflow-y-auto mt-6 px-3 pb-4 custom-scrollbar">
          <ul className="space-y-1">
            {visibleGroups.map((group) => {
              const GroupIcon = group.icon;
              const isGroupOpen = openGroups[group.title];
              const groupActive = isGroupActive(group);

              if (group.items) {
                // Submenu Group
                return (
                  <li key={group.title} className="mb-2">
                    <Collapsible
                      open={isCollapsed ? false : isGroupOpen}
                      onOpenChange={() => toggleGroup(group.title)}
                      className="w-full"
                    >
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          className={cn(
                            "w-full justify-between hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors",
                            isCollapsed ? "px-2 justify-center" : "px-3",
                            groupActive && !isCollapsed ? "text-amber-600 dark:text-amber-500 font-medium" : "text-gray-600 dark:text-zinc-400"
                          )}
                          title={isCollapsed ? group.title : undefined}
                        >
                          <div className="flex items-center">
                            <GroupIcon className={cn("h-5 w-5", isCollapsed ? "" : "mr-3", groupActive ? "text-amber-600 dark:text-amber-500" : "")} />
                            {!isCollapsed && <span className="truncate">{group.title}</span>}
                          </div>
                          {!isCollapsed && (
                            <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", isGroupOpen ? "transform rotate-180" : "")} />
                          )}
                        </Button>
                      </CollapsibleTrigger>

                      <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
                        {!isCollapsed && (
                          <ul className="mt-1 ml-4 space-y-1 border-l-2 border-gray-100 dark:border-zinc-800 pl-2">
                            {group.items.map(item => {
                              const ItemIcon = item.icon;
                              const active = isActive(item.href);
                              const isRoutesHistory = item.href === '/routes-history';
                              const hasPending = isRoutesHistory && pendingCount > 0;

                              return (
                                <li key={item.name}>
                                  <Link href={item.href}>
                                    <div className={cn(
                                      "flex items-center px-3 py-2 text-sm rounded-md transition-colors cursor-pointer",
                                      active
                                        ? "bg-amber-50 dark:bg-zinc-800/50 text-amber-700 dark:text-amber-500 font-medium"
                                        : "text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-200 hover:bg-gray-50 dark:hover:bg-zinc-800/50"
                                    )}>
                                      <ItemIcon className={cn("h-4 w-4 mr-2", active ? "text-amber-600 dark:text-amber-500" : "opacity-70")} />
                                      <span className="truncate flex-1">{item.name}</span>
                                      {hasPending && (
                                        <Badge variant="destructive" className="ml-1 h-5 px-1.5 bg-red-500">
                                          {pendingCount}
                                        </Badge>
                                      )}
                                    </div>
                                  </Link>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </CollapsibleContent>
                    </Collapsible>
                  </li>
                );
              } else {
                // Direct Link Item (Dashboard)
                const active = isActive(group.href!);
                return (
                  <li key={group.title} className="mb-2">
                    <Link href={group.href!}>
                      <div className={cn(
                        "flex items-center w-full py-2 rounded-md transition-colors cursor-pointer",
                        isCollapsed ? "justify-center px-2" : "px-3",
                        active
                          ? "bg-gray-100 dark:bg-zinc-800 text-amber-600 dark:text-amber-500 font-medium"
                          : "text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800"
                      )}
                        title={isCollapsed ? group.title : undefined}
                      >
                        <GroupIcon className={cn("h-5 w-5", isCollapsed ? "" : "mr-3", active ? "text-amber-600 dark:text-amber-500" : "")} />
                        {!isCollapsed && <span>{group.title}</span>}
                      </div>
                    </Link>
                  </li>
                );
              }
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
