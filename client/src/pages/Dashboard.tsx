import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { getAuthHeaders } from "@/lib/auth";
import { buildApiUrl } from "@/lib/api-config";
import { normalizeItems } from "@/lib/normalize";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Calendar,
  Users,
  CheckCircle,
  DollarSign,
  Plus,
  Route,
  UserPlus,
  BarChart3,
  MapPin,
  Clock,
  TrendingUp,
  TrendingDown,
  Timer
} from "lucide-react";
import type { Appointment, Client, Technician, Service, Route as RouteType } from "@shared/schema";
import { VehiclesAttentionCard } from "@/components/dashboard/VehiclesAttentionCard";
import { VehicleDocumentsAlertsCard } from "@/components/dashboard/VehicleDocumentsAlertsCard";
import { UpcomingMaintenancesCard } from "@/components/dashboard/UpcomingMaintenancesCard";
import { MaintenanceCostsCard } from "@/components/dashboard/MaintenanceCostsCard";
import { RoutesInProgressCard } from "@/components/dashboard/RoutesInProgressCard";
import { ProviderLocationsMap } from "@/components/dashboard/ProviderLocationsMap";
import { CriticalAlertsCard } from "@/components/dashboard/CriticalAlertsCard";
import { ProductivityCard } from "@/components/dashboard/ProductivityCard";
import { QualityMetricsCard } from "@/components/dashboard/QualityMetricsCard";
import { FinancialMetricsCard } from "@/components/dashboard/FinancialMetricsCard";
import { PendingReasonsCard } from "@/components/dashboard/PendingReasonsCard";
import { OperationStatsCard } from "@/components/dashboard/OperationStatsCard";
import { DashboardTabs, DashboardTabKey } from "@/components/dashboard/DashboardTabs";
import { DashboardFilters, DashboardFiltersState, defaultDashboardFilters } from "@/components/dashboard/DashboardFilters";
import { FuelFilters } from "@/components/dashboard/FuelFilters";
import { FuelMetricsCard } from "@/components/dashboard/FuelMetricsCard";
import { FuelEfficiencyCard } from "@/components/dashboard/FuelEfficiencyCard";
import { FuelCostEvolutionCard } from "@/components/dashboard/FuelCostEvolutionCard";
import type { Vehicle } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Share2 } from "lucide-react";
import { captureAndShare } from "@/lib/screenshot";
import { useRef } from "react";


interface DashboardStats {
  todayAppointments: number;
  activeTechnicians: number;
  completionRate: number;
  monthRevenue: number;
  avgExecutionTime: number; // em minutos
  todayVariation: number; // % variação vs ontem
  completionVariation: number; // % variação vs mês passado
  revenueVariation: number; // % variação vs mês passado
}

interface TodayAppointment {
  id: number;
  time: string;
  client: string;
  service: string;
  address: string;
  status: string;
  technician: string;
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<DashboardTabKey>("overview");
  const [filters, setFilters] = useState<DashboardFiltersState>(defaultDashboardFilters);

  // State for fuel filters (fleet tab)
  const [selectedVehicles, setSelectedVehicles] = useState<number[]>([]);
  const [selectedFuelTypes, setSelectedFuelTypes] = useState<string[]>(["gasolina", "etanol", "diesel_s500", "diesel_s10", "eletrico"]);

  // Fetch vehicles for initializing filter state
  const { data: vehiclesData = [] } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/vehicles");
      return res.json();
    },
  });

  // Initialize selectedVehicles with all vehicles when data loads
  if (vehiclesData.length > 0 && selectedVehicles.length === 0) {
    setSelectedVehicles(vehiclesData.map(v => v.id));
  }

  // ✅ NOVO: Usar endpoint otimizado em vez de /api/appointments
  interface AppointmentsStats {
    todayAppointments: number;
    todayVariation: number;
    completionRate: number;
    completionVariation: number;
    monthRevenue: number;
    revenueVariation: number;
    avgExecutionTime: number;
  }

  const { data: appointmentsStats } = useQuery<AppointmentsStats>({
    queryKey: ["/api/dashboard/appointments-stats"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/dashboard/appointments-stats"), {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch appointments stats");
      return res.json();
    },
  });

  // ✅ Lista leve de agendamentos de hoje (para Agenda e Atividades)
  interface TodayAppointment {
    id: number;
    scheduledDate: string;
    status: string;
    clientId: number;
    serviceId: number;
    technicianId: number | null;
    teamId: number | null;
    logradouro: string | null;
    numero: string | null;
    bairro: string | null;
    cidade: string | null;
    notes: string | null;
    executionStatus: string | null;
    createdAt: string;
    clientName: string | null;
  }

  const { data: todayAppointments = [] } = useQuery<TodayAppointment[]>({
    queryKey: ["/api/dashboard/today-appointments"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/dashboard/today-appointments?limit=10"), {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch today appointments");
      return res.json();
    },
  });

  // ❌ Removido: clients não é mais usado no Dashboard (métricas pré-calculadas)

  const { data: techniciansData } = useQuery({
    queryKey: ["/api/technicians"],
    queryFn: async () => {
      const response = await fetch(buildApiUrl("/api/technicians?page=1&pageSize=50"), { headers: getAuthHeaders() });
      return response.json();
    },
  });
  const technicians = normalizeItems<Technician>(techniciansData);

  const { data: servicesData } = useQuery({
    queryKey: ["/api/services"],
    queryFn: async () => {
      const response = await fetch(buildApiUrl("/api/services?page=1&pageSize=50"), { headers: getAuthHeaders() });
      return response.json();
    },
  });
  const services = normalizeItems<Service>(servicesData);

  // Técnicos ativos
  const activeTechnicians = technicians.filter((tech: Technician) => tech.isActive);

  // ✅ Usar métricas do novo endpoint
  const stats: DashboardStats = {
    todayAppointments: appointmentsStats?.todayAppointments ?? 0,
    activeTechnicians: activeTechnicians.length,
    completionRate: appointmentsStats?.completionRate ?? 0,
    monthRevenue: appointmentsStats?.monthRevenue ?? 0,
    avgExecutionTime: appointmentsStats?.avgExecutionTime ?? 0,
    todayVariation: appointmentsStats?.todayVariation ?? 0,
    completionVariation: appointmentsStats?.completionVariation ?? 0,
    revenueVariation: appointmentsStats?.revenueVariation ?? 0,
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "in_progress":
        return "bg-yellow-100 text-yellow-800";
      case "scheduled":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "completed":
        return "Concluído";
      case "in_progress":
        return "Em Andamento";
      case "scheduled":
        return "Agendado";
      default:
        return status;
    }
  };

  const formatTime = (dateInput: string | Date) => {
    const date = (typeof dateInput === 'string' || typeof dateInput === 'number')
      ? new Date(dateInput)
      : dateInput;
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const dashboardRef = useRef<HTMLDivElement>(null);

  const handleShare = async () => {
    if (dashboardRef.current) {
      await captureAndShare(dashboardRef.current, `dashboard-${new Date().toISOString().split('T')[0]}.png`);
    }
  };

  return (
    <TooltipProvider>
      <div id="dashboard-capture" className="space-y-6" ref={dashboardRef}>
        {/* Ação: Compartilhar */}
        <div className="flex justify-end">
          <Button variant="outline" onClick={handleShare} className="gap-2">
            <Share2 className="h-4 w-4" />
            Compartilhar
          </Button>
        </div>

        {/* Filtros Globais */}
        <DashboardFilters filters={filters} onFiltersChange={setFilters} />

        {/* Dashboard com Abas */}
        <DashboardTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          children={{
            // ===================== ABA: VISÃO GERAL =====================
            overview: (
              <div className="space-y-6">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <p className="text-sm font-medium text-gray-600 dark:text-zinc-400 cursor-help border-b border-dashed border-gray-400 dark:border-zinc-500">Agendamentos Hoje</p>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p>Total de agendamentos com data de hoje. Inclui todos os status (agendado, em andamento, concluído).</p>
                            </TooltipContent>
                          </Tooltip>
                          <p className="text-3xl font-bold text-gray-900 dark:text-zinc-100">{stats.todayAppointments}</p>
                        </div>
                        <div className="w-12 h-12 bg-burnt-yellow/10 dark:bg-yellow-900/20 rounded-lg flex items-center justify-center">
                          <Calendar className="text-burnt-yellow dark:text-yellow-500 h-6 w-6" />
                        </div>
                      </div>
                      <div className="mt-4 flex items-center">
                        {stats.todayVariation >= 0 ? (
                          <TrendingUp className="h-4 w-4 text-green-600" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-600" />
                        )}
                        <span className={`text-sm font-medium ml-1 ${stats.todayVariation >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {stats.todayVariation >= 0 ? '+' : ''}{stats.todayVariation}%
                        </span>
                        <span className="text-gray-600 dark:text-zinc-400 text-sm ml-2">vs. ontem</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <p className="text-sm font-medium text-gray-600 dark:text-zinc-400 cursor-help border-b border-dashed border-gray-400 dark:border-zinc-500">Técnicos Ativos</p>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p>Número de técnicos cadastrados com status "ativo". Abaixo mostra quantos têm agendamentos hoje.</p>
                            </TooltipContent>
                          </Tooltip>
                          <p className="text-3xl font-bold text-gray-900 dark:text-zinc-100">{stats.activeTechnicians}</p>
                        </div>
                        <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                          <Users className="text-blue-600 dark:text-blue-400 h-6 w-6" />
                        </div>
                      </div>
                      <div className="mt-4 flex items-center">
                        <span className="text-gray-600 dark:text-zinc-400 text-sm">
                          {activeTechnicians.filter((t: Technician) =>
                            todayAppointments.some((a: TodayAppointment) => a.technicianId === t.id)
                          ).length} em campo agora
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <p className="text-sm font-medium text-gray-600 dark:text-zinc-400 cursor-help border-b border-dashed border-gray-400 dark:border-zinc-500">Taxa de Conclusão</p>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p>Percentual de agendamentos concluídos no mês atual. Cálculo: (concluídos / total do mês) x 100.</p>
                            </TooltipContent>
                          </Tooltip>
                          <p className="text-3xl font-bold text-gray-900 dark:text-zinc-100">{stats.completionRate}%</p>
                        </div>
                        <div className="w-12 h-12 bg-green-50 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                          <CheckCircle className="text-green-600 dark:text-green-400 h-6 w-6" />
                        </div>
                      </div>
                      <div className="mt-4 flex items-center">
                        {stats.completionVariation >= 0 ? (
                          <TrendingUp className="h-4 w-4 text-green-600" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-600" />
                        )}
                        <span className={`text-sm font-medium ml-1 ${stats.completionVariation >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {stats.completionVariation >= 0 ? '+' : ''}{stats.completionVariation}%
                        </span>
                        <span className="text-gray-600 dark:text-zinc-400 text-sm ml-2">vs. mês passado</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <p className="text-sm font-medium text-gray-600 dark:text-zinc-400 cursor-help border-b border-dashed border-gray-400 dark:border-zinc-500">Receita do Mês</p>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p>Soma dos preços dos serviços de todos os agendamentos concluídos no mês atual.</p>
                            </TooltipContent>
                          </Tooltip>
                          <p className="text-3xl font-bold text-gray-900 dark:text-zinc-100">R$ {stats.monthRevenue.toLocaleString()}</p>
                        </div>
                        <div className="w-12 h-12 bg-purple-50 dark:bg-purple-900/20 rounded-lg flex items-center justify-center">
                          <DollarSign className="text-purple-600 dark:text-purple-400 h-6 w-6" />
                        </div>
                      </div>
                      <div className="mt-4 flex items-center">
                        {stats.revenueVariation >= 0 ? (
                          <TrendingUp className="h-4 w-4 text-green-600" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-600" />
                        )}
                        <span className={`text-sm font-medium ml-1 ${stats.revenueVariation >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {stats.revenueVariation >= 0 ? '+' : ''}{stats.revenueVariation}%
                        </span>
                        <span className="text-gray-600 dark:text-zinc-400 text-sm ml-2">vs. mês passado</span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Tempo Médio de Execução */}
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <p className="text-sm font-medium text-gray-600 dark:text-zinc-400 cursor-help border-b border-dashed border-gray-400 dark:border-zinc-500">Tempo Médio</p>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p>Média de tempo entre início e fim dos atendimentos concluídos no mês. Calculado a partir dos registros do prestador.</p>
                            </TooltipContent>
                          </Tooltip>
                          <p className="text-3xl font-bold text-gray-900 dark:text-zinc-100">
                            {stats.avgExecutionTime > 0 ? `${stats.avgExecutionTime} min` : '--'}
                          </p>
                        </div>
                        <div className="w-12 h-12 bg-orange-50 dark:bg-orange-900/20 rounded-lg flex items-center justify-center">
                          <Timer className="text-orange-600 dark:text-orange-400 h-6 w-6" />
                        </div>
                      </div>
                      <div className="mt-4 flex items-center">
                        <span className="text-gray-600 dark:text-zinc-400 text-sm">por atendimento concluído</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Routes In Progress & Critical Alerts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <RoutesInProgressCard />
                  <CriticalAlertsCard />
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Today's Schedule */}
                  <Card>
                    <CardHeader className="border-b border-gray-100 dark:border-zinc-800">
                      <div className="flex items-center justify-between">
                        <CardTitle>Agenda de Hoje</CardTitle>
                        <Button variant="link" className="text-burnt-yellow hover:text-burnt-yellow-dark">
                          Ver todos
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6">
                      {todayAppointments.length === 0 ? (
                        <div className="text-center py-8">
                          <Calendar className="h-12 w-12 text-gray-400 dark:text-zinc-600 mx-auto mb-4" />
                          <p className="text-gray-600 dark:text-zinc-400">Nenhum agendamento para hoje</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {todayAppointments.slice(0, 3).map((appointment: TodayAppointment) => {
                            const technician = technicians.find((t: Technician) => t.id === appointment.technicianId);
                            const addressText = [
                              appointment.logradouro,
                              appointment.numero,
                              appointment.bairro,
                              appointment.cidade,
                            ].filter(Boolean).join(', ');

                            return (
                              <div key={appointment.id} className="flex items-center space-x-4 p-4 bg-gray-50 dark:bg-zinc-800 rounded-lg">
                                <div className="w-12 h-12 bg-burnt-yellow rounded-lg flex items-center justify-center">
                                  <span className="text-white font-semibold text-sm">
                                    {formatTime(appointment.scheduledDate)}
                                  </span>
                                </div>
                                <div className="flex-1">
                                  <h4 className="font-medium text-gray-900 dark:text-zinc-100">{appointment.clientName || "Cliente"}</h4>
                                  <p className="text-sm text-gray-600 dark:text-zinc-400">{appointment.notes || "Serviço"}</p>
                                  <p className="text-xs text-gray-500 dark:text-zinc-500">{addressText}</p>
                                </div>
                                <div className="text-right">
                                  <Badge className={getStatusColor(appointment.status)}>
                                    {getStatusText(appointment.status)}
                                  </Badge>
                                  <p className="text-xs text-gray-500 dark:text-zinc-500 mt-1">{technician?.name || "Técnico"}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Quick Actions */}
                  <Card>
                    <CardHeader className="border-b border-gray-100 dark:border-zinc-800">
                      <CardTitle>Ações Rápidas</CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                      <div className="grid grid-cols-1 gap-4">
                        <Button
                          variant="outline"
                          className="flex items-center justify-start p-4 h-auto border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800"
                          onClick={() => setLocation("/appointments")}
                        >
                          <div className="w-10 h-10 bg-burnt-yellow rounded-lg flex items-center justify-center mr-4">
                            <Plus className="text-white h-5 w-5" />
                          </div>
                          <div className="text-left">
                            <h4 className="font-medium text-gray-900 dark:text-zinc-100">Novo Agendamento</h4>
                            <p className="text-sm text-gray-600 dark:text-zinc-400">Criar um novo atendimento</p>
                          </div>
                        </Button>

                        <Button
                          variant="outline"
                          className="flex items-center justify-start p-4 h-auto border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800"
                          onClick={() => setLocation("/appointments")}
                        >
                          <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center mr-4">
                            <Route className="text-white h-5 w-5" />
                          </div>
                          <div className="text-left">
                            <h4 className="font-medium text-gray-900 dark:text-zinc-100">Otimizar Rota</h4>
                            <p className="text-sm text-gray-600 dark:text-zinc-400">Gerar rota para hoje</p>
                          </div>
                        </Button>

                        <Button
                          variant="outline"
                          className="flex items-center justify-start p-4 h-auto border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800"
                          onClick={() => setLocation("/clients")}
                        >
                          <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center mr-4">
                            <UserPlus className="text-white h-5 w-5" />
                          </div>
                          <div className="text-left">
                            <h4 className="font-medium text-gray-900 dark:text-zinc-100">Novo Cliente</h4>
                            <p className="text-sm text-gray-600 dark:text-zinc-400">Cadastrar cliente</p>
                          </div>
                        </Button>

                        <Button
                          variant="outline"
                          className="flex items-center justify-start p-4 h-auto border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800"
                          onClick={() => setLocation("/business-rules")}
                        >
                          <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center mr-4">
                            <BarChart3 className="text-white h-5 w-5" />
                          </div>
                          <div className="text-left">
                            <h4 className="font-medium text-gray-900 dark:text-zinc-100">Configurações</h4>
                            <p className="text-sm text-gray-600 dark:text-zinc-400">Regras de negócio</p>
                          </div>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Productivity & Quality Metrics */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <ProductivityCard startDate={filters.startDate} endDate={filters.endDate} />
                  <QualityMetricsCard startDate={filters.startDate} endDate={filters.endDate} />
                </div>

                {/* Recent Activity - Two Columns */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Administrative Activity */}
                  <Card>
                    <CardHeader className="border-b border-gray-100">
                      <CardTitle className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        Atividades Administrativas
                      </CardTitle>
                      <CardDescription>Cadastros e agendamentos</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6">
                      {todayAppointments.length === 0 ? (
                        <div className="text-center py-8">
                          <Clock className="h-12 w-12 text-gray-400 dark:text-zinc-600 mx-auto mb-4" />
                          <p className="text-gray-600 dark:text-zinc-400">Nenhuma atividade administrativa</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {todayAppointments.slice(0, 4).map((activity: TodayAppointment) => {

                            return (
                              <div key={activity.id} className="flex items-start space-x-4">
                                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                                  <Calendar className="text-blue-600 dark:text-blue-400 h-4 w-4" />
                                </div>
                                <div className="flex-1">
                                  <p className="text-sm text-gray-900 dark:text-zinc-100">
                                    Agendamento criado para{" "}
                                    <span className="font-medium">{activity.clientName || "Cliente"}</span>
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-zinc-500">
                                    {new Date(activity.createdAt).toLocaleDateString('pt-BR')} às{" "}
                                    {new Date(activity.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Provider Activity - Admin Only */}
                  <Card>
                    <CardHeader className="border-b border-gray-100">
                      <CardTitle className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        Atividades de Prestadores
                      </CardTitle>
                      <CardDescription>Finalizações e entregas</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6">
                      {(() => {
                        // Filtrar apenas agendamentos com executionStatus (finalizados por prestadores)
                        const providerActivities = todayAppointments.filter((a: TodayAppointment) => a.executionStatus);

                        if (providerActivities.length === 0) {
                          return (
                            <div className="text-center py-8">
                              <CheckCircle className="h-12 w-12 text-gray-400 dark:text-zinc-600 mx-auto mb-4" />
                              <p className="text-gray-600 dark:text-zinc-400">Nenhuma atividade de prestadores</p>
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-4">
                            {providerActivities.slice(0, 4).map((activity: TodayAppointment) => {
                              const technician = technicians.find((t: Technician) => t.id === activity.technicianId);

                              const isCompleted = activity.executionStatus === 'concluido';
                              const statusLabel = activity.executionStatus === 'concluido' ? 'Concluído' :
                                activity.executionStatus?.startsWith('nao_realizado') ? 'Não realizado' :
                                  activity.executionStatus || 'Pendente';

                              return (
                                <div key={activity.id} className="flex items-start space-x-4">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isCompleted ? 'bg-green-100 dark:bg-green-900/30' : 'bg-orange-100 dark:bg-orange-900/30'
                                    }`}>
                                    {isCompleted ? (
                                      <CheckCircle className="text-green-600 dark:text-green-400 h-4 w-4" />
                                    ) : (
                                      <Clock className="text-orange-600 dark:text-orange-400 h-4 w-4" />
                                    )}
                                  </div>
                                  <div className="flex-1">
                                    <p className="text-sm text-gray-900 dark:text-zinc-100">
                                      <span className="font-medium">{technician?.name || "Técnico"}</span>{" "}
                                      {isCompleted ? 'concluiu' : 'registrou'} atendimento em{" "}
                                      <span className="font-medium">{activity.clientName || "Cliente"}</span>
                                    </p>
                                    <div className="flex items-center gap-2 mt-1">
                                      <Badge className={`text-xs ${isCompleted ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' : 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300'
                                        }`}>
                                        {statusLabel}
                                      </Badge>
                                      <span className="text-xs text-gray-500 dark:text-zinc-500">
                                        {(activity as any).updatedAt ? new Date((activity as any).updatedAt).toLocaleDateString('pt-BR') : (activity.createdAt ? new Date(activity.createdAt).toLocaleDateString('pt-BR') : '')}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                </div>
              </div>
            ),

            // ===================== ABA: OPERAÇÃO =====================
            operations: (
              <div className="space-y-6">
                {/* Estatísticas de Agendamentos */}
                <OperationStatsCard
                  startDate={filters.startDate}
                  endDate={filters.endDate}
                  technicianId={filters.responsibleType === 'technician' ? filters.responsibleId : undefined}
                  teamId={filters.responsibleType === 'team' ? filters.responsibleId : undefined}
                />

                {/* Rotas em Progresso + Mapa de Localização */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <RoutesInProgressCard />
                  <ProviderLocationsMap />
                </div>

                {/* Alertas Críticos */}
                <CriticalAlertsCard />

                {/* Métricas de Produtividade */}
                <ProductivityCard startDate={filters.startDate} endDate={filters.endDate} />
              </div>
            ),

            // ===================== ABA: FINANCEIRO =====================
            financial: (
              <div className="space-y-6">
                {/* Receita Real vs Esperada */}
                <FinancialMetricsCard
                  technicianId={filters.responsibleType === 'technician' ? filters.responsibleId : undefined}
                  teamId={filters.responsibleType === 'team' ? filters.responsibleId : undefined}
                  startDate={filters.startDate}
                  endDate={filters.endDate}
                />
              </div>
            ),

            // ===================== ABA: QUALIDADE =====================
            quality: (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Métricas de Qualidade */}
                  <QualityMetricsCard startDate={filters.startDate} endDate={filters.endDate} />

                  {/* Motivos de Pendências com filtro */}
                  <PendingReasonsCard startDate={filters.startDate} endDate={filters.endDate} />
                </div>
              </div>
            ),

            // ===================== ABA: FROTA =====================
            fleet: (
              <div className="space-y-6">
                {/* Fuel Filters */}
                <FuelFilters
                  selectedVehicles={selectedVehicles}
                  setSelectedVehicles={setSelectedVehicles}
                  selectedFuelTypes={selectedFuelTypes}
                  setSelectedFuelTypes={setSelectedFuelTypes}
                />

                {/* Fuel Metrics Cards */}
                <FuelMetricsCard vehicleIds={selectedVehicles} fuelTypes={selectedFuelTypes} startDate={filters.startDate} endDate={filters.endDate} />

                {/* Fuel Efficiency + Cost Evolution */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <FuelEfficiencyCard vehicleIds={selectedVehicles} fuelTypes={selectedFuelTypes} startDate={filters.startDate} endDate={filters.endDate} />
                  <FuelCostEvolutionCard vehicleIds={selectedVehicles} fuelTypes={selectedFuelTypes} startDate={filters.startDate} endDate={filters.endDate} />
                </div>

                {/* Vehicle Alerts & Maintenance - Two Columns */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <VehicleDocumentsAlertsCard />
                  <VehiclesAttentionCard />
                  <UpcomingMaintenancesCard />
                </div>

                {/* Maintenance Costs - Full Width */}
                <div className="grid grid-cols-1 gap-6">
                  <MaintenanceCostsCard startDate={filters.startDate} endDate={filters.endDate} />
                </div>
              </div>
            ),
          }}
        />
      </div>
    </TooltipProvider>
  );
}
