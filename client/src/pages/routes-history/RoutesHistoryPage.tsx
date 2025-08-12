import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  History, 
  Search, 
  Filter, 
  Car, 
  User, 
  MapPin, 
  Clock, 
  Route,
  Navigation,
  Download,
  Eye
} from 'lucide-react';

interface RouteFilters {
  dateFrom: string;
  dateTo: string;
  selectedResponsible: string;
  selectedVehicle: string;
  selectedStatus: string;
  searchTerm: string;
}

interface Route {
  id: string;
  title: string;
  date: string;
  vehicleId?: string;
  responsibleType: 'technician' | 'team';
  responsibleId: string;
  distanceTotal: number;
  durationTotal: number;
  stopsCount: number;
  status: 'draft' | 'optimized' | 'running' | 'done' | 'canceled';
  createdAt: string;
  updatedAt: string;
}

interface RouteDetail {
  route: Route;
  stops: Array<{
    id: string;
    routeId: string;
    appointmentId: string;
    order: number;
    lat: number;
    lng: number;
    address: string;
    appointmentNumericId?: number | null;
    clientName?: string | null;
    scheduledDate?: Date | null;
  }>;
}

const statusLabels = {
  draft: 'Rascunho',
  optimized: 'Otimizada', 
  running: 'Em execução',
  done: 'Finalizada',
  canceled: 'Cancelada'
};

const statusColors = {
  draft: 'bg-gray-100 text-gray-800',
  optimized: 'bg-blue-100 text-blue-800',
  running: 'bg-yellow-100 text-yellow-800', 
  done: 'bg-green-100 text-green-800',
  canceled: 'bg-red-100 text-red-800'
};

// Helpers seguros de formatação
const fmtDateTime = (v?: string | number | Date | null) => {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "—" : d.toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" });
};

const fmtDate = (v?: string | number | Date | null) => {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
};

const fmtKm = (m?: number) => (m && m > 0 ? `${(m / 1000).toFixed(1)} km` : "—");
const fmtMin = (s?: number) => (s && s > 0 ? `${Math.round(s / 60)} min` : "—");

export default function RoutesHistoryPage() {
  const [filters, setFilters] = useState<RouteFilters>({
    dateFrom: '',
    dateTo: '',
    selectedResponsible: 'all',
    selectedVehicle: 'all', 
    selectedStatus: 'all',
    searchTerm: ''
  });

  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);

  console.log('✅ Página Histórico de Rotas carregada');
  console.log('🔍 [ROUTES HISTORY] Aplicando filtros:', filters);

  // Query para listar rotas com filtros
  const { data: routes = [], isLoading: isLoadingRoutes } = useQuery<Route[]>({
    queryKey: ['/api/routes', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      
      if (filters.dateFrom) params.append('from', filters.dateFrom);
      if (filters.dateTo) params.append('to', filters.dateTo);
      if (filters.selectedStatus !== 'all') params.append('status', filters.selectedStatus);
      if (filters.selectedResponsible !== 'all') {
        const [type, id] = filters.selectedResponsible.split(':');
        params.append('responsibleType', type);
        params.append('responsibleId', id);
      }
      if (filters.selectedVehicle !== 'all') params.append('vehicleId', filters.selectedVehicle);
      if (filters.searchTerm.trim()) params.append('search', filters.searchTerm.trim());
      
      const response = await fetch(`/api/routes?${params.toString()}`);
      if (!response.ok) throw new Error('Erro ao buscar rotas');
      return response.json();
    }
  });

  // Query para detalhes da rota selecionada
  const { data: routeDetail } = useQuery<RouteDetail>({
    queryKey: ['/api/routes', selectedRoute],
    queryFn: async () => {
      const response = await fetch(`/api/routes/${selectedRoute}`);
      if (!response.ok) throw new Error('Erro ao buscar detalhes da rota');
      return response.json();
    },
    enabled: !!selectedRoute
  });

  // Queries para options dos filtros
  const { data: technicians = [] } = useQuery({
    queryKey: ['/api/technicians'],
    queryFn: async () => {
      const response = await fetch('/api/technicians');
      if (!response.ok) throw new Error('Erro ao buscar técnicos');
      return response.json();
    }
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['/api/teams'],
    queryFn: async () => {
      const response = await fetch('/api/teams');
      if (!response.ok) throw new Error('Erro ao buscar equipes');
      return response.json();
    }
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ['/api/vehicles'],
    queryFn: async () => {
      const response = await fetch('/api/vehicles');
      if (!response.ok) throw new Error('Erro ao buscar veículos');
      return response.json();
    }
  });

  const { data: appointments = [] } = useQuery({
    queryKey: ['/api/appointments'],
    queryFn: async () => {
      const response = await fetch('/api/appointments');
      if (!response.ok) throw new Error('Erro ao buscar agendamentos');
      return response.json();
    }
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['/api/clients'],
    queryFn: async () => {
      const response = await fetch('/api/clients');
      if (!response.ok) throw new Error('Erro ao buscar clientes');
      return response.json();
    }
  });

  const formatDistance = (meters: number) => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(1)} km`;
    }
    return `${meters} m`;
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}min`;
    }
    return `${minutes}min`;
  };

  const getResponsibleName = (route?: Route) => {
    if (!route) return '—';
    if (route.responsibleType === 'technician') {
      const technician = technicians.find((t: any) => t.id.toString() === route.responsibleId);
      return technician?.name || `Técnico ${route.responsibleId}`;
    } else {
      const team = teams.find((t: any) => t.id.toString() === route.responsibleId);
      return team?.name || `Equipe ${route.responsibleId}`;
    }
  };

  const getVehicleName = (vehicleId?: string) => {
    if (!vehicleId) return '-';
    const vehicle = vehicles.find((v: any) => v.id.toString() === vehicleId);
    return vehicle ? `${vehicle.plate} (${vehicle.model})` : vehicleId;
  };

  const getClientNameByAppointmentId = (appointmentId: string) => {
    const appointment = appointments.find((apt: any) => apt.id.toString() === appointmentId);
    if (!appointment) return `Agendamento #${appointmentId}`;
    
    const client = clients.find((cli: any) => cli.id.toString() === appointment.clientId?.toString());
    return client?.name || `Cliente não encontrado`;
  };

  const getRouteVehicleName = (route: Route) => {
    // Primeiro verifica se a rota tem veículo direto
    if (route.vehicleId) {
      return getVehicleName(route.vehicleId);
    }
    
    // Se não tem veículo direto, verifica se é uma equipe com veículo vinculado
    if (route.responsibleType === 'team') {
      const team = teams.find((t: any) => t.id.toString() === route.responsibleId);
      if (team?.vehicleId) {
        return getVehicleName(team.vehicleId.toString());
      }
    }
    
    return '-';
  };

  const handleStartNavigation = () => {
    // TODO: Implementar funcionalidade de navegação
    console.log('🧭 Iniciar navegação para rota:', selectedRoute);
  };

  const handleExportRoute = () => {
    // TODO: Implementar exportação da rota
    console.log('📤 Exportar rota:', selectedRoute);
  };

  console.log('📋 [ROUTES HISTORY] Componente montado/atualizado');

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <History className="h-6 w-6 text-burnt-yellow" />
          <h1 className="text-2xl font-bold text-gray-900">Histórico de Rotas</h1>
        </div>
        <p className="text-gray-600">Visualize e gerencie o histórico de rotas otimizadas</p>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
          <CardDescription>
            Use os filtros abaixo para encontrar rotas específicas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Período */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Data de</label>
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                data-testid="input-date-from"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Data até</label>
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                data-testid="input-date-to"
              />
            </div>

            {/* Responsável */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Responsável</label>
              <Select 
                value={filters.selectedResponsible}
                onValueChange={(value) => setFilters(prev => ({ ...prev, selectedResponsible: value }))}
              >
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

            {/* Veículo */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Veículo</label>
              <Select
                value={filters.selectedVehicle}
                onValueChange={(value) => setFilters(prev => ({ ...prev, selectedVehicle: value }))}
              >
                <SelectTrigger data-testid="select-vehicle">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {vehicles.map((vehicle: any) => (
                    <SelectItem key={vehicle.id} value={vehicle.id.toString()}>
                      {vehicle.plate} ({vehicle.model})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select
                value={filters.selectedStatus}
                onValueChange={(value) => setFilters(prev => ({ ...prev, selectedStatus: value }))}
              >
                <SelectTrigger data-testid="select-status">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="draft">Rascunho</SelectItem>
                  <SelectItem value="optimized">Otimizada</SelectItem>
                  <SelectItem value="running">Em execução</SelectItem>
                  <SelectItem value="done">Finalizada</SelectItem>
                  <SelectItem value="canceled">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Busca por título */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Buscar por título</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Digite o título da rota..."
                  value={filters.searchTerm}
                  onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                  className="pl-10"
                  data-testid="input-search-term"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardHeader>
          <CardTitle>
            Rotas Encontradas ({routes.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingRoutes ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-burnt-yellow"></div>
            </div>
          ) : routes.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-500">Nenhuma rota encontrada com os filtros aplicados</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Veículo</TableHead>
                    <TableHead>Técnico/Equipe</TableHead>
                    <TableHead>Distância</TableHead>
                    <TableHead>Duração</TableHead>
                    <TableHead>Paradas</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {routes.map((route) => (
                    <TableRow key={route.id} data-testid={`row-route-${route.id}`}>
                      <TableCell className="font-medium">{route.title}</TableCell>
                      <TableCell>
                        {fmtDateTime(route.date)}
                      </TableCell>
                      <TableCell>{getRouteVehicleName(route)}</TableCell>
                      <TableCell>{getResponsibleName(route)}</TableCell>
                      <TableCell className="text-blue-600">
                        {fmtKm(route.distanceTotal)}
                      </TableCell>
                      <TableCell className="text-green-600">
                        {fmtMin(route.durationTotal)}
                      </TableCell>
                      <TableCell>{route.stopsCount}</TableCell>
                      <TableCell>
                        <Badge className={statusColors[route.status] || statusColors.draft}>
                          {statusLabels[route.status] || route.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Sheet>
                          <SheetTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedRoute(route.id)}
                              data-testid={`button-view-route-${route.id}`}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Ver
                            </Button>
                          </SheetTrigger>
                          <SheetContent className="w-[400px] sm:w-[540px]">
                            <SheetHeader>
                              <SheetTitle>Detalhes da Rota</SheetTitle>
                              <SheetDescription>
                                Informações completas sobre a rota selecionada
                              </SheetDescription>
                            </SheetHeader>
                            
                            {routeDetail && (
                              <div className="mt-6 space-y-6">
                                {/* Informações gerais */}
                                <div>
                                  <h4 className="font-semibold text-lg mb-3">{routeDetail.route?.title}</h4>
                                  
                                  <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                      <div className="text-gray-500">Data</div>
                                      <div className="font-medium">
                                        {fmtDateTime(routeDetail.route?.date)}
                                      </div>
                                    </div>
                                    
                                    <div>
                                      <div className="text-gray-500">Status</div>
                                      <Badge className={statusColors[routeDetail.route?.status] || statusColors.draft}>
                                        {statusLabels[routeDetail.route?.status] || routeDetail.route?.status}
                                      </Badge>
                                    </div>
                                    
                                    <div>
                                      <div className="text-gray-500">Veículo</div>
                                      <div className="font-medium flex items-center gap-1">
                                        <Car className="h-4 w-4" />
                                        {getRouteVehicleName(routeDetail.route)}
                                      </div>
                                    </div>
                                    
                                    <div>
                                      <div className="text-gray-500">Responsável</div>
                                      <div className="font-medium flex items-center gap-1">
                                        <User className="h-4 w-4" />
                                        {getResponsibleName(routeDetail.route)}
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                <Separator />

                                {/* Métricas */}
                                <div className="grid grid-cols-3 gap-4">
                                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                                    <Route className="h-6 w-6 text-blue-600 mx-auto mb-1" />
                                    <div className="text-sm text-gray-500">Distância</div>
                                    <div className="font-bold text-blue-600">
                                      {fmtKm(routeDetail.route?.distanceTotal)}
                                    </div>
                                  </div>
                                  
                                  <div className="text-center p-3 bg-green-50 rounded-lg">
                                    <Clock className="h-6 w-6 text-green-600 mx-auto mb-1" />
                                    <div className="text-sm text-gray-500">Duração</div>
                                    <div className="font-bold text-green-600">
                                      {fmtMin(routeDetail.route?.durationTotal)}
                                    </div>
                                  </div>
                                  
                                  <div className="text-center p-3 bg-yellow-50 rounded-lg">
                                    <MapPin className="h-6 w-6 text-yellow-600 mx-auto mb-1" />
                                    <div className="text-sm text-gray-500">Paradas</div>
                                    <div className="font-bold text-yellow-600">
                                      {routeDetail.route?.stopsCount}
                                    </div>
                                  </div>
                                </div>

                                <Separator />

                                {/* Lista de paradas */}
                                <div>
                                  <h5 className="font-semibold mb-3">Paradas da Rota</h5>
                                  <ScrollArea className="h-[300px]">
                                    <div className="space-y-3">
                                      {/* Ponto inicial */}
                                      <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                                        <div className="flex-shrink-0 w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                                          🏠
                                        </div>
                                        <div className="flex-1">
                                          <div className="font-medium text-sm text-green-800">
                                            Ponto inicial (Empresa)
                                          </div>
                                          <div className="text-sm text-green-700 mt-1">
                                            Rodovia BR-116, 15480, Xaxim, Curitiba
                                          </div>
                                          <div className="text-xs text-green-600 mt-1">
                                            -49.2654, -25.4284
                                          </div>
                                        </div>
                                      </div>

                                      {/* Paradas dos agendamentos */}
                                      {routeDetail.stops?.map((stop, index) => (
                                        <div key={stop.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                                          <div className="flex-shrink-0 w-8 h-8 bg-burnt-yellow text-white rounded-full flex items-center justify-center text-sm font-bold">
                                            {stop.order}
                                          </div>
                                          <div className="flex-1">
                                            <div className="font-medium text-sm">
                                              {stop.clientName ? stop.clientName : `Agendamento #${stop.appointmentId}`}
                                            </div>
                                            <div className="text-sm text-gray-600 mt-1">
                                              {stop.address}
                                            </div>
                                            <div className="text-xs text-gray-500 mt-1">
                                              {stop.lat.toFixed(6)}, {stop.lng.toFixed(6)}
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </ScrollArea>
                                </div>

                                <Separator />

                                {/* Ações */}
                                <div className="flex gap-3">
                                  <Button 
                                    onClick={handleStartNavigation}
                                    className="flex-1"
                                    data-testid="button-start-navigation"
                                  >
                                    <Navigation className="h-4 w-4 mr-2" />
                                    Iniciar Navegação
                                  </Button>
                                  
                                  <Button 
                                    variant="outline" 
                                    onClick={handleExportRoute}
                                    className="flex-1"
                                    data-testid="button-export-route"
                                  >
                                    <Download className="h-4 w-4 mr-2" />
                                    Exportar Rota
                                  </Button>
                                </div>
                              </div>
                            )}
                          </SheetContent>
                        </Sheet>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}