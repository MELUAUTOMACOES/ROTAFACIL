import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Route,
  MapPin,
  Clock,
  Navigation,
  TrendingUp,
  Filter,
  Search,
  Calendar,
  CheckSquare,
  Edit,
  Repeat2,
  Loader2,
} from "lucide-react";
import type {
  Appointment,
  Client,
  Service,
  Technician,
  Team,
  User,
} from "@shared/schema";
import { getPlanLimits } from "@shared/plan-limits";
import AppointmentForm from "@/components/forms/AppointmentForm";

interface OptimizedRoute {
  optimizedOrder: Appointment[];
  totalDistance: number;
  estimatedTime: number;
  geojson?: any;
  routeSteps?: RouteStep[];
  matrixDurations?: number[][];
  matrixDistances?: number[][];
  tspOrder?: number[];
  startAddress?: string;
  startToFirstDistance?: string;
  startToFirstDuration?: string;
}

interface RouteStep {
  appointmentIndex: number;
  distance: string;
  duration: string;
  distanceMeters: number;
  durationSeconds: number;
}

async function geocodeEndereco(endereco: string) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(endereco)}&format=json&limit=1`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "RotaFacilDev/1.0 (seuemail@dominio.com)",
    },
  });
  const data = await res.json();
  if (data && data.length) {
    return {
      lat: parseFloat(data[0].lat),
      lon: parseFloat(data[0].lon),
    };
  }
  throw new Error("Endereço não encontrado: " + endereco);
}

// Função de geocodificação com fallbacks para endereço de início
async function geocodeComFallbacks(entity: any, businessRules: any) {
  console.log(
    "🔍 Iniciando geocodificação com fallbacks para entidade:",
    entity?.name || "Não definida",
  );

  // Se há entidade (técnico ou equipe), verificar se tem endereço de início próprio
  if (entity) {
    const hasOwnStartAddress =
      entity.enderecoInicioCep &&
      entity.enderecoInicioLogradouro &&
      entity.enderecoInicioBairro &&
      entity.enderecoInicioCidade &&
      entity.enderecoInicioEstado;

    if (hasOwnStartAddress) {
      console.log("🏠 Entidade tem endereço próprio, tentando fallbacks...");

      const tentativas = [
        // Endereço completo
        [
          entity.enderecoInicioLogradouro,
          entity.enderecoInicioNumero,
          entity.enderecoInicioBairro,
          entity.enderecoInicioCidade,
          entity.enderecoInicioCep,
          entity.enderecoInicioEstado,
          "Brasil",
        ]
          .filter(Boolean)
          .join(", "),
        // Sem número
        [
          entity.enderecoInicioLogradouro,
          entity.enderecoInicioBairro,
          entity.enderecoInicioCidade,
          entity.enderecoInicioCep,
          entity.enderecoInicioEstado,
          "Brasil",
        ]
          .filter(Boolean)
          .join(", "),
        // Só CEP, Cidade, Estado, Brasil
        [
          entity.enderecoInicioCep,
          entity.enderecoInicioCidade,
          entity.enderecoInicioEstado,
          "Brasil",
        ]
          .filter(Boolean)
          .join(", "),
      ];

      for (let i = 0; i < tentativas.length; i++) {
        const endereco = tentativas[i];
        if (!endereco) continue;

        console.log(`🔄 Tentativa ${i + 1}: ${endereco}`);

        try {
          const result = await geocodeEndereco(endereco);
          console.log(`✅ Sucesso na tentativa ${i + 1}:`, result);
          return result;
        } catch (error: any) {
          console.log(`❌ Falhou tentativa ${i + 1}:`, error.message);
        }
      }
    }
  }

  // Fallback: endereço da empresa
  if (businessRules) {
    console.log("🏢 Tentando endereço da empresa como fallback...");

    const tentativasEmpresa = [
      // Endereço completo da empresa
      [
        businessRules.enderecoEmpresaLogradouro,
        businessRules.enderecoEmpresaNumero,
        businessRules.enderecoEmpresaBairro,
        businessRules.enderecoEmpresaCidade,
        businessRules.enderecoEmpresaCep,
        businessRules.enderecoEmpresaEstado,
        "Brasil",
      ]
        .filter(Boolean)
        .join(", "),
      // Sem número da empresa
      [
        businessRules.enderecoEmpresaLogradouro,
        businessRules.enderecoEmpresaBairro,
        businessRules.enderecoEmpresaCidade,
        businessRules.enderecoEmpresaCep,
        businessRules.enderecoEmpresaEstado,
        "Brasil",
      ]
        .filter(Boolean)
        .join(", "),
      // Só CEP, Cidade, Estado, Brasil da empresa
      [
        businessRules.enderecoEmpresaCep,
        businessRules.enderecoEmpresaCidade,
        businessRules.enderecoEmpresaEstado,
        "Brasil",
      ]
        .filter(Boolean)
        .join(", "),
    ];

    for (let i = 0; i < tentativasEmpresa.length; i++) {
      const endereco = tentativasEmpresa[i];
      if (!endereco) continue;

      console.log(`🔄 Tentativa empresa ${i + 1}: ${endereco}`);

      try {
        const result = await geocodeEndereco(endereco);
        console.log(`✅ Sucesso na tentativa empresa ${i + 1}:`, result);
        return result;
      } catch (error: any) {
        console.log(`❌ Falhou tentativa empresa ${i + 1}:`, error.message);
      }
    }
  }

  throw new Error(
    "Não foi possível encontrar o endereço de início. Ajuste o endereço da equipe/técnico ou da empresa.",
  );
}

// Função para calcular rota usando OSRM
async function calcularRotaOsrm(coordenadas: { lat: number; lon: number }[]) {
  if (coordenadas.length < 2) {
    throw new Error(
      "São necessárias pelo menos 2 coordenadas para calcular uma rota",
    );
  }

  const pontos = coordenadas
    .map((coord) => `${coord.lon},${coord.lat}`)
    .join(";");
  const url = `/api/route?coords=${encodeURIComponent(pontos)}`;

  console.log("🚗 Chamando PROXY OSRM:", url);
  console.log("📍 Coordenadas enviadas:", coordenadas);

  const res = await fetch(url);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Erro OSRM: Status ${res.status}. Resposta: ${text.substring(0, 100)}...`,
    );
  }
  return res.json();
}

export default function Routes() {
  const [selectedAppointments, setSelectedAppointments] = useState<number[]>(
    [],
  );
  const [optimizedRoute, setOptimizedRoute] = useState<OptimizedRoute | null>(
    null,
  );
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedService, setSelectedService] = useState<string>("");
  const [selectedTechnician, setSelectedTechnician] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [editingAppointment, setEditingAppointment] =
    useState<Appointment | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState<boolean>(false);
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);
  const [terminarNoPontoInicial, setTerminarNoPontoInicial] =
    useState<boolean>(false);
  const { toast } = useToast();

  // Monitor fullscreen changes and DOM state
  useEffect(() => {
    const handleFullscreenChange = () => {
      const fullscreenElement =
        document.fullscreenElement || (document as any).webkitFullscreenElement;
      const isNowFullscreen = !!fullscreenElement;
      console.log("🖼️ [DEBUG] Fullscreen changed:", isNowFullscreen);
      setIsFullscreen(isNowFullscreen);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);

    // Check initial fullscreen state
    handleFullscreenChange();

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener(
        "webkitfullscreenchange",
        handleFullscreenChange,
      );
    };
  }, []);

  // Log component mount and render state
  useEffect(() => {
    console.log("🔄 [DEBUG] Routes component mounted/updated");
    console.log(
      "🔄 [DEBUG] Selected appointments:",
      selectedAppointments.length,
    );
    console.log("🔄 [DEBUG] Optimized route:", !!optimizedRoute);
    console.log("🔄 [DEBUG] Is fullscreen:", isFullscreen);
  });

  // Fetch user data to get plan information
  const { data: user } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const response = await fetch("/api/auth/me", {
        headers: getAuthHeaders(),
      });
      return response.json();
    },
  });

  const { data: appointments = [] } = useQuery({
    queryKey: ["/api/appointments"],
    queryFn: async () => {
      const response = await fetch("/api/appointments", {
        headers: getAuthHeaders(),
      });
      return response.json();
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

  // Query para buscar regras de negócio (endereço da empresa)
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

  const optimizeRouteMutation = useMutation({
    mutationFn: async (appointmentIds: number[]): Promise<OptimizedRoute> => {
      if (appointmentIds.length === 0) {
        throw new Error(
          "Selecione pelo menos um agendamento para otimizar a rota",
        );
      }

      try {
        const response = await fetch("/api/gerar-rota", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
          body: JSON.stringify({ appointmentIds }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return data as OptimizedRoute;
      } catch (error) {
        console.error("Erro ao otimizar rota:", error);
        throw error;
      }
    },
    onSuccess: (data: OptimizedRoute) => {
      setOptimizedRoute(data);
      toast({
        title: "Rota otimizada com sucesso!",
        description: `Rota gerada com ${data.optimizedOrder.length} paradas`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao otimizar rota",
        variant: "destructive",
      });
    },
  });

  const handleAppointmentToggle = (appointmentId: number) => {
    setSelectedAppointments((prev) =>
      prev.includes(appointmentId)
        ? prev.filter((id) => id !== appointmentId)
        : [...prev, appointmentId],
    );
  };

  // Handle select all appointments with plan limits
  const handleSelectAllAppointments = () => {
    console.log("📋 [DEBUG] handleSelectAllAppointments chamado");

    if (!user) {
      console.log("❌ [DEBUG] Dados do usuário não carregados");
      return;
    }

    const planLimits = getPlanLimits(user.plan);

    // Get all filtered appointments as a flat array
    const allFilteredAppointments: Appointment[] = [];
    for (const dayAppointments of Object.values(
      filteredAndGroupedAppointments,
    )) {
      allFilteredAppointments.push(...(dayAppointments as Appointment[]));
    }
    const availableAppointmentIds = allFilteredAppointments.map(
      (apt: Appointment) => apt.id,
    );

    console.log(
      "📋 [DEBUG] Total de agendamentos filtrados:",
      availableAppointmentIds.length,
    );
    console.log("📋 [DEBUG] Plano do usuário:", user.plan);
    console.log(
      "📋 [DEBUG] Limite máximo do plano:",
      planLimits.maxRouteAddresses,
    );
    console.log(
      "📋 [DEBUG] Agendamentos atualmente selecionados:",
      selectedAppointments,
    );

    if (availableAppointmentIds.length === 0) {
      toast({
        title: "Atenção",
        description: "Nenhum agendamento encontrado com os filtros aplicados",
        variant: "destructive",
      });
      return;
    }

    // Verificar se todos os agendamentos disponíveis já estão selecionados
    const maxToSelect = Math.min(
      availableAppointmentIds.length,
      planLimits.maxRouteAddresses,
    );
    const appointmentsToSelect = availableAppointmentIds.slice(0, maxToSelect);
    const allSelected = appointmentsToSelect.every((id) =>
      selectedAppointments.includes(id),
    );

    if (allSelected && selectedAppointments.length > 0) {
      // Desmarcar todos
      console.log("📋 [DEBUG] Desmarcando todos os agendamentos");
      setSelectedAppointments([]);
      toast({
        title: "Agendamentos Desmarcados",
        description: "Todos os agendamentos foram desmarcados",
        variant: "default",
      });
    } else {
      // Selecionar todos (até o limite do plano)
      console.log(
        "📋 [DEBUG] Selecionando agendamentos:",
        appointmentsToSelect.length,
      );
      console.log("📋 [DEBUG] IDs selecionados:", appointmentsToSelect);

      setSelectedAppointments(appointmentsToSelect);

      // Show message if limit was reached
      if (availableAppointmentIds.length > planLimits.maxRouteAddresses) {
        toast({
          title: "Limite do Plano Atingido",
          description: `Foram selecionados apenas ${maxToSelect} agendamentos devido ao limite do seu plano. Para aumentar seu limite, faça upgrade do plano.`,
          variant: "default",
        });
        console.log(
          "⚠️ [DEBUG] Limite do plano atingido, mostrando mensagem para o usuário",
        );
      } else {
        toast({
          title: "Agendamentos Selecionados",
          description: `${appointmentsToSelect.length} agendamentos foram selecionados`,
          variant: "default",
        });
      }
    }
  };

  // Handle edit appointment
  const handleEditAppointment = (appointment: Appointment) => {
    console.log("✏️ [DEBUG] Abrindo edição para agendamento:", appointment.id);
    console.log("✏️ [DEBUG] Dados do agendamento:", appointment);
    setEditingAppointment(appointment);
    setIsEditDialogOpen(true);
  };

  const handleCloseEditDialog = () => {
    console.log("✏️ [DEBUG] Fechando diálogo de edição");
    setEditingAppointment(null);
    setIsEditDialogOpen(false);
  };

  const queryClient = useQueryClient();

  const handleAppointmentUpdated = () => {
    console.log("✅ [DEBUG] Agendamento atualizado com sucesso");
    handleCloseEditDialog();

    // Invalidate queries to refresh data
    queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });

    toast({
      title: "Agendamento Atualizado",
      description:
        "O agendamento foi atualizado com sucesso na tela de roteirização",
      variant: "default",
    });
  };

  // Função para determinar o endereço de início correto (incluindo CEP)
  const getStartAddress = (appointment: Appointment) => {
    let entity = null;

    if (appointment.technicianId) {
      entity = technicians.find(
        (t: Technician) => t.id === appointment.technicianId,
      );
    } else if (appointment.teamId) {
      entity = teams.find((t: Team) => t.id === appointment.teamId);
    }

    // Se há entidade (técnico ou equipe), verificar se tem endereço de início próprio
    if (entity) {
      const hasOwnStartAddress =
        entity.enderecoInicioCep &&
        entity.enderecoInicioLogradouro &&
        entity.enderecoInicioBairro &&
        entity.enderecoInicioCidade &&
        entity.enderecoInicioEstado;

      if (hasOwnStartAddress) {
        const numero = entity.enderecoInicioNumero
          ? `, ${entity.enderecoInicioNumero}`
          : "";
        const complemento = entity.enderecoInicioComplemento
          ? `, ${entity.enderecoInicioComplemento}`
          : "";
        // Inclui o CEP na montagem do endereço
        return `${entity.enderecoInicioLogradouro}${numero}${complemento}, ${entity.enderecoInicioBairro}, ${entity.enderecoInicioCidade}, ${entity.enderecoInicioCep}, ${entity.enderecoInicioEstado}, Brasil`;
      }
    }

    // Usar endereço da empresa como fallback
    if (businessRules) {
      const numero = businessRules.enderecoEmpresaNumero
        ? `, ${businessRules.enderecoEmpresaNumero}`
        : "";
      const complemento = businessRules.enderecoEmpresaComplemento
        ? `, ${businessRules.enderecoEmpresaComplemento}`
        : "";
      // Inclui o CEP na montagem do endereço
      return `${businessRules.enderecoEmpresaLogradouro}${numero}${complemento}, ${businessRules.enderecoEmpresaBairro}, ${businessRules.enderecoEmpresaCidade}, ${businessRules.enderecoEmpresaCep}, ${businessRules.enderecoEmpresaEstado}, Brasil`;
    }

    throw new Error(
      "Endereço de início não configurado - configure o endereço da empresa nas Regras de Negócio",
    );
  };

  const handleOptimizeRoute = async () => {
    if (selectedAppointments.length === 0) {
      toast({
        title: "Atenção",
        description: "Selecione pelo menos um agendamento para otimizar a rota",
        variant: "destructive",
      });
      return;
    }

    setIsOptimizing(true);

    try {
      console.log("🚀 Iniciando otimização de rota...");

      // 1. Verificar se dados necessários estão carregados
      if (!businessRules) {
        throw new Error(
          "Regras de negócio não carregadas - endereço da empresa necessário",
        );
      }

      // 2. Pegue os agendamentos selecionados completos
      const selecionados = appointments.filter((apt: Appointment) =>
        selectedAppointments.includes(apt.id),
      );
      console.log("📋 Agendamentos selecionados:", selecionados.length);

      // 3. Determinar entidade (técnico ou equipe) para o primeiro agendamento
      const firstAppointment = selecionados[0];
      let entity = null;

      if (firstAppointment.technicianId) {
        entity = technicians.find(
          (t: Technician) => t.id === firstAppointment.technicianId,
        );
      } else if (firstAppointment.teamId) {
        entity = teams.find((t: Team) => t.id === firstAppointment.teamId);
      }

      console.log("👤 Entidade determinada:", entity?.name || "Nenhuma");

      // 4. Validar campos obrigatórios para geocodificação de destinos
      console.log("🔍 Validando campos obrigatórios dos destinos...");
      for (let i = 0; i < selecionados.length; i++) {
        const apt = selecionados[i];
        const cliente = getClient(apt.clientId);

        // Verificar campos obrigatórios para geocodificação robusta
        if (!apt.bairro) {
          throw new Error(
            `Agendamento ${i + 1} (${cliente?.name || "Cliente desconhecido"}): Campo BAIRRO é obrigatório para geocodificação. Configure no agendamento.`,
          );
        }
        if (!apt.cidade) {
          throw new Error(
            `Agendamento ${i + 1} (${cliente?.name || "Cliente desconhecido"}): Campo CIDADE é obrigatório para geocodificação. Configure no agendamento.`,
          );
        }
        if (!apt.logradouro) {
          throw new Error(
            `Agendamento ${i + 1} (${cliente?.name || "Cliente desconhecido"}): Campo LOGRADOURO é obrigatório para geocodificação. Configure no agendamento.`,
          );
        }
      }

      // 5. Monte o endereço COMPLETO para cada agendamento
      const enderecosDestino = selecionados.map((apt: Appointment) => {
        // Montar endereço completo: logradouro, numero, bairro, cidade, cep, estado, Brasil
        const endereco = [
          apt.logradouro,
          apt.numero,
          apt.bairro,
          apt.cidade,
          apt.cep,
          "PR", // Estado padrão PR
          "Brasil",
        ]
          .filter(Boolean)
          .join(", ");

        return endereco;
      });

      // 6. Geocodificar endereço de início com fallbacks
      console.log("🌍 Geocodificando endereço de início com fallbacks...");
      const coordenadaInicio = await geocodeComFallbacks(entity, businessRules);
      console.log("✅ Coordenada de início:", coordenadaInicio);

      // Capturar endereço de início formatado para exibição
      const enderecoInicioFormatado = getStartAddress(selecionados[0]);

      // 7. Geocodificar todos os destinos com logs detalhados
      console.log("🌍 Geocodificando destinos...");
      const coordenadasDestino = [];
      for (let i = 0; i < enderecosDestino.length; i++) {
        const endereco = enderecosDestino[i];
        const cliente = getClient(selecionados[i].clientId);

        console.log(`📍 Endereço para geocodificação:`, endereco);

        try {
          const coord = await geocodeEndereco(endereco);
          coordenadasDestino.push(coord);
          console.log(`✅ Coordenada encontrada:`, endereco, coord);
          console.log(
            `✅ Destino ${i + 1} (${cliente?.name || "Desconhecido"}) geocodificado:`,
            coord,
          );
        } catch (error: any) {
          console.warn(`❌ Geocodificação FALHOU para:`, endereco);
          console.error(
            `❌ Erro ao geocodificar destino ${i + 1} (${cliente?.name || "Desconhecido"}):`,
            endereco,
            error,
          );
          throw new Error(
            `Erro ao geocodificar endereço: ${endereco}. ${error.message || error}`,
          );
        }
      }

      // 8. Montar array final de coordenadas (início + destinos)
      const todasCoordenadas = [coordenadaInicio, ...coordenadasDestino];
      console.log("📍 Todas as coordenadas para otimização:", todasCoordenadas);

      // 9. Validar que temos pelo menos 2 pontos
      if (todasCoordenadas.length < 2) {
        throw new Error(
          "São necessárias pelo menos 2 coordenadas (início + 1 destino) para otimizar uma rota",
        );
      }

      // 10. Montar array de coordenadas no formato [lon, lat]
      const coordsArray = todasCoordenadas.map((coord) => [
        coord.lon,
        coord.lat,
      ]);
      console.log("📍 Coordenadas formatadas para backend:", coordsArray);

      // 11. Chama backend para gerar matriz de durações
      console.log("🎯 Enviando coordenadas para /api/rota/matrix...");
      const matrixRes = await fetch("/api/rota/matrix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coords: coordsArray }),
      });
      if (!matrixRes.ok) {
        const errorText = await matrixRes.text();
        throw new Error("Erro ao calcular matriz: " + errorText);
      }
      const matrixData = await matrixRes.json();
      console.log("✅ Matriz de durações recebida:", matrixData);

      // 12. Resolve TSP (ordem ótima)
      console.log("🧠 Enviando matriz para /api/rota/tsp...");
      const tspRes = await fetch("/api/rota/tsp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matrix: matrixData.matrix,
          terminarNoPontoInicial, // este campo novo!
        }),
      });
      if (!tspRes.ok) {
        const errorText = await tspRes.text();
        throw new Error("Erro ao otimizar rota: " + errorText);
      }
      const tspData = await tspRes.json();
      console.log("✅ Ordem otimizada recebida:", tspData);

      // 13. Aplica a ordem ao array de agendamentos
      const agendamentosOtimizados = tspData.order
        .filter((idx: number) => idx > 0)
        .map((idx: number) => selecionados[idx - 1]); // -1 porque selecionados[0] corresponde ao destino 1

      console.log(
        "📋 Agendamentos reordenados conforme otimização:",
        agendamentosOtimizados.length,
      );

      // 14. Calcular tempo e distância exatos usando as matrizes OSRM
      const matrixDurations = matrixData.durations || matrixData.matrix; // fallback para compatibilidade
      const matrixDistances = matrixData.distances;
      const tspOrder = tspData.order;

      let totalTime = 0;
      let totalDistance = 0;
      const routeSteps: RouteStep[] = [];

      console.log("🧮 Calculando tempos e distâncias exatos...");
      console.log("Ordem TSP:", tspOrder);
      console.log("Matriz durações:", matrixDurations);
      console.log("Matriz distâncias:", matrixDistances);

      // Incluir trecho do início (índice 0) até o primeiro ponto na soma total
      if (tspOrder.length > 1) {
        const startToFirstTimeSec = matrixDurations[0][tspOrder[1]];
        const startToFirstDistM = matrixDistances
          ? matrixDistances[0][tspOrder[1]]
          : 0;

        totalTime += startToFirstTimeSec;
        totalDistance += startToFirstDistM;

        console.log(
          `📍 Início até primeiro ponto incluído nos totais: ${(startToFirstDistM / 1000).toFixed(1)} km / ${Math.round(startToFirstTimeSec / 60)} min`,
        );
      }

      // Calcular para cada trecho da rota otimizada (entre os pontos da sequência)
      for (let i = 1; i < tspOrder.length; i++) {
        const from = tspOrder[i - 1];
        const to = tspOrder[i];

        const timeSec = matrixDurations[from][to];
        const distM = matrixDistances ? matrixDistances[from][to] : 0;

        totalTime += timeSec;
        totalDistance += distM;

        // Formatar para exibição
        const distanceKm = distM > 0 ? (distM / 1000).toFixed(1) + " km" : "—";
        const durationMin =
          timeSec > 0 ? Math.round(timeSec / 60) + " min" : "—";

        routeSteps.push({
          appointmentIndex: i - 1, // índice no array agendamentosOtimizados
          distance: distanceKm,
          duration: durationMin,
          distanceMeters: distM,
          durationSeconds: timeSec,
        });

        console.log(
          `📍 Trecho ${i}: de ${from} para ${to} = ${distanceKm} / ${durationMin}`,
        );
      }

      // Formatar totais
      const totalTimeFormatted =
        totalTime > 0
          ? `${Math.floor(totalTime / 3600)}h ${Math.round((totalTime % 3600) / 60)}min`
          : "0min";

      const totalDistanceFormatted =
        totalDistance > 0 ? (totalDistance / 1000).toFixed(1) : "0";

      // Calcular distância e tempo do início ao primeiro ponto
      const firstPointIndex = tspOrder.length > 1 ? tspOrder[1] : null;
      let startToFirstDistance = "—";
      let startToFirstDuration = "—";

      if (firstPointIndex !== null) {
        const startToFirstTimeSec = matrixDurations[0][firstPointIndex];
        const startToFirstDistM = matrixDistances
          ? matrixDistances[0][firstPointIndex]
          : 0;

        startToFirstDistance =
          startToFirstDistM > 0
            ? (startToFirstDistM / 1000).toFixed(1) + " km"
            : "—";
        startToFirstDuration =
          startToFirstTimeSec > 0
            ? Math.round(startToFirstTimeSec / 60) + " min"
            : "—";

        console.log(
          `📍 Início até primeiro ponto: ${startToFirstDistance} / ${startToFirstDuration}`,
        );
      }

      console.log("📊 Totais calculados:");
      console.log(`- Tempo total: ${totalTimeFormatted} (${totalTime}s)`);
      console.log(
        `- Distância total: ${totalDistanceFormatted} km (${totalDistance}m)`,
      );

      // 15. Atualize a tela com a rota otimizada!
      setOptimizedRoute({
        optimizedOrder: agendamentosOtimizados,
        totalDistance: parseFloat(totalDistanceFormatted),
        estimatedTime: Math.round(totalTime / 60), // em minutos
        geojson: null,
        routeSteps: routeSteps,
        matrixDurations: matrixDurations,
        matrixDistances: matrixDistances,
        tspOrder: tspOrder,
        startAddress: enderecoInicioFormatado,
        startToFirstDistance: startToFirstDistance,
        startToFirstDuration: startToFirstDuration,
      });

      toast({
        title: "Rota otimizada com sucesso!",
        description: `Rota calculada com ${agendamentosOtimizados.length} paradas.`,
      });

      console.log("✅ Otimização concluída com sucesso!");
    } catch (error: any) {
      console.error("❌ Erro na otimização:", error);
      toast({
        title: "Erro",
        description: `Falha ao otimizar rota: ${error.message || error}`,
        variant: "destructive",
      });
    } finally {
      setIsOptimizing(false);
    }
  };

  const getClient = (clientId: number | null) =>
    clientId ? clients.find((c: Client) => c.id === clientId) : null;
  const getService = (serviceId: number) =>
    services.find((s: Service) => s.id === serviceId);
  const getTechnician = (technicianId: number | null) =>
    technicianId
      ? technicians.find((t: Technician) => t.id === technicianId)
      : null;

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

  // Filter and organize appointments
  const filteredAndGroupedAppointments = useMemo(() => {
    let filtered = appointments.filter((apt: Appointment) => {
      // Filter by date
      const appointmentDate = new Date(apt.scheduledDate);
      const localDate = new Date(
        appointmentDate.getTime() - appointmentDate.getTimezoneOffset() * 60000,
      )
        .toISOString()
        .split("T")[0];
      if (selectedDate && localDate !== selectedDate) return false;

      // Filter by search term (client name)
      if (searchTerm) {
        const client = getClient(apt.clientId);
        if (!client?.name.toLowerCase().includes(searchTerm.toLowerCase()))
          return false;
      }

      // Filter by service
      if (selectedService && selectedService !== "all") {
        const service = getService(apt.serviceId);
        if (service?.id.toString() !== selectedService) return false;
      }

      // Filter by technician/team
      if (selectedTechnician && selectedTechnician !== "all") {
        console.log(
          `🔍 [DEBUG] Filtro aplicado - selectedTechnician: ${selectedTechnician}, apt.technicianId: ${apt.technicianId}, apt.teamId: ${apt.teamId}`,
        );

        // Verificar se é um técnico individual
        const technician = getTechnician(apt.technicianId);
        const isMatchingTechnician =
          technician?.id.toString() === selectedTechnician;

        // Verificar se é uma equipe (o valor vem como "team-{id}")
        const team = teams.find((t: any) => t.id === apt.teamId);
        const isMatchingTeam = team && selectedTechnician === `team-${team.id}`;

        console.log(
          `🔍 [DEBUG] isMatchingTechnician: ${isMatchingTechnician}, isMatchingTeam: ${isMatchingTeam}, team:`,
          team?.name,
        );

        if (!isMatchingTechnician && !isMatchingTeam) return false;
      }

      // Filter by status
      if (selectedStatus && selectedStatus !== "all") {
        console.log(
          `🔍 [DEBUG] Filtro de status aplicado - selectedStatus: ${selectedStatus}, apt.status: ${apt.status}`,
        );
        if (apt.status !== selectedStatus) {
          console.log(`🔍 [DEBUG] Agendamento ${apt.id} filtrado por status`);
          return false;
        }
      }

      return true;
    });

    // Group by date
    const grouped = filtered.reduce(
      (acc: Record<string, Appointment[]>, apt: Appointment) => {
        const date = new Date(apt.scheduledDate).toLocaleDateString("pt-BR");
        if (!acc[date]) {
          acc[date] = [];
        }
        acc[date].push(apt);
        return acc;
      },
      {} as Record<string, Appointment[]>,
    );

    // Sort appointments within each day by time
    Object.keys(grouped).forEach((date) => {
      grouped[date].sort(
        (a: Appointment, b: Appointment) =>
          new Date(a.scheduledDate).getTime() -
          new Date(b.scheduledDate).getTime(),
      );
    });

    return grouped;
  }, [
    appointments,
    selectedDate,
    searchTerm,
    selectedService,
    selectedTechnician,
    selectedStatus,
    clients,
    services,
    technicians,
  ]);

  return (
    <div className={`space-y-6 ${isFullscreen ? "min-h-screen p-4" : ""}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Roteirização</h1>
          <p className="text-gray-600">
            Otimize as rotas dos seus atendimentos técnicos
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Filter className="h-5 w-5 mr-2" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Data</label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
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
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Serviço</label>
              <Select
                value={selectedService}
                onValueChange={setSelectedService}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos os serviços" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os serviços</SelectItem>
                  {services.map((service: Service) => (
                    <SelectItem key={service.id} value={service.id.toString()}>
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
                onValueChange={setSelectedTechnician}
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
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="scheduled">Agendado</SelectItem>
                  <SelectItem value="in_progress">Em Andamento</SelectItem>
                  <SelectItem value="completed">Concluído</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Opção "Terminar no ponto inicial" */}
            <div className="col-span-full pt-4 border-t border-gray-100">
              <Card className="p-4 mb-3 border-2 border-dashed border-burnt-yellow bg-burnt-yellow/5 rounded-2xl shadow-sm">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="terminarNoPontoInicial"
                    checked={terminarNoPontoInicial}
                    onCheckedChange={(checked) =>
                      setTerminarNoPontoInicial(checked === true)
                    }
                    className="w-5 h-5 data-[state=checked]:bg-burnt-yellow data-[state=checked]:border-burnt-yellow"
                  />
                  <label
                    htmlFor="terminarNoPontoInicial"
                    className="font-medium text-base flex items-center gap-2 cursor-pointer"
                  >
                    <Repeat2 className="text-burnt-yellow w-5 h-5" />
                    Terminar no ponto inicial
                  </label>
                </div>
              </Card>

              <p className="text-xs text-gray-500 ml-1 mb-4">
                {terminarNoPontoInicial
                  ? "A rota irá terminar no mesmo local de início. Ideal para técnicos que voltam à empresa."
                  : "A rota termina no cliente mais distante. Ideal para técnicos que encerram o dia no último cliente."}
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={handleSelectAllAppointments}
                  disabled={
                    !user ||
                    Object.keys(filteredAndGroupedAppointments).length === 0
                  }
                  variant="outline"
                  className="flex-1 sm:flex-none"
                  type="button"
                >
                  <CheckSquare className="h-4 w-4 mr-2" />
                  Selecionar Todos
                </Button>

                <Button
                  onClick={handleOptimizeRoute}
                  disabled={selectedAppointments.length === 0 || isOptimizing}
                  className="bg-burnt-yellow hover:bg-burnt-yellow-dark text-white flex-1 sm:flex-none"
                  type="button"
                >
                  {isOptimizing ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  ) : (
                    <Route className="h-4 w-4 mr-2" />
                  )}
                  Otimizar Rota
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div
        className="flex gap-6 items-stretch max-h-[1200px]">
        {/* Appointments Selection */}
        <Card className="flex flex-col flex-1 w-1/2 max-h-[1200px]">
          <CardHeader className="border-b border-gray-100 flex-shrink-0">
            <CardTitle className="flex items-center">
              <MapPin className="h-5 w-5 mr-2 text-burnt-yellow" />
              Selecionar Atendimentos
            </CardTitle>
            <p className="text-sm text-gray-600">
              Escolha os atendimentos para incluir na rota (
              {selectedAppointments.length} selecionados)
            </p>
          </CardHeader>
          <CardContent className="p-6 flex flex-col flex-1 overflow-hidden">
            {Object.keys(filteredAndGroupedAppointments).length === 0 ? (
              <div className="text-center py-8 flex-1 flex flex-col justify-center min-h-[300px]">
                <Route className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">Nenhum agendamento encontrado</p>
                <p className="text-sm text-gray-500 mt-2">
                  Ajuste os filtros para ver os agendamentos disponíveis
                </p>
              </div>
            ) : (
              <div className="space-y-6 flex-1 overflow-y-auto pr-2">
                {Object.entries(filteredAndGroupedAppointments).map(
                  ([date, dayAppointments]) => (
                    <div key={date}>
                      <div className="flex items-center mb-3">
                        <Calendar className="h-4 w-4 mr-2 text-burnt-yellow" />
                        <h3 className="font-semibold text-gray-900">{date}</h3>
                        <span className="ml-2 text-sm text-gray-500">
                          ({(dayAppointments as Appointment[]).length}{" "}
                          agendamentos)
                        </span>
                      </div>
                      <div className="space-y-3 pl-6">
                        {(dayAppointments as Appointment[]).map(
                          (appointment: Appointment) => {
                            const client = getClient(appointment.clientId);
                            const service = getService(appointment.serviceId);

                            // Corrigir busca de técnico/equipe responsável
                            let responsibleInfo = {
                              name: "Responsável não atribuído",
                              type: "none",
                            };

                            if (appointment.technicianId) {
                              const technician = getTechnician(
                                appointment.technicianId,
                              );
                              responsibleInfo = {
                                name:
                                  technician?.name || "Técnico não encontrado",
                                type: "technician",
                              };
                              console.log(
                                `👤 [DEBUG] Card ${appointment.id} - Técnico:`,
                                technician?.name,
                                "ID:",
                                appointment.technicianId,
                              );
                            } else if (appointment.teamId) {
                              const team = teams.find(
                                (t: any) => t.id === appointment.teamId,
                              );
                              responsibleInfo = {
                                name: team?.name || "Equipe não encontrada",
                                type: "team",
                              };
                              console.log(
                                `👥 [DEBUG] Card ${appointment.id} - Equipe:`,
                                team?.name,
                                "ID:",
                                appointment.teamId,
                              );
                            }

                            const { time } = formatDateTime(
                              appointment.scheduledDate.toString(),
                            );
                            const isSelected = selectedAppointments.includes(
                              appointment.id,
                            );

                            return (
                              <div
                                key={appointment.id}
                                className={`relative flex items-center space-x-4 p-3 border rounded-lg transition-colors
                              ${
                                isSelected
                                  ? "border-burnt-yellow bg-burnt-yellow bg-opacity-5"
                                  : "border-gray-200 hover:bg-gray-50"
                              }`}
                              >
                                <div
                                  className="flex items-center space-x-4 flex-1 cursor-pointer"
                                  onClick={() =>
                                    handleAppointmentToggle(appointment.id)
                                  }
                                >
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() =>
                                      handleAppointmentToggle(appointment.id)
                                    }
                                    className="text-burnt-yellow"
                                  />
                                  <div className="flex-1">
                                    <div className="flex items-center justify-between mb-1">
                                      <h4 className="font-medium text-gray-900">
                                        {client?.name || "Cliente"}
                                      </h4>
                                      <span className="text-sm text-gray-500">
                                        {time}
                                      </span>
                                    </div>
                                    <p className="text-sm text-gray-600">
                                      {service?.name || "Serviço"}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      {client ? (
                                        `${client.logradouro}, ${client.numero}, ${client.bairro}, ${client.cidade} - ${client.cep}`
                                      ) : (
                                        <span className="text-red-600">
                                          Endereço não encontrado
                                        </span>
                                      )}
                                    </p>
                                    <div className="flex items-center justify-between mt-1 pr-10">
                                      <div className="flex items-center">
                                        <span className="text-xs text-gray-500">
                                          {responsibleInfo.type === "team"
                                            ? "Equipe:"
                                            : "Técnico:"}
                                        </span>
                                        <span className="text-xs font-medium text-gray-700 ml-1">
                                          {responsibleInfo.type === "team"
                                            ? "👥"
                                            : "👤"}{" "}
                                          {responsibleInfo.name}
                                        </span>
                                      </div>
                                      <Badge
                                        className={`text-xs px-2 py-1 mr-2 ${
                                          appointment.status === "completed"
                                            ? "bg-green-100 text-green-800"
                                            : appointment.status ===
                                                "in_progress"
                                              ? "bg-yellow-100 text-yellow-800"
                                              : appointment.status ===
                                                  "scheduled"
                                                ? "bg-blue-100 text-blue-800"
                                                : appointment.status ===
                                                    "cancelled"
                                                  ? "bg-red-100 text-red-800"
                                                  : "bg-gray-100 text-gray-800"
                                        }`}
                                      >
                                        {appointment.status === "completed"
                                          ? "Concluído"
                                          : appointment.status === "in_progress"
                                            ? "Em Andamento"
                                            : appointment.status === "scheduled"
                                              ? "Agendado"
                                              : appointment.status ===
                                                  "cancelled"
                                                ? "Cancelado"
                                                : appointment.status}
                                      </Badge>
                                    </div>
                                  </div>
                                </div>

                                {/* Edit Button - Posicionado para não sobrepor o status */}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="absolute bottom-2 right-2 h-6 w-6 p-0 hover:bg-burnt-yellow hover:text-white"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    console.log(
                                      "✏️ [DEBUG] Botão de edição clicado - Reposicionamento aplicado para não sobrepor status",
                                    );
                                    handleEditAppointment(appointment);
                                  }}
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                              </div>
                            );
                          },
                        )}
                      </div>
                    </div>
                  ),
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Optimized Route */}
        <Card className="flex flex-col flex-1 w-1/2 max-h-[1200px]">
          <CardHeader className="border-b border-gray-100 flex-shrink-0">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center">
                <Navigation className="h-5 w-5 mr-2 text-burnt-yellow" />
                Rota Otimizada
              </CardTitle>
              {optimizedRoute && (
                <div className="flex flex-col items-end">
                  <span className="text-sm text-gray-600">
                    Distância total:{" "}
                    <span className="text-blue-600 font-semibold">
                      {optimizedRoute.totalDistance} km
                    </span>
                  </span>
                  <span className="text-sm text-gray-600">
                    Tempo total estimado:{" "}
                    <span className="text-green-600 font-semibold">
                      {optimizedRoute.estimatedTime > 60
                        ? `${Math.floor(optimizedRoute.estimatedTime / 60)}h ${optimizedRoute.estimatedTime % 60}min`
                        : `${optimizedRoute.estimatedTime}min`}
                    </span>
                  </span>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-6 flex flex-col flex-1 overflow-hidden">
            {/* Sempre mostra o loading se isOptimizing, independente se já existe optimizedRoute */}
            {isOptimizing ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <Loader2 className="h-12 w-12 text-burnt-yellow mx-auto mb-4 animate-spin" />
                  <p className="text-lg font-medium text-gray-900 mb-2">
                    Otimizando rota, aguarde...
                  </p>
                  <p className="text-sm text-gray-500">
                    Calculando a melhor sequência de atendimentos
                  </p>
                </div>
              </div>
            ) : optimizedRoute ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Map Placeholder */}
                <div className="bg-gray-100 rounded-lg h-48 flex items-center justify-center mb-4 flex-shrink-0">
                  <div className="text-center">
                    <MapPin className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600 font-medium text-sm">
                      Mapa da rota otimizada
                    </p>
                    <p className="text-xs text-gray-500">
                      Integração com Google Maps
                    </p>
                  </div>
                </div>

                {/* Route Steps - Container com scroll */}
                <div className="flex-1 overflow-y-auto pr-2">
                  <div className="space-y-4">
                    <h4 className="font-medium text-gray-900 flex items-center">
                      <Clock className="h-4 w-4 mr-2" />
                      Sequência da Rota
                    </h4>

                  {/* Card de início da rota */}
                  {optimizedRoute.startAddress && (
                    <div className="flex items-start space-x-4 border-b border-gray-100 pb-4">
                      <div className="w-8 h-8 bg-gray-500 rounded-full flex items-center justify-center text-white font-medium text-sm flex-shrink-0">
                        📍
                      </div>
                      <div className="flex-1">
                        <h5 className="font-medium text-gray-900">
                          Início da rota
                        </h5>
                        <p className="text-sm text-gray-600">
                          {optimizedRoute.startAddress}
                        </p>
                        <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                          <span>—</span>
                          <span className="text-gray-400">—</span>
                          <span className="text-gray-400">—</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {optimizedRoute.optimizedOrder.map((appointment, index) => {
                    const client = getClient(appointment.clientId);
                    const service = getService(appointment.serviceId);
                    const { time } = formatDateTime(
                      appointment.scheduledDate.toString(),
                    );

                    // Pegar dados reais do trecho
                    let distance, duration;

                    if (index === 0) {
                      // Para o primeiro ponto, usar dados do início até ele
                      distance = optimizedRoute.startToFirstDistance || "—";
                      duration = optimizedRoute.startToFirstDuration || "—";
                    } else {
                      // Para os demais, usar dados do trecho anterior
                      const routeStep = optimizedRoute.routeSteps?.[index];
                      distance = routeStep?.distance || "—";
                      duration = routeStep?.duration || "—";
                    }

                    return (
                      <div
                        key={appointment.id}
                        className="flex items-start space-x-4"
                      >
                        <div className="w-8 h-8 bg-burnt-yellow rounded-full flex items-center justify-center text-white font-medium text-sm flex-shrink-0">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <h5 className="font-medium text-gray-900">
                            {client?.name || "Cliente"}
                          </h5>
                          <p className="text-sm text-gray-600">
                            {client.logradouro}, {client.numero},{" "}
                            {client.bairro}, {client.cidade} - {client.cep}
                          </p>
                          <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                            <span>{time}</span>
                            <span className="text-blue-600 font-medium">
                              {distance}
                            </span>
                            <span className="text-green-600 font-medium">
                              {duration}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* Route Summary */}
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">
                          Tempo total estimado:
                        </span>
                        <span className="font-medium text-green-600">
                          {optimizedRoute.estimatedTime > 60
                            ? `${Math.floor(optimizedRoute.estimatedTime / 60)}h ${optimizedRoute.estimatedTime % 60}min`
                            : `${optimizedRoute.estimatedTime}min`}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Distância total:</span>
                        <span className="font-medium text-blue-600">
                          {optimizedRoute.totalDistance} km
                        </span>
                      </div>
                      <div className="flex items-center justify-between sm:col-span-2">
                        <span className="text-gray-600">
                          Economia de combustível:
                        </span>
                        <span className="font-medium text-green-600 flex items-center">
                          <TrendingUp className="h-3 w-3 mr-1" />
                          Rota otimizada
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
            ) : (
              <div className="flex-1 flex flex-col justify-center items-center text-center py-8 min-h-[300px]">
                <Route className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">
                  Selecione agendamentos e clique em "Otimizar Rota"
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  A rota otimizada aparecerá aqui
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Appointment Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Agendamento</DialogTitle>
          </DialogHeader>
          {editingAppointment && (
            <AppointmentForm
              appointment={editingAppointment}
              clients={clients}
              services={services}
              technicians={technicians}
              teams={teams}
              onClose={handleCloseEditDialog}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
