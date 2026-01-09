import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useRoute } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient"; // você já usa no VehicleForm
import { getAuthHeaders } from "@/lib/auth";
import { normalizeItems } from "@/lib/normalize";
import { useToast } from "@/hooks/use-toast";
import { usePendingAppointments } from "@/hooks/usePendingAppointments";
import { ToastAction } from "@/components/ui/toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import RouteTrackingMap from "@/components/maps/RouteTrackingMap";
import RouteAuditModal from "@/components/RouteAuditModal";
import { ResolvePendingModal } from "@/components/modals/ResolvePendingModal";
import { AppointmentHistoryModal } from "@/components/modals/AppointmentHistoryModal";
import { AppointmentDetailsModal } from "@/components/modals/AppointmentDetailsModal";
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
  Wand2, // Adicionado
  X,
  GripVertical,
  ChevronLeft,
  ChevronRight,
  Truck,
  Loader2,
  FileText
} from 'lucide-react';
import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import leafletImage from 'leaflet-image';
// @ts-ignore - dom-to-image-more não tem tipos TypeScript
import domtoimage from 'dom-to-image-more';

// dnd-kit
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";


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
  responsibleName?: string | null;  // ✅ Novo: vem do join no backend
  distanceTotal: number;
  durationTotal: number;
  stopsCount: number;
  status: 'draft' | 'confirmado' | 'finalizado' | 'cancelado';
  displayNumber: number;
  createdAt: string;
  updatedAt: string;
}

// Interface para resposta paginada
interface RoutesResponse {
  items: Route[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
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
  confirmado: 'Confirmado',
  finalizado: 'Finalizado',
  cancelado: 'Cancelado'
};

const statusColors = {
  draft: 'bg-gray-100 text-gray-800',
  confirmado: 'bg-blue-100 text-blue-800',
  finalizado: 'bg-green-100 text-green-800',
  cancelado: 'bg-red-100 text-red-800'
};

const isRouteEditable = (status: string) => {
  return status === 'draft' || status === 'confirmado';
};

// uuid "0000-...-0026" -> 26 (versão de front)
const uuidToNumberFront = (v?: string | null) => {
  if (!v) return null;
  const compact = v.replace(/-/g, "");
  if (!/^[0-9a-fA-F]{32}$/.test(compact)) return null;
  const numeric = compact.replace(/^0+/, "");
  const n = Number(numeric);
  return Number.isFinite(n) ? n : null;
};

// Mostrar nome do cliente mesmo se o back não tiver enviado clientName
const displayStopName = (stop: any, appointments: any[], clients: any[]) => {
  // tenta pelo appointmentNumericId (back já manda isso quando consegue)
  let apptIdNum = Number(stop?.appointmentNumericId);
  if (!Number.isFinite(apptIdNum)) {
    // fallback: tenta extrair do UUID salvo em stop.appointmentId
    apptIdNum = uuidToNumberFront(String(stop?.appointmentId)) ?? NaN;
  }

  let clientName = stop?.clientName && String(stop.clientName).trim() ? stop.clientName : null;

  if (Number.isFinite(apptIdNum)) {
    const appt = appointments.find(a => Number(a.id) === apptIdNum);

    if (appt) {
      // a) já vem nome no appointment?
      if (appt?.client?.name) clientName = appt.client.name;
      else if (appt?.clientName) clientName = appt.clientName;
      else {
        // b) tenta achar cliente separado
        const cli = clients.find((c: any) => String(c.id) === String(appt.clientId));
        if (cli?.name) clientName = cli.name;
      }

      // Retorna nome + ID do agendamento
      if (clientName) return `${clientName} #${apptIdNum} `;
    }
  }

  // fallback final (mas com label mais curta/legível)
  const raw = String(stop?.appointmentId ?? "");
  return `Agendamento #${raw.length > 12 ? `${raw.slice(0, 8)}…${raw.slice(-4)}` : raw} `;
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

// mostra só a data em pt-BR (com correção de timezone)
const fmtDateList = (input: string | Date) => {
  // Garante que pegamos apenas YYYY-MM-DD, seja string ISO ou Date
  const dateStr = typeof input === 'string' ? input : input.toISOString();
  const ymd = dateStr.split('T')[0];
  // Adiciona meio-dia para evitar problemas de fuso horário
  return new Date(ymd + 'T12:00:00').toLocaleDateString("pt-BR");
};


export default function RoutesHistoryPage() {
  // Rastreamento
  const [trackingRouteId, setTrackingRouteId] = useState<string | null>(null);

  // Estados dos filtros
  const [filters, setFilters] = useState<RouteFilters>({
    dateFrom: '',
    dateTo: '',
    selectedResponsible: 'all',
    selectedVehicle: 'all',
    selectedStatus: 'all',
    searchTerm: ''
  });

  const [, setLocation] = useLocation();

  // Capturar ID da rota da URL (/routes-history/:routeId)
  const [match, params] = useRoute("/routes-history/:routeId");

  // Abre /appointments com responsável e data da rota pré-preenchidos
  const openNewAppointment = (route: Route) => {
    if (!route) return;

    const prefill = {
      teamId: route.responsibleType === "team" ? Number(route.responsibleId) : undefined,
      technicianId: route.responsibleType === "technician" ? Number(route.responsibleId) : undefined,
      scheduledDate: route.date, // usa a data da rota
    };

    const encoded = encodeURIComponent(btoa(JSON.stringify(prefill)));
    setLocation(`/ appointments ? prefill = ${encoded} `);
  };

  // ✅ Estado de paginação para rotas
  const [routesPage, setRoutesPage] = useState(1);
  const routesPageSize = 20;

  // Reset page ao mudar filtros
  useEffect(() => {
    setRoutesPage(1);
  }, [filters]);

  // Query para listar rotas com filtros E paginação
  const { data: routesResponse, isLoading: isLoadingRoutes } = useQuery<RoutesResponse>({
    queryKey: ['/api/routes', filters, routesPage],
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

      // Paginação
      params.append('page', String(routesPage));
      params.append('pageSize', String(routesPageSize));

      const response = await fetch(`/api/routes?${params.toString()}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Erro ao buscar rotas');
      return response.json();
    }
  });

  // Extrair items e pagination da resposta
  const routesData = routesResponse?.items || [];
  const routesPagination = routesResponse?.pagination || { page: 1, pageSize: 20, total: 0, totalPages: 1 };

  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [auditRouteId, setAuditRouteId] = useState<string | null>(null);

  // Estados para resolução de pendências
  const [resolvePendingOpen, setResolvePendingOpen] = useState(false);
  const [selectedPendingAppt, setSelectedPendingAppt] = useState<any | null>(null);
  const [appointmentHistoryOpen, setAppointmentHistoryOpen] = useState(false);
  const [selectedHistoryApptId, setSelectedHistoryApptId] = useState<number | null>(null);
  const [appointmentHistory, setAppointmentHistory] = useState<any[]>([]);
  const [appointmentDetailsId, setAppointmentDetailsId] = useState<number | null>(null);

  // Função para verificar URL params e abrir automaticamente a modal
  useEffect(() => {
    // Prioridade 1: displayNumber na URL como parâmetro de rota (/routes-history/:routeId)
    if (match && params?.routeId && routesData.length > 0) {
      // Tentar converter para número (displayNumber)
      const displayNum = Number(params.routeId);

      if (!isNaN(displayNum)) {
        // Buscar rota pelo displayNumber
        const routeExists = routesData.find(route => route.displayNumber === displayNum);
        if (routeExists) {
          setSelectedRoute(routeExists.id);
        }
      } else {
        // Fallback: buscar pelo UUID (para compatibilidade)
        const routeExists = routesData.find(route => route.id === params.routeId);
        if (routeExists) {
          setSelectedRoute(params.routeId);
        }
      }
      return;
    }

    // Prioridade 2: Query string (?open=routeId) - para compatibilidade
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
  }, [routesData, match, params]);

  console.log('✅ Página Histórico de Rotas carregada');
  console.log('🔍 [ROUTES HISTORY] Aplicando filtros:', filters);

  // Query para pendências (agendamentos não concluídos de rotas finalizadas)
  const { pendingAppointments, isLoading: isLoadingPending } = usePendingAppointments();

  const getExecutionStatusColor = (status: string | null) => {
    if (!status) return 'bg-gray-100 text-gray-800 border-gray-200';
    if (status === 'concluido') return 'bg-green-100 text-green-800 border-green-200';
    return 'bg-red-100 text-red-800 border-red-200';
  };

  const getExecutionStatusLabel = (status: string | null) => {
    if (!status) return 'Pendente';
    switch (status) {
      case 'concluido': return 'Concluído';
      case 'nao_realizado_cliente_ausente': return 'Ausente';
      case 'nao_realizado_cliente_pediu_remarcacao': return 'Remarcar';
      case 'nao_realizado_problema_tecnico': return 'Prob. Técnico';
      case 'nao_realizado_endereco_incorreto': return 'End. Incorreto';
      case 'nao_realizado_cliente_recusou': return 'Recusou';
      case 'nao_realizado_falta_material': return 'Falta Material';
      case 'nao_realizado_outro': return 'Outro';
      default: return 'Pendente';
    }
  };

  // Detalhe da rota selecionada
  const { data: routeDetail } = useQuery<RouteDetail>({
    queryKey: ['/api/routes', selectedRoute],
    queryFn: async () => {
      const response = await fetch(`/api/routes/${selectedRoute}`, {
        headers: getAuthHeaders(),
      });
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
      const res = await fetch(`/api/routes/${selectedRoute}/available-appointments`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) return []; // deixa o fallback funcionar se o endpoint não existir
      const data = await res.json();
      return normalizeItems(data);
    },
  });

  // Fallback: lista geral de agendamentos (você já tem esse endpoint)
  const { data: appointmentsData } = useQuery({
    queryKey: ['/api/appointments'],
    queryFn: async () => {
      const response = await fetch('/api/appointments', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Erro ao buscar agendamentos');
      return response.json();
    }
  });
  const appointments = normalizeItems(appointmentsData);

  // (opcional) cache de clientes para exibir nome
  const { data: clients = [] } = useQuery({
    queryKey: ['/api/clients'],
    queryFn: async () => {
      const response = await fetch('/api/clients?limit=50', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Erro ao buscar clientes');
      const data = await response.json();
      return normalizeItems(data);
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
  const { data: techniciansData } = useQuery({
    queryKey: ['/api/technicians'],
    queryFn: async () => {
      const response = await fetch('/api/technicians?page=1&pageSize=50', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Erro ao buscar técnicos');
      return response.json();
    }
  });
  const technicians = normalizeItems<any>(techniciansData);

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
      // Invalida appointments para atualização instantânea na tela de agendamentos
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
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
          terminarNoPontoInicial: false, // Por padrão não termina no ponto inicial
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

  // mutation para atualizar status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ routeId, status }: { routeId: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/routes/${routeId}/status`, { status });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Erro ao atualizar status");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Status atualizado",
        description: "O status da rota foi alterado com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/routes', selectedRoute] });
      queryClient.invalidateQueries({ queryKey: ['/api/routes'] });
      // Invalida appointments para atualização instantânea na tela de agendamentos
      queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
      // Invalida provider active-today para atualização na tela de Prestadores
      queryClient.invalidateQueries({ queryKey: ['/api/provider/active-today'] });
      queryClient.invalidateQueries({ queryKey: ['/api/provider/route'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar status",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateRouteDateMutation = useMutation({
    mutationFn: async ({ routeId, date }: { routeId: string; date: string }) => {
      const res = await apiRequest("PATCH", `/api/routes/${routeId}/date`, { date });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/routes'] });
      if (selectedRoute) {
        queryClient.invalidateQueries({ queryKey: [`/api/routes/${selectedRoute}`] });
      }
      toast({
        title: "Data atualizada",
        description: "A data da rota foi alterada com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar data",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Função helper para verificar se a rota é editável baseado no status
  const isRouteEditable = (status: string) => {
    return status === 'draft' || status === 'confirmado';
  };

  // Estados para modal de remoção
  const [removeOpen, setRemoveOpen] = useState(false);
  const [stopToRemove, setStopToRemove] = useState<{ id: string; clientName?: string } | null>(null);

  // Guarda a última parada removida para permitir "Desfazer"
  const [lastRemoved, setLastRemoved] = useState<null | {
    routeId: string;
    stopId: string;
    appointmentId?: number;
    clientName?: string | null;
  }>(null);

  // Lista local (UI) para ordenar sem esperar round-trip
  const [stopsUI, setStopsUI] = useState<RouteDetail["stops"]>([]);

  // sempre que routeDetail mudar, sincroniza a UI (ordenado por "order")
  useEffect(() => {
    const sorted = (routeDetail?.stops || [])
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    setStopsUI(sorted);
  }, [routeDetail?.stops]);

  // linha provisória desenhada no mapa enquanto o back recalcula
  const [manualLine, setManualLine] = useState<any | null>(null);

  // gera um LineString simples a partir da lista ordenada local
  const buildLineFromStops = (stops: typeof stopsUI) => ({
    type: "LineString",
    coordinates: stops
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((s) => [Number(s.lng), Number(s.lat)]),
  });

  useEffect(() => {
    setManualLine(null);
  }, [routeDetail?.route?.updatedAt, routeDetail?.stops?.length]);

  // start “fixo” da empresa/técnico (para o pin e para a linha manual)
  const [localStart, setLocalStart] = useState<{ lat: number; lon: number } | null>(null);

  // quando abrir/atualizar a rota, congela o start da empresa
  useEffect(() => {
    // Só atualiza se ainda não tem um localStart definido ou se mudou de rota
    if (!routeDetail?.route?.id) return;

    const apiStart = (routeDetail as any)?.start;
    let newStart = null;

    if (apiStart && Number.isFinite(Number(apiStart.lat)) && Number.isFinite(Number(apiStart.lng ?? apiStart.lon))) {
      newStart = { lat: Number(apiStart.lat), lon: Number(apiStart.lng ?? apiStart.lon) };
      console.log("🎯 [START UPDATE] Usando start do API:", newStart);
    } else {
      const s = getStartCoords(routeDetail?.route);
      if (s && Number.isFinite(s.lat) && Number.isFinite(s.lon)) {
        newStart = { lat: s.lat, lon: s.lon };
        console.log("🎯 [START UPDATE] Usando start calculado:", newStart);
      }
    }

    // Só atualiza se realmente tem um novo valor válido
    if (newStart) {
      setLocalStart(newStart);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeDetail?.route?.id, (routeDetail as any)?.start]);

  // Flag de ordenação local
  const [isLocalReordered, setIsLocalReordered] = useState(false);

  // Estado de loading para reordenação - usando useRef para persistir entre re-renders
  const [isReordering, setIsReordering] = useState(false);
  const reorderingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isReorderingRef = useRef(false);

  // já existia: mantém stopsUI em sincronia com o back
  useEffect(() => {
    // Não atualiza se está reordenando para evitar interrupções
    if (isReorderingRef.current) {
      console.log("⚠️ [BLOCK] Bloqueando atualização de stopsUI durante reordenação");
      return;
    }

    const sorted = (routeDetail?.stops || [])
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    setStopsUI(sorted);
    setIsLocalReordered(false); // <- sempre que vier algo do back (ex.: Otimizar), voltamos ao modo "servidor"
  }, [routeDetail?.stops]);

  useEffect(() => {
    if (!isReorderingRef.current) {
      setIsLocalReordered(false);
    }
  }, [routeDetail?.route?.id]);

  // Força atualização quando a rota é atualizada no backend
  useEffect(() => {
    // Só atualiza se NÃO está reordenando
    if (routeDetail?.route?.updatedAt && !isReorderingRef.current) {
      console.log("🔄 [ROUTE UPDATE] Rota atualizada, forçando re-render");
      setMapVersion((v) => v + 1);
    }
  }, [routeDetail?.route?.updatedAt]);

  // Limpa timeout ao desmontar
  useEffect(() => {
    return () => {
      if (reorderingTimeoutRef.current) {
        clearTimeout(reorderingTimeoutRef.current);
      }
    };
  }, []);


  // mutation para remover parada
  const removeStopMutation = useMutation({
    mutationFn: async ({ routeId, stopId, appointmentId, clientName }: {
      routeId: string;
      stopId: string;
      appointmentId?: number;
      clientName?: string | null;
    }) => {
      const res = await fetch(`/api/routes/${routeId}/stops/${stopId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      const contentType = res.headers.get("content-type") || "";
      const payload = contentType.includes("application/json") ? await res.json() : await res.text();

      if (!res.ok) {
        const msg = typeof payload === "string" ? payload : payload?.message || "Falha ao remover";
        throw new Error(msg);
      }

      return { ...payload, routeId, stopId, appointmentId, clientName };
    },
    onSuccess: (payload) => {
      // guarda infos para UNDO
      setLastRemoved({
        routeId: payload.routeId,
        stopId: payload.stopId,
        appointmentId: payload.appointmentId,
        clientName: payload.clientName,
      });

      toast({
        title: "Parada removida",
        description: `${payload.clientName || "Agendamento"} foi removido da rota.`,
        action: (
          <ToastAction altText="Desfazer" onClick={() => undoRemove()}>
            Desfazer
          </ToastAction>
        ),
      });

      setRemoveOpen(false);
      setStopToRemove(null);
      // recarrega detalhe da rota e listagem
      queryClient.invalidateQueries({ queryKey: ["/api/routes", selectedRoute] });
      queryClient.invalidateQueries({ queryKey: ["/api/routes"] });
      // Invalida appointments para atualização instantânea na tela de agendamentos
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
    },
    onError: (err: any) => {
      toast({
        title: "Não foi possível remover",
        description: err?.message || "Tente novamente.",
        variant: "destructive",
      });
    },
  });


  // Mutation para reordenar paradas
  const reorderStopsMutation = useMutation({
    mutationFn: async ({ routeId, stopIds }: { routeId: string; stopIds: string[] }) => {
      const res = await apiRequest("PATCH", `/api/routes/${routeId}/stops/reorder`, { stopIds });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || "Falha ao reordenar");
      }
      return res.json();
    },
    onError: (e: any) => {
      toast({
        title: "Erro ao reordenar",
        description: e?.message || "Tente novamente.",
        variant: "destructive",
      });
      // volta estado local (refetch)
      setIsLocalReordered(false);
      // Delay no erro também para dar tempo de ver o loading
      reorderingTimeoutRef.current = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['/api/routes', selectedRoute] });
        isReorderingRef.current = false;
        setIsReordering(false);
        reorderingTimeoutRef.current = null;
        console.log("🔴 [LOADING] Loading FINALIZADO (erro)");
      }, 1000);
    },
    onSuccess: (data) => {
      console.log("✨ [REORDER SUCCESS] Resposta do backend:", data);

      // Se o backend retornou o ponto inicial, atualizar o estado local
      if (data?.start) {
        setLocalStart({
          lat: Number(data.start.lat),
          lon: Number(data.start.lng ?? data.start.lon),
        });
        console.log("📍 [REORDER SUCCESS] Ponto inicial atualizado:", data.start);
      }

      // força voltar ao modo "servidor" para usar dados corretos do backend
      setIsLocalReordered(false);

      // Aguarda um pouco antes de invalidar para evitar multiplos re-renders
      // TIMEOUT ÚNICO de 2500ms total
      reorderingTimeoutRef.current = setTimeout(() => {
        console.log("⏳ [LOADING] Iniciando finalização...");
        // Invalida apenas uma vez
        queryClient.invalidateQueries({ queryKey: ['/api/routes', selectedRoute] });
        setMapVersion((v) => v + 1);

        // Remove o loading após garantir que tudo foi atualizado
        isReorderingRef.current = false;
        setIsReordering(false);
        reorderingTimeoutRef.current = null;
        console.log("✅ [LOADING] Loading FINALIZADO com sucesso após 2.5s");
      }, 2500); // 2.5 segundos FIXO
    },
  });

  // Função para desfazer remoção
  const undoRemove = () => {
    if (!lastRemoved?.routeId || !lastRemoved?.appointmentId) return;

    // re-adiciona o agendamento removido
    addStopsMutation.mutate({
      routeId: lastRemoved.routeId,
      appointmentIds: [String(lastRemoved.appointmentId)],
    });

    // limpa memória local para não reaproveitar indevidamente
    setLastRemoved(null);
  };

  // ========== FUNÇÕES PARA RESOLUÇÃO DE PENDÊNCIAS ==========

  // Abrir modal de resolução de pendência
  const handleResolvePending = (appt: any) => {
    setSelectedPendingAppt(appt);
    setResolvePendingOpen(true);
  };

  // Submeter resolução de pendência
  const handleResolveSubmit = async (resolutionData: any) => {
    try {
      const response = await apiRequest("POST", "/api/pending-resolutions/resolve", resolutionData);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao resolver pendência");
      }

      toast({
        title: "Pendência resolvida",
        description: "A pendência foi resolvida com sucesso.",
      });

      // Fecha modal
      setResolvePendingOpen(false);
      setSelectedPendingAppt(null);

      // Invalida queries para atualizar a lista
      await queryClient.invalidateQueries({ queryKey: ['/api/pending-appointments'] });
      await queryClient.refetchQueries({ queryKey: ['/api/pending-appointments'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/routes'] });

    } catch (error: any) {
      toast({
        title: "Erro ao resolver pendência",
        description: error.message,
        variant: "destructive",
      });
      throw error; // re-throw para o modal tratar
    }
  };

  // Buscar e exibir histórico de um agendamento
  const handleViewHistory = async (appointmentId: number) => {
    try {
      const response = await fetch(`/api/appointments/${appointmentId}/history`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error("Erro ao buscar histórico");
      }

      const history = await response.json();
      setAppointmentHistory(history);
      setSelectedHistoryApptId(appointmentId);
      setAppointmentHistoryOpen(true);

    } catch (error: any) {
      toast({
        title: "Erro ao buscar histórico",
        description: error.message,
        variant: "destructive",
      });
    }
  };


  const { data: teamsData } = useQuery({
    queryKey: ['/api/teams'],
    queryFn: async () => {
      const response = await fetch('/api/teams?page=1&pageSize=50', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Erro ao buscar equipes');
      return response.json();
    }
  });
  const teams = normalizeItems<any>(teamsData);

  // carrega veículos
  const { data: vehiclesData } = useQuery({
    queryKey: ["/api/vehicles"],
    queryFn: async () => {
      const response = await fetch("/api/vehicles?page=1&pageSize=50", {
        headers: getAuthHeaders(),
      }); // "fetch" = solicitar dados ao backend
      if (!response.ok) throw new Error("Erro ao buscar veículos");
      return response.json();
    },
  });
  const vehicles = normalizeItems<any>(vehiclesData);

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
      const r = await fetch('/api/business-rules', {
        headers: getAuthHeaders(),
      });
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
    // Busca veículo usando a mesma lógica da tabela (fallback)
    const fallbackVehicleId =
      route.vehicleId ??
      (route.responsibleType === "team"
        ? vehicles.find((v: any) => v.teamId === Number(route.responsibleId))?.id
        : vehicles.find((v: any) => v.technicianId === Number(route.responsibleId))?.id);

    return formatVehicle(getVehicleById(fallbackVehicleId));
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

  // Retorna SEMPRE o início da EMPRESA quando disponível.
  // Só se não houver lat/lng da empresa é que caímos para rota/responsável.
  const getStartCoords = (route?: Route) => {
    const br: any = businessRules;

    // 1) Tenta empresa primeiro (garante pino fixo)
    const companyLat = Number(br?.enderecoEmpresaLat);
    const companyLng = Number(br?.enderecoEmpresaLng);
    if (Number.isFinite(companyLat) && Number.isFinite(companyLng)) {
      return { lat: companyLat, lon: companyLng };
    }

    // 2) Sem empresa? Tenta rota/responsável como antes
    if (!route) return null;
    const r: any = route;

    const candidates: Array<[any, any]> = [
      [r.startLat, r.startLng],
      [r.startLatitude, r.startLongitude],
      [r.start_lat, r.start_lng],
      [r.start?.lat, r.start?.lng],
      [r.start?.latitude, r.start?.longitude],
    ];

    if (route.responsibleType === "technician") {
      const tech: any = technicians.find((t: any) => t.id.toString() === route.responsibleId);
      candidates.push([tech?.enderecoInicioLat, tech?.enderecoInicioLng]);
    } else if (route.responsibleType === "team") {
      const team: any = teams.find((t: any) => t.id.toString() === route.responsibleId);
      candidates.push([team?.enderecoInicioLat, team?.enderecoInicioLng]);
    }

    for (const [lat, lng] of candidates) {
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return { lat: Number(lat), lon: Number(lng) };
      }
    }

    // 3) Sem nada? Loga para facilitar debug (apenas no dev)
    if (process.env.NODE_ENV !== "production") {
      console.warn("[ROUTES HISTORY] Start não encontrado: verifique business-rules (lat/lng) ou start da rota.");
    }
    return null;
  };



  const handleExportRoute = async () => {
    if (!routeDetail) {
      toast({
        title: "Erro ao exportar",
        description: "Nenhuma rota selecionada",
        variant: "destructive",
      });
      return;
    }

    try {
      toast({
        title: "Gerando PDF...",
        description: "Por favor, aguarde enquanto o PDF está sendo criado.",
      });

      // 1. Gerar link do Google Maps
      const originText = getStartAddressText(routeDetail.route).trim();
      const orderedStops = [...(routeDetail.stops || [])].sort(
        (a, b) => (a.order ?? 0) - (b.order ?? 0)
      );

      const stopAddresses = orderedStops
        .map((s) => {
          const addr = (s.address || "").trim();
          if (addr) return addr;
          if (Number.isFinite(s.lat) && Number.isFinite(s.lng)) {
            return `${s.lat},${s.lng}`;
          }
          return "";
        })
        .filter(Boolean);

      let googleMapsUrl = "";
      if (originText && stopAddresses.length > 0) {
        const waypoints = stopAddresses.slice(0, -1);
        const destination = stopAddresses[stopAddresses.length - 1];
        googleMapsUrl =
          `https://www.google.com/maps/dir/?api=1&travelmode=driving` +
          `&origin=${encodeURIComponent(originText)}` +
          `&destination=${encodeURIComponent(destination)}` +
          (waypoints.length
            ? `&waypoints=${encodeURIComponent(waypoints.join("|"))}`
            : "");
      }

      // 2. Gerar QR Code
      let qrCodeDataUrl = "";
      if (googleMapsUrl) {
        qrCodeDataUrl = await QRCode.toDataURL(googleMapsUrl, {
          width: 200,
          margin: 1,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });
      }

      // 3. Carregar logo
      const logoUrl = '/brand/rotafacil-pin.png';
      let logoDataUrl = "";
      try {
        const logoResponse = await fetch(logoUrl);
        const logoBlob = await logoResponse.blob();
        logoDataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(logoBlob);
        });
      } catch (e) {
        console.warn('Logo não carregada:', e);
      }

      // 4. Capturar mapa como imagem - usando dom-to-image-more para melhor precisão
      let mapImageDataUrl = "";

      const mapContainer = document.querySelector('.leaflet-container') as HTMLElement;
      if (mapContainer) {
        // Aguardar que todos os tiles e elementos do mapa estejam carregados
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Forçar invalidação do tamanho do mapa para garantir renderização correta
        try {
          const mapInstance = (mapContainer as any)._leaflet_map;
          if (mapInstance) {
            mapInstance.invalidateSize();
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } catch (e) {
          console.warn('Não foi possível invalidar o tamanho do mapa:', e);
        }

        // 4.1) Remove apenas markers numerados (DivIcon) antes da captura
        const mapInstance = (mapContainer as any)._leaflet_map;
        let removedMarkers: any[] = [];
        if (mapInstance) {
          try {
            const leafletMod: any = await import('leaflet');
            const L = leafletMod?.default ?? leafletMod;
            if (L?.DivIcon) {
              mapInstance.eachLayer((layer: any) => {
                try {
                  // Remove apenas markers com DivIcon (números das paradas)
                  // Mantém: StartIcon (pin de início) e GeoJSON/Polyline (linha da rota)
                  if (layer instanceof L.Marker && layer.options?.icon instanceof L.DivIcon) {
                    removedMarkers.push(layer);
                    mapInstance.removeLayer(layer);
                  }
                } catch {
                  // ignore
                }
              });
            }
          } catch {
            // ignore
          }
        }

        await new Promise(resolve => setTimeout(resolve, 100));

        if (true) {
          let captureStyleEl: HTMLStyleElement | null = null;
          try {
            // Mitiga "grades"/gaps de tiles do Leaflet: desativa transforms durante a captura.
            captureStyleEl = document.createElement('style');
            captureStyleEl.setAttribute('data-pdf-map-capture', '1');
            captureStyleEl.textContent = `
              .leaflet-container { background: #ffffff !important; }
              .leaflet-pane, .leaflet-map-pane, .leaflet-tile-pane, .leaflet-overlay-pane,
              .leaflet-marker-pane, .leaflet-shadow-pane { transform: none !important; }
              .leaflet-tile-container { transform: none !important; }
              .leaflet-tile { transform: none !important; }
            `;
            document.head.appendChild(captureStyleEl);

            await new Promise(resolve => setTimeout(resolve, 250));

            // dom-to-image-more: captura tiles + polyline + StartIcon (sem markers numerados que crasham)
            const dataUrl = await domtoimage.toJpeg(mapContainer, {
              quality: 0.98,
              bgcolor: '#ffffff',
              width: mapContainer.offsetWidth,
              height: mapContainer.offsetHeight,
              style: {
                transform: 'none',
                backgroundColor: '#ffffff',
              },
              filter: (node: HTMLElement) => {
                // Filtrar controles do Leaflet
                if (node.classList) {
                  return !node.classList.contains('leaflet-control-container') &&
                    !node.classList.contains('leaflet-control-attribution') &&
                    !node.classList.contains('leaflet-control-zoom');
                }
                return true;
              },
            });

            // Reduz a imagem antes de inserir no PDF para evitar artefatos por fatiamento interno do jsPDF
            try {
              const img = new Image();
              img.crossOrigin = 'anonymous';
              await new Promise<void>((resolve, reject) => {
                img.onload = () => resolve();
                img.onerror = reject;
                img.src = dataUrl;
              });

              const maxW = 900;
              const maxH = 600;
              const scale = Math.min(1, maxW / img.width, maxH / img.height);
              const targetW = Math.max(1, Math.round(img.width * scale));
              const targetH = Math.max(1, Math.round(img.height * scale));

              const c = document.createElement('canvas');
              c.width = targetW;
              c.height = targetH;
              const cctx = c.getContext('2d');
              if (cctx) {
                cctx.fillStyle = '#ffffff';
                cctx.fillRect(0, 0, targetW, targetH);
                cctx.imageSmoothingEnabled = true;
                // @ts-ignore
                cctx.imageSmoothingQuality = 'high';
                cctx.drawImage(img, 0, 0, targetW, targetH);
                mapImageDataUrl = c.toDataURL('image/jpeg', 0.92);
              } else {
                mapImageDataUrl = dataUrl;
              }
            } catch {
              mapImageDataUrl = dataUrl;
            }
          } catch {
            toast({
              title: "Aviso",
              description: "Não foi possível capturar o mapa. O PDF será gerado sem a visualização do mapa.",
              variant: "default",
            });
          } finally {
            if (captureStyleEl) captureStyleEl.remove();
            // Restaura markers numerados
            if (mapInstance && removedMarkers.length > 0) {
              try {
                removedMarkers.forEach((layer) => {
                  try {
                    layer.addTo(mapInstance);
                  } catch {
                    // ignore
                  }
                });
              } catch {
                // ignore
              }
            }
          }
        }
      }

      // 5. Criar PDF com design melhorado
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      let yPosition = margin;

      // Cores do tema (definidas como tuplas para TypeScript)
      const primaryColor: [number, number, number] = [200, 140, 0]; // burnt-yellow
      const secondaryColor: [number, number, number] = [0, 100, 0]; // verde
      const accentColor: [number, number, number] = [41, 128, 185]; // azul
      const textColor: [number, number, number] = [50, 50, 50];
      const lightGray: [number, number, number] = [240, 240, 240];

      // Cabeçalho com fundo colorido
      pdf.setFillColor(...primaryColor);
      pdf.rect(0, 0, pageWidth, 35, 'F');

      // Logo
      if (logoDataUrl) {
        const logoSize = 15;
        pdf.addImage(logoDataUrl, 'PNG', margin, 8, logoSize, logoSize);
      }

      // Título no cabeçalho
      pdf.setFontSize(24);
      pdf.setTextColor(255, 255, 255);
      pdf.text('Rota Fácil', logoDataUrl ? margin + 20 : margin, 18);

      pdf.setFontSize(12);
      pdf.setTextColor(255, 255, 255);
      pdf.text('Relatório de Rota', logoDataUrl ? margin + 20 : margin, 26);

      yPosition = 45;

      // Título da rota com fundo
      pdf.setFillColor(...lightGray);
      pdf.roundedRect(margin, yPosition - 5, pageWidth - 2 * margin, 12, 2, 2, 'F');
      pdf.setFontSize(16);
      pdf.setTextColor(...textColor);
      pdf.text(`${routeDetail.route?.title || 'Sem título'}`, margin + 3, yPosition + 3);
      yPosition += 15;

      // Card de informações principais
      pdf.setFillColor(250, 250, 250);
      const cardHeight = 50;
      pdf.roundedRect(margin, yPosition, pageWidth - 2 * margin, cardHeight, 3, 3, 'F');

      yPosition += 5;
      const leftCol = margin + 5;
      const rightCol = pageWidth / 2 + 5;

      // Coluna esquerda
      pdf.setFontSize(10);
      pdf.setTextColor(...primaryColor);
      pdf.text('ID:', leftCol, yPosition);
      pdf.setTextColor(...textColor);
      pdf.text(`#${routeDetail.route.displayNumber}`, leftCol + 15, yPosition);
      yPosition += 6;

      pdf.setTextColor(...primaryColor);
      pdf.text('Data:', leftCol, yPosition);
      pdf.setTextColor(...textColor);
      pdf.text(fmtDateList(routeDetail.route?.date), leftCol + 15, yPosition);
      yPosition += 6;

      pdf.setTextColor(...primaryColor);
      pdf.text('Responsável:', leftCol, yPosition);
      pdf.setTextColor(...textColor);
      const respText = pdf.splitTextToSize(getResponsibleName(routeDetail.route), 60);
      pdf.text(respText, leftCol + 25, yPosition);
      yPosition += 6;

      pdf.setTextColor(...primaryColor);
      pdf.text('Veículo:', leftCol, yPosition);
      pdf.setTextColor(...textColor);
      const vehicleText = pdf.splitTextToSize(getRouteVehicleName(routeDetail.route), 60);
      pdf.text(vehicleText, leftCol + 20, yPosition);

      // Coluna direita
      yPosition -= 18;

      pdf.setTextColor(...primaryColor);
      pdf.text('Status:', rightCol, yPosition);
      pdf.setTextColor(...textColor);
      pdf.text(statusLabels[routeDetail.route?.status] || routeDetail.route?.status, rightCol + 15, yPosition);
      yPosition += 6;

      pdf.setTextColor(...accentColor);
      pdf.text('Distância:', rightCol, yPosition);
      pdf.setTextColor(...textColor);
      pdf.text(fmtKm(routeDetail.route?.distanceTotal), rightCol + 22, yPosition);
      yPosition += 6;

      pdf.setTextColor(...secondaryColor);
      pdf.text('Duração:', rightCol, yPosition);
      pdf.setTextColor(...textColor);
      pdf.text(fmtMin(routeDetail.route?.durationTotal), rightCol + 20, yPosition);
      yPosition += 6;

      pdf.setTextColor(...primaryColor);
      pdf.text('Paradas:', rightCol, yPosition);
      pdf.setTextColor(...textColor);
      pdf.text(`${routeDetail.route?.stopsCount}`, rightCol + 18, yPosition);

      yPosition += 25;

      // Ponto inicial com ícone
      pdf.setFillColor(...secondaryColor);
      pdf.roundedRect(margin, yPosition, pageWidth - 2 * margin, 8, 2, 2, 'F');
      pdf.setFontSize(12);
      pdf.setTextColor(255, 255, 255);
      pdf.text('Ponto Inicial', margin + 3, yPosition + 5.5);
      yPosition += 12;

      pdf.setFontSize(10);
      pdf.setTextColor(...textColor);
      const startAddress = getStartAddressText(routeDetail.route);
      const startLines = pdf.splitTextToSize(startAddress, pageWidth - 2 * margin - 10);
      pdf.text(startLines, margin + 5, yPosition);
      yPosition += startLines.length * 5 + 8;

      // Paradas com design melhorado
      pdf.setFillColor(...primaryColor);
      pdf.roundedRect(margin, yPosition, pageWidth - 2 * margin, 8, 2, 2, 'F');
      pdf.setFontSize(12);
      pdf.setTextColor(255, 255, 255);
      pdf.text('Paradas da Rota', margin + 3, yPosition + 5.5);
      yPosition += 12;

      orderedStops.forEach((stop, index) => {
        // Verificar se precisa de nova página
        if (yPosition > pageHeight - 35) {
          pdf.addPage();
          yPosition = margin;
        }

        // Número da parada com círculo
        pdf.setFillColor(...primaryColor);
        pdf.circle(margin + 5, yPosition + 2, 4, 'F');
        pdf.setFontSize(10);
        pdf.setTextColor(255, 255, 255);
        pdf.text(`${stop.order}`, margin + 3.5, yPosition + 3.2);

        // Nome do cliente
        pdf.setFontSize(11);
        pdf.setTextColor(...textColor);
        pdf.text(displayStopName(stop, appointments, clients), margin + 12, yPosition + 3);
        yPosition += 6;

        // Endereço
        pdf.setFontSize(9);
        pdf.setTextColor(120, 120, 120);
        const addressLines = pdf.splitTextToSize(stop.address, pageWidth - 2 * margin - 15);
        pdf.text(addressLines, margin + 12, yPosition);
        yPosition += addressLines.length * 4 + 5;
      });

      // Adicionar nova página para o mapa e QR code
      pdf.addPage();
      yPosition = margin;

      // Cabeçalho da segunda página
      pdf.setFillColor(...accentColor);
      pdf.rect(0, 0, pageWidth, 20, 'F');
      pdf.setFontSize(16);
      pdf.setTextColor(255, 255, 255);
      pdf.text('Visualização e Navegação', margin, 13);

      yPosition = 30;

      // Mapa com borda
      if (mapImageDataUrl) {
        pdf.setFillColor(...lightGray);
        pdf.roundedRect(margin - 2, yPosition - 2, pageWidth - 2 * margin + 4, 124, 3, 3, 'F');

        const mapWidth = pageWidth - 2 * margin;
        const mapHeight = 120;
        // @ts-ignore
        pdf.addImage(mapImageDataUrl, 'JPEG', margin, yPosition, mapWidth, mapHeight, undefined, 'NONE');
        yPosition += mapHeight + 10;
      }

      // QR Code com card estilizado
      if (qrCodeDataUrl) {
        pdf.setFillColor(250, 250, 250);
        pdf.roundedRect(margin, yPosition, pageWidth - 2 * margin, 70, 3, 3, 'F');

        yPosition += 8;
        pdf.setFontSize(14);
        pdf.setTextColor(...primaryColor);
        pdf.text('Navegue pelo Google Maps', margin + 5, yPosition);
        yPosition += 7;

        pdf.setFontSize(9);
        pdf.setTextColor(...textColor);
        pdf.text('Escaneie o QR Code com seu celular para iniciar a navegação:', margin + 5, yPosition);
        yPosition += 8;

        const qrSize = 45;
        const qrX = (pageWidth - qrSize) / 2;
        pdf.addImage(qrCodeDataUrl, 'PNG', qrX, yPosition, qrSize, qrSize);
      }

      // Rodapé em todas as páginas
      const totalPages = pdf.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setDrawColor(200, 200, 200);
        pdf.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
        pdf.setFontSize(8);
        pdf.setTextColor(150, 150, 150);
        const footerText = `Gerado em ${new Date().toLocaleString('pt-BR')} - Rota Fácil`;
        pdf.text(footerText, margin, pageHeight - 8);
        pdf.text(`Página ${i} de ${totalPages}`, pageWidth - margin - 20, pageHeight - 8);
      }

      // 6. Salvar PDF
      const fileName = `rota_${routeDetail.route.displayNumber}_${routeDetail.route?.title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      pdf.save(fileName);

      // Registrar auditoria de exportação
      try {
        await fetch(`/api/routes/${routeDetail.route.id}/audit-export`, {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json',
          },
        });
      } catch (error) {
        console.error('Erro ao registrar auditoria de exportação:', error);
      }

      toast({
        title: "PDF gerado com sucesso!",
        description: `Arquivo ${fileName} foi baixado.`,
      });

    } catch (error) {
      console.error('Erro ao exportar rota:', error);
      toast({
        title: "Erro ao gerar PDF",
        description: "Ocorreu um erro ao criar o arquivo PDF. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  // Sensores DnD e handler
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Versão do mapa para forçar re-render durante DnD
  const [mapVersion, setMapVersion] = useState(0);

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = stopsUI.findIndex(s => s.id === active.id);
    const newIndex = stopsUI.findIndex(s => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    // IMEDIATAMENTE mostra o loading ANTES de qualquer atualização
    // Cancela timeout anterior se existir
    if (reorderingTimeoutRef.current) {
      clearTimeout(reorderingTimeoutRef.current);
      reorderingTimeoutRef.current = null;
    }

    // Define em ambos: state e ref
    isReorderingRef.current = true;
    setIsReordering(true);
    console.log("🟡 [LOADING] Loading INICIADO");

    console.log("🎯 [DRAG END] Reordenando:", {
      movendoDe: oldIndex,
      movendoPara: newIndex,
      stopMovida: stopsUI[oldIndex],
      totalStops: stopsUI.length,
    });

    const newList = arrayMove(stopsUI, oldIndex, newIndex).map((s, idx) => ({
      ...s,
      order: idx + 1
    }));

    console.log("🔄 [DRAG END] Nova ordem:", newList.map(s => ({ id: s.id, order: s.order, address: s.address?.substring(0, 30) })));

    // Pequeno delay para garantir que o loading apareça antes das mudanças
    setTimeout(() => {
      setStopsUI(newList);
      setIsLocalReordered(true);
      // Não força re-render aqui, deixa para quando terminar

      if (routeDetail?.route?.id) {
        console.log("📡 [DRAG END] Enviando para o backend reordenar...");
        reorderStopsMutation.mutate({
          routeId: routeDetail.route.id,
          stopIds: newList.map(s => s.id),
        });
      }
    }, 50); // 50ms é suficiente para o loading aparecer
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


  // Componente para item sortável com handle
  function SortableStopItem({
    stop,
    children,
  }: {
    stop: { id: string };
    children: React.ReactNode;
  }) {
    const {
      attributes,
      listeners,
      setNodeRef,
      setActivatorNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: stop.id });

    const style: React.CSSProperties = {
      transform: CSS.Transform.toString(transform),
      transition,
    };

    return (
      <div ref={setNodeRef} style={style} className={isDragging ? "opacity-50" : ""}>
        <div className="flex items-start gap-2">
          {/* Handle de arraste */}
          <button
            className="cursor-grab p-1 rounded hover:bg-gray-100 mt-2"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label="Arrastar"
            title="Arrastar para reordenar"
          >
            <GripVertical className="w-4 h-4 text-gray-400" />
          </button>
          <div className="flex-1">
            {children}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <History className="h-6 w-6 text-burnt-yellow" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">Romaneios - Histórico de Rotas</h1>
        </div>
        <p className="text-gray-600">Visualize e gerencie os romaneios e o histórico de rotas otimizadas</p>
      </div>

      <Tabs defaultValue="romaneios" className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
          <TabsTrigger value="romaneios">Romaneios</TabsTrigger>
          <TabsTrigger value="pendencias" className="relative">
            Pendências
            {pendingAppointments.length > 0 && (
              <Badge variant="destructive" className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px]">
                {pendingAppointments.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="romaneios" className="space-y-6 mt-6">
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
                      <SelectItem value="confirmado">Confirmado</SelectItem>
                      <SelectItem value="finalizado">Finalizado</SelectItem>
                      <SelectItem value="cancelado">Cancelado</SelectItem>
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
                              <Select
                                value={route.status}
                                onValueChange={(newStatus) => {
                                  updateStatusMutation.mutate({ routeId: route.id, status: newStatus });
                                }}
                                disabled={!isRouteEditable(route.status)}
                              >
                                <SelectTrigger className={`w-[140px] h-7 ${statusColors[route.status] || statusColors.draft} border-0 font-medium`}>
                                  <SelectValue>
                                    {statusLabels[route.status] || route.status}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="draft">Rascunho</SelectItem>
                                  <SelectItem value="confirmado">Confirmado</SelectItem>
                                  <SelectItem value="finalizado">Finalizado</SelectItem>
                                  <SelectItem value="cancelado">Cancelado</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedRoute(route.id);
                                    setLocation(`/routes-history/${route.displayNumber}`);
                                  }}
                                  data-testid={`button-view-route-${route.id}`}
                                >
                                  <Eye className="h-4 w-4 mr-1" />
                                  Ver
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setAuditRouteId(route.id)}
                                  data-testid={`button-audit-route-${route.id}`}
                                  title="Ver histórico de alterações"
                                >
                                  <FileText className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setTrackingRouteId(route.id)}
                                  title="Ver Rastreamento GPS"
                                >
                                  <MapPin className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>

                  </Table>
                </div>
              )}

              {/* Barra de paginação */}
              {routesPagination.total > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 p-4 bg-gray-50 dark:bg-zinc-800 rounded-lg">
                  <div className="text-sm text-gray-600 dark:text-zinc-400">
                    Mostrando {routesData.length} de {routesPagination.total} rotas
                  </div>
                  <div className="flex items-center gap-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRoutesPage(p => Math.max(1, p - 1))}
                      disabled={routesPage <= 1}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Anterior
                    </Button>
                    <span className="text-sm font-medium">
                      Página {routesPagination.page} de {routesPagination.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRoutesPage(p => Math.min(routesPagination.totalPages, p + 1))}
                      disabled={routesPage >= routesPagination.totalPages}
                    >
                      Próxima
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pendencias" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Pendências de Rotas Finalizadas</CardTitle>
              <CardDescription>Agendamentos que não foram concluídos em rotas já encerradas.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data Rota</TableHead>
                    <TableHead>Rota</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Status Execução</TableHead>
                    <TableHead>Notas</TableHead>
                    <TableHead>Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingAppointments.map((apt: any) => (
                    <TableRow key={apt.id}>
                      <TableCell>{fmtDate(apt.routeDate)}</TableCell>
                      <TableCell>{apt.routeTitle}</TableCell>
                      <TableCell>{apt.clientName}</TableCell>
                      <TableCell>{apt.responsibleName}</TableCell>
                      <TableCell>
                        {/* 💵 Se paymentStatus é 'nao_pago', mostrar 'Falta Pagamento' */}
                        {apt.paymentStatus === 'nao_pago' ? (
                          <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-200">
                            💵 Falta Pagamento
                          </Badge>
                        ) : (
                          <Badge variant="outline" className={
                            apt.executionStatus === 'concluido'
                              ? 'bg-green-100 text-green-800 border-green-200'
                              : 'bg-red-100 text-red-800 border-red-200'
                          }>
                            {apt.executionStatus === 'concluido' ? 'Concluído' :
                              apt.executionStatus === 'nao_realizado_cliente_ausente' ? 'Cliente Ausente' :
                                apt.executionStatus === 'nao_realizado_cliente_pediu_remarcacao' ? 'Remarcar' :
                                  apt.executionStatus === 'nao_realizado_problema_tecnico' ? 'Problema Técnico' :
                                    apt.executionStatus === 'nao_realizado_endereco_incorreto' ? 'Endereço Incorreto' :
                                      apt.executionStatus === 'nao_realizado_cliente_recusou' ? 'Cliente Recusou' :
                                        apt.executionStatus === 'nao_realizado_falta_material' ? 'Falta Material' :
                                          apt.executionStatus || 'Pendente'}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate" title={apt.executionNotes}>{apt.executionNotes || '-'}</TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleResolvePending(apt)}
                        >
                          Resolver
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {pendingAppointments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-4 text-gray-500">Nenhuma pendência encontrada.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal central (layout split — infos à esq., mapa à dir.) */}
      <Dialog
        open={!!selectedRoute}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedRoute(null);
            // Voltar para /routes-history quando fechar o modal
            setLocation('/routes-history');
          }
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
                        <div className="flex items-center gap-2">
                          <Input
                            type="date"
                            className="h-7 w-auto min-w-[130px] text-xs px-2"
                            value={routeDetail.route?.date ? new Date(routeDetail.route.date).toISOString().split('T')[0] : ''}
                            onChange={(e) => {
                              if (routeDetail.route?.id && e.target.value) {
                                updateRouteDateMutation.mutate({
                                  routeId: routeDetail.route.id,
                                  date: e.target.value
                                });
                              }
                            }}
                            disabled={!isRouteEditable(routeDetail.route?.status)}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="text-gray-500">Status</div>
                        <Select
                          value={routeDetail.route?.status}
                          onValueChange={(newStatus) => {
                            if (routeDetail.route?.id) {
                              updateStatusMutation.mutate({ routeId: routeDetail.route.id, status: newStatus });
                            }
                          }}
                          disabled={!isRouteEditable(routeDetail.route?.status)}
                        >
                          <SelectTrigger className={`w-[140px] h-7 ${statusColors[routeDetail.route?.status] || statusColors.draft} border-0 font-medium`}>
                            <SelectValue>
                              {statusLabels[routeDetail.route?.status] || routeDetail.route?.status}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="draft">Rascunho</SelectItem>
                            <SelectItem value="confirmado">Confirmado</SelectItem>
                            <SelectItem value="finalizado">Finalizado</SelectItem>
                            <SelectItem value="cancelado">Cancelado</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <div className="text-gray-500">Veículo</div>
                        <div className="font-medium flex items-center gap-2">
                          <Car className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          {getRouteVehicleName(routeDetail.route)}
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
                        disabled={!isRouteEditable(routeDetail.route?.status)}
                        data-testid="btn-add-existing-appointments"
                      >
                        + Incluir agendamentos existentes
                      </Button>

                      <Button
                        onClick={() => routeDetail?.route?.id && optimizeRouteMutation.mutate(routeDetail.route.id)}
                        disabled={
                          !isRouteEditable(routeDetail.route?.status) ||
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
                    {!isRouteEditable(routeDetail.route?.status) && (
                      <div className="mt-2 text-sm text-amber-600">
                        ⚠️ Esta rota está {statusLabels[routeDetail.route?.status]?.toLowerCase()} e não pode ser editada.
                      </div>
                    )}
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

                      {/* === Drag & Drop só nas paradas (stopsUI) === */}
                      {isRouteEditable(routeDetail.route?.status) ? (
                        <DndContext
                          sensors={sensors}
                          collisionDetection={closestCenter}
                          onDragEnd={handleDragEnd}
                        >
                          <SortableContext
                            items={stopsUI.map((s) => s.id)}
                            strategy={verticalListSortingStrategy}
                          >
                            {stopsUI.map((stop) => (
                              <SortableStopItem key={stop.id} stop={stop}>
                                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                                  <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 bg-burnt-yellow text-white rounded-full flex items-center justify-center text-sm font-bold">
                                    {stop.order}
                                  </div>
                                  <div className="flex-1">
                                    <div className="font-medium text-sm">
                                      {displayStopName(stop, appointments, clients)}
                                    </div>
                                    <div className="text-xs sm:text-sm text-gray-600 mt-1">{stop.address}</div>
                                    {Number.isFinite(stop.lat) && Number.isFinite(stop.lng) && (stop.lat !== 0 || stop.lng !== 0) && (
                                      <div className="text-[11px] text-gray-500 mt-1">
                                        {Number(stop.lat).toFixed(6)}, {Number(stop.lng).toFixed(6)}
                                      </div>
                                    )}
                                  </div>
                                  {/* Botões olho e remover */}
                                  <div className="flex items-center gap-1">
                                    {stop.appointmentNumericId && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setAppointmentDetailsId(stop.appointmentNumericId || null);
                                        }}
                                        className="rounded-md p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50"
                                        title="Ver detalhes do atendimento"
                                        aria-label="Ver detalhes"
                                      >
                                        <Eye className="h-4 w-4" />
                                      </button>
                                    )}
                                    {isRouteEditable(routeDetail.route?.status) && (
                                      <button
                                        onClick={() => {
                                          setStopToRemove({
                                            id: stop.id,
                                            clientName: stop.clientName || undefined
                                          });
                                          setRemoveOpen(true);
                                        }}
                                        className="rounded-md p-1 text-gray-500 hover:text-red-600 hover:bg-red-50"
                                        title="Remover da rota"
                                        aria-label="Remover da rota"
                                      >
                                        <X className="h-4 w-4" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </SortableStopItem>
                            ))}
                          </SortableContext>
                        </DndContext>
                      ) : (
                        // Modo somente leitura - sem drag and drop
                        stopsUI.map((stop) => (
                          <div key={stop.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                            <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 bg-burnt-yellow text-white rounded-full flex items-center justify-center text-sm font-bold">
                              {stop.order}
                            </div>
                            <div className="flex-1">
                              <div className="font-medium text-sm">
                                {displayStopName(stop, appointments, clients)}
                              </div>
                              <div className="text-xs sm:text-sm text-gray-600 mt-1">{stop.address}</div>
                              {Number.isFinite(stop.lat) && Number.isFinite(stop.lng) && (stop.lat !== 0 || stop.lng !== 0) && (
                                <div className="text-[11px] text-gray-500 mt-1">
                                  {Number(stop.lat).toFixed(6)}, {Number(stop.lng).toFixed(6)}
                                </div>
                              )}
                            </div>
                            {/* Botão olho */}
                            {stop.appointmentNumericId && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAppointmentDetailsId(stop.appointmentNumericId || null);
                                }}
                                className="rounded-md p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50"
                                title="Ver detalhes do atendimento"
                                aria-label="Ver detalhes"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Coluna DIREITA – mapa ocupa toda a altura da coluna */}
                <div className="lg:col-span-6 min-h-0 flex h-full">
                  <div className="relative flex-1 h-full min-h-[300px] rounded-lg overflow-hidden border">
                    <div className="absolute inset-0">
                      {(() => {
                        // 1) Paradas (clientes) em ordem
                        const sourceStops = isLocalReordered && stopsUI?.length ? stopsUI : (routeDetail.stops || []);
                        const orderedStops = sourceStops
                          .slice()
                          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

                        console.log("🔄 [RoutesHistory] Estado do mapa:", {
                          isLocalReordered,
                          sourceStopsCount: sourceStops.length,
                          orderedStopsCount: orderedStops.length,
                          primeiraParada: orderedStops[0],
                          localStart,
                          apiStart: (routeDetail as any)?.start,
                        });

                        // 2) Waypoints (somente clientes) – filtra inválidos
                        const stopsAsWaypoints = orderedStops
                          .map((s) => ({ lat: Number(s.lat), lon: Number(s.lng) }))
                          .filter((w) => Number.isFinite(w.lat) && Number.isFinite(w.lon));

                        // 3) START: EMPRESA primeiro (getStartCoords já prioriza empresa)
                        const apiStart = (routeDetail as any)?.start;
                        const derivedStart =
                          localStart ??
                          (apiStart && Number.isFinite(Number(apiStart.lat)) && Number.isFinite(Number(apiStart.lng ?? apiStart.lon))
                            ? { lat: Number(apiStart.lat), lon: Number(apiStart.lng ?? apiStart.lon) }
                            : getStartCoords(routeDetail.route));

                        // 👉 Garantia extra: se ainda assim vier null, não deixamos o mapa "pegar" o 1º cliente como start.
                        //    Preferimos não desenhar o pino até termos a empresa (evita o bug visual).
                        const startForMap = derivedStart || null;

                        console.log("📍 [RoutesHistory] Ponto inicial calculado:", {
                          startForMap,
                          derivedStart,
                          usandoLocalStart: !!localStart,
                          usandoApiStart: !localStart && !!apiStart,
                          usandoGetStartCoords: !localStart && !apiStart,
                        });

                        // 4) GeoJSON vindo do back (quando existir)
                        let rawBackendGeoJson: any =
                          (routeDetail.route as any)?.polylineGeoJson ??
                          (routeDetail.route as any)?.routeGeoJson ??
                          (routeDetail.route as any)?.geojson ?? null;
                        if (typeof rawBackendGeoJson === "string") {
                          try { rawBackendGeoJson = JSON.parse(rawBackendGeoJson); } catch { }
                        }

                        // 5) Linha manual durante DnD – renomeado para evitar sombra de state
                        const manualLineGeo =
                          isLocalReordered && startForMap && stopsAsWaypoints.length > 0
                            ? ({
                              type: "LineString",
                              coordinates: [
                                [startForMap.lon, startForMap.lat],
                                ...stopsAsWaypoints.map((w) => [w.lon, w.lat]),
                              ],
                            } as const)
                            : null;

                        // 6) GeoJSON final
                        const routeGeoJson =
                          manualLineGeo ??
                          rawBackendGeoJson ??
                          // ✅ FALLBACK: Sempre inclui o ponto inicial antes das paradas
                          (startForMap && stopsAsWaypoints.length > 0
                            ? {
                              type: "LineString",
                              coordinates: [
                                [startForMap.lon, startForMap.lat],
                                ...stopsAsWaypoints.map((w) => [w.lon, w.lat])
                              ]
                            }
                            : null);

                        // 7) key inclui versão para re-render forçado (ver ajuste 3)
                        const keyForMap = `${routeDetail.route?.id}-${isLocalReordered ? "local" : "server"}-${mapVersion}`;

                        // LOG FINAL: Verificar o que está sendo enviado para o mapa
                        console.log("🎯 [RENDER MAP] Dados finais para o mapa:", {
                          keyForMap,
                          isLocalReordered,
                          startForMap,
                          waypointsCount: stopsAsWaypoints.length,
                          firstWaypoint: stopsAsWaypoints[0],
                          hasGeoJson: !!routeGeoJson,
                          geoJsonFirstCoord: routeGeoJson?.coordinates?.[0],
                        });

                        return (
                          <OptimizedRouteMap
                            key={keyForMap}
                            routeGeoJson={routeGeoJson}
                            waypoints={stopsAsWaypoints}
                            // � Mantenha o pino fixo da empresa:
                            startWaypoint={startForMap}
                            // (Compat opcional, caso seu OptimizedRouteMap novo espere 'origin')
                            {...({ origin: startForMap } as any)}
                          />
                        );
                      })()}

                      {/* Overlay de loading durante reordenação */}
                      {isReordering && (
                        <div className="absolute inset-0 z-50 flex items-center justify-center bg-burnt-yellow/20 backdrop-blur-sm">
                          <div className="bg-white/95 rounded-lg shadow-xl p-6 flex flex-col items-center space-y-3 border-2 border-burnt-yellow/30">
                            <Loader2 className="h-10 w-10 animate-spin text-burnt-yellow" />
                            <p className="text-gray-700 font-semibold">Reordenando rota...</p>
                            <p className="text-sm text-gray-500">Por favor, aguarde...</p>
                          </div>
                        </div>
                      )}

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
              <div className="flex flex-col sm:flex-row gap-3">
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

      {/* Modal de confirmação para remoção de paradas */}
      <Dialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Remover {stopToRemove?.clientName || "parada"} da rota?
            </DialogTitle>
            <DialogDescription>
              Isso remove o agendamento <strong>apenas da rota</strong>. O agendamento continua existindo na agenda.
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRemoveOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={removeStopMutation.isPending || !stopToRemove || !routeDetail?.route?.id}
              onClick={() => {
                if (stopToRemove && routeDetail?.route?.id) {
                  const stop = routeDetail.stops.find(s => s.id === stopToRemove.id);
                  removeStopMutation.mutate({
                    routeId: routeDetail.route.id,
                    stopId: stopToRemove.id,
                    appointmentId: Number(stop?.appointmentNumericId ?? stop?.appointmentId),
                    clientName: stopToRemove.clientName
                  });
                }
              }}
            >
              {removeStopMutation.isPending ? "Removendo..." : "Remover"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de auditoria de alterações da rota */}
      <RouteAuditModal
        routeId={auditRouteId}
        open={!!auditRouteId}
        onOpenChange={(open) => !open && setAuditRouteId(null)}
      />

      {/* Modal de resolução de pendências */}
      {selectedPendingAppt && (
        <ResolvePendingModal
          isOpen={resolvePendingOpen}
          onClose={() => {
            setResolvePendingOpen(false);
            setSelectedPendingAppt(null);
          }}
          appointment={selectedPendingAppt}
          pendingReason={
            // 💰 Se for pendência de pagamento, usar 'payment_pending'
            selectedPendingAppt?.pendingType === 'payment'
              ? 'payment_pending'
              : (selectedPendingAppt?.executionStatus || 'nao_realizado_outro')
          }
          onResolve={handleResolveSubmit}
        />
      )}

      {/* Modal de histórico de agendamento */}
      <AppointmentHistoryModal
        isOpen={appointmentHistoryOpen}
        onClose={() => {
          setAppointmentHistoryOpen(false);
          setSelectedHistoryApptId(null);
          setAppointmentHistory([]);
        }}
        appointmentId={selectedHistoryApptId || 0}
        history={appointmentHistory}
      />

      {/* Modal de detalhes do agendamento */}
      <AppointmentDetailsModal
        isOpen={!!appointmentDetailsId}
        onClose={() => setAppointmentDetailsId(null)}
        appointmentId={appointmentDetailsId}
      />

      {/* Modal de Rastreamento */}
      <Dialog open={!!trackingRouteId} onOpenChange={(open) => !open && setTrackingRouteId(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Rastreamento da Rota</DialogTitle>
            <DialogDescription>Trajeto percorrido e pontos registrados pelo GPS</DialogDescription>
          </DialogHeader>
          <div className="flex-1 rounded-lg overflow-hidden relative" style={{ minHeight: '500px' }}>
            {trackingRouteId && <RouteTrackingMap routeId={trackingRouteId} height="500px" />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}