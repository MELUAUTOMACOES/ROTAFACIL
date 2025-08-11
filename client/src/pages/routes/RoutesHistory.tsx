import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { 
  Search, 
  Filter, 
  Calendar, 
  MapPin, 
  Clock, 
  User, 
  Car, 
  Route as RouteIcon,
  X, 
  Navigation, 
  CheckCircle2,
  Download 
} from "lucide-react";

type RouteStatus = "draft" | "optimized" | "running" | "done" | "canceled";

interface RouteListItem {
  id: string;
  title: string;
  date: string;
  vehicleId?: string;
  responsibleType: "technician" | "team";
  responsibleId: string;
  distanceTotal: number;
  durationTotal: number;
  stopsCount: number;
  status: RouteStatus;
  createdAt: string;
}

interface RouteDetail {
  route: {
    id: string;
    title: string;
    date: string;
    vehicleId?: string;
    responsibleType: "technician" | "team";
    responsibleId: string;
    distanceTotal: number;
    durationTotal: number;
    stopsCount: number;
    status: RouteStatus;
    polylineGeoJson?: any;
  };
  start?: {
    address: string;
    lat: number;
    lng: number;
  };
  stops: Array<{
    id: string;
    appointmentId: string;
    order: number;
    lat: number;
    lng: number;
    address: string;
    clientName?: string;
    serviceName?: string;
    scheduledDate?: string;
  }>;
}

export default function RoutesHistory() {
  // Estados para filtros
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [selectedResponsible, setSelectedResponsible] = useState<string>("all");
  const [selectedVehicle, setSelectedVehicle] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  
  // Estado do drawer
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  
  const { toast } = useToast();

  // Query para listar rotas com filtros
  const { data: routes = [], isLoading: isLoadingRoutes } = useQuery({
    queryKey: ['/api/routes', dateFrom, dateTo, selectedResponsible, selectedVehicle, selectedStatus, searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateFrom) params.append('from', dateFrom);
      if (dateTo) params.append('to', dateTo);
      if (selectedResponsible !== 'all') {
        const [type, id] = selectedResponsible.split(':');
        params.append('responsibleType', type);
        params.append('responsibleId', id);
      }
      if (selectedVehicle !== 'all') params.append('vehicleId', selectedVehicle);
      if (selectedStatus !== 'all') params.append('status', selectedStatus);
      if (searchTerm.trim()) params.append('search', searchTerm.trim());
      
      console.log('🔍 [ROUTES HISTORY] Aplicando filtros:', {
        dateFrom, dateTo, selectedResponsible, selectedVehicle, selectedStatus, searchTerm
      });
      
      const response = await fetch(`/api/routes?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Erro ao carregar rotas');
      }
      return response.json();
    }
  });

  // Query para detalhes da rota selecionada
  const { data: routeDetails, isLoading: isLoadingDetails } = useQuery({
    queryKey: ['/api/routes', selectedRouteId],
    queryFn: async () => {
      if (!selectedRouteId) return null;
      
      console.log('📋 [ROUTES HISTORY] Carregando detalhes da rota:', selectedRouteId);
      
      const response = await fetch(`/api/routes/${selectedRouteId}`);
      if (!response.ok) {
        throw new Error('Erro ao carregar detalhes da rota');
      }
      return response.json();
    },
    enabled: !!selectedRouteId
  });

  // Queries para obter dados de técnicos, equipes e veículos para os filtros
  const { data: technicians = [] } = useQuery({
    queryKey: ['/api/technicians'],
    queryFn: async () => {
      const response = await fetch('/api/technicians');
      if (!response.ok) throw new Error('Erro ao carregar técnicos');
      return response.json();
    }
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['/api/teams'],
    queryFn: async () => {
      const response = await fetch('/api/teams');
      if (!response.ok) throw new Error('Erro ao carregar equipes');
      return response.json();
    }
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ['/api/vehicles'],
    queryFn: async () => {
      const response = await fetch('/api/vehicles');
      if (!response.ok) throw new Error('Erro ao carregar veículos');
      return response.json();
    }
  });

  // Log de eventos
  useEffect(() => {
    console.log('📋 [ROUTES HISTORY] Componente montado/atualizado');
  }, []);

  // Funções auxiliares
  const getStatusText = (status: RouteStatus): string => {
    const statusMap = {
      draft: "Rascunho",
      optimized: "Otimizada", 
      running: "Em Andamento",
      done: "Finalizada",
      canceled: "Cancelada"
    };
    return statusMap[status] || status;
  };

  const getStatusColor = (status: RouteStatus): string => {
    const colorMap = {
      draft: "bg-gray-100 text-gray-800",
      optimized: "bg-blue-100 text-blue-800",
      running: "bg-yellow-100 text-yellow-800", 
      done: "bg-green-100 text-green-800",
      canceled: "bg-red-100 text-red-800"
    };
    return colorMap[status] || "bg-gray-100 text-gray-800";
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
  };

  const formatDateTime = (dateString: string): { date: string; time: string } => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('pt-BR'),
      time: date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };
  };

  const formatDistance = (meters: number): string => {
    return `${(meters / 1000).toFixed(1)} km`;
  };

  const formatDuration = (seconds: number): string => {
    return `${Math.round(seconds / 60)} min`;
  };

  const getResponsibleName = (type: string, id: string): string => {
    if (type === 'technician') {
      const technician = technicians.find((t: any) => t.id.toString() === id);
      return technician?.name || "Técnico não encontrado";
    } else if (type === 'team') {
      const team = teams.find((t: any) => t.id.toString() === id);
      return team?.name || "Equipe não encontrada";
    }
    return "Responsável não encontrado";
  };

  const getVehicleName = (vehicleId?: string): string => {
    if (!vehicleId) return "Nenhum";
    const vehicle = vehicles.find((v: any) => v.id.toString() === vehicleId);
    return vehicle ? `${vehicle.brand} ${vehicle.model} (${vehicle.plate})` : "Veículo não encontrado";
  };

  // Handlers
  const handleRowClick = (routeId: string) => {
    console.log('📋 [ROUTES HISTORY] Abrindo detalhes da rota:', routeId);
    setSelectedRouteId(routeId);
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    console.log('📋 [ROUTES HISTORY] Fechando drawer');
    setIsDrawerOpen(false);
    setSelectedRouteId(null);
  };

  const handleApplyFilters = () => {
    console.log('🔍 [ROUTES HISTORY] Aplicando filtros manualmente');
    // Os filtros são aplicados automaticamente via react-query
    toast({
      title: "Filtros aplicados",
      description: "A lista foi atualizada conforme os filtros selecionados",
    });
  };

  const handleClearFilters = () => {
    console.log('🔍 [ROUTES HISTORY] Limpando filtros');
    setDateFrom("");
    setDateTo("");
    setSelectedResponsible("all");
    setSelectedVehicle("all");
    setSelectedStatus("all");
    setSearchTerm("");
    
    toast({
      title: "Filtros limpos",
      description: "Todos os filtros foram removidos",
    });
  };

  const handleStartNavigation = () => {
    console.log('🧭 [ROUTES HISTORY] Iniciando navegação (placeholder)');
    toast({
      title: "Navegação",
      description: "Funcionalidade de navegação será implementada em breve",
    });
  };

  const handleExportRoute = () => {
    console.log('📄 [ROUTES HISTORY] Exportando rota (placeholder)');
    toast({
      title: "Exportar",
      description: "Funcionalidade de exportação será implementada em breve",
    });
  };

  if (isLoadingRoutes) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-burnt-yellow"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Histórico de Rotas</h1>
        <p className="text-gray-600">Visualize e gerencie todas as rotas criadas</p>
      </div>

      {/* Card de Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-lg">
            <Filter className="h-5 w-5 mr-2 text-burnt-yellow" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Primeira linha - Período */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">De</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                data-testid="input-date-from"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Até</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                data-testid="input-date-to"
              />
            </div>
          </div>

          {/* Segunda linha - Responsável, Veículo, Status */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Responsável</label>
              <Select value={selectedResponsible} onValueChange={setSelectedResponsible}>
                <SelectTrigger data-testid="select-responsible">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {technicians.map((tech: any) => (
                    <SelectItem key={`technician:${tech.id}`} value={`technician:${tech.id}`}>
                      {tech.name} (Técnico)
                    </SelectItem>
                  ))}
                  {teams.map((team: any) => (
                    <SelectItem key={`team:${team.id}`} value={`team:${team.id}`}>
                      {team.name} (Equipe)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Veículo</label>
              <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
                <SelectTrigger data-testid="select-vehicle">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {vehicles.map((vehicle: any) => (
                    <SelectItem key={vehicle.id} value={vehicle.id.toString()}>
                      {vehicle.brand} {vehicle.model} ({vehicle.plate})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Status</label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger data-testid="select-status">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="draft">Rascunho</SelectItem>
                  <SelectItem value="optimized">Otimizada</SelectItem>
                  <SelectItem value="running">Em Andamento</SelectItem>
                  <SelectItem value="done">Finalizada</SelectItem>
                  <SelectItem value="canceled">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Terceira linha - Busca por título */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Buscar por título</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Digite o título da rota..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search-title"
              />
            </div>
          </div>

          {/* Botões */}
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              onClick={handleApplyFilters}
              className="bg-burnt-yellow hover:bg-burnt-yellow-dark text-white"
              data-testid="button-apply-filters"
            >
              Aplicar
            </Button>
            <Button
              onClick={handleClearFilters}
              variant="outline"
              data-testid="button-clear-filters"
            >
              Limpar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Rotas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-lg">
            <RouteIcon className="h-5 w-5 mr-2 text-burnt-yellow" />
            Rotas ({routes.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {routes.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <RouteIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>Nenhuma rota encontrada</p>
              <p className="text-sm">Tente ajustar os filtros ou criar uma nova rota</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-2 font-semibold text-gray-700">Título</th>
                    <th className="text-left py-3 px-2 font-semibold text-gray-700">Data</th>
                    <th className="text-left py-3 px-2 font-semibold text-gray-700">Veículo</th>
                    <th className="text-left py-3 px-2 font-semibold text-gray-700">Técnico/Equipe</th>
                    <th className="text-left py-3 px-2 font-semibold text-gray-700">Distância</th>
                    <th className="text-left py-3 px-2 font-semibold text-gray-700">Duração</th>
                    <th className="text-left py-3 px-2 font-semibold text-gray-700">Paradas</th>
                    <th className="text-left py-3 px-2 font-semibold text-gray-700">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {routes.map((route: RouteListItem) => (
                    <tr
                      key={route.id}
                      onClick={() => handleRowClick(route.id)}
                      className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                      data-testid={`row-route-${route.id}`}
                    >
                      <td className="py-3 px-2">
                        <div className="font-medium text-gray-900">{route.title}</div>
                      </td>
                      <td className="py-3 px-2">
                        <div className="text-gray-600">{formatDate(route.date)}</div>
                      </td>
                      <td className="py-3 px-2">
                        <div className="text-gray-600">{getVehicleName(route.vehicleId)}</div>
                      </td>
                      <td className="py-3 px-2">
                        <div className="text-gray-600">
                          {getResponsibleName(route.responsibleType, route.responsibleId)}
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <div className="text-blue-600 font-medium">
                          {formatDistance(route.distanceTotal)}
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <div className="text-green-600 font-medium">
                          {formatDuration(route.durationTotal)}
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <div className="text-gray-600">{route.stopsCount}</div>
                      </td>
                      <td className="py-3 px-2">
                        <Badge
                          className={getStatusColor(route.status)}
                          data-testid={`status-${route.status}-${route.id}`}
                        >
                          {getStatusText(route.status)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Drawer de Detalhes da Rota */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute inset-0 bg-black bg-opacity-50" onClick={handleCloseDrawer} />
            <section className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-xl">
              <div className="flex h-full flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                    <Navigation className="h-5 w-5 mr-2 text-burnt-yellow" />
                    Detalhes da Rota
                  </h2>
                  <button
                    onClick={handleCloseDrawer}
                    className="text-gray-400 hover:text-gray-600"
                    data-testid="button-close-drawer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                  {isLoadingDetails && (
                    <div className="p-4 text-sm text-gray-600 flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#DAA520] mr-3"></div>
                      Carregando detalhes...
                    </div>
                  )}
                  
                  {routeDetails && !isLoadingDetails && (
                    <div className="space-y-6">
                      {/* Summary */}
                      <div className="bg-[#DAA520]/10 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-900 mb-2">Resumo da Rota</h3>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>Paradas:</span>
                            <span className="font-medium">
                              {routeDetails.route.stopsCount}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Distância Total:</span>
                            <span className="font-medium text-blue-600">
                              {formatDistance(routeDetails.route.distanceTotal)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Tempo Estimado:</span>
                            <span className="font-medium text-green-600">
                              {formatDuration(routeDetails.route.durationTotal)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Ordem das Paradas */}
                      <div>
                        <h3 className="font-semibold text-gray-900 mb-4">Paradas da Rota</h3>

                        {/* Início da rota */}
                        {routeDetails.start && (
                          <div className="bg-gray-50 rounded-lg p-4 mb-3">
                            <div className="flex items-start space-x-3">
                              <div className="flex-shrink-0 w-6 h-6 bg-gray-400 text-white rounded-full flex items-center justify-center text-sm font-medium">
                                <span>•</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-gray-900 truncate">Início da rota</h4>
                                <p className="text-sm text-gray-600 truncate">
                                  {routeDetails.start.address}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="space-y-3">
                          {routeDetails.stops?.map((stop: any, index: number) => {
                            const dt = stop.scheduledDate ? new Date(stop.scheduledDate) : null;
                            const { date, time } = dt ? formatDateTime(stop.scheduledDate!) : { date: null, time: null };

                            return (
                              <div key={`${stop.appointmentId}-${index}`} className="bg-gray-50 rounded-lg p-4">
                                <div className="flex items-start space-x-3">
                                  <div className="flex-shrink-0 w-6 h-6 bg-burnt-yellow text-white rounded-full flex items-center justify-center text-sm font-medium">
                                    {stop.order}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <h4 className="font-medium text-gray-900 truncate">
                                      {stop.clientName || "Cliente"}
                                    </h4>
                                    {stop.serviceName && (
                                      <p className="text-sm text-gray-600 truncate">{stop.serviceName}</p>
                                    )}
                                    {dt && (
                                      <p className="text-sm text-gray-500">{date} às {time}</p>
                                    )}
                                    <p className="text-sm text-gray-500 truncate">{stop.address}</p>
                                  </div>
                                  <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="space-y-3">
                        <Button 
                          className="w-full bg-burnt-yellow hover:bg-burnt-yellow-dark text-white"
                          onClick={handleStartNavigation}
                          data-testid="button-start-navigation"
                        >
                          Iniciar Navegação
                        </Button>
                        <Button 
                          variant="outline" 
                          className="w-full"
                          onClick={handleExportRoute}
                          data-testid="button-export-route"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Exportar Rota
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}