import { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import AppointmentForm from "@/components/forms/AppointmentForm";
import AppointmentCalendar from "@/components/AppointmentCalendar";
import AvailabilityCalendar from "@/components/AvailabilityCalendar";
import { DeleteConfirmationDialog } from "@/components/DeleteConfirmationDialog";
import {
  Plus,
  Calendar,
  MapPin,
  Clock,
  User,
  Edit,
  Trash2,
  Download,
  Upload,
  Filter,
  Search,
  List,
  Route,
  X,
  Navigation,
  CheckCircle2,
  Repeat2,
  ChevronDown,
  Wrench,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  downloadCSV,
  downloadReport,
  downloadWithConfirmation,
} from "@/lib/download";
import { useSafeNavigation } from "@/hooks/useSafeNavigation";
import { useCalendarCleanup } from "@/hooks/useCalendarCleanup";
import type {
  Appointment,
  Client,
  Service,
  Technician,
  Team,
  DateRestriction,
} from "@shared/schema";
import OptimizedRouteMap from "@/components/maps/OptimizedRouteMap";

export default function Appointments() {
  const [selectedAppointment, setSelectedAppointment] =
    useState<Appointment | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [prefilledData, setPrefilledData] = useState<any>(null);

  // Estados para filtros
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedService, setSelectedService] = useState<string>("all");
  const [selectedTechnician, setSelectedTechnician] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [inRouteFilter, setInRouteFilter] = useState<string>("no"); // "all", "yes", "no"

  // Estado para controlar visualização (lista, calendário ou disponibilidade)
  const [viewMode, setViewMode] = useState<"list" | "calendar" | "availability">("list");

  // Estado para data de navegação na visualização de disponibilidade
  const [availabilityDate, setAvailabilityDate] = useState<Date>(new Date());

  // Estado para modal de restrição de data
  const [isRestrictionModalOpen, setIsRestrictionModalOpen] = useState(false);
  const [restrictionStartDate, setRestrictionStartDate] = useState<string>("");
  const [restrictionEndDate, setRestrictionEndDate] = useState<string>("");
  const [restrictionTitle, setRestrictionTitle] = useState<string>("");
  const [selectedRestrictionResponsibles, setSelectedRestrictionResponsibles] = useState<string[]>([]);
  const [restrictionError, setRestrictionError] = useState<string | null>(null);

  // Estado para paginação
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 20;

  // Estado para modal de confirmação de exclusão
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [appointmentToDelete, setAppointmentToDelete] = useState<Appointment | null>(null);

  // Estados para seleção de agendamentos e otimização de rotas
  const [selectedAppointmentIds, setSelectedAppointmentIds] = useState<
    number[]
  >([]);
  const [isRouteDrawerOpen, setIsRouteDrawerOpen] = useState(false);
  const [endAtStart, setEndAtStart] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isViewing, setIsViewing] = useState(false);
  const [optimizedRoute, setOptimizedRoute] = useState<{
    route?: any;
    stops?: any[];
    appointments?: Appointment[];
    totalDistance?: number;
    totalDuration?: number;
    start?: { lat: number; lon: number; address: string } | null;
  } | null>(null);
  const [isRouteOptimized, setIsRouteOptimized] = useState(false);
  const [polyline, setPolyline] = useState<any>(null);
  const [startWaypoint, setStartWaypoint] = useState<{ lat: number; lon: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedInfo, setSavedInfo] = useState<null | {
    id: string;
    displayNumber: number;
  }>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleRestrictionModalClose = () => {
    setIsRestrictionModalOpen(false);
    setRestrictionStartDate("");
    setRestrictionEndDate("");
    setRestrictionTitle("");
    setSelectedRestrictionResponsibles([]);
    setRestrictionError(null);
  };

  const handleRestrictionModalOpenChange = (open: boolean) => {
    if (!open) {
      setRestrictionStartDate("");
      setRestrictionEndDate("");
      setRestrictionTitle("");
      setSelectedRestrictionResponsibles([]);
      setRestrictionError(null);
    }
    setIsRestrictionModalOpen(open);
  };

  //Mapa
  const [routeWaypoints, setRouteWaypoints] = useState<{ lat: number; lon: number }[] | null>(null);

  // Hook de navegação segura com limpeza robusta
  const { isSafeToOperate, registerCleanup } = useSafeNavigation({
    componentName: "APPOINTMENTS",
    modals: [
      {
        isOpen: isFormOpen,
        setIsOpen: setIsFormOpen,
        resetState: () => {
          setSelectedAppointment(null);
          setPrefilledData(null);
        },
      },
      {
        isOpen: isRouteDrawerOpen,
        setIsOpen: setIsRouteDrawerOpen,
        resetState: () => {
          setOptimizedRoute(null);
          setPolyline(null);
          setError(null);
          setSelectedAppointmentIds([]);
          setSavedInfo(null);
          setIsOptimizing(false);
        },
      },
    ],
    calendars: [
      {
        isVisible: viewMode === "calendar" || viewMode === "availability",
      },
    ],
  });

  // Hook específico para limpeza do calendário
  const calendarContainerRef = useCalendarCleanup(viewMode === "calendar");

  // Limpar todos os estados quando o drawer fechar
  useEffect(() => {
    if (!isRouteDrawerOpen) {
      setSavedInfo(null);
      setOptimizedRoute(null);
      setPolyline(null);
      setError(null);
      setIsOptimizing(false);
    }
  }, [isRouteDrawerOpen]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("prefill");
    if (!raw) return;

    try {
      const decoded = JSON.parse(atob(decodeURIComponent(raw)));
      console.log("🧩 [APPOINTMENTS] Prefill recebido:", decoded);

      setPrefilledData(decoded);
      setIsFormOpen(true);

      // limpa a query para não reabrir ao recarregar
      window.history.replaceState({}, "", window.location.pathname);
    } catch (e) {
      console.error("❌ [APPOINTMENTS] Erro ao ler prefill:", e);
    }
  }, []);


  // Limpar estados ao alterar a seleção, MAS só se o drawer NÃO estiver aberto
  useEffect(() => {
    if (!isRouteDrawerOpen) {
      setSavedInfo(null);
      setOptimizedRoute(null);
      setPolyline(null);
      setError(null);
    }
  }, [JSON.stringify(selectedAppointmentIds), isRouteDrawerOpen]);

  // Logs para monitorar uso dos filtros
  useEffect(() => {
    console.log("🔍 [FILTER] Filtros aplicados:", {
      selectedDate,
      searchTerm,
      selectedService,
      selectedTechnician,
      selectedStatus,
      inRouteFilter,
    });
  }, [
    selectedDate,
    searchTerm,
    selectedService,
    selectedTechnician,
    selectedStatus,
    inRouteFilter,
  ]);

  // Verificar parâmetros da URL ao carregar a página
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const preselected = urlParams.get("preselected");

    console.log("📋 [DEBUG] Appointments - Verificando parâmetros URL:", {
      preselected,
      date: urlParams.get("date"),
      cep: urlParams.get("cep"),
      numero: urlParams.get("numero"),
      serviceId: urlParams.get("serviceId"),
      technicianId: urlParams.get("technicianId"),
      teamId: urlParams.get("teamId"),
      clientId: urlParams.get("clientId"),
    });

    if (preselected === "true") {
      const data = {
        date: urlParams.get("date"),
        cep: urlParams.get("cep"),
        numero: urlParams.get("numero"),
        serviceId: urlParams.get("serviceId"),
        technicianId: urlParams.get("technicianId"),
        teamId: urlParams.get("teamId"),
        clientId: urlParams.get("clientId"),
      };

      console.log("📋 [DEBUG] Appointments - Dados processados:", data);

      // Verificar se todos os campos obrigatórios estão presentes
      const hasRequiredFields =
        data.date &&
        data.cep &&
        data.numero &&
        data.serviceId &&
        (data.technicianId || data.teamId);

      console.log(
        "📋 [DEBUG] Appointments - Campos obrigatórios presentes:",
        hasRequiredFields,
      );

      if (hasRequiredFields) {
        setPrefilledData(data);
        setIsFormOpen(true);

        // Limpar parâmetros da URL
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname,
        );
      }
    }
  }, []);

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["/api/appointments"],
    queryFn: async () => {
      const response = await fetch("/api/appointments", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch appointments");
      const data = await response.json();

      // Log para debug de romaneios
      const withRouteInfo = data.filter((apt: any) => apt.routeInfo);
      if (withRouteInfo.length > 0) {
        console.log(`🚚 [APPOINTMENTS] ${withRouteInfo.length} agendamentos com romaneio:`,
          withRouteInfo.map((apt: any) => `#${apt.id} -> Romaneio ${apt.routeInfo.status} #${apt.routeInfo.displayNumber}`)
        );
      }

      return data;
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["/api/clients"],
    queryFn: async () => {
      const response = await fetch("/api/clients", {
        headers: getAuthHeaders(),
      });
      return response.json();
    },
  });

  // Restrições de data para o mês atual na aba de disponibilidade
  const monthStart = useMemo(() => {
    const d = new Date(availabilityDate);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [availabilityDate]);

  const monthEnd = useMemo(() => {
    const d = new Date(availabilityDate);
    d.setMonth(d.getMonth() + 1, 0);
    d.setHours(23, 59, 59, 999);
    return d;
  }, [availabilityDate]);

  const { data: dateRestrictions = [] } = useQuery<DateRestriction[]>({
    queryKey: [
      "/api/date-restrictions",
      monthStart.toISOString(),
      monthEnd.toISOString(),
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        start: monthStart.toISOString(),
        end: monthEnd.toISOString(),
      });
      const response = await fetch(`/api/date-restrictions?${params.toString()}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch date restrictions");
      return response.json();
    },
    enabled: viewMode === "availability" || viewMode === "calendar",
  });

  const { data: services = [] } = useQuery({
    queryKey: ["/api/services"],
    queryFn: async () => {
      const response = await fetch("/api/services", {
        headers: getAuthHeaders(),
      });
      return response.json();
    },
  });

  const { data: technicians = [] } = useQuery({
    queryKey: ["/api/technicians"],
    queryFn: async () => {
      const response = await fetch("/api/technicians", {
        headers: getAuthHeaders(),
      });
      return response.json();
    },
  });

  const { data: teams = [] } = useQuery({
    queryKey: ["/api/teams"],
    queryFn: async () => {
      const response = await fetch("/api/teams", {
        headers: getAuthHeaders(),
      });
      return response.json();
    },
  });

  const { data: businessRules } = useQuery({
    queryKey: ["/api/business-rules"],
    queryFn: async () => {
      const response = await fetch("/api/business-rules", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) return null;
      return response.json();
    },
  });

  const { data: teamMembers = [] } = useQuery({
    queryKey: ["/api/team-members"],
    queryFn: async () => {
      const response = await fetch("/api/team-members", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) return [];
      return response.json();
    },
  });

  // Mutations para restrições de data
  const createDateRestrictionMutation = useMutation({
    mutationFn: async () => {
      setRestrictionError(null);
      // Validações em ordem de prioridade para mensagens mais claras
      if (!restrictionTitle.trim()) {
        throw new Error("Informe o motivo da restrição.");
      }
      if (!restrictionStartDate) {
        throw new Error("Selecione a data inicial.");
      }
      if (selectedRestrictionResponsibles.length === 0) {
        throw new Error("Selecione pelo menos um técnico ou equipe.");
      }

      const start = new Date(restrictionStartDate);
      const end = restrictionEndDate ? new Date(restrictionEndDate) : new Date(restrictionStartDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new Error("Datas inválidas.");
      }

      const startDate = start < end ? start : end;
      const endDate = end > start ? end : start;

      // Aviso se houver agendamentos existentes nos dias/responsáveis selecionados
      const conflictMessages: string[] = [];

      for (const resp of selectedRestrictionResponsibles) {
        const [type, idStr] = resp.split("-");
        const responsibleType = type === "team" ? "team" : "technician";
        const responsibleId = parseInt(idStr, 10);
        if (!responsibleId) continue;

        const responsibleName = responsibleType === "team"
          ? teams.find((t: Team) => t.id === responsibleId)?.name || `Equipe #${responsibleId}`
          : technicians.find((t: Technician) => t.id === responsibleId)?.name || `Técnico #${responsibleId}`;

        const current = new Date(startDate);
        current.setHours(0, 0, 0, 0);

        while (current <= endDate) {
          const dayYear = current.getFullYear();
          const dayMonth = current.getMonth();
          const dayDate = current.getDate();

          const hasAppointment = appointments.some((apt: Appointment) => {
            if (responsibleType === "team" ? apt.teamId !== responsibleId : apt.technicianId !== responsibleId) {
              return false;
            }
            const aptDate = new Date(apt.scheduledDate);
            return (
              aptDate.getFullYear() === dayYear &&
              aptDate.getMonth() === dayMonth &&
              aptDate.getDate() === dayDate
            );
          });

          if (hasAppointment) {
            const displayDate = current.toLocaleDateString("pt-BR");
            conflictMessages.push(`${displayDate} - ${responsibleName}`);
          }

          current.setDate(current.getDate() + 1);
          current.setHours(0, 0, 0, 0);
        }
      }

      if (conflictMessages.length > 0) {
        const details = conflictMessages.join("; ");
        throw new Error(
          `Existem agendamentos nas seguintes datas/responsáveis: ${details}. ` +
          "Remova esses agendamentos antes de criar a restrição de data.",
        );
      }

      // Criar efetivamente as restrições
      for (const resp of selectedRestrictionResponsibles) {
        const [type, idStr] = resp.split("-");
        const responsibleType = type === "team" ? "team" : "technician";
        const responsibleId = parseInt(idStr, 10);
        if (!responsibleId) continue;

        const current = new Date(startDate);
        current.setHours(0, 0, 0, 0);

        while (current <= endDate) {
          await apiRequest("POST", "/api/date-restrictions", {
            date: current.toISOString(),
            responsibleType,
            responsibleId,
            title: restrictionTitle.trim(),
          });

          current.setDate(current.getDate() + 1);
          current.setHours(0, 0, 0, 0);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/date-restrictions"] });
      handleRestrictionModalClose();
      setRestrictionError(null);
      toast({
        title: "Restrição criada",
        description: "As restrições de data foram aplicadas com sucesso.",
      });
    },
    onError: (error: any) => {
      setRestrictionError(error.message || "Erro ao criar restrição de data.");
    },
  });

  const deleteDateRestrictionMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/date-restrictions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/date-restrictions"] });
      toast({
        title: "Restrição removida",
        description: "Restrição de data removida com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao remover restrição de data.",
        variant: "destructive",
      });
    },
  });

  const deleteAppointmentMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/appointments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      toast({
        title: "Sucesso",
        description: "Agendamento excluído com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao excluir agendamento",
        variant: "destructive",
      });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const response = await fetch(`/api/appointments/${id}`, {
        method: "PATCH",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error("Erro ao atualizar status");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      toast({
        title: "Sucesso",
        description: "Status atualizado com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar status",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setIsFormOpen(true);
  };

  const handleDelete = async (appointment: Appointment) => {
    setAppointmentToDelete(appointment);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (appointmentToDelete) {
      deleteAppointmentMutation.mutate(appointmentToDelete.id);
      setAppointmentToDelete(null);
    }
  };

  const handleFormClose = () => {
    // Usa o hook seguro para verificar se é seguro operar
    if (!isSafeToOperate()) {
      console.log(
        "⚠️ [APPOINTMENTS] Componente desmontado, operação cancelada",
      );
      return;
    }

    console.log("🧹 [DEBUG] handleFormClose - Limpando formulário");
    console.log(
      "🧹 [DEBUG] handleFormClose - selectedAppointment antes:",
      selectedAppointment,
    );
    console.log(
      "🧹 [DEBUG] handleFormClose - prefilledData antes:",
      prefilledData,
    );

    setIsFormOpen(false);
    setSelectedAppointment(null);
    setPrefilledData(null);

    console.log(
      "🧹 [DEBUG] handleFormClose - Estado limpo - formulário deve abrir vazio na próxima vez",
    );
  };

  // Handlers para seleção de agendamentos
  const handleAppointmentSelection = (
    appointmentId: number,
    isSelected: boolean,
  ) => {
    if (isSelected) {
      setSelectedAppointmentIds((prev) => [...prev, appointmentId]);
    } else {
      setSelectedAppointmentIds((prev) =>
        prev.filter((id) => id !== appointmentId),
      );
    }
  };

  const handleSelectAll = (isSelected: boolean) => {
    if (isSelected) {
      // Selecionar apenas agendamentos que não estão em romaneio confirmado/finalizado
      const selectableAppointments = filteredAppointments.filter(
        (apt: Appointment) => !((apt as any).routeInfo)
      );
      setSelectedAppointmentIds(selectableAppointments.map((apt: Appointment) => apt.id));
    } else {
      setSelectedAppointmentIds([]);
    }
  };

  // Nova função para visualizar rota SEM otimizar (na ordem dos agendamentos selecionados)
  const handleViewRoute = async () => {
    if (selectedAppointmentIds.length < 2) {
      toast({
        title: "Selecione ao menos 2 agendamentos.",
        variant: "destructive",
      });
      return;
    }

    // ✅ Responsável único (mesmo técnico OU mesma equipe)
    const selected = filteredAppointments.filter((apt: Appointment) =>
      selectedAppointmentIds.includes(apt.id),
    );
    const keys = selected
      .map((apt: Appointment) =>
        apt.technicianId
          ? `technician-${apt.technicianId}`
          : apt.teamId
            ? `team-${apt.teamId}`
            : null,
      )
      .filter(Boolean);
    const uniqueKeys = Array.from(new Set(keys));
    if (uniqueKeys.length !== 1) {
      toast({
        title: "Seleção inválida",
        description:
          "Não é possível visualizar rota com técnicos/equipes diferentes. Selecione do mesmo responsável.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Abrir drawer com loading
      setIsViewing(true);
      setIsRouteDrawerOpen(true);

      // Limpar estados
      setSavedInfo(null);
      setError(null);
      setIsOptimizing(false);
      setOptimizedRoute(null);
      setPolyline(null);
      setStartWaypoint(null);
      setIsRouteOptimized(false);

      console.log("🗺️ [ROUTE] Visualizando rota na ordem dos agendamentos selecionados");

      // Ordenar agendamentos pela ordem em que foram selecionados
      const orderedAppointments = selectedAppointmentIds
        .map(id => filteredAppointments.find((apt: Appointment) => apt.id === id))
        .filter(Boolean) as Appointment[];

      // Chamar API do backend para obter rota SEM otimização (mas com polyline calculada)
      console.log("🗺️ [ROUTE] Chamando API do backend para gerar rota sem otimização...");

      const res = await fetch("/api/routes/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentIds: selectedAppointmentIds,
          endAtStart,
          title: `Rota ${new Date().toLocaleDateString()}`,
          preview: true,
          skipOptimization: true, // NÃO otimizar, manter ordem
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Falha ao visualizar rota");
      }

      const data = await res.json();
      console.log("✅ [ROUTE] Rota recebida do backend:", data);

      // Marcar se a rota foi otimizada ou não
      setIsRouteOptimized(data.route?.isOptimized ?? false);

      // Extrair polyline do backend (igual na otimização)
      const backendGeo =
        data?.route?.polylineGeoJson ??
        data?.route?.routeGeoJson ??
        data?.route?.geojson ??
        data?.polylineGeoJson ??
        data?.routeGeoJson ??
        data?.geojson ??
        null;

      console.log("🗺️ [ROUTE] Polyline do backend:", {
        hasPolyline: !!backendGeo,
        type: backendGeo?.type,
      });

      // Extrair ponto inicial e paradas (igual na otimização)
      const asNum = (v: any) => (v === undefined || v === null ? undefined : Number(v));

      let startWp: { lat: number; lon: number } | null = null;
      const sLat =
        asNum(data?.start?.lat) ??
        asNum(data?.start?.latitude) ??
        asNum(data?.route?.startLat) ??
        (Array.isArray(data?.route?.start) ? asNum(data.route.start[1]) : undefined);
      const sLon =
        asNum(data?.start?.lon) ??
        asNum(data?.start?.lng) ??
        asNum(data?.start?.longitude) ??
        asNum(data?.route?.startLng) ??
        (Array.isArray(data?.route?.start) ? asNum(data.route.start[0]) : undefined);
      if (Number.isFinite(sLat) && Number.isFinite(sLon)) startWp = { lat: sLat!, lon: sLon! };

      let stopWps: { lat: number; lon: number }[] = [];
      if (Array.isArray(data?.stops) && data.stops.length) {
        stopWps = data.stops
          .map((s: any) => ({
            lat: asNum(s.lat ?? s.latitude ?? s.coords?.lat),
            lon: asNum(s.lon ?? s.lng ?? s.longitude ?? s.coords?.lng),
          }))
          .filter((p: any) => Number.isFinite(p.lat) && Number.isFinite(p.lon)) as any;
      }

      const allWps = startWp ? [startWp, ...stopWps] : stopWps;

      setOptimizedRoute(data);
      setRouteWaypoints(allWps.length >= 2 ? allWps : null);
      setPolyline(backendGeo);
      setStartWaypoint(startWp);
      setIsRouteOptimized(data.route?.isOptimized ?? true); // Por padrão, otimização é true

      toast({
        title: "Rota visualizada",
        description: `${data.stops?.length || 0} paradas na ordem selecionada`,
      });
    } catch (err: any) {
      console.error("❌ [ROUTE] Erro ao visualizar rota:", err);
      setError(err.message || "Erro ao visualizar rota");
      toast({
        title: "Erro ao visualizar rota",
        description: err.message || "Erro interno do servidor",
        variant: "destructive",
      });
    } finally {
      setIsViewing(false);
    }
  };

  const handleOptimizeRoute = async () => {
    if (selectedAppointmentIds.length < 2) {
      toast({
        title: "Selecione ao menos 2 agendamentos.",
        variant: "destructive",
      });
      return;
    }

    // ✅ Responsável único (mesmo técnico OU mesma equipe)
    const selected = filteredAppointments.filter((apt: Appointment) =>
      selectedAppointmentIds.includes(apt.id),
    );
    const keys = selected
      .map((apt: Appointment) =>
        apt.technicianId
          ? `technician-${apt.technicianId}`
          : apt.teamId
            ? `team-${apt.teamId}`
            : null,
      )
      .filter(Boolean);
    const uniqueKeys = Array.from(new Set(keys));
    if (uniqueKeys.length !== 1) {
      toast({
        title: "Seleção inválida",
        description:
          "Não é possível otimizar rota com técnicos/equipes diferentes. Selecione do mesmo responsável.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Limpar estados ao iniciar nova otimização
      setSavedInfo(null);
      setOptimizedRoute(null);
      setPolyline(null);
      setError(null);
      setIsOptimizing(true);
      // NÃO fechar o drawer se já estiver aberto
      if (!isRouteDrawerOpen) {
        setIsRouteDrawerOpen(true);
      }

      console.log("🗺️ [ROUTE] Otimizando rotas com configuração:", {
        appointmentIds: selectedAppointmentIds,
        endAtStart: endAtStart,
      });

      // 1) Pré-geocodificar (não-bloqueante): apenas chama a API e ignora avisos
      try {
        const geoRes = await fetch("/api/appointments/geocode-missing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ appointmentIds: selectedAppointmentIds }),
        });

        // não precisa tratar erros/pending → segue direto
        await geoRes.json().catch(() => ({}));
      } catch {
        // ignora
      }

      // função auxiliar para tentar otimizar com até 2 tentativas
      const tryOptimize = async (attempt: number) => {
        console.log(`🗺️ [ROUTE] Tentativa ${attempt} de otimização...`);

        const res = await fetch("/api/routes/optimize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            appointmentIds: selectedAppointmentIds, // números
            endAtStart,
            title: `Rota ${new Date().toLocaleDateString()}`,
            preview: true,
          }),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          console.error(`❌ [ROUTE] Falha tentativa ${attempt}:`, errorData);
          if (attempt < 2) {
            console.log("🔄 Retentando otimização...");
            return tryOptimize(attempt + 1); // tenta de novo
          }
          throw new Error(errorData.error || "Falha ao otimizar rota");
        }

        const data = await res.json();
        console.log("✅ [ROUTE] Rota otimizada recebida:", data);
        return data;
      };

      // aqui dentro do seu try principal
      const data = await tryOptimize(1);

      // 1) Polyline do backend (checa vários nomes) — senão, criamos fallback depois
      const backendGeo =
        data?.route?.polylineGeoJson ??
        data?.route?.routeGeoJson ??
        data?.route?.geojson ??
        data?.polylineGeoJson ??
        data?.routeGeoJson ??
        data?.geojson ??
        null;

      // 2) Monta waypoints: início + paradas, com múltiplos fallbacks
      const asNum = (v: any) => (v === undefined || v === null ? undefined : Number(v));

      // Início (start) via payload
      let startWp: { lat: number; lon: number } | null = null;
      const sLat =
        asNum(data?.start?.lat) ??
        asNum(data?.start?.latitude) ??
        asNum(data?.route?.startLat) ??
        (Array.isArray(data?.route?.start) ? asNum(data.route.start[1]) : undefined);
      const sLon =
        asNum(data?.start?.lon) ??
        asNum(data?.start?.lng) ??
        asNum(data?.start?.longitude) ??
        asNum(data?.route?.startLng) ??
        (Array.isArray(data?.route?.start) ? asNum(data.route.start[0]) : undefined);
      if (Number.isFinite(sLat) && Number.isFinite(sLon)) startWp = { lat: sLat!, lon: sLon! };

      // Paradas (stops) do payload (ou último recurso: clientes dos agendamentos selecionados)
      let stopWps: { lat: number; lon: number }[] = [];
      if (Array.isArray(data?.stops) && data.stops.length) {
        stopWps = data.stops
          .map((s: any) => ({
            lat: asNum(s.lat ?? s.latitude ?? s.coords?.lat),
            lon: asNum(s.lon ?? s.lng ?? s.longitude ?? s.coords?.lng),
          }))
          .filter((p: any) => Number.isFinite(p.lat) && Number.isFinite(p.lon)) as any;
      } else {
        const selected = filteredAppointments.filter((apt: Appointment) =>
          selectedAppointmentIds.includes(apt.id),
        );
        stopWps = selected
          .map((apt: Appointment) => {
            const client = getClient(apt.clientId) as any;
            const lat = asNum((apt as any).lat ?? (apt as any).latitude ?? client?.lat);
            const lon =
              asNum((apt as any).lng ?? (apt as any).lon ?? (apt as any).longitude ?? client?.lng);
            return Number.isFinite(lat) && Number.isFinite(lon) ? { lat: lat!, lon: lon! } : null;
          })
          .filter(Boolean) as any;
      }

      // Se não temos início mas temos polyline do backend → usa o 1º vértice do polyline como início real
      if (!startWp && backendGeo) {
        try {
          const geom =
            backendGeo?.type === "LineString"
              ? backendGeo
              : backendGeo?.type === "Feature"
                ? backendGeo.geometry
                : backendGeo?.geometry?.type === "LineString"
                  ? backendGeo.geometry
                  : null;
          const first = geom?.coordinates?.[0];
          if (Array.isArray(first) && first.length >= 2) {
            const [lon, lat] = first;
            if (Number.isFinite(lat) && Number.isFinite(lon)) {
              startWp = { lat: Number(lat), lon: Number(lon) };
            }
          }
        } catch { }
      }

      // Waypoints finais (índice 0 é sempre o início quando existir)
      const allWps = startWp ? [startWp, ...stopWps] : stopWps;

      // 3) Atualiza estados de forma resiliente
      setOptimizedRoute(data);
      setRouteWaypoints(allWps.length >= 2 ? allWps : null);
      setPolyline(
        backendGeo ??
        (allWps.length >= 2
          ? { type: "LineString", coordinates: allWps.map((w) => [w.lon, w.lat]) }
          : null),
      );
      setStartWaypoint(startWp);
      setIsRouteOptimized(true); // Marca como otimizado após otimização

      toast({
        title: "Rota otimizada com sucesso!",
        description: `${data.stops?.length || 0} paradas organizadas`,
      });
    } catch (err: any) {
      console.error("❌ [ROUTE] Erro ao otimizar:", err);
      setError(err.message || "Erro interno do servidor");
      toast({
        title: "Erro ao otimizar rota",
        description: err.message || "Erro interno do servidor",
        variant: "destructive",
      });
      setIsRouteDrawerOpen(false);
    } finally {
      setIsOptimizing(false);
    }
  };

  // Abre o Google Maps com origem, paradas e destino, na ordem otimizada.
  // Se roundTrip = true, volta ao ponto inicial (encerra onde começou).
  const openInGoogleMaps = (waypoints: { lat: number; lon: number }[] | null, roundTrip: boolean) => {
    if (!waypoints || waypoints.length < 2) {
      toast({
        title: "Rota insuficiente",
        description: "É preciso ter ao menos início e um destino.",
        variant: "destructive",
      });
      return;
    }

    const pts = roundTrip ? [...waypoints, waypoints[0]] : [...waypoints];

    const origin = `${pts[0].lat},${pts[0].lon}`;
    const destination = `${pts[pts.length - 1].lat},${pts[pts.length - 1].lon}`;
    const mids = pts.slice(1, -1).map(p => `${p.lat},${p.lon}`).join("|");

    const url =
      `https://www.google.com/maps/dir/?api=1` +
      `&origin=${encodeURIComponent(origin)}` +
      `&destination=${encodeURIComponent(destination)}` +
      (mids ? `&waypoints=${encodeURIComponent(mids)}` : "") +
      `&travelmode=driving&dir_action=navigate`;

    window.open(url, "_blank");
  };


  const handleSaveRoute = async () => {
    if (!optimizedRoute?.route || optimizedRoute.route.id) {
      toast({
        title: "Erro",
        description: "Rota já foi salva ou dados inválidos",
        variant: "destructive",
      });
      return;
    }

    try {
      // Se a rota NÃO foi otimizada, salva na ordem atual
      // Se foi otimizada, chama a API de otimização para salvar

      console.log("💾 [ROUTE] Salvando rota:", { isOptimized: isRouteOptimized, appointmentIds: selectedAppointmentIds });

      const res = await fetch("/api/routes/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentIds: selectedAppointmentIds,
          endAtStart,
          title: optimizedRoute.route.title,
          preview: false,
          // Se não foi otimizado, mantém a ordem original (não otimiza)
          skipOptimization: !isRouteOptimized,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Falha ao salvar rota");
      }

      const data = await res.json();
      setOptimizedRoute(data);
      setSavedInfo({
        id: data.route.id,
        displayNumber: data.route.displayNumber,
      });
      // ❌ NÃO limpe a seleção aqui
      // setSelectedAppointmentIds([]);  // REMOVIDO

      toast({
        title: `Rota salva com sucesso — ID #${data.route.displayNumber}`,
        description: "A rota foi salva no histórico",
      });
    } catch (err: any) {
      console.error("❌ [ROUTE] Erro ao salvar:", err);
      toast({
        title: "Erro ao salvar rota",
        description: err.message || "Erro interno do servidor",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "in_progress":
        return "bg-yellow-100 text-yellow-800";
      case "scheduled":
        return "bg-blue-100 text-blue-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      case "rescheduled":
        return "bg-purple-100 text-purple-800";
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
      case "cancelled":
        return "Cancelado";
      case "rescheduled":
        return "Remarcado";
      default:
        return status;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "bg-red-100 text-red-800";
      case "high":
        return "bg-orange-100 text-orange-800";
      case "normal":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getPriorityText = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "Urgente";
      case "high":
        return "Alta";
      case "normal":
        return "Normal";
      default:
        return priority;
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString("pt-BR"),
      time: date.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
  };

  const getClient = (clientId: number | null) =>
    clientId ? clients.find((c: Client) => c.id === clientId) : null;
  const getService = (serviceId: number) =>
    services.find((s: Service) => s.id === serviceId);
  const getTechnician = (technicianId: number | null) =>
    technicianId
      ? technicians.find((t: Technician) => t.id === technicianId)
      : null;
  const getTeam = (teamId: number | null) =>
    teamId ? teams.find((t: Team) => t.id === teamId) : null;

  // Função para obter informações do responsável (técnico ou equipe) com logs detalhados
  const getResponsibleInfo = (appointment: Appointment) => {
    if (appointment.technicianId) {
      const technician = getTechnician(appointment.technicianId);
      return {
        type: "technician" as const,
        name: technician?.name || "Técnico não encontrado",
        id: appointment.technicianId,
        displayName: `👤 ${technician?.name || "Técnico não encontrado"}`,
      };
    } else if (appointment.teamId) {
      const team = getTeam(appointment.teamId);
      return {
        type: "team" as const,
        name: team?.name || "Equipe não encontrada",
        id: appointment.teamId,
        displayName: `👥 ${team?.name || "Equipe não encontrada"}`,
      };
    }
    console.log(
      `❌ [DEBUG] Agendamento ${appointment.id} - Nenhum responsável atribuído`,
    );
    return {
      type: "none" as const,
      name: "Responsável não atribuído",
      id: null,
      displayName: "❌ Responsável não atribuído",
    };
  };

  // Lógica de filtragem dos agendamentos
  const filteredAppointments = useMemo(() => {
    if (!appointments || appointments.length === 0) return [];

    console.log("🔍 [FILTER] Aplicando filtros nos agendamentos...");
    console.log("🔍 [FILTER] Total de agendamentos:", appointments.length);

    const filtered = appointments.filter((apt: Appointment) => {
      // Filter by date
      if (selectedDate) {
        const aptDate = new Date(apt.scheduledDate).toLocaleDateString("en-CA"); // YYYY-MM-DD format
        console.log(
          `🔍 [FILTER] Comparando datas - selectedDate: ${selectedDate}, aptDate: ${aptDate}`,
        );
        if (aptDate !== selectedDate) {
          console.log(`🔍 [FILTER] Agendamento ${apt.id} filtrado por data`);
          return false;
        }
      }

      // Filter by client name (search term)
      if (searchTerm) {
        const client = getClient(apt.clientId);
        const clientName = client?.name?.toLowerCase() || "";
        const searchLower = searchTerm.toLowerCase();
        console.log(
          `🔍 [FILTER] Pesquisando "${searchTerm}" em "${clientName}"`,
        );
        if (!clientName.includes(searchLower)) {
          console.log(
            `🔍 [FILTER] Agendamento ${apt.id} filtrado por busca de cliente`,
          );
          return false;
        }
      }

      // Filter by service
      if (selectedService && selectedService !== "all") {
        console.log(
          `🔍 [FILTER] Filtro de serviço aplicado - selectedService: ${selectedService}, apt.serviceId: ${apt.serviceId}`,
        );
        if (apt.serviceId.toString() !== selectedService) {
          console.log(`🔍 [FILTER] Agendamento ${apt.id} filtrado por serviço`);
          return false;
        }
      }

      // Filter by technician/team
      if (selectedTechnician && selectedTechnician !== "all") {
        console.log(
          `🔍 [FILTER] Filtro de técnico/equipe aplicado - selectedTechnician: ${selectedTechnician}`,
        );

        // Verificar se é um técnico individual
        const technician = getTechnician(apt.technicianId);
        const isMatchingTechnician =
          technician?.id.toString() === selectedTechnician;

        // Verificar se é uma equipe (o valor vem como "team-{id}")
        const team = teams.find((t: any) => t.id === apt.teamId);
        const isMatchingTeam = team && selectedTechnician === `team-${team.id}`;

        console.log(
          `🔍 [FILTER] isMatchingTechnician: ${isMatchingTechnician}, isMatchingTeam: ${isMatchingTeam}, team:`,
          team?.name,
        );

        if (!isMatchingTechnician && !isMatchingTeam) {
          console.log(
            `🔍 [FILTER] Agendamento ${apt.id} filtrado por técnico/equipe`,
          );
          return false;
        }
      }

      // Filter by status
      if (selectedStatus && selectedStatus !== "all") {
        console.log(
          `🔍 [FILTER] Filtro de status aplicado - selectedStatus: ${selectedStatus}, apt.status: ${apt.status}`,
        );
        if (apt.status !== selectedStatus) {
          console.log(`🔍 [FILTER] Agendamento ${apt.id} filtrado por status`);
          return false;
        }
      }

      // Filter by route (em romaneio)
      if (inRouteFilter !== "all") {
        const hasRoute = !!(apt as any).routeInfo;
        if (inRouteFilter === "yes" && !hasRoute) {
          return false;
        }
        if (inRouteFilter === "no" && hasRoute) {
          return false;
        }
      }

      return true;
    });

    console.log(
      `🔍 [FILTER] Resultado da filtragem: ${filtered.length} de ${appointments.length} agendamentos`,
    );
    return filtered;
  }, [
    appointments,
    selectedDate,
    searchTerm,
    selectedService,
    selectedTechnician,
    selectedStatus,
    inRouteFilter,
    clients,
    services,
    technicians,
    teams,
  ]);

  // Agrupar agendamentos por data e ordenar cronologicamente
  const groupedAppointments = useMemo(() => {
    // Primeiro, ordenar por data (mais antigo para mais recente)
    const sorted = [...filteredAppointments].sort((a, b) => {
      return new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime();
    });

    // Agrupar por data
    const grouped: { [key: string]: Appointment[] } = {};
    sorted.forEach((apt) => {
      const dateKey = new Date(apt.scheduledDate).toLocaleDateString("pt-BR");
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(apt);
    });

    // Converter para array de objetos {date, appointments} e ordenar as datas
    return Object.entries(grouped)
      .map(([date, appointments]) => ({
        date,
        dateObj: new Date(appointments[0].scheduledDate),
        appointments,
      }))
      .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
  }, [filteredAppointments]);

  // Paginação
  const totalPages = Math.ceil(filteredAppointments.length / itemsPerPage);
  const paginatedAppointments = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredAppointments.slice(startIndex, endIndex);
  }, [filteredAppointments, currentPage, itemsPerPage]);

  // Reagrupar agendamentos paginados por data
  const paginatedGroupedAppointments = useMemo(() => {
    const sorted = [...paginatedAppointments].sort((a, b) => {
      return new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime();
    });

    const grouped: { [key: string]: Appointment[] } = {};
    sorted.forEach((apt) => {
      const dateKey = new Date(apt.scheduledDate).toLocaleDateString("pt-BR");
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(apt);
    });

    return Object.entries(grouped)
      .map(([date, appointments]) => ({
        date,
        dateObj: new Date(appointments[0].scheduledDate),
        appointments,
      }))
      .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
  }, [paginatedAppointments]);

  // Resetar para página 1 quando os filtros mudarem
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedDate, searchTerm, selectedService, selectedTechnician, selectedStatus, inRouteFilter]);

  // Computed values for route optimization
  const selectedAppointments = filteredAppointments.filter((apt: Appointment) =>
    selectedAppointmentIds.includes(apt.id),
  );
  const isAllSelected =
    filteredAppointments.length > 0 &&
    selectedAppointmentIds.length === filteredAppointments.length;
  const isPartiallySelected =
    selectedAppointmentIds.length > 0 &&
    selectedAppointmentIds.length < filteredAppointments.length;

  const importCSVMutation = useMutation({
    mutationFn: async (appointments: any[]) => {
      const response = await apiRequest("POST", "/api/appointments/import", {
        appointments,
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });

      // Log detalhado dos resultados do backend
      console.group("📊 RESULTADO DA IMPORTAÇÃO NO BACKEND");
      console.log(`✅ Sucessos: ${data.success}`);
      console.log(`❌ Erros: ${data.errors}`);

      if (data.detailedErrors && data.detailedErrors.length > 0) {
        console.log("\n📋 Erros detalhados do servidor:");
        data.detailedErrors.forEach((error: string, index: number) => {
          console.log(`   ${index + 1}. ${error}`);
        });
      }

      if (data.processedItems) {
        console.log(`\n📈 Itens processados: ${data.processedItems.length}`);
        const successItems = data.processedItems.filter(
          (item: any) => item.status === "success",
        );
        const errorItems = data.processedItems.filter(
          (item: any) => item.status === "error",
        );
        console.log(`   • Sucessos: ${successItems.length}`);
        console.log(`   • Erros: ${errorItems.length}`);
      }
      console.groupEnd();

      // Toast com resultado
      if (data.errors > 0) {
        const errorMessage = data.detailedErrors
          ? data.detailedErrors.slice(0, 2).join("\n") +
          (data.detailedErrors.length > 2
            ? `\n... e mais ${data.detailedErrors.length - 2} erros`
            : "")
          : `${data.errors} erros encontrados`;

        toast({
          title: `Importação parcial: ${data.success} sucessos, ${data.errors} erros`,
          description: errorMessage,
          variant: "destructive",
        });

        // Gerar relatório de erros do backend se houver
        if (data.detailedErrors && data.detailedErrors.length > 0) {
          const backendErrorReport = [
            "RELATÓRIO DE ERROS - PROCESSAMENTO NO SERVIDOR",
            "=" + "=".repeat(50),
            "",
            `Data/Hora: ${new Date().toLocaleString("pt-BR")}`,
            "",
            "RESUMO:",
            "-".repeat(20),
            `Total processado: ${data.success + data.errors}`,
            `Sucessos: ${data.success}`,
            `Erros: ${data.errors}`,
            `Taxa de sucesso: ${((data.success / (data.success + data.errors)) * 100).toFixed(1)}%`,
            "",
            "ERROS DO SERVIDOR:",
            "-".repeat(40),
            ...data.detailedErrors.map(
              (error: string, index: number) => `${index + 1}. ${error}`,
            ),
          ].join("\n");

          // Download seguro do relatório do servidor
          const filename = `relatorio_servidor_${new Date().toISOString().split("T")[0]}_${new Date().toTimeString().split(" ")[0].replace(/:/g, "")}.txt`;

          setTimeout(() => {
            downloadWithConfirmation(
              backendErrorReport,
              filename,
              "Deseja baixar o relatório de erros do servidor?",
            );
          }, 1500);
        }
      } else {
        toast({
          title: "Sucesso",
          description: `${data.success} agendamentos importados com sucesso!`,
        });
      }
    },
    onError: (error: any) => {
      console.error("❌ Erro na comunicação com o servidor:", error);
      toast({
        title: "Erro de comunicação",
        description: error.message || "Erro ao conectar com o servidor",
        variant: "destructive",
      });
    },
  });

  const handleImportCSV = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const csv = event.target?.result as string;
            const lines = csv.split("\n").filter((line) => line.trim());

            if (lines.length < 2) {
              toast({
                title: "Erro",
                description:
                  "Arquivo CSV deve conter pelo menos uma linha de dados",
                variant: "destructive",
              });
              return;
            }

            const headers = lines[0]
              .split(",")
              .map((h) => h.replace(/"/g, "").trim());
            const appointmentsToImport = [];
            const errors = [];

            console.log(
              "📋 [CSV IMPORT] Iniciando importação de agendamentos...",
            );
            console.log("📋 [CSV IMPORT] Campos reconhecidos:", headers);
            console.log(
              "📋 [CSV IMPORT] Técnicos disponíveis:",
              technicians.map((t: Technician) => t.name),
            );
            console.log(
              "📋 [CSV IMPORT] Equipes disponíveis:",
              teams.map((t: Team) => t.name),
            );

            for (let i = 1; i < lines.length; i++) {
              const values = lines[i]
                .split(",")
                .map((v) => v.replace(/"/g, "").trim());

              if (values.length < headers.length) continue;

              const clientName = values[0];
              const cpfCliente = values[1];
              const serviceName = values[5];
              const technicianName = values[6];
              const dateTime = values[7];
              const cep = values[10];
              const bairro = values[11]; // NOVO
              const cidade = values[12]; // NOVO
              const logradouro = values[13];
              const numero = values[14];
              const complemento = values[15] || "";
              const notes = values[16] || "";

              console.log(
                `📋 [CSV IMPORT] Linha ${i + 1}: Cliente=${clientName}, CPF=${cpfCliente}`,
              );

              // Encontrar cliente pelo CPF (prioritário) ou nome (fallback) ANTES da validação
              let client = null;
              let clientData = null;
              let finalClientName = clientName;
              let finalCep = cep;
              let finalLogradouro = logradouro;
              let finalNumero = numero;

              if (cpfCliente) {
                // Buscar cliente pelo CPF primeiro
                client = clients.find((c: Client) => c.cpf === cpfCliente);

                if (client) {
                  console.log(
                    `✅ [CSV IMPORT] Cliente encontrado pelo CPF ${cpfCliente}: ${client.name}`,
                  );
                  console.log(
                    `📋 [CSV IMPORT] Usando dados do cliente cadastrado, ignorando dados do CSV`,
                  );

                  // Usar dados do cliente cadastrado
                  finalClientName = client.name;
                  finalCep = client.cep;
                  finalLogradouro = client.logradouro;
                  finalNumero = client.numero;
                } else {
                  console.log(
                    `🔍 [CSV IMPORT] CPF ${cpfCliente} não encontrado, criando novo cliente`,
                  );
                }
              }

              if (!client && clientName) {
                // Se não encontrou pelo CPF, tentar por nome como fallback
                client = clients.find(
                  (c: Client) =>
                    c.name.toLowerCase() === clientName.toLowerCase(),
                );

                if (client) {
                  console.log(
                    `⚠️ [CSV IMPORT] Cliente encontrado pelo nome: ${client.name} (sem CPF fornecido)`,
                  );
                  // Usar dados do cliente cadastrado
                  finalClientName = client.name;
                  finalCep = client.cep;
                  finalLogradouro = client.logradouro;
                  finalNumero = client.numero;
                }
              }

              // Validar campos obrigatórios APÓS puxar dados do cliente
              const validationErrors = [];
              const phone1 = values[3];

              // Validar campos obrigatórios (agora usando dados finais)
              if (!finalClientName)
                validationErrors.push(
                  "Cliente não identificado (forneça nome ou CPF válido)",
                );
              if (!serviceName)
                validationErrors.push("Serviço (coluna 6) está vazio");
              if (!dateTime)
                validationErrors.push("Data/Hora (coluna 8) está vazia");
              if (!finalCep)
                validationErrors.push(
                  "CEP não disponível (cliente não cadastrado)",
                );
              if (!finalNumero)
                validationErrors.push(
                  "Número não disponível (cliente não cadastrado)",
                );

              // Validar formato do CEP
              if (finalCep && !/^\d{5}-?\d{3}$/.test(finalCep)) {
                validationErrors.push(
                  `CEP "${finalCep}" inválido (formato esperado: XXXXX-XXX)`,
                );
              }

              // Validar se o número é numérico
              if (finalNumero && isNaN(Number(finalNumero))) {
                validationErrors.push(
                  `Número "${finalNumero}" deve ser numérico`,
                );
              }

              if (validationErrors.length > 0) {
                errors.push(`Linha ${i + 1}: ${validationErrors.join("; ")}`);
                continue;
              }

              if (!client) {
                // Preparar dados do cliente para criação automática
                clientData = {
                  name: finalClientName,
                  cpf: cpfCliente || "",
                  email: values[2] || "",
                  phone1: phone1 || "",
                  phone2: values[4] || "",
                  cep: finalCep,
                  bairro: bairro || "",
                  cidade: cidade || "",
                  logradouro: finalLogradouro,
                  numero: finalNumero,
                  complemento: complemento,
                  observacoes: `Cliente criado automaticamente via importação CSV em ${new Date().toLocaleString("pt-BR")}`,
                };
                console.log(
                  `🆕 [CSV IMPORT] Preparando criação de novo cliente: ${finalClientName}`,
                );
              }

              // Encontrar serviço
              const service = services.find(
                (s: Service) =>
                  s.name.toLowerCase() === serviceName.toLowerCase(),
              );
              if (!service) {
                errors.push(
                  `Linha ${i + 1}: Serviço "${serviceName}" não encontrado`,
                );
                continue;
              }

              // Encontrar técnico ou equipe
              let technician = null;
              let team = null;

              if (technicianName) {
                // Primeiro, procurar por técnico individual
                technician = technicians.find(
                  (t: Technician) =>
                    t.name.toLowerCase() === technicianName.toLowerCase(),
                );

                if (technician) {
                  console.log(
                    `👤 [CSV IMPORT] Técnico encontrado: ${technician.name}`,
                  );
                } else {
                  // Se não encontrou técnico, procurar por equipe
                  team = teams.find(
                    (team: Team) =>
                      team.name.toLowerCase() === technicianName.toLowerCase(),
                  );

                  if (team) {
                    console.log(
                      `👥 [CSV IMPORT] Equipe encontrada: ${team.name}`,
                    );
                  } else {
                    console.log(
                      `⚠️ [CSV IMPORT] Técnico/Equipe "${technicianName}" não encontrado`,
                    );
                  }
                }
              }

              // Validar e normalizar prioridade
              let normalizedPriority = "normal";
              const priorityValue = values[9];
              if (priorityValue) {
                const lowerPriority = priorityValue.toLowerCase().trim();
                if (lowerPriority === "normal") {
                  normalizedPriority = "normal";
                } else if (
                  lowerPriority === "alta" ||
                  lowerPriority === "high"
                ) {
                  normalizedPriority = "high";
                } else if (
                  lowerPriority === "urgente" ||
                  lowerPriority === "urgent"
                ) {
                  normalizedPriority = "urgent";
                } else {
                  errors.push(
                    `Linha ${i + 1}: Prioridade "${priorityValue}" inválida. Use: Normal, Alta ou Urgente`,
                  );
                  continue;
                }
              }

              // Validar e converter data com múltiplos formatos
              let scheduledDate;
              try {
                // Tentar diferentes formatos de data
                let dateObj;

                // Formato ISO (YYYY-MM-DD HH:MM:SS)
                if (/^\d{4}-\d{2}-\d{2}/.test(dateTime)) {
                  dateObj = new Date(dateTime);
                }
                // Formato brasileiro (DD/MM/YYYY HH:MM)
                else if (/^\d{2}\/\d{2}\/\d{4}/.test(dateTime)) {
                  const [datePart, timePart = "00:00"] = dateTime.split(" ");
                  const [day, month, year] = datePart.split("/");
                  dateObj = new Date(`${year}-${month}-${day} ${timePart}`);
                }
                // Formato americano (MM/DD/YYYY HH:MM)
                else if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(dateTime)) {
                  dateObj = new Date(dateTime);
                } else {
                  dateObj = new Date(dateTime);
                }

                if (isNaN(dateObj.getTime())) {
                  throw new Error("Data inválida");
                }

                // Verificar se a data não é muito antiga (antes de 2020) ou muito futura (depois de 2030)
                const year = dateObj.getFullYear();
                if (year < 2020 || year > 2030) {
                  errors.push(
                    `Linha ${i + 1}: Data "${dateTime}" fora do intervalo válido (2020-2030)`,
                  );
                  continue;
                }

                scheduledDate = dateObj.toISOString();
              } catch {
                errors.push(
                  `Linha ${i + 1}: Data/hora "${dateTime}" inválida. Formatos aceitos: YYYY-MM-DD HH:MM, DD/MM/YYYY HH:MM`,
                );
                continue;
              }

              // Mapear status em português para valores do sistema
              let finalStatus = "scheduled"; // padrão
              const statusInput = (values[8] || "").trim();

              console.log(
                `🔄 [CSV IMPORT] Status recebido da linha ${i + 1}: "${statusInput}"`,
              );

              if (statusInput) {
                const statusLower = statusInput
                  .toLowerCase()
                  .normalize("NFD")
                  .replace(/[\u0300-\u036f]/g, ""); // remove acentos

                const statusMap: { [key: string]: string } = {
                  agendado: "scheduled",
                  "em andamento": "in_progress",
                  "em-andamento": "in_progress",
                  emandamento: "in_progress",
                  concluido: "completed",
                  concluído: "completed",
                  cancelado: "cancelled",
                  remarcado: "rescheduled",
                  // Manter compatibilidade com inglês
                  scheduled: "scheduled",
                  in_progress: "in_progress",
                  completed: "completed",
                  cancelled: "cancelled",
                  rescheduled: "rescheduled",
                };

                if (statusMap[statusLower]) {
                  finalStatus = statusMap[statusLower];
                  console.log(
                    `✅ [CSV IMPORT] Status "${statusInput}" mapeado para: ${finalStatus}`,
                  );
                } else {
                  errors.push(
                    `Linha ${i + 1}: Status "${statusInput}" inválido. Valores aceitos: Agendado, Em Andamento, Concluído, Cancelado, Remarcado`,
                  );
                  console.log(
                    `❌ [CSV IMPORT] Status inválido na linha ${i + 1}: "${statusInput}"`,
                  );
                  continue;
                }
              }

              const appointmentData = {
                clientId: client?.id || null,
                clientData: clientData,
                serviceId: service.id,
                technicianId: technician?.id || null,
                teamId: team?.id || null,
                scheduledDate,
                status: finalStatus,
                priority: normalizedPriority,
                cep: finalCep,
                bairro: client ? client.bairro : bairro || "",
                cidade: client ? client.cidade : cidade || "",
                logradouro: finalLogradouro,
                numero: finalNumero,
                complemento,
                notes,
              };

              console.log(
                `📋 [CSV IMPORT] Agendamento preparado - Linha ${i + 1}:`,
                {
                  technicianId: appointmentData.technicianId,
                  teamId: appointmentData.teamId,
                  serviceId: appointmentData.serviceId,
                  clientId: appointmentData.clientId,
                },
              );

              appointmentsToImport.push(appointmentData);
            }

            if (errors.length > 0) {
              // Criar um relatório detalhado de erros
              const errorReport = {
                totalLines: lines.length - 1,
                validAppointments: appointmentsToImport.length,
                errorCount: errors.length,
                errors: errors,
              };

              // Mostrar primeiros 3 erros no toast
              const shortErrorMessage =
                errors.slice(0, 3).join("\n") +
                (errors.length > 3
                  ? `\n... e mais ${errors.length - 3} erros`
                  : "");

              toast({
                title: `${errors.length} erros encontrados na importação`,
                description: shortErrorMessage,
                variant: "destructive",
              });

              // Log detalhado no console
              console.group("📋 RELATÓRIO DETALHADO DE IMPORTAÇÃO CSV");
              console.log(`📊 Resumo:`);
              console.log(
                `   • Total de linhas processadas: ${errorReport.totalLines}`,
              );
              console.log(
                `   • Agendamentos válidos: ${errorReport.validAppointments}`,
              );
              console.log(`   • Erros encontrados: ${errorReport.errorCount}`);
              console.log(
                `   • Taxa de sucesso: ${((errorReport.validAppointments / errorReport.totalLines) * 100).toFixed(1)}%`,
              );
              console.log("\n📝 LISTA COMPLETA DE ERROS:");
              errorReport.errors.forEach((error, index) => {
                console.log(`   ${index + 1}. ${error}`);
              });
              console.log("\n💡 DICAS PARA CORREÇÃO:");
              console.log(
                "   • Verifique se os nomes de clientes, serviços e técnicos estão exatamente como cadastrados",
              );
              console.log(
                "   • Formato de data aceito: YYYY-MM-DD HH:MM:SS ou DD/MM/YYYY HH:MM",
              );
              console.log("   • CEP deve estar no formato XXXXX-XXX");
              console.log("   • Campos obrigatórios não podem estar vazios");
              console.log("\n📋 ORDEM DOS CAMPOS NO CSV:");
              console.log(
                "   1. Cliente | 2. CPF Cliente | 3. Email Cliente | 4. Telefone 1 | 5. Telefone 2",
              );
              console.log(
                "   6. Serviço | 7. Técnico | 8. Data/Hora | 9. Status | 10. Prioridade",
              );
              console.log(
                "   11. CEP | 12. Logradouro | 13. Número | 14. Complemento | 15. Observações",
              );
              console.groupEnd();

              // Criar arquivo de log para download
              const logContent = [
                "RELATÓRIO DE ERROS - IMPORTAÇÃO CSV",
                "=" + "=".repeat(40),
                "",
                `Data/Hora: ${new Date().toLocaleString("pt-BR")}`,
                `Arquivo processado: ${file.name}`,
                "",
                "RESUMO:",
                `-".repeat(20)`,
                `Total de linhas: ${errorReport.totalLines}`,
                `Agendamentos válidos: ${errorReport.validAppointments}`,
                `Erros encontrados: ${errorReport.errorCount}`,
                `Taxa de sucesso: ${((errorReport.validAppointments / errorReport.totalLines) * 100).toFixed(1)}%`,
                "",
                "ERROS DETALHADOS:",
                "-".repeat(40),
                ...errorReport.errors.map(
                  (error, index) => `${index + 1}. ${error}`,
                ),
                "",
                "DICAS PARA CORREÇÃO:",
                "-".repeat(40),
                "• Verifique se os nomes de clientes, serviços e técnicos estão exatamente como cadastrados no sistema",
                "• Formato de data aceito: YYYY-MM-DD HH:MM:SS ou DD/MM/YYYY HH:MM",
                "• CEP deve estar no formato XXXXX-XXX",
                "• Campos obrigatórios não podem estar vazios",
                "• Use apenas caracteres válidos (evite caracteres especiais nos nomes)",
                "",
                "ORDEM DOS CAMPOS NO CSV:",
                "-".repeat(40),
                "1. Cliente | 2. CPF Cliente | 3. Email Cliente | 4. Telefone 1 | 5. Telefone 2",
                "6. Serviço | 7. Técnico | 8. Data/Hora | 9. Status | 10. Prioridade",
                "11. CEP | 12. Logradouro | 13. Número | 14. Complemento | 15. Observações",
                "",
                "COMPORTAMENTO INTELIGENTE DE CPF:",
                "-".repeat(40),
                "• Se o CPF do cliente já estiver cadastrado, os dados do cliente serão puxados automaticamente",
                "• Neste caso, os dados do CSV (nome, telefone, endereço) serão ignorados para esse cliente",
                "• Isso garante consistência com os dados já cadastrados no sistema",
                "",
                "OBSERVAÇÃO: Use o botão 'Baixar CSV Modelo' para obter um arquivo com a estrutura correta.",
              ].join("\n");

              const logBlob = new Blob([logContent], {
                type: "text/plain;charset=utf-8;",
              });
              // Download seguro do relatório de erros
              const filename = `relatorio_erros_${new Date().toISOString().split("T")[0]}_${new Date().toTimeString().split(" ")[0].replace(/:/g, "")}.txt`;

              setTimeout(() => {
                downloadWithConfirmation(
                  logContent,
                  filename,
                  "Deseja baixar um relatório detalhado dos erros encontrados?",
                );
              }, 1000);
            }

            if (appointmentsToImport.length > 0) {
              importCSVMutation.mutate(appointmentsToImport);
            } else {
              toast({
                title: "Erro",
                description: "Nenhum agendamento válido encontrado no arquivo",
                variant: "destructive",
              });
            }
          } catch (error) {
            toast({
              title: "Erro",
              description: "Erro ao processar arquivo CSV",
              variant: "destructive",
            });
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const downloadCSVTemplate = () => {
    const templateHeaders = [
      "Cliente",
      "CPF Cliente",
      "Email Cliente",
      "Telefone 1",
      "Telefone 2",
      "Serviço",
      "Técnico",
      "Data/Hora",
      "Status",
      "Prioridade",
      "CEP",
      "Bairro", // NOVO
      "Cidade", // NOVO
      "Logradouro",
      "Número",
      "Complemento",
      "Observações",
    ];

    const exampleRow = [
      "João Silva",
      "123.456.789-01",
      "joao@email.com",
      "(11) 99999-9999",
      "(11) 88888-8888",
      "Instalação",
      "Carlos Técnico",
      "2024-12-25 14:30",
      "Agendado",
      "normal",
      "01234-567",
      "Portão", // EXEMPLO
      "Curitiba", // EXEMPLO
      "Rua das Flores",
      "123",
      "Apto 45",
      "Cliente preferencial",
    ];

    const csvContent = [templateHeaders, exampleRow]
      .map((row) => row.map((field) => `"${field}"`).join(","))
      .join("\n");

    // Download seguro do modelo CSV
    downloadCSV(csvContent, "modelo_importacao_agendamentos.csv");

    toast({
      title: "Modelo baixado",
      description: "Use este arquivo como base para importar seus agendamentos",
    });
  };

  const exportToCSV = () => {
    if (appointments.length === 0) {
      toast({
        title: "Aviso",
        description: "Não há agendamentos para exportar",
        variant: "destructive",
      });
      return;
    }

    const csvHeaders = [
      "ID",
      "Cliente",
      "Email Cliente",
      "Telefone 1",
      "Telefone 2",
      "Serviço",
      "Técnico",
      "Data/Hora",
      "Status",
      "Prioridade",
      "CEP",
      "Bairro", // NOVO
      "Cidade", // NOVO
      "Logradouro",
      "Número",
      "Complemento",
      "Observações",
    ];

    const csvData = appointments.map((appointment: Appointment) => {
      const client = getClient(appointment.clientId);
      const service = getService(appointment.serviceId);
      const technician = getTechnician(appointment.technicianId);
      const { date, time } = formatDateTime(
        appointment.scheduledDate.toString(),
      );

      return [
        appointment.id,
        client?.name || "Cliente não encontrado",
        client?.email || "",
        client?.phone1 || "",
        client?.phone2 || "",
        service?.name || "Serviço não encontrado",
        technician?.name || "Técnico não encontrado",
        `${date} ${time}`,
        getStatusText(appointment.status),
        getPriorityText(appointment.priority),
        appointment.cep,
        appointment.bairro || "", // NOVO
        appointment.cidade || "", // NOVO
        appointment.logradouro,
        appointment.numero,
        appointment.complemento || "",
        appointment.notes || "",
      ];
    });

    const csvContent = [csvHeaders, ...csvData]
      .map((row: any[]) => row.map((field: any) => `"${field}"`).join(","))
      .join("\n");

    // Download seguro da exportação CSV
    const filename = `agendamentos_${new Date().toISOString().split("T")[0]}.csv`;
    downloadCSV(csvContent, filename);

    toast({
      title: "Sucesso",
      description: "Agendamentos exportados com sucesso",
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-burnt-yellow"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header - Mobile-First Responsive */}
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agendamentos</h1>
          <p className="text-gray-600">Gerencie todos os seus agendamentos</p>
        </div>

        {/* Action Buttons - Stack on mobile */}
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
            <Button
              variant="ghost"
              onClick={downloadCSVTemplate}
              className="text-xs text-blue-500 hover:text-blue-700 hover:bg-blue-50 w-full sm:w-auto"
            >
              Baixar CSV Modelo
            </Button>

            <Button
              variant="outline"
              onClick={handleImportCSV}
              className="border-blue-600 text-blue-600 hover:bg-blue-50 w-full sm:w-auto"
            >
              <Upload className="h-4 w-4 mr-2" />
              Importar CSV
            </Button>

            <Button
              variant="outline"
              onClick={exportToCSV}
              className="border-burnt-yellow text-burnt-yellow hover:bg-burnt-yellow hover:text-white w-full sm:w-auto"
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
          </div>

          <Button
            className="bg-burnt-yellow hover:bg-burnt-yellow-dark text-white w-full md:w-auto"
            onClick={() => {
              console.log("🆕 [DEBUG] Novo Agendamento - Botão clicado");
              console.log(
                "🆕 [DEBUG] Novo Agendamento - Limpando selectedAppointment e prefilledData",
              );
              setSelectedAppointment(null);
              setPrefilledData(null);
              setIsFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo Agendamento
          </Button>
        </div>
      </div>

      {/* Mobile-First Responsive Layout */}
      <div className="space-y-4 md:space-y-6">
        {/* Filters Card with View Mode Toggle */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center">
              <Filter className="h-5 w-5 mr-2" />
              Filtros e Visualização
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Filter Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Data</label>
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => {
                      console.log("🔍 [FILTER] Data alterada:", e.target.value);
                      setSelectedDate(e.target.value);
                    }}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Buscar Cliente
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Nome do cliente..."
                      value={searchTerm}
                      onChange={(e) => {
                        console.log(
                          "🔍 [FILTER] Busca alterada:",
                          e.target.value,
                        );
                        setSearchTerm(e.target.value);
                      }}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Serviço
                  </label>
                  <Select
                    value={selectedService}
                    onValueChange={(value) => {
                      console.log("🔍 [FILTER] Serviço alterado:", value);
                      setSelectedService(value);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os serviços" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os serviços</SelectItem>
                      {services.map((service: Service) => (
                        <SelectItem
                          key={service.id}
                          value={service.id.toString()}
                        >
                          {service.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Técnicos/Equipes
                  </label>
                  <Select
                    value={selectedTechnician}
                    onValueChange={(value) => {
                      console.log(
                        "🔍 [FILTER] Técnico/Equipe alterado:",
                        value,
                      );
                      setSelectedTechnician(value);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os técnicos e equipes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        Todos os técnicos e equipes
                      </SelectItem>
                      {technicians.map((technician: Technician) => (
                        <SelectItem
                          key={`tech-${technician.id}`}
                          value={technician.id.toString()}
                        >
                          👤 {technician.name}
                        </SelectItem>
                      ))}
                      {teams.map((team: any) => (
                        <SelectItem
                          key={`team-${team.id}`}
                          value={`team-${team.id}`}
                        >
                          👥 {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Status
                  </label>
                  <Select
                    value={selectedStatus}
                    onValueChange={(value) => {
                      console.log("🔍 [FILTER] Status alterado:", value);
                      setSelectedStatus(value);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os status</SelectItem>
                      <SelectItem value="scheduled">Agendado</SelectItem>
                      <SelectItem value="in_progress">Em Andamento</SelectItem>
                      <SelectItem value="completed">Concluído</SelectItem>
                      <SelectItem value="cancelled">Cancelado</SelectItem>
                      <SelectItem value="rescheduled">Remarcado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Em romaneio
                  </label>
                  <Select
                    value={inRouteFilter}
                    onValueChange={(value) => {
                      setInRouteFilter(value);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Filtrar por romaneio" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="yes">Sim</SelectItem>
                      <SelectItem value="no">Não</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* View Mode Toggle and Clear Filters */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pt-4 border-t border-gray-100">
                {/* View Mode Toggle */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <span className="text-sm font-medium text-gray-700">
                    Modo de Visualização:
                  </span>
                  <div className="bg-white border border-gray-200 rounded p-0.5 shadow-sm w-full max-w-sm sm:w-auto">
                    <Tabs
                      value={viewMode}
                      onValueChange={(value) =>
                        setViewMode(value as "list" | "calendar" | "availability")
                      }
                      className="w-full"
                    >
                      <TabsList className="grid w-full grid-cols-3 h-auto sm:h-8 bg-gray-50 p-0 gap-1 sm:gap-0">
                        <TabsTrigger
                          value="list"
                          className="flex items-center justify-center gap-2 py-2 px-2 sm:py-1 sm:px-3 text-sm font-medium rounded border shadow-none data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-burnt-yellow data-[state=active]:border-burnt-yellow w-full"
                        >
                          <List className="h-4 w-4" />
                          <span className="text-sm sm:text-xs">Lista</span>
                        </TabsTrigger>
                        <TabsTrigger
                          value="calendar"
                          className="flex items-center justify-center gap-2 py-2 px-2 sm:py-1 sm:px-3 text-sm font-medium rounded border shadow-none data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-burnt-yellow data-[state=active]:border-burnt-yellow w-full"
                        >
                          <Calendar className="h-4 w-4" />
                          <span className="text-sm sm:text-xs">Calendário</span>
                        </TabsTrigger>
                        <TabsTrigger
                          value="availability"
                          className="flex items-center justify-center gap-2 py-2 px-2 sm:py-1 sm:px-3 text-sm font-medium rounded border shadow-none data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-burnt-yellow data-[state=active]:border-burnt-yellow w-full"
                        >
                          <Clock className="h-4 w-4" />
                          <span className="text-sm sm:text-xs">Disponibilidade</span>
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  {/* Botão de restrição de data */}
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-auto border-red-500 text-red-600 hover:bg-red-50"
                    onClick={() => setIsRestrictionModalOpen(true)}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Restrição de data
                  </Button>

                  {/* Clear Filters Button */}
                  <Button
                    onClick={() => {
                      console.log("🔍 [FILTER] Limpando todos os filtros");
                      setSelectedDate("");
                      setSearchTerm("");
                      setSelectedService("all");
                      setSelectedTechnician("all");
                      setSelectedStatus("all");
                      setInRouteFilter("no");
                    }}
                    variant="outline"
                    className="w-full sm:w-auto"
                    type="button"
                  >
                    Limpar Filtros
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Content Area - List or Calendar View */}
      {viewMode === "list" ? (
        /* List View */
        filteredAppointments.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Calendar className="h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {appointments.length === 0
                  ? "Nenhum agendamento encontrado"
                  : "Nenhum agendamento encontrado com os filtros aplicados"}
              </h3>
              <p className="text-gray-600 text-center mb-6">
                {appointments.length === 0
                  ? "Comece criando seu primeiro agendamento para organizar seus atendimentos técnicos."
                  : "Tente ajustar os filtros ou limpar todos os filtros para ver mais agendamentos."}
              </p>
              <Button
                className="bg-burnt-yellow hover:bg-burnt-yellow-dark text-white"
                onClick={() => {
                  setPrefilledData(null);
                  setSelectedAppointment(null);
                  setIsFormOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Criar Primeiro Agendamento
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Selection Header */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="select-all"
                    checked={isAllSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = isPartiallySelected;
                    }}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="w-4 h-4 text-burnt-yellow bg-gray-100 border-gray-300 rounded focus:ring-burnt-yellow focus:ring-2"
                  />
                  <label
                    htmlFor="select-all"
                    className="text-sm font-medium text-gray-700"
                  >
                    Selecionar Todos
                  </label>
                </div>
                {selectedAppointmentIds.length > 0 && (
                  <span className="text-sm text-gray-600">
                    {selectedAppointmentIds.length} de{" "}
                    {filteredAppointments.length} selecionados
                  </span>
                )}
              </div>

            </div>

            {/* Appointments List - Agrupado por Data */}
            <div className="space-y-6">
              {paginatedGroupedAppointments.map((group) => (
                <div key={group.date} className="space-y-4">
                  {/* Linha de separação com a data */}
                  <div className="flex items-center gap-4">
                    <div className="flex-1 border-t border-gray-300"></div>
                    <div className="px-4 py-2 bg-burnt-yellow text-white font-semibold rounded-lg shadow-sm">
                      {group.date}
                    </div>
                    <div className="flex-1 border-t border-gray-300"></div>
                  </div>

                  {/* Agendamentos do dia */}
                  <div className="grid gap-4">
                    {group.appointments.map((appointment: Appointment) => {
                      const client = getClient(appointment.clientId);
                      const service = getService(appointment.serviceId);
                      const responsible = getResponsibleInfo(appointment);
                      const { date, time } = formatDateTime(appointment.scheduledDate.toString());
                      const isSelected = selectedAppointmentIds.includes(appointment.id);

                      // helper para alternar seleção
                      const toggleSelection = () =>
                        handleAppointmentSelection(appointment.id, !isSelected);

                      // evita que cliques em elementos internos (checkbox/botões) propaguem
                      const stop = (e: React.MouseEvent | React.KeyboardEvent) => e.stopPropagation();

                      return (
                        <Card
                          key={appointment.id}
                          onClick={(appointment as any).routeInfo ? undefined : toggleSelection}
                          onKeyDown={(e) => {
                            if (!(appointment as any).routeInfo && (e.key === "Enter" || e.key === " ")) {
                              stop(e);
                              toggleSelection();
                            }
                          }}
                          role="checkbox"
                          aria-checked={isSelected}
                          tabIndex={(appointment as any).routeInfo ? -1 : 0}
                          className={`select-none transition-shadow ${(appointment as any).routeInfo
                            ? "opacity-75 cursor-not-allowed"
                            : "cursor-pointer hover:shadow-md"
                            } ${isSelected ? "ring-2 ring-burnt-yellow" : ""
                            }`}
                        >
                          <CardContent className="p-6">
                            <div className="flex items-start justify-between">
                              <div className="flex items-start space-x-3">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  disabled={(appointment as any).routeInfo !== null && (appointment as any).routeInfo !== undefined}
                                  onClick={stop}
                                  onChange={(e) =>
                                    handleAppointmentSelection(appointment.id, e.target.checked)
                                  }
                                  className="w-4 h-4 text-burnt-yellow bg-gray-100 border-gray-300 rounded focus:ring-burnt-yellow focus:ring-2 mt-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                                <div className="flex-1">
                                  <div className="flex items-center space-x-3 mb-3">
                                    <h3 className="text-lg font-semibold text-gray-900">
                                      {client?.name || "Cliente não encontrado"}
                                      <span className="ml-2 text-sm font-normal text-gray-500">#{appointment.id}</span>
                                    </h3>

                                    {/* Dropdown de Status */}
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <button
                                          onClick={stop}
                                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium transition-colors hover:opacity-80 ${getStatusColor(appointment.status)}`}
                                        >
                                          {getStatusText(appointment.status)}
                                          <ChevronDown className="h-3 w-3" />
                                        </button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent onClick={stop}>
                                        <DropdownMenuItem
                                          onClick={() =>
                                            updateStatusMutation.mutate({
                                              id: appointment.id,
                                              status: "scheduled",
                                            })
                                          }
                                        >
                                          Agendado
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() =>
                                            updateStatusMutation.mutate({
                                              id: appointment.id,
                                              status: "in_progress",
                                            })
                                          }
                                        >
                                          Em Andamento
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() =>
                                            updateStatusMutation.mutate({
                                              id: appointment.id,
                                              status: "completed",
                                            })
                                          }
                                        >
                                          Concluído
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() =>
                                            updateStatusMutation.mutate({
                                              id: appointment.id,
                                              status: "cancelled",
                                            })
                                          }
                                        >
                                          Cancelado
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() =>
                                            updateStatusMutation.mutate({
                                              id: appointment.id,
                                              status: "rescheduled",
                                            })
                                          }
                                        >
                                          Remarcado
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>

                                    <Badge className={getPriorityColor(appointment.priority)}>
                                      {getPriorityText(appointment.priority)}
                                    </Badge>

                                    {/* Badge de Romaneio Confirmado/Finalizado */}
                                    {(appointment as any).routeInfo && (
                                      <Link href={`/routes-history/${(appointment as any).routeInfo.displayNumber}`}>
                                        <Badge className="bg-orange-100 text-orange-800 border border-orange-300 hover:bg-orange-200 cursor-pointer">
                                          🚚 Romaneio {(appointment as any).routeInfo.status === 'confirmado' ? 'Confirmado' : 'Finalizado'} #{(appointment as any).routeInfo.displayNumber}
                                        </Badge>
                                      </Link>
                                    )}
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                                    <div className="flex items-center space-x-2">
                                      <Calendar className="h-4 w-4" />
                                      {appointment.allDay ? (
                                        <span className="font-semibold text-red-700">
                                          📅 {date} - DIA INTEIRO
                                        </span>
                                      ) : (
                                        <span>
                                          {date} às {time}
                                        </span>
                                      )}
                                    </div>

                                    <div className="flex items-center space-x-2">
                                      <User className="h-4 w-4" />
                                      <span>{responsible.displayName}</span>
                                    </div>

                                    <div className="flex items-center space-x-2">
                                      <MapPin className="h-4 w-4" />
                                      <span>
                                        {client ? (
                                          <>
                                            {client.logradouro || "Logradouro não informado"}
                                            {client.numero ? `, ${client.numero}` : ""}
                                            {client.bairro ? `, ${client.bairro}` : ""}
                                            {client.cidade ? `, ${client.cidade}` : ""}
                                            {client.cep ? ` - ${client.cep}` : ""}
                                            {client.complemento
                                              ? `, ${client.complemento.toUpperCase()}`
                                              : ""}
                                          </>
                                        ) : (
                                          <span style={{ color: "red" }}>
                                            Cliente não encontrado
                                          </span>
                                        )}
                                      </span>
                                    </div>

                                    <div className="flex items-center space-x-2">
                                      <Clock className="h-4 w-4" />
                                      <span>
                                        {service?.duration ? `${service.duration} min` : "Tempo não informado"}
                                      </span>
                                    </div>

                                    <div className="flex items-center space-x-2">
                                      <Wrench className="h-4 w-4" />
                                      <span>{service?.name || "Serviço não encontrado"}</span>
                                    </div>
                                  </div>

                                  {appointment.notes && (
                                    <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                                      <p className="text-sm text-gray-700">{appointment.notes}</p>
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="flex space-x-2 ml-4">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    stop(e);
                                    handleEdit(appointment);
                                  }}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    stop(e);
                                    handleDelete(appointment);
                                  }}
                                  className="text-red-600 hover:text-red-700 hover:border-red-300"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 mt-8 pb-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                >
                  ← Anterior
                </Button>

                <span className="text-sm font-medium text-gray-700">
                  Página {currentPage} de {totalPages} ({filteredAppointments.length} agendamentos)
                </span>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                >
                  Próxima →
                </Button>
              </div>
            )}
          </div>
        )
      ) : viewMode === "calendar" ? (
        /* Calendar View */
        <Card>
          <CardContent className="p-6">
            {filteredAppointments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Calendar className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {appointments.length === 0
                    ? "Nenhum agendamento encontrado"
                    : "Nenhum agendamento encontrado com os filtros aplicados"}
                </h3>
                <p className="text-gray-600 text-center mb-6">
                  {appointments.length === 0
                    ? "Comece criando seu primeiro agendamento para organizar seus atendimentos técnicos."
                    : "Tente ajustar os filtros ou limpar todos os filtros para ver mais agendamentos."}
                </p>
                <Button
                  className="bg-burnt-yellow hover:bg-burnt-yellow-dark text-white"
                  onClick={() => {
                    setPrefilledData(null);
                    setSelectedAppointment(null);
                    setIsFormOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Primeiro Agendamento
                </Button>
              </div>
            ) : (
              <AppointmentCalendar
                appointments={filteredAppointments}
                clients={clients}
                services={services}
                technicians={technicians}
                teams={teams}
                dateRestrictions={dateRestrictions}
              />
            )}
          </CardContent>
        </Card>
      ) : (
        /* Availability View */
        <Card>
          <CardContent className="p-6">
            <AvailabilityCalendar
              appointments={appointments}
              services={services}
              technicians={technicians}
              teams={teams}
              teamMembers={teamMembers}
              businessRules={businessRules}
              currentDate={availabilityDate}
              onDateChange={setAvailabilityDate}
              dateRestrictions={dateRestrictions}
            />
          </CardContent>
        </Card>
      )}

      {/* Centralized Dialog for All Appointment Forms */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <AppointmentForm
            appointment={selectedAppointment}
            onClose={handleFormClose}
            clients={clients}
            services={services}
            technicians={technicians}
            teams={teams}
            prefilledData={prefilledData}
          />
        </DialogContent>
      </Dialog>

      {/* Modal de Restrição de Data */}
      <Dialog open={isRestrictionModalOpen} onOpenChange={handleRestrictionModalOpenChange}>
        <DialogContent className="w-[95vw] md:w-[80vw] max-w-5xl max-h-[90vh] overflow-y-auto">
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Restrição de data
              </h2>
              <p className="text-sm text-gray-600">
                Selecione o intervalo de datas, os técnicos/equipes afetados e o motivo. Esses dias ficarão indisponíveis para novos agendamentos.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Data inicial</label>
                <Input
                  type="date"
                  value={restrictionStartDate}
                  onChange={(e) => setRestrictionStartDate(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Data final (opcional)</label>
                <Input
                  type="date"
                  value={restrictionEndDate}
                  onChange={(e) => setRestrictionEndDate(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Motivo</label>
              <Input
                placeholder="Ex.: Feriado municipal, treinamento interno, manutenção de sistema..."
                value={restrictionTitle}
                onChange={(e) => setRestrictionTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium block">
                Técnicos e equipes afetados
              </label>
              <p className="text-xs text-gray-500 mb-1">
                Marque um ou mais responsáveis. A mesma restrição será aplicada a todos os selecionados.
              </p>
              <div className="max-h-52 overflow-y-auto border rounded-md p-3 space-y-2">
                {technicians.map((technician: Technician) => {
                  const key = `technician-${technician.id}`;
                  const checked = selectedRestrictionResponsibles.includes(key);
                  return (
                    <label
                      key={key}
                      className="flex items-center gap-2 text-sm cursor-pointer"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) => {
                          setSelectedRestrictionResponsibles((prev) =>
                            value
                              ? [...prev, key]
                              : prev.filter((k) => k !== key),
                          );
                        }}
                      />
                      <span>👤 {technician.name}</span>
                    </label>
                  );
                })}
                {teams.map((team: Team) => {
                  const key = `team-${team.id}`;
                  const checked = selectedRestrictionResponsibles.includes(key);
                  return (
                    <label
                      key={key}
                      className="flex items-center gap-2 text-sm cursor-pointer"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) => {
                          setSelectedRestrictionResponsibles((prev) =>
                            value
                              ? [...prev, key]
                              : prev.filter((k) => k !== key),
                          );
                        }}
                      />
                      <span>👥 {team.name}</span>
                    </label>
                  );
                })}
                {technicians.length === 0 && teams.length === 0 && (
                  <p className="text-xs text-gray-500">
                    Cadastre técnicos e equipes para aplicar restrições de data.
                  </p>
                )}
              </div>
            </div>

            {/* Lista simples de restrições do mês atual */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Restrições deste mês</span>
              </div>
              {dateRestrictions.length === 0 ? (
                <p className="text-xs text-gray-500">
                  Nenhuma restrição de data cadastrada neste mês.
                </p>
              ) : (
                <div className="max-h-40 overflow-y-auto border rounded-md divide-y text-sm">
                  {dateRestrictions.map((r: DateRestriction) => {
                    const d = new Date(r.date);
                    const dateLabel = d.toLocaleDateString("pt-BR");
                    const isTeam = r.responsibleType === "team";
                    const responsibleName = isTeam
                      ? teams.find((t: Team) => t.id === r.responsibleId)?.name || `Equipe #${r.responsibleId}`
                      : technicians.find((t: Technician) => t.id === r.responsibleId)?.name || `Técnico #${r.responsibleId}`;

                    return (
                      <div
                        key={r.id}
                        className="flex items-center justify-between px-2 py-1.5"
                      >
                        <div className="min-w-0 mr-2">
                          <div className="text-xs text-gray-500">{dateLabel}</div>
                          <div className="flex items-center gap-1 text-xs">
                            <span>{isTeam ? "👥" : "👤"}</span>
                            <span className="truncate">{responsibleName}</span>
                          </div>
                          <div className="text-xs text-gray-700 truncate">
                            {r.title}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-7 w-7 text-red-600 border-red-300 hover:bg-red-50"
                          onClick={() => deleteDateRestrictionMutation.mutate(r.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {restrictionError && (
              <div className="text-sm text-red-600 border border-red-200 bg-red-50 rounded-md px-3 py-2">
                {restrictionError}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleRestrictionModalClose}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={() => createDateRestrictionMutation.mutate()}
              >
                Salvar restrições
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Route Optimization Drawer */}
      {isRouteDrawerOpen && (
        <div className="fixed inset-0 z-[9999]">
          {/* Overlay cobre a viewport inteira */}
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setIsRouteDrawerOpen(false)}
          />

          {/* Painel à direita */}
          <section
            className="
              fixed right-0 top-0 h-full w-full bg-white shadow-xl
              max-w-[90vw] md:max-w-[60vw] lg:max-w-[40vw]
            "
            role="dialog"
            aria-modal="true"
          >
            <div className="flex h-full flex-col">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Navigation className="h-5 w-5 mr-2 text-burnt-yellow" />
                  {optimizedRoute?.route?.id || savedInfo ? "Rota Otimizada" : "Visualização de Rota"}
                </h2>
                <button
                  onClick={() => setIsRouteDrawerOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {(isOptimizing || isViewing) && (
                  <div className="p-4 text-sm text-gray-600 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#DAA520] mr-3"></div>
                    {isOptimizing ? "Otimizando rota, aguarde..." : "Carregando, aguarde..."}
                  </div>
                )}

                {!isOptimizing && !isViewing && optimizedRoute && (
                  <div className="space-y-6">
                    {/* Mapa com altura garantida para evitar 0px */}
                    <div className="relative w-full h-[420px] md:h-[480px] rounded-lg overflow-hidden border">
                      <div className="absolute inset-0">
                        <OptimizedRouteMap
                          key={`${Boolean(polyline)}-${routeWaypoints?.length ?? 0}-${isRouteDrawerOpen ? 'open' : 'closed'}`}
                          routeGeoJson={polyline ?? undefined}
                          waypoints={routeWaypoints ?? undefined}
                          startWaypoint={startWaypoint}
                        />
                      </div>
                    </div>

                    {/* Summary */}
                    <div className="bg-[#DAA520]/10 rounded-lg p-4">
                      <h3 className="font-semibold text-gray-900 mb-2">
                        Resumo da Rota
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Paradas:</span>
                          <span className="font-medium">
                            {optimizedRoute.route?.stopsCount ??
                              optimizedRoute.stops?.length ??
                              0}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Distância Total:</span>
                          <span className="font-medium text-blue-600">
                            {optimizedRoute.route?.distanceTotal
                              ? `${(optimizedRoute.route.distanceTotal / 1000).toFixed(1)} km`
                              : "N/A"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Tempo Estimado:</span>
                          <span className="font-medium text-green-600">
                            {optimizedRoute.route?.durationTotal
                              ? `${Math.round(optimizedRoute.route.durationTotal / 60)} min`
                              : "N/A"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Ordem Otimizada */}
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-4">
                        Ordem Otimizada
                      </h3>

                      {/* Início da rota (endereço da empresa) */}
                      {optimizedRoute.start && (
                        <div className="bg-gray-50 rounded-lg p-4 mb-3">
                          <div className="flex items-start space-x-3">
                            <div className="flex-shrink-0 w-6 h-6 bg-gray-400 text-white rounded-full flex items-center justify-center">
                              <img src="/brand/rotafacil-pin.png" alt="Início" className="w-3.5 h-3.5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-gray-900 truncate">Início da rota</h4>
                              <p className="text-sm text-gray-600 truncate">{optimizedRoute.start.address}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="space-y-3">
                        {optimizedRoute.stops?.map(
                          (stop: any, index: number) => {
                            const dt = stop.scheduledDate
                              ? new Date(stop.scheduledDate)
                              : null;
                            const date = dt
                              ? dt.toLocaleDateString("pt-BR")
                              : null;
                            const time = dt
                              ? dt.toLocaleTimeString("pt-BR", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                              : null;

                            return (
                              <div
                                key={`${stop.appointmentId}-${index}`}
                                className="bg-gray-50 rounded-lg p-4"
                              >
                                <div className="flex items-start space-x-3">
                                  <div className="flex-shrink-0 w-6 h-6 bg-burnt-yellow text-white rounded-full flex items-center justify-center text-sm font-medium">
                                    {index + 1}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <h4 className="font-medium text-gray-900 truncate">
                                      {stop.clientName || "Cliente"}
                                    </h4>
                                    {stop.serviceName && (
                                      <p className="text-sm text-gray-600 truncate">
                                        {stop.serviceName}
                                      </p>
                                    )}
                                    {dt && (
                                      <p className="text-sm text-gray-500">
                                        {date} às {time}
                                      </p>
                                    )}
                                    <p className="text-sm text-gray-500 truncate">
                                      {stop.address}
                                    </p>
                                  </div>
                                  <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                                </div>
                              </div>
                            );
                          },
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-3">
                      {/* Botão de otimizar (aparece apenas se ainda não foi otimizado) */}
                      {!optimizedRoute.route?.id && !savedInfo && !isRouteOptimized && (
                        <Button
                          className="w-full bg-burnt-yellow hover:bg-burnt-yellow-dark text-white"
                          onClick={handleOptimizeRoute}
                          disabled={isOptimizing}
                        >
                          {isOptimizing ? "Otimizando..." : "Otimizar Rota"}
                        </Button>
                      )}

                      {/* Botão de salvar aparece sempre (tanto otimizado quanto não otimizado) */}
                      {!optimizedRoute.route?.id && !savedInfo && (
                        <Button
                          className="w-full bg-green-600 hover:bg-green-700 text-white"
                          onClick={handleSaveRoute}
                          disabled={isOptimizing}
                        >
                          Salvar Rota {!isRouteOptimized && "(na ordem atual)"}
                        </Button>
                      )}

                      {/* Botões padrão */}
                      <Button
                        className="w-full bg-black hover:bg-gray-800 text-white"
                        onClick={() => openInGoogleMaps(routeWaypoints, endAtStart)}
                        disabled={!routeWaypoints || routeWaypoints.length < 2}
                      >
                        Iniciar Navegação
                      </Button>
                      <Button variant="outline" className="w-full">
                        Exportar Rota
                      </Button>

                      {/* Aviso de rota salva + botão Ver no Histórico */}
                      {savedInfo && (
                        <div className="mt-3 flex items-center justify-between gap-2">
                          <div className="text-sm">
                            <span className="font-medium">
                              Rota salva com sucesso
                            </span>
                            <span className="ml-1">
                              ID #{savedInfo.displayNumber}
                            </span>
                          </div>
                          <button
                            type="button"
                            className="px-3 py-2 rounded-xl bg-[#DAA520] text-black hover:bg-[#B8860B] transition"
                            onClick={() =>
                              window.open(
                                `/routes-history?open=${savedInfo.id}&id=${savedInfo.displayNumber}`,
                                "_blank",
                              )
                            }
                          >
                            Ver no Histórico
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Botão flutuante para otimizar rotas */}
      {selectedAppointmentIds.length > 1 && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
          {/* Checkbox "Terminar no ponto inicial" - Mobile: ícone, Desktop: com texto */}
          <label className="flex items-center gap-2 bg-white rounded-lg shadow-lg px-3 py-2 text-sm font-medium text-[#B8860B] border border-[#DAA520] cursor-pointer hover:bg-gray-50">
            <input
              type="checkbox"
              checked={endAtStart}
              onChange={(e) => setEndAtStart(e.target.checked)}
              className="h-4 w-4 rounded border-[#DAA520] text-[#DAA520] focus:ring-[#DAA520]"
            />
            <span className="hidden sm:inline">Terminar no início</span>
            <span className="sm:hidden">↩️</span>
          </label>

          {/* Botão principal de visualizar rota */}
          <Button
            onClick={handleViewRoute}
            className="bg-burnt-yellow hover:bg-burnt-yellow-dark text-white shadow-lg hover:shadow-xl transition-all"
            size="lg"
          >
            <Route className="h-5 w-5 sm:mr-2" />
            <span className="hidden sm:inline">Visualizar Rota</span>
            <span className="sm:hidden text-xs">({selectedAppointmentIds.length})</span>
          </Button>
        </div>
      )}

      {/* Modal de confirmação de exclusão */}
      <DeleteConfirmationDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={confirmDelete}
        title="Excluir Agendamento"
        description="Tem certeza que deseja excluir este agendamento?"
      />
    </div>
  );
}
