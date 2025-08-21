import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient"; // você já usa no VehicleForm
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import OptimizedRouteMap from "@/components/maps/OptimizedRouteMap";
import { 
  History, 
  Search, 
  Filter, 
  Car, 
  User, 
  MapPin, 
  Clock, 
  Route as RouteIcon,   // ⬅ renomeado
  Navigation,
  Download,
  Eye,
  Wand2 // Adicionado
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
  date: string;               // ou Date, se já vier como Date
  vehicleId?: number | null;  // ⬅ agora é integer (FK)
  responsibleType: 'technician' | 'team';
  responsibleId: string;
  distanceTotal: number;
  durationTotal: number;
  stopsCount: number;
  status: 'draft' | 'optimized' | 'running' | 'done' | 'canceled';
  displayNumber: number;
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

type BusinessRules = {
  enderecoEmpresaLogradouro?: string;
  enderecoEmpresaNumero?: string;
  enderecoEmpresaBairro?: string;
  enderecoEmpresaCidade?: string;
  enderecoEmpresaCep?: string;
  enderecoEmpresaEstado?: string;
};



const joinParts = (...parts: (string | number | undefined | null)[]) =>
  parts
    .map(p => (typeof p === "number" ? String(p) : (p || "").trim()))
    .filter(Boolean)
    .join(", ");


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

// mostra só a data em pt-BR
const fmtDateList = (input: string | Date) => {
  const d = typeof input === "string" ? new Date(input) : input;
  return d.toLocaleDateString("pt-BR");
};


export default function RoutesHistoryPage() {
  const [filters, setFilters] = useState<RouteFilters>({
    dateFrom: '',
    dateTo: '',
    selectedResponsible: 'all',
    selectedVehicle: 'all', 
    selectedStatus: 'all',
    searchTerm: ''
  });

  const [, setLocation] = useLocation();

  // Abre /appointments com responsável e data da rota pré-preenchidos
  const openNewAppointment = (route: Route) => {
    if (!route) return;

    const prefill = {
      teamId: route.responsibleType === "team" ? Number(route.responsibleId) : undefined,
      technicianId: route.responsibleType === "technician" ? Number(route.responsibleId) : undefined,
      scheduledDate: route.date, // usa a data da rota
    };

    const encoded = encodeURIComponent(btoa(JSON.stringify(prefill)));
    setLocation(`/appointments?prefill=${encoded}`);
  };

  // Query para listar rotas com filtros
  const { data: routesData = [], isLoading: isLoadingRoutes } = useQuery<Route[]>({
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

  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);

  // Função para verificar URL params e abrir automaticamente a modal
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const openRouteId = urlParams.get('open');
    if (openRouteId && routesData.length > 0) {
      const routeExists = routesData.find(route => route.id === openRouteId);
      if (routeExists) {
        setSelectedRoute(openRouteId);
        // Limpar o parâmetro da URL após abrir
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, [routesData]);

  console.log('✅ Página Histórico de Rotas carregada');
  console.log('🔍 [ROUTES HISTORY] Aplicando filtros:', filters);

  // Detalhe da rota selecionada
  const { data: routeDetail } = useQuery<RouteDetail>({
    queryKey: ['/api/routes', selectedRoute],
    queryFn: async () => {
      const response = await fetch(`/api/routes/${selectedRoute}`);
      if (!response.ok) throw new Error('Erro ao buscar detalhes da rota');
      return response.json();
    },
    enabled: !!selectedRoute
  });

  // Rótulo bonitinho da data da rota (para mostrar no modal)
  const routeDayLabel = routeDetail?.route ? fmtDateList(routeDetail.route.date) : "—";


  // ================== BLOCO ÚNICO DO MODAL: estado + queries + lista ==================

  // Estado do modal + seleção
  const [addStopsOpen, setAddStopsOpen] = useState(false);
  const [selectedToAdd, setSelectedToAdd] = useState<number[]>([]);

  // Agendamentos disponíveis do back (filtra por dia e exclui já usados)
  const { data: appointmentsAll = [], isLoading: isLoadingAppts } = useQuery({
    queryKey: ["/api/routes", selectedRoute, "available-appointments"],
    enabled: !!selectedRoute && addStopsOpen, // só busca quando o modal abrir
    queryFn: async () => {
      if (!selectedRoute) return [];
      const res = await fetch(`/api/routes/${selectedRoute}/available-appointments`);
      if (!res.ok) return []; // deixa o fallback funcionar se o endpoint não existir
      return res.json();
    },
  });

  // Fallback: lista geral de agendamentos (você já tem esse endpoint)
  const { data: appointments = [] } = useQuery({
    queryKey: ['/api/appointments'],
    queryFn: async () => {
      const response = await fetch('/api/appointments');
      if (!response.ok) throw new Error('Erro ao buscar agendamentos');
      return response.json();
    }
  });

  // (opcional) cache de clientes para exibir nome
  const { data: clients = [] } = useQuery({
    queryKey: ['/api/clients'],
    queryFn: async () => {
      const response = await fetch('/api/clients');
      if (!response.ok) throw new Error('Erro ao buscar clientes');
      return response.json();
    }
  });

  // Data da rota em YYYY-MM-DD (para filtrar por dia)
  const routeDateYMD =
    routeDetail?.route ? new Date(routeDetail.route.date).toISOString().slice(0, 10) : "";

  // IDs já usados na rota (numérico se possível)
  const usedApptIds = new Set(
    (routeDetail?.stops || [])
      .map((s: any) => Number(s.appointmentNumericId ?? s.appointmentId))
      .filter((n: any) => Number.isFinite(n))
  );

  // Fallback local: mesmo dia, status scheduled e não usado
  const fallbackFromAll = (appointments || []).filter((a: any) => {
    const when = a.scheduledDate || a.scheduled_date || a.date;
    const dt = new Date(when);
    const day = isNaN(dt.getTime()) ? "" : dt.toISOString().slice(0, 10);
    const status = a.status || "scheduled";
    const idNum = Number(a.id);
    return day === routeDateYMD && status === "scheduled" && !usedApptIds.has(idNum);
  });

  // Lista final exibida no modal
  const availableList: any[] =
    (appointmentsAll && appointmentsAll.length > 0) ? appointmentsAll : fallbackFromAll;

  // selecionar/deselecionar um agendamento
  const toggleSelectAppt = (id: number) => {
    setSelectedToAdd((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // (opcional) debug
  console.log("[ADD-APPTS] disponíveis do back:", appointmentsAll?.length || 0,
              "| fallback:", fallbackFromAll.length,
              "| exibindo:", availableList.length);

  // Função para confirmar adição das paradas selecionadas
  const confirmAddStops = () => {
    if (!selectedRoute || selectedToAdd.length === 0) return;
    
    const appointmentIds = selectedToAdd.map(id => String(id));
    addStopsMutation.mutate({
      routeId: selectedRoute,
      appointmentIds
    });
  };

  // ================== FIM DO BLOCO ÚNICO DO MODAL ==================

  // Queries para options dos filtros
  const { data: technicians = [] } = useQuery({
    queryKey: ['/api/technicians'],
    queryFn: async () => {
      const response = await fetch('/api/technicians');
      if (!response.ok) throw new Error('Erro ao buscar técnicos');
      return response.json();
    }
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // mutation para adicionar paradas
  const addStopsMutation = useMutation({
    mutationFn: async ({ routeId, appointmentIds }: { routeId: string; appointmentIds: string[] }) => {
      const response = await apiRequest("POST", `/api/routes/${routeId}/stops`, {
        appointmentIds,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao adicionar paradas");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Paradas adicionadas",
        description: "Os agendamentos foram incluídos na rota com sucesso.",
      });
      setAddStopsOpen(false);
      setSelectedToAdd([]);
      // Recarrega tanto o detalhe quanto a lista
      queryClient.invalidateQueries({ queryKey: ["/api/routes", selectedRoute] });
      queryClient.invalidateQueries({ queryKey: ["/api/routes"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao adicionar paradas",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // mutation para otimizar rota
  const optimizeRouteMutation = useMutation({
    mutationFn: async (routeId: string) => {
      const res = await apiRequest(
        "POST",
        `/api/routes/${routeId}/optimize`,
        {
          terminarNoPontoInicial:
            // se existir, manda como preferir; senão, false
            (routeDetail?.route as any)?.end_at_start ?? false,
        }
      );
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Rota otimizada",
        description: "A ordem das paradas foi recalculada.",
      });
      // Recarrega detalhe e lista
      queryClient.invalidateQueries({ queryKey: ['/api/routes', selectedRoute] });
      queryClient.invalidateQueries({ queryKey: ['/api/routes'] });
    },
    onError: (err: any) => {
      toast({
        title: "Erro ao otimizar",
        description: err?.message || "Tente novamente.",
        variant: "destructive",
      });
    },
  });


  const { data: teams = [] } = useQuery({
    queryKey: ['/api/teams'],
    queryFn: async () => {
      const response = await fetch('/api/teams');
      if (!response.ok) throw new Error('Erro ao buscar equipes');
      return response.json();
    }
  });

  // carrega veículos
  const { data: vehicles = [] } = useQuery({
    queryKey: ["/api/vehicles"],
    queryFn: async () => {
      const response = await fetch("/api/vehicles"); // "fetch" = solicitar dados ao backend
      if (!response.ok) throw new Error("Erro ao buscar veículos");
      return response.json();
    },
  });

  // helpers
  const getVehicleById = (id?: number | null) =>
    vehicles.find((v: any) => v.id === Number(id));

  const formatVehicle = (v?: any) =>
    v ? `${v.brand} ${v.model} • ${v.plate}` : "—";

  // Hora curta pt-BR
  const fmtHora = (v: string | Date) =>
    new Date(v).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  // Nome do cliente a partir do agendamento + cache de clients
  const getClientNameForAppt = (a: any) => {
    if (a?.client?.name) return a.client.name;   // se vier aninhado do backend
    if (a?.clientName) return a.clientName;      // se vier plano
    const c = clients.find((cli: any) => String(cli.id) === String(a?.clientId));
    return c?.name || "Cliente não identificado";
  };

  // Endereço bonitinho a partir do agendamento
  const formatAddressFromAppt = (a: any) =>
    joinParts(a?.logradouro, a?.numero, a?.bairro, a?.cidade);


  const { data: businessRules } = useQuery<BusinessRules | null>({
    queryKey: ['/api/business-rules'],
    queryFn: async () => {
      const r = await fetch('/api/business-rules');
      return r.ok ? r.json() : null;
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
    if (!routeDetail) return;

    // Ponto inicial
    const originText = getStartAddressText(routeDetail.route).trim();

    // Paradas em ordem
    const orderedStops = [...(routeDetail.stops || [])].sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0)
    );

    // Usa o endereço salvo na parada; se faltar, tenta coordenadas
    const stopAddresses = orderedStops
      .map((s) => {
        const addr = (s.address || "").trim();
        if (addr) return addr;
        if (Number.isFinite(s.lat) && Number.isFinite(s.lng)) {
          return `${s.lat},${s.lng}`; // fallback por coordenadas
        }
        return "";
      })
      .filter(Boolean);

    if (stopAddresses.length === 0) return;

    let url = "";
    if (originText) {
      // Origin = início dinâmico; Destination = última parada; Waypoints = demais
      const waypoints = stopAddresses.slice(0, -1);
      const destination = stopAddresses[stopAddresses.length - 1];
      url =
        `https://www.google.com/maps/dir/?api=1&travelmode=driving` +
        `&origin=${encodeURIComponent(originText)}` +
        `&destination=${encodeURIComponent(destination)}` +
        (waypoints.length
          ? `&waypoints=${encodeURIComponent(waypoints.join("|"))}`
          : "");
    } else {
      // Fallback: sem origem → usa a 1ª como origem
      const addresses = [...stopAddresses];
      const origin = addresses.shift()!;
      const destination = addresses.pop() ?? origin;
      url =
        `https://www.google.com/maps/dir/?api=1&travelmode=driving` +
        `&origin=${encodeURIComponent(origin)}` +
        `&destination=${encodeURIComponent(destination)}` +
        (addresses.length
          ? `&waypoints=${encodeURIComponent(addresses.join("|"))}`
          : "");
    }

    window.open(url, "_blank");
  };

  // Retorna coordenadas do ponto inicial da rota (quando existirem)
  const getStartCoords = (route?: Route) => {
    if (!route) return null;
    const r: any = route;

    // tentativas de campos comuns que podem vir do backend
    const candidates: Array<[any, any]> = [
      [r.startLat, r.startLng],
      [r.startLatitude, r.startLongitude],
      [r.start_lat, r.start_lng],
      [r.start?.lat, r.start?.lng],
      [r.start?.latitude, r.start?.longitude],
    ];

    // Se o responsável tiver coordenadas de início
    if (route.responsibleType === "technician") {
      const tech: any = technicians.find((t: any) => t.id.toString() === route.responsibleId);
      candidates.push([tech?.enderecoInicioLat, tech?.enderecoInicioLng]);
    } else if (route.responsibleType === "team") {
      const team: any = teams.find((t: any) => t.id.toString() === route.responsibleId);
      candidates.push([team?.enderecoInicioLat, team?.enderecoInicioLng]);
    }

    // Coordenadas da empresa (se existirem nas regras)
    candidates.push([
      (businessRules as any)?.enderecoEmpresaLat,
      (businessRules as any)?.enderecoEmpresaLng,
    ]);

    for (const [lat, lng] of candidates) {
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return { lat: Number(lat), lon: Number(lng) };
      }
    }
    return null;
  };


  const handleExportRoute = () => {
    // TODO: Implementar exportação da rota
    console.log('📤 Exportar rota:', selectedRoute);
  };

  console.log('📋 [ROUTES HISTORY] Componente montado/atualizado');

  const getStartAddressText = (route?: Route) => {
    if (!route) return "";

    // 1) Se o backend já armazena startAddress na rota, use-o
    const anyRoute = route as any;
    if (typeof anyRoute?.startAddress === "string" && anyRoute.startAddress.trim()) {
      return anyRoute.startAddress.trim();
    }

    // 2) Tenta endereço de início do responsável (técnico/equipe)
    if (route.responsibleType === "technician") {
      const tech: any = technicians.find((t: any) => t.id.toString() === route.responsibleId);
      if (tech?.enderecoInicioCidade) {
        return joinParts(
          tech.enderecoInicioLogradouro,
          tech.enderecoInicioNumero,
          tech.enderecoInicioBairro,
          tech.enderecoInicioCidade,
          tech.enderecoInicioCep,
          tech.enderecoInicioEstado,
          "Brasil"
        );
      }
    } else if (route.responsibleType === "team") {
      const team: any = teams.find((t: any) => t.id.toString() === route.responsibleId);
      if (team?.enderecoInicioCidade) {
        return joinParts(
          team.enderecoInicioLogradouro,
          team.enderecoInicioNumero,
          team.enderecoInicioBairro,
          team.enderecoInicioCidade,
          team.enderecoInicioCep,
          team.enderecoInicioEstado,
          "Brasil"
        );
      }
    }

    // 3) Fallback: endereço da empresa
    if (businessRules) {
      return joinParts(
        businessRules.enderecoEmpresaLogradouro,
        businessRules.enderecoEmpresaNumero,
        businessRules.enderecoEmpresaBairro,
        businessRules.enderecoEmpresaCidade,
        businessRules.enderecoEmpresaCep,
        businessRules.enderecoEmpresaEstado,
        "Brasil"
      );
    }

    return "";
  };


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
            Rotas Encontradas ({routesData.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingRoutes ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-burnt-yellow"></div>
            </div>
          ) : routesData.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-500">Nenhuma rota encontrada com os filtros aplicados</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Rota Criada dia</TableHead>
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
                  {routesData.map((route) => {
                    // 👇 fallback: se a rota não tiver vehicleId, tenta pelo responsável
                    const fallbackVehicleId =
                      route.vehicleId ??
                      (route.responsibleType === "team"
                        ? vehicles.find((v: any) => v.teamId === Number(route.responsibleId))?.id
                        : vehicles.find((v: any) => v.technicianId === Number(route.responsibleId))?.id);

                    return (
                      <TableRow key={route.id} data-testid={`row-route-${route.id}`}>
                        <TableCell className="font-medium">#{route.displayNumber}</TableCell>
                        <TableCell className="font-medium">{route.title}</TableCell>
                        <TableCell>{fmtDateList(route.date)}</TableCell>

                        {/* Veículo (agora correto) */}
                        <TableCell>
                          {formatVehicle(getVehicleById(fallbackVehicleId))}
                        </TableCell>

                        <TableCell>{getResponsibleName(route)}</TableCell>
                        <TableCell className="text-blue-600">{fmtKm(route.distanceTotal)}</TableCell>
                        <TableCell className="text-green-600">{fmtMin(route.durationTotal)}</TableCell>
                        <TableCell>{route.stopsCount}</TableCell>
                        <TableCell>
                          <Badge className={statusColors[route.status] || statusColors.draft}>
                            {statusLabels[route.status] || route.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedRoute(route.id)}
                            data-testid={`button-view-route-${route.id}`}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Ver
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>

              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal central (layout split — infos à esq., mapa à dir.) */}
      <Dialog
        open={!!selectedRoute}
        onOpenChange={(open) => {
          if (!open) setSelectedRoute(null);
        }}
      >
        <DialogContent
          className="
            w-[85vw] h-[80vh] max-w-[1400px] max-h-[90vh]
            p-0 overflow-hidden
          "
        >
          <div className="flex flex-col h-full min-h-0">
            {/* Cabeçalho */}
            <div className="px-4 py-2 border-b">
              <DialogHeader className="p-0 space-y-0">
                <DialogTitle className="text-sm sm:text-base font-semibold leading-tight">
                  Detalhes da Rota
                </DialogTitle>
                <DialogDescription className="text-[11px] sm:text-xs text-gray-500 leading-snug">
                  Informações completas sobre a rota selecionada
                </DialogDescription>
              </DialogHeader>
            </div>

            {/* Corpo: grid responsivo com scroll interno */}
            {routeDetail ? (
              <div className="flex-1 min-h-0 h-full grid grid-cols-1 lg:grid-cols-12 gap-4 p-4">
                {/* Coluna ESQUERDA – informações e paradas (rolável) */}
                <div className="lg:col-span-6 min-h-0 overflow-y-auto pr-1 space-y-5">
                  {/* Título e dados resumidos */}
                  <div>
                    <div className="text-gray-500">Rota Criada dia</div>
                    <h4 className="font-semibold text-base sm:text-lg mb-2">
                      {routeDetail.route?.title}
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
                      <div>
                        <div className="text-gray-500">Data do Serviço</div>
                        <div className="font-medium">{fmtDateList(routeDetail.route?.date)}</div>
                      </div>

                      <div>
                        <div className="text-gray-500">Status</div>
                        <Badge className={statusColors[routeDetail.route?.status] || statusColors.draft}>
                          {statusLabels[routeDetail.route?.status] || routeDetail.route?.status}
                        </Badge>
                      </div>

                      <div>
                        <div className="text-gray-500">Veículo</div>
                        <div className="font-medium flex items-center gap-2">
                          <Car className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          {formatVehicle(getVehicleById(routeDetail.route?.vehicleId))}
                        </div>
                      </div>

                      <div>
                        <div className="text-gray-500">Responsável</div>
                        <div className="font-medium flex items-center gap-2">
                          <User className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          {getResponsibleName(routeDetail.route)}
                        </div>
                      </div>
                    </div>

                    {/* Ações do detalhe */}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        className="border-burnt-yellow text-burnt-yellow hover:bg-yellow-50"
                        onClick={() => setAddStopsOpen(true)}
                        data-testid="btn-add-existing-appointments"
                      >
                        + Incluir agendamentos existentes
                      </Button>

                      <Button
                        onClick={() => routeDetail?.route?.id && optimizeRouteMutation.mutate(routeDetail.route.id)}
                        disabled={
                          optimizeRouteMutation.isPending ||
                          !routeDetail?.stops || routeDetail.stops.length < 2
                        }
                        className="bg-black text-white hover:bg-gray-800"
                        data-testid="btn-optimize-route"
                      >
                        <Wand2 className="h-4 w-4 mr-2" />
                        {optimizeRouteMutation.isPending ? "Otimizando..." : "Otimizar rota"}
                      </Button>
                    </div>
                  </div>

                  <Separator />



                  {/* Métricas compactas */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div className="text-center p-2 bg-blue-50 rounded-md">
                      <RouteIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-blue-600 mx-auto mb-0.5" />
                      <div className="text-[10px] sm:text-[11px] text-gray-500">Distância</div>
                      <div className="font-semibold text-blue-600 text-xs sm:text-sm">
                        {fmtKm(routeDetail.route?.distanceTotal)}
                      </div>
                    </div>

                    <div className="text-center p-2 bg-green-50 rounded-md">
                      <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-green-600 mx-auto mb-0.5" />
                      <div className="text-[10px] sm:text-[11px] text-gray-500">Duração</div>
                      <div className="font-semibold text-green-600 text-xs sm:text-sm">
                        {fmtMin(routeDetail.route?.durationTotal)}
                      </div>
                    </div>

                    <div className="text-center p-2 bg-yellow-50 rounded-md">
                      <MapPin className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-yellow-600 mx-auto mb-0.5" />
                      <div className="text-[10px] sm:text-[11px] text-gray-500">Paradas</div>
                      <div className="font-semibold text-yellow-600 text-xs sm:text-sm">
                        {routeDetail.route?.stopsCount}
                      </div>
                    </div>
                  </div>


                  <Separator />

                  {/* Modal: adicionar agendamentos existentes */}
                  <Dialog open={addStopsOpen} onOpenChange={setAddStopsOpen}>
                    <DialogContent className="sm:max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Adicionar agendamentos à rota</DialogTitle>
                        <DialogDescription>
                          Selecione agendamentos do dia {routeDayLabel} que ainda não estão nesta rota.
                        </DialogDescription>
                      </DialogHeader>


                      {isLoadingAppts ? (
                        <div className="py-6 text-center text-gray-500">Carregando agendamentos…</div>
                      ) : availableList.length === 0 ? (
                        <div className="py-6 text-center text-gray-500">
                          Nenhum agendamento disponível para este dia.
                        </div>
                      ) : (
                        <div className="max-h-[50vh] overflow-y-auto space-y-2">
                          {availableList.map((a: any) => {
                            const when = a.scheduledDate || a.scheduled_date || a.date;
                            return (
                              <label
                                key={a.id}
                                className="flex items-start gap-3 p-3 border rounded-md hover:bg-gray-50 cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  className="mt-1"
                                  checked={selectedToAdd.includes(a.id)}
                                  onChange={() => toggleSelectAppt(a.id)}
                                />
                                <div className="flex-1">
                                  {/* Cliente */}
                                  <div className="text-sm font-semibold">
                                    {getClientNameForAppt(a)}
                                  </div>

                                  {/* Agendamento # */}
                                  <div className="text-xs font-medium text-gray-700">
                                    Agendamento #{a.id}
                                  </div>

                                  {/* Endereço */}
                                  <div className="text-xs text-gray-600">
                                    {formatAddressFromAppt(a)}
                                  </div>

                                  {/* Horário */}
                                  <div className="text-[11px] text-gray-500">
                                    {fmtHora(when)}
                                  </div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      )}


                      <div className="mt-4 flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setAddStopsOpen(false)}>Cancelar</Button>
                        <Button
                          onClick={confirmAddStops}
                          disabled={selectedToAdd.length === 0 || addStopsMutation.isPending}
                          className="bg-black text-white hover:bg-gray-800"
                        >
                          {addStopsMutation.isPending ? "Incluindo..." : `Incluir ${selectedToAdd.length} agendamento(s)`}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>


                  {/* Lista de paradas */}
                  <div>
                    <h5 className="font-semibold text-sm sm:text-base mb-2 sm:mb-3">
                      Paradas da Rota
                    </h5>

                    <div className="space-y-2">
                      {/* Início da rota dinâmico (agora com o pin do RotaFácil) */}
                      <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 bg-green-600 rounded-full flex items-center justify-center">
                          <img src="/brand/rotafacil-pin.png" alt="Início" className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-sm text-green-800">
                            Início da rota (
                            {routeDetail.route.responsibleType === "technician" ? "Técnico"
                              : routeDetail.route.responsibleType === "team" ? "Equipe" : "Empresa"}
                            )
                          </div>
                          <div className="text-xs sm:text-sm text-green-700 mt-1">
                            {getStartAddressText(routeDetail.route)}
                          </div>
                        </div>
                      </div>


                      {/* Paradas (ordenadas) */}
                      {routeDetail.stops
                        ?.slice()
                        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                        .map((stop) => (
                          <div key={stop.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                            <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 bg-burnt-yellow text-white rounded-full flex items-center justify-center text-sm font-bold">
                              {stop.order}
                            </div>
                            <div className="flex-1">
                              <div className="font-medium text-sm">
                                {stop.clientName ? stop.clientName : `Agendamento #${stop.appointmentId}`}
                              </div>
                              <div className="text-xs sm:text-sm text-gray-600 mt-1">{stop.address}</div>
                              <div className="text-[11px] text-gray-500 mt-1">
                                {stop.lat.toFixed(6)}, {stop.lng.toFixed(6)}
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>

                {/* Coluna DIREITA – mapa ocupa toda a altura da coluna */}
                <div className="lg:col-span-6 min-h-0 flex h-full">
                  <div className="relative flex-1 h-full min-h-[300px] rounded-lg overflow-hidden border">
                    <div className="absolute inset-0">
                      {(() => {
                        // 1) Paradas ordenadas
                        const orderedStops = (routeDetail.stops || [])
                          .slice()
                          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

                        // 2) Waypoints das paradas
                        const stopWps = orderedStops.map((s) => ({
                          lat: Number(s.lat),
                          lon: Number(s.lng),
                        }));

                        // 3) Tenta pegar coordenadas de início (técnico/equipe/empresa)
                        const startWp = getStartCoords(routeDetail.route);

                        // 4) GeoJSON vindo do backend (se existir)
                        const rawBackendGeoJson =
                          (routeDetail.route as any)?.polylineGeoJson ??
                          (routeDetail.route as any)?.routeGeoJson ??
                          (routeDetail.route as any)?.geojson ??
                          null;

                        // 5) O GeoJSON que vamos desenhar (se não existir backend, usamos fallback com as paradas)
                        const routeGeoJson =
                          rawBackendGeoJson ??
                          (stopWps.length >= 2
                            ? { type: "LineString", coordinates: stopWps.map((w) => [w.lon, w.lat]) }
                            : null);

                        // 6) Se NÃO temos startWp, mas TEMOS polyline do backend, usa o 1º ponto do polyline como início
                        const startFromGeo: { lat: number; lon: number } | null =
                          !startWp && rawBackendGeoJson && routeGeoJson
                            ? (() => {
                                // aceita LineString puro, Feature ou Feature<LineString>
                                const geom =
                                  routeGeoJson?.type === "LineString"
                                    ? routeGeoJson
                                    : routeGeoJson?.type === "Feature"
                                    ? routeGeoJson.geometry
                                    : routeGeoJson?.geometry?.type === "LineString"
                                    ? routeGeoJson.geometry
                                    : null;

                                const c = geom?.coordinates?.[0];
                                if (Array.isArray(c) && c.length >= 2) {
                                  const [lon, lat] = c;
                                  if (Number.isFinite(lat) && Number.isFinite(lon)) {
                                    return { lat: Number(lat), lon: Number(lon) };
                                  }
                                }
                                return null;
                              })()
                            : null;

                        // 7) Monta o array final de waypoints (índice 0 é SEMPRE o início)
                        const allWps =
                          startWp ? [startWp, ...stopWps]
                          : startFromGeo ? [startFromGeo, ...stopWps]
                          : stopWps;

                        return (
                          <OptimizedRouteMap
                            routeGeoJson={routeGeoJson}
                            waypoints={allWps}
                          />
                        );
                      })()}

                    </div>
                  </div>
                </div>

              </div>
            ) : (
              <div className="flex-1 min-h-0 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-burnt-yellow" />
              </div>
            )}

            {/* Rodapé fixo (ações) */}
            <div className="border-t px-4 py-3 bg-white">
              <div className="flex flex-col sm:flex-flex-row gap-3">
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
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}