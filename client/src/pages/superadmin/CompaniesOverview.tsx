import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { getQueryFn } from "@/lib/queryClient";
import {
  Building2,
  Users,
  CalendarCheck,
  Route,
  UserCog,
  Car,
  UsersRound,
  Search,
  ArrowUpDown,
  Filter,
  Hash,
  MapPin,
  Loader2,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface CompanyMetrics {
  companyId: number;
  companyName: string;
  cnpj: string;
  plan: string;
  statusAssinatura: string;
  createdAt: string;
  totalClients: number;
  totalUsers: number;
  totalRoutes: number;
  totalAppointments: number;
  avgAppointmentsPerRoute: number;
  totalTeams: number;
  totalTechnicians: number;
  totalVehicles: number;
  totalKm: number;
}

type SortOption =
  | "appointments_desc"
  | "routes_desc"
  | "users_desc"
  | "clients_desc"
  | "teams_desc"
  | "technicians_desc"
  | "vehicles_desc"
  | "km_desc"
  | "name_asc"
  | "name_desc";

type ActivityFilter =
  | "all"
  | "no_routes"
  | "no_appointments"
  | "has_appointments";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "appointments_desc", label: "Mais agendamentos" },
  { value: "routes_desc", label: "Mais rotas" },
  { value: "users_desc", label: "Mais usuários" },
  { value: "clients_desc", label: "Mais clientes" },
  { value: "teams_desc", label: "Mais equipes" },
  { value: "technicians_desc", label: "Mais técnicos" },
  { value: "vehicles_desc", label: "Mais veículos" },
  { value: "km_desc", label: "Mais km rodados" },
  { value: "name_asc", label: "Nome (A-Z)" },
  { value: "name_desc", label: "Nome (Z-A)" },
];

const ACTIVITY_OPTIONS: { value: ActivityFilter; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "no_routes", label: "Sem rotas" },
  { value: "no_appointments", label: "Sem agendamentos" },
  { value: "has_appointments", label: "Com agendamentos" },
];

function formatNumber(n: number): string {
  return n.toLocaleString("pt-BR");
}

function formatKm(km: number): string {
  if (km >= 1000) {
    return `${(km / 1000).toFixed(1).replace(".", ",")} mil`;
  }
  return formatNumber(km);
}

function getPlanBadge(plan: string) {
  const colors: Record<string, string> = {
    free: "bg-gray-100 text-gray-700 dark:bg-zinc-700 dark:text-zinc-300",
    basic: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    professional: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    enterprise: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors[plan] || colors.free}`}>
      {plan.charAt(0).toUpperCase() + plan.slice(1)}
    </span>
  );
}

export default function CompaniesOverview() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  // Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("appointments_desc");
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");
  const [minAppointments, setMinAppointments] = useState<string>("");

  // Proteção no frontend (backend já protege)
  const isSuperAdmin = user?.isSuperAdmin || user?.email === 'lucaspmastaler@gmail.com';

  const { data: companies = [], isLoading, error } = useQuery<CompanyMetrics[]>({
    queryKey: ["/api/superadmin/companies"],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: isSuperAdmin,
    staleTime: 60_000,
  });

  // Pipeline de filtros
  const filteredCompanies = useMemo(() => {
    let result = companies;

    // 1) Busca por nome
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      result = result.filter(
        (c) =>
          c.companyName.toLowerCase().includes(term) ||
          c.cnpj.includes(term)
      );
    }

    // 2) Filtro de atividade
    if (activityFilter === "no_routes") {
      result = result.filter((c) => c.totalRoutes === 0);
    } else if (activityFilter === "no_appointments") {
      result = result.filter((c) => c.totalAppointments === 0);
    } else if (activityFilter === "has_appointments") {
      result = result.filter((c) => c.totalAppointments > 0);
    }

    // 3) Mínimo de agendamentos
    const minVal = parseInt(minAppointments);
    if (!isNaN(minVal) && minVal > 0) {
      result = result.filter((c) => c.totalAppointments >= minVal);
    }

    // 4) Ordenação (slice para não mutar)
    result = result.slice().sort((a, b) => {
      switch (sortBy) {
        case "appointments_desc":
          return b.totalAppointments - a.totalAppointments;
        case "routes_desc":
          return b.totalRoutes - a.totalRoutes;
        case "users_desc":
          return b.totalUsers - a.totalUsers;
        case "clients_desc":
          return b.totalClients - a.totalClients;
        case "teams_desc":
          return b.totalTeams - a.totalTeams;
        case "technicians_desc":
          return b.totalTechnicians - a.totalTechnicians;
        case "vehicles_desc":
          return b.totalVehicles - a.totalVehicles;
        case "km_desc":
          return b.totalKm - a.totalKm;
        case "name_asc":
          return a.companyName.localeCompare(b.companyName, "pt-BR");
        case "name_desc":
          return b.companyName.localeCompare(a.companyName, "pt-BR");
        default:
          return 0;
      }
    });

    return result;
  }, [companies, searchTerm, sortBy, activityFilter, minAppointments]);

  // Totais consolidados
  const totals = useMemo(() => {
    return {
      companies: companies.length,
      appointments: companies.reduce((s, c) => s + c.totalAppointments, 0),
      users: companies.reduce((s, c) => s + c.totalUsers, 0),
      clients: companies.reduce((s, c) => s + c.totalClients, 0),
      routes: companies.reduce((s, c) => s + c.totalRoutes, 0),
      km: companies.reduce((s, c) => s + c.totalKm, 0),
    };
  }, [companies]);

  // Acesso negado
  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-zinc-950">
        <div className="text-center space-y-4">
          <ShieldAlert className="h-16 w-16 text-red-500 mx-auto" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Acesso Restrito
          </h1>
          <p className="text-gray-500 dark:text-zinc-400">
            Esta página é exclusiva para SuperAdmin.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Empresas Cadastradas
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
            Visão consolidada de todas as empresas do RotaFácil
          </p>
        </div>

        {/* Resumo geral consolidado */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <SummaryCard
            icon={Building2}
            label="Empresas"
            value={totals.companies}
          />
          <SummaryCard
            icon={CalendarCheck}
            label="Agendamentos"
            value={totals.appointments}
          />
          <SummaryCard
            icon={Users}
            label="Usuários"
            value={totals.users}
          />
          <SummaryCard
            icon={UsersRound}
            label="Clientes"
            value={totals.clients}
          />
          <SummaryCard
            icon={Route}
            label="Rotas"
            value={totals.routes}
          />
          <SummaryCard
            icon={MapPin}
            label="Km total"
            value={totals.km}
            formatFn={formatKm}
          />
        </div>

        {/* Barra de Filtros */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-4 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Busca */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por nome da empresa…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700"
              />
            </div>

            {/* Ordenação */}
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700">
                <ArrowUpDown className="h-4 w-4 mr-2 text-gray-400" />
                <SelectValue placeholder="Ordenar por…" />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Filtro de atividade */}
            <Select value={activityFilter} onValueChange={(v) => setActivityFilter(v as ActivityFilter)}>
              <SelectTrigger className="bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700">
                <Filter className="h-4 w-4 mr-2 text-gray-400" />
                <SelectValue placeholder="Atividade…" />
              </SelectTrigger>
              <SelectContent>
                {ACTIVITY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Mínimo de agendamentos */}
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="number"
                min={0}
                placeholder="Mín. agendamentos"
                value={minAppointments}
                onChange={(e) => setMinAppointments(e.target.value)}
                className="pl-9 bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700"
              />
            </div>
          </div>

          {/* Contagem de resultados */}
          <div className="mt-3 flex items-center justify-between text-xs text-gray-500 dark:text-zinc-400">
            <span>
              {filteredCompanies.length} de {companies.length} empresa{companies.length !== 1 ? "s" : ""}
            </span>
            {(searchTerm || activityFilter !== "all" || minAppointments) && (
              <button
                onClick={() => {
                  setSearchTerm("");
                  setActivityFilter("all");
                  setMinAppointments("");
                  setSortBy("appointments_desc");
                }}
                className="text-amber-600 hover:text-amber-700 dark:text-amber-500 dark:hover:text-amber-400 font-medium"
              >
                Limpar filtros
              </button>
            )}
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
            <span className="ml-3 text-gray-500 dark:text-zinc-400">
              Carregando métricas…
            </span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="text-center py-20">
            <ShieldAlert className="h-12 w-12 text-red-500 mx-auto mb-3" />
            <p className="text-red-600 dark:text-red-400 font-medium">
              Erro ao carregar dados
            </p>
            <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">
              {(error as Error).message}
            </p>
          </div>
        )}

        {/* Grid de cards */}
        {!isLoading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredCompanies.map((company) => (
              <CompanyCard key={company.companyId} company={company} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && filteredCompanies.length === 0 && companies.length > 0 && (
          <div className="text-center py-16">
            <Building2 className="h-12 w-12 text-gray-300 dark:text-zinc-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-zinc-400 font-medium">
              Nenhuma empresa encontrada com os filtros atuais
            </p>
          </div>
        )}

        {!isLoading && !error && companies.length === 0 && (
          <div className="text-center py-16">
            <Building2 className="h-12 w-12 text-gray-300 dark:text-zinc-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-zinc-400 font-medium">
              Nenhuma empresa cadastrada ainda
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Componentes internos ────────────────────────────────────────

function SummaryCard({
  icon: Icon,
  label,
  value,
  formatFn,
}: {
  icon: any;
  label: string;
  value: number;
  formatFn?: (n: number) => string;
}) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-4">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20">
          <Icon className="h-5 w-5 text-amber-600 dark:text-amber-500" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatFn ? formatFn(value) : formatNumber(value)}
          </p>
          <p className="text-xs text-gray-500 dark:text-zinc-400">{label}</p>
        </div>
      </div>
    </div>
  );
}

function CompanyCard({ company }: { company: CompanyMetrics }) {
  const metrics = [
    { icon: UsersRound, label: "Clientes", value: company.totalClients },
    { icon: Users, label: "Usuários", value: company.totalUsers },
    { icon: Route, label: "Rotas", value: company.totalRoutes },
    { icon: CalendarCheck, label: "Agendamentos", value: company.totalAppointments },
    { icon: TrendingUp, label: "Média/rota", value: company.avgAppointmentsPerRoute },
    { icon: UsersRound, label: "Equipes", value: company.totalTeams },
    { icon: UserCog, label: "Técnicos", value: company.totalTechnicians },
    { icon: Car, label: "Veículos", value: company.totalVehicles },
    { icon: MapPin, label: "Km rodados", value: company.totalKm, format: formatKm },
  ];

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 overflow-hidden hover:border-amber-300 dark:hover:border-amber-700 transition-colors">
      {/* Header do card */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white truncate">
              {company.companyName}
            </h3>
            <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5 font-mono">
              {company.cnpj}
            </p>
          </div>
          <div className="ml-3 flex-shrink-0">
            {getPlanBadge(company.plan)}
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-5 border-t border-gray-100 dark:border-zinc-800" />

      {/* Grid de métricas */}
      <div className="px-5 py-4 grid grid-cols-2 gap-x-6 gap-y-3">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <div key={m.label} className="flex items-center gap-2">
              <Icon className="h-3.5 w-3.5 text-gray-400 dark:text-zinc-500 flex-shrink-0" />
              <span className="text-xs text-gray-500 dark:text-zinc-400 truncate">
                {m.label}
              </span>
              <span className="text-sm font-semibold text-gray-900 dark:text-white ml-auto tabular-nums">
                {m.format ? m.format(m.value) : formatNumber(m.value)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Footer com status */}
      <div className="px-5 py-2.5 bg-gray-50 dark:bg-zinc-800/50 flex items-center justify-between text-xs">
        <span className="text-gray-400 dark:text-zinc-500">
          Criada em{" "}
          {new Date(company.createdAt).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })}
        </span>
        <Badge
          variant={company.statusAssinatura === "active" ? "default" : "destructive"}
          className={
            company.statusAssinatura === "active"
              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-100"
              : ""
          }
        >
          {company.statusAssinatura === "active" ? "Ativa" : company.statusAssinatura}
        </Badge>
      </div>
    </div>
  );
}
