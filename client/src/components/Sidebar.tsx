import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  Car,
  Users,
  Settings,
  MapPin,
  LayoutDashboard,
  UserCog,
  Wrench,
  LogOut,
  X,
  FileText,
  Search
} from "lucide-react";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Agendamentos", href: "/appointments", icon: Calendar },
  { name: "Ache uma data", href: "/find-date", icon: Search },
  { name: "Roteirização", href: "/routes", icon: MapPin },
  { name: "Clientes", href: "/clients", icon: Users },
  { name: "Técnicos/Equipes", href: "/technicians", icon: UserCog },
  { name: "Veículos", href: "/vehicles", icon: Car },
  { name: "Serviços", href: "/services", icon: Wrench },
  { name: "Regras de Negócio", href: "/business-rules", icon: FileText },
];

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const isActive = (href: string) => {
    if (href === "/dashboard" && (location === "/" || location === "/dashboard")) {
      return true;
    }
    return location === href;
  };

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
        fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
      `}>
        {/* Header */}
        <div className="flex items-center justify-between h-16 bg-black px-6">
          <Link href="/dashboard">
            <div className="flex items-center space-x-2 cursor-pointer hover:opacity-80 transition-opacity">
              <img src="/attached_assets/SEM FUNDO_1750819798590.png" alt="RotaFácil Logo" className="h-8 w-8" />
              <h1 className="text-xl font-bold text-white">
                Rota<span className="text-burnt-yellow">Fácil</span>
              </h1>
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
        
        {/* Navigation */}
        <nav className="mt-8 px-4">
          <ul className="space-y-2">
            {navigation.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              
              return (
                <li key={item.name}>
                  <Link 
                    href={item.href}
                    className={`
                      flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors
                      ${active 
                        ? "bg-gray-100 text-burnt-yellow" 
                        : "text-gray-700 hover:bg-gray-100"
                      }
                    `}
                  >
                    <Icon className={`h-5 w-5 mr-3 ${active ? "text-burnt-yellow" : "text-gray-600"}`} />
                    {item.name}
                  </Link>
                </li>
              );
            })}
          </ul>
          
          {/* Plan info */}
          <div className="mt-8 pt-8 border-t border-gray-200">
            <div className="px-4 py-2">
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
        </nav>
        
        {/* User info */}
        <div className="absolute bottom-0 w-full p-4 border-t border-gray-200">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-gray-600">
                {user?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
              </span>
            </div>
            <div className="ml-3 flex-1">
              <p className="text-sm font-medium text-gray-700">{user?.name}</p>
              <p className="text-xs text-gray-500">{user?.email}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-400 hover:text-gray-600"
              onClick={logout}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
