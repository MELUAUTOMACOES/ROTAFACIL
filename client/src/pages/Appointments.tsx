import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import AppointmentForm from "@/components/forms/AppointmentForm";
import AppointmentCalendar from "@/components/AppointmentCalendar";
import { Plus, Calendar, MapPin, Clock, User, Edit, Trash2, Download, Upload, Filter, Search, List } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Appointment, Client, Service, Technician, Team } from "@shared/schema";

export default function Appointments() {
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [prefilledData, setPrefilledData] = useState<any>(null);
  
  // Estados para filtros
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedService, setSelectedService] = useState<string>("all");
  const [selectedTechnician, setSelectedTechnician] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  
  // Estado para controlar visualização (lista ou calendário)
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Logs para monitorar uso dos filtros
  useEffect(() => {
    console.log("🔍 [FILTER] Filtros aplicados:", {
      selectedDate,
      searchTerm,
      selectedService,
      selectedTechnician,
      selectedStatus
    });
  }, [selectedDate, searchTerm, selectedService, selectedTechnician, selectedStatus]);

  // Verificar parâmetros da URL ao carregar a página
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const preselected = urlParams.get('preselected');
    
    console.log("📋 [DEBUG] Appointments - Verificando parâmetros URL:", {
      preselected,
      date: urlParams.get('date'),
      cep: urlParams.get('cep'),
      numero: urlParams.get('numero'),
      serviceId: urlParams.get('serviceId'),
      technicianId: urlParams.get('technicianId'),
      teamId: urlParams.get('teamId'),
      clientId: urlParams.get('clientId')
    });
    
    if (preselected === 'true') {
      const data = {
        date: urlParams.get('date'),
        cep: urlParams.get('cep'),
        numero: urlParams.get('numero'),
        serviceId: urlParams.get('serviceId'),
        technicianId: urlParams.get('technicianId'),
        teamId: urlParams.get('teamId'),
        clientId: urlParams.get('clientId'),
      };
      
      console.log("📋 [DEBUG] Appointments - Dados processados:", data);
      
      // Verificar se todos os campos obrigatórios estão presentes
      const hasRequiredFields = data.date && data.cep && data.numero && data.serviceId && 
                               (data.technicianId || data.teamId);
      
      console.log("📋 [DEBUG] Appointments - Campos obrigatórios presentes:", hasRequiredFields);
      
      if (hasRequiredFields) {
        setPrefilledData(data);
        setIsFormOpen(true);
        
        // Limpar parâmetros da URL
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["/api/appointments"],
    queryFn: async () => {
      const response = await fetch("/api/appointments", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      return Array.isArray(data) ? data : [];
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

  const handleEdit = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setIsFormOpen(true);
  };

  const handleDelete = async (appointment: Appointment) => {
    if (confirm("Tem certeza que deseja excluir este agendamento?")) {
      deleteAppointmentMutation.mutate(appointment.id);
    }
  };

  const handleFormClose = () => {
    console.log("🧹 [DEBUG] handleFormClose - Limpando formulário");
    console.log("🧹 [DEBUG] handleFormClose - selectedAppointment antes:", selectedAppointment);
    console.log("🧹 [DEBUG] handleFormClose - prefilledData antes:", prefilledData);
    
    setIsFormOpen(false);
    setSelectedAppointment(null);
    setPrefilledData(null);
    
    console.log("🧹 [DEBUG] handleFormClose - Estado limpo - formulário deve abrir vazio na próxima vez");
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
      date: date.toLocaleDateString('pt-BR'),
      time: date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };
  };

  const getClient = (clientId: number | null) => clientId ? clients.find((c: Client) => c.id === clientId) : null;
  const getService = (serviceId: number) => services.find((s: Service) => s.id === serviceId);
  const getTechnician = (technicianId: number | null) => technicianId ? technicians.find((t: Technician) => t.id === technicianId) : null;
  const getTeam = (teamId: number | null) => teamId ? teams.find((t: Team) => t.id === teamId) : null;

  // Função para obter informações do responsável (técnico ou equipe) com logs detalhados
  const getResponsibleInfo = (appointment: Appointment) => {
    if (appointment.technicianId) {
      const technician = getTechnician(appointment.technicianId);
      console.log(`👤 [DEBUG] Agendamento ${appointment.id} - Técnico individual:`, technician?.name, "ID:", appointment.technicianId);
      return {
        type: 'technician' as const,
        name: technician?.name || "Técnico não encontrado",
        id: appointment.technicianId,
        displayName: `👤 ${technician?.name || "Técnico não encontrado"}`
      };
    } else if (appointment.teamId) {
      const team = getTeam(appointment.teamId);
      console.log(`👥 [DEBUG] Agendamento ${appointment.id} - Equipe:`, team?.name, "ID:", appointment.teamId);
      return {
        type: 'team' as const,
        name: team?.name || "Equipe não encontrada",
        id: appointment.teamId,
        displayName: `👥 ${team?.name || "Equipe não encontrada"}`
      };
    }
    console.log(`❌ [DEBUG] Agendamento ${appointment.id} - Nenhum responsável atribuído`);
    return {
      type: 'none' as const,
      name: "Responsável não atribuído",
      id: null,
      displayName: "❌ Responsável não atribuído"
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
        const aptDate = new Date(apt.scheduledDate).toLocaleDateString('en-CA'); // YYYY-MM-DD format
        console.log(`🔍 [FILTER] Comparando datas - selectedDate: ${selectedDate}, aptDate: ${aptDate}`);
        if (aptDate !== selectedDate) {
          console.log(`🔍 [FILTER] Agendamento ${apt.id} filtrado por data`);
          return false;
        }
      }

      // Filter by client name (search term)
      if (searchTerm) {
        const client = getClient(apt.clientId);
        const clientName = client?.name?.toLowerCase() || '';
        const searchLower = searchTerm.toLowerCase();
        console.log(`🔍 [FILTER] Pesquisando "${searchTerm}" em "${clientName}"`);
        if (!clientName.includes(searchLower)) {
          console.log(`🔍 [FILTER] Agendamento ${apt.id} filtrado por busca de cliente`);
          return false;
        }
      }

      // Filter by service
      if (selectedService && selectedService !== "all") {
        console.log(`🔍 [FILTER] Filtro de serviço aplicado - selectedService: ${selectedService}, apt.serviceId: ${apt.serviceId}`);
        if (apt.serviceId.toString() !== selectedService) {
          console.log(`🔍 [FILTER] Agendamento ${apt.id} filtrado por serviço`);
          return false;
        }
      }

      // Filter by technician/team
      if (selectedTechnician && selectedTechnician !== "all") {
        console.log(`🔍 [FILTER] Filtro de técnico/equipe aplicado - selectedTechnician: ${selectedTechnician}`);
        
        // Verificar se é um técnico individual
        const technician = getTechnician(apt.technicianId);
        const isMatchingTechnician = technician?.id.toString() === selectedTechnician;
        
        // Verificar se é uma equipe (o valor vem como "team-{id}")
        const team = teams.find((t: any) => t.id === apt.teamId);
        const isMatchingTeam = team && selectedTechnician === `team-${team.id}`;
        
        console.log(`🔍 [FILTER] isMatchingTechnician: ${isMatchingTechnician}, isMatchingTeam: ${isMatchingTeam}, team:`, team?.name);
        
        if (!isMatchingTechnician && !isMatchingTeam) {
          console.log(`🔍 [FILTER] Agendamento ${apt.id} filtrado por técnico/equipe`);
          return false;
        }
      }

      // Filter by status
      if (selectedStatus && selectedStatus !== "all") {
        console.log(`🔍 [FILTER] Filtro de status aplicado - selectedStatus: ${selectedStatus}, apt.status: ${apt.status}`);
        if (apt.status !== selectedStatus) {
          console.log(`🔍 [FILTER] Agendamento ${apt.id} filtrado por status`);
          return false;
        }
      }

      return true;
    });

    console.log(`🔍 [FILTER] Resultado da filtragem: ${filtered.length} de ${appointments.length} agendamentos`);
    return filtered;
  }, [appointments, selectedDate, searchTerm, selectedService, selectedTechnician, selectedStatus, clients, services, technicians, teams]);

  const importCSVMutation = useMutation({
    mutationFn: async (appointments: any[]) => {
      const response = await apiRequest("POST", "/api/appointments/import", { appointments });
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
        const successItems = data.processedItems.filter((item: any) => item.status === 'success');
        const errorItems = data.processedItems.filter((item: any) => item.status === 'error');
        console.log(`   • Sucessos: ${successItems.length}`);
        console.log(`   • Erros: ${errorItems.length}`);
      }
      console.groupEnd();
      
      // Toast com resultado
      if (data.errors > 0) {
        const errorMessage = data.detailedErrors ? 
          data.detailedErrors.slice(0, 2).join('\n') + 
          (data.detailedErrors.length > 2 ? `\n... e mais ${data.detailedErrors.length - 2} erros` : '') : 
          `${data.errors} erros encontrados`;
          
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
            `Data/Hora: ${new Date().toLocaleString('pt-BR')}`,
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
            ...data.detailedErrors.map((error: string, index: number) => `${index + 1}. ${error}`),
          ].join('\n');

          const backendLogBlob = new Blob([backendErrorReport], { type: "text/plain;charset=utf-8;" });
          const backendLogLink = document.createElement("a");
          const backendLogUrl = URL.createObjectURL(backendLogBlob);
          backendLogLink.setAttribute("href", backendLogUrl);
          backendLogLink.setAttribute("download", `relatorio_servidor_${new Date().toISOString().split('T')[0]}_${new Date().toTimeString().split(' ')[0].replace(/:/g, '')}.txt`);
          backendLogLink.style.visibility = "hidden";
          document.body.appendChild(backendLogLink);
          
          setTimeout(() => {
            if (confirm("Deseja baixar o relatório de erros do servidor?")) {
              backendLogLink.click();
            }
            document.body.removeChild(backendLogLink);
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
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const csv = event.target?.result as string;
            const lines = csv.split('\n').filter(line => line.trim());
            
            if (lines.length < 2) {
              toast({
                title: "Erro",
                description: "Arquivo CSV deve conter pelo menos uma linha de dados",
                variant: "destructive",
              });
              return;
            }

            const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
            const appointmentsToImport = [];
            const errors = [];

            console.log("📋 [CSV IMPORT] Iniciando importação de agendamentos...");
            console.log("📋 [CSV IMPORT] Campos reconhecidos:", headers);
            console.log("📋 [CSV IMPORT] Técnicos disponíveis:", technicians.map((t: Technician) => t.name));
            console.log("📋 [CSV IMPORT] Equipes disponíveis:", teams.map((t: Team) => t.name));

            for (let i = 1; i < lines.length; i++) {
              const values = lines[i].split(',').map(v => v.replace(/"/g, '').trim());
              
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


              console.log(`📋 [CSV IMPORT] Linha ${i + 1}: Cliente=${clientName}, CPF=${cpfCliente}`);

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
                  console.log(`✅ [CSV IMPORT] Cliente encontrado pelo CPF ${cpfCliente}: ${client.name}`);
                  console.log(`📋 [CSV IMPORT] Usando dados do cliente cadastrado, ignorando dados do CSV`);
                  
                  // Usar dados do cliente cadastrado
                  finalClientName = client.name;
                  finalCep = client.cep;
                  finalLogradouro = client.logradouro;
                  finalNumero = client.numero;
                } else {
                  console.log(`🔍 [CSV IMPORT] CPF ${cpfCliente} não encontrado, criando novo cliente`);
                }
              }
              
              if (!client && clientName) {
                // Se não encontrou pelo CPF, tentar por nome como fallback
                client = clients.find((c: Client) => c.name.toLowerCase() === clientName.toLowerCase());
                
                if (client) {
                  console.log(`⚠️ [CSV IMPORT] Cliente encontrado pelo nome: ${client.name} (sem CPF fornecido)`);
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
              if (!finalClientName) validationErrors.push("Cliente não identificado (forneça nome ou CPF válido)");
              if (!serviceName) validationErrors.push("Serviço (coluna 6) está vazio");
              if (!dateTime) validationErrors.push("Data/Hora (coluna 8) está vazia");
              if (!finalCep) validationErrors.push("CEP não disponível (cliente não cadastrado)");
              if (!finalNumero) validationErrors.push("Número não disponível (cliente não cadastrado)");
              
              // Validar formato do CEP
              if (finalCep && !/^\d{5}-?\d{3}$/.test(finalCep)) {
                validationErrors.push(`CEP "${finalCep}" inválido (formato esperado: XXXXX-XXX)`);
              }
              
              // Validar se o número é numérico
              if (finalNumero && isNaN(Number(finalNumero))) {
                validationErrors.push(`Número "${finalNumero}" deve ser numérico`);
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
                  observacoes: `Cliente criado automaticamente via importação CSV em ${new Date().toLocaleString('pt-BR')}`
                };
                console.log(`🆕 [CSV IMPORT] Preparando criação de novo cliente: ${finalClientName}`);
              }

              // Encontrar serviço
              const service = services.find((s: Service) => s.name.toLowerCase() === serviceName.toLowerCase());
              if (!service) {
                errors.push(`Linha ${i + 1}: Serviço "${serviceName}" não encontrado`);
                continue;
              }

              // Encontrar técnico ou equipe
              let technician = null;
              let team = null;
              
              if (technicianName) {
                // Primeiro, procurar por técnico individual
                technician = technicians.find((t: Technician) => t.name.toLowerCase() === technicianName.toLowerCase());
                
                if (technician) {
                  console.log(`👤 [CSV IMPORT] Técnico encontrado: ${technician.name}`);
                } else {
                  // Se não encontrou técnico, procurar por equipe
                  team = teams.find((team: Team) => team.name.toLowerCase() === technicianName.toLowerCase());
                  
                  if (team) {
                    console.log(`👥 [CSV IMPORT] Equipe encontrada: ${team.name}`);
                  } else {
                    console.log(`⚠️ [CSV IMPORT] Técnico/Equipe "${technicianName}" não encontrado`);
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
                } else if (lowerPriority === "alta" || lowerPriority === "high") {
                  normalizedPriority = "high";
                } else if (lowerPriority === "urgente" || lowerPriority === "urgent") {
                  normalizedPriority = "urgent";
                } else {
                  errors.push(`Linha ${i + 1}: Prioridade "${priorityValue}" inválida. Use: Normal, Alta ou Urgente`);
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
                }
                else {
                  dateObj = new Date(dateTime);
                }
                
                if (isNaN(dateObj.getTime())) {
                  throw new Error("Data inválida");
                }
                
                // Verificar se a data não é muito antiga (antes de 2020) ou muito futura (depois de 2030)
                const year = dateObj.getFullYear();
                if (year < 2020 || year > 2030) {
                  errors.push(`Linha ${i + 1}: Data "${dateTime}" fora do intervalo válido (2020-2030)`);
                  continue;
                }
                
                scheduledDate = dateObj.toISOString();
              } catch {
                errors.push(`Linha ${i + 1}: Data/hora "${dateTime}" inválida. Formatos aceitos: YYYY-MM-DD HH:MM, DD/MM/YYYY HH:MM`);
                continue;
              }

              // Mapear status em português para valores do sistema
              let finalStatus = "scheduled"; // padrão
              const statusInput = (values[8] || "").trim();
              
              console.log(`🔄 [CSV IMPORT] Status recebido da linha ${i + 1}: "${statusInput}"`);
              
              if (statusInput) {
                const statusLower = statusInput.toLowerCase()
                  .normalize('NFD')
                  .replace(/[\u0300-\u036f]/g, ''); // remove acentos
                
                const statusMap: { [key: string]: string } = {
                  'agendado': 'scheduled',
                  'em andamento': 'in_progress', 
                  'em-andamento': 'in_progress',
                  'emandamento': 'in_progress',
                  'concluido': 'completed',
                  'concluído': 'completed',
                  'cancelado': 'cancelled',
                  // Manter compatibilidade com inglês
                  'scheduled': 'scheduled',
                  'in_progress': 'in_progress',
                  'completed': 'completed',
                  'cancelled': 'cancelled'
                };
                
                if (statusMap[statusLower]) {
                  finalStatus = statusMap[statusLower];
                  console.log(`✅ [CSV IMPORT] Status "${statusInput}" mapeado para: ${finalStatus}`);
                } else {
                  errors.push(`Linha ${i + 1}: Status "${statusInput}" inválido. Valores aceitos: Agendado, Em Andamento, Concluído, Cancelado`);
                  console.log(`❌ [CSV IMPORT] Status inválido na linha ${i + 1}: "${statusInput}"`);
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
                bairro: client ? client.bairro : (bairro || ""),
                cidade: client ? client.cidade : (cidade || ""),
                logradouro: finalLogradouro,
                numero: finalNumero,
                complemento,
                notes
              };
              
              console.log(`📋 [CSV IMPORT] Agendamento preparado - Linha ${i + 1}:`, {
                technicianId: appointmentData.technicianId,
                teamId: appointmentData.teamId,
                serviceId: appointmentData.serviceId,
                clientId: appointmentData.clientId
              });
              
              appointmentsToImport.push(appointmentData);
            }

            if (errors.length > 0) {
              // Criar um relatório detalhado de erros
              const errorReport = {
                totalLines: lines.length - 1,
                validAppointments: appointmentsToImport.length,
                errorCount: errors.length,
                errors: errors
              };

              // Mostrar primeiros 3 erros no toast
              const shortErrorMessage = errors.slice(0, 3).join('\n') + 
                (errors.length > 3 ? `\n... e mais ${errors.length - 3} erros` : '');
              
              toast({
                title: `${errors.length} erros encontrados na importação`,
                description: shortErrorMessage,
                variant: "destructive",
              });
              
              // Log detalhado no console
              console.group("📋 RELATÓRIO DETALHADO DE IMPORTAÇÃO CSV");
              console.log(`📊 Resumo:`);
              console.log(`   • Total de linhas processadas: ${errorReport.totalLines}`);
              console.log(`   • Agendamentos válidos: ${errorReport.validAppointments}`);
              console.log(`   • Erros encontrados: ${errorReport.errorCount}`);
              console.log(`   • Taxa de sucesso: ${((errorReport.validAppointments / errorReport.totalLines) * 100).toFixed(1)}%`);
              console.log("\n📝 LISTA COMPLETA DE ERROS:");
              errorReport.errors.forEach((error, index) => {
                console.log(`   ${index + 1}. ${error}`);
              });
              console.log("\n💡 DICAS PARA CORREÇÃO:");
              console.log("   • Verifique se os nomes de clientes, serviços e técnicos estão exatamente como cadastrados");
              console.log("   • Formato de data aceito: YYYY-MM-DD HH:MM:SS ou DD/MM/YYYY HH:MM");
              console.log("   • CEP deve estar no formato XXXXX-XXX");
              console.log("   • Campos obrigatórios não podem estar vazios");
              console.log("\n📋 ORDEM DOS CAMPOS NO CSV:");
              console.log("   1. Cliente | 2. CPF Cliente | 3. Email Cliente | 4. Telefone 1 | 5. Telefone 2");
              console.log("   6. Serviço | 7. Técnico | 8. Data/Hora | 9. Status | 10. Prioridade");
              console.log("   11. CEP | 12. Logradouro | 13. Número | 14. Complemento | 15. Observações");
              console.groupEnd();

              // Criar arquivo de log para download
              const logContent = [
                "RELATÓRIO DE ERROS - IMPORTAÇÃO CSV",
                "=" + "=".repeat(40),
                "",
                `Data/Hora: ${new Date().toLocaleString('pt-BR')}`,
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
                ...errorReport.errors.map((error, index) => `${index + 1}. ${error}`),
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
                "OBSERVAÇÃO: Use o botão 'Baixar CSV Modelo' para obter um arquivo com a estrutura correta."
              ].join('\n');

              const logBlob = new Blob([logContent], { type: "text/plain;charset=utf-8;" });
              const logLink = document.createElement("a");
              const logUrl = URL.createObjectURL(logBlob);
              logLink.setAttribute("href", logUrl);
              logLink.setAttribute("download", `relatorio_erros_${new Date().toISOString().split('T')[0]}_${new Date().toTimeString().split(' ')[0].replace(/:/g, '')}.txt`);
              logLink.style.visibility = "hidden";
              document.body.appendChild(logLink);
              
              // Perguntar se o usuário quer baixar o relatório
              setTimeout(() => {
                if (confirm("Deseja baixar um relatório detalhado dos erros encontrados?")) {
                  logLink.click();
                }
                document.body.removeChild(logLink);
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
      "Bairro",      // NOVO
      "Cidade",      // NOVO
      "Logradouro", 
      "Número",
      "Complemento",
      "Observações"
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
      "Portão",     // EXEMPLO
      "Curitiba",   // EXEMPLO
      "Rua das Flores",
      "123",
      "Apto 45",
      "Cliente preferencial"
    ];

    const csvContent = [templateHeaders, exampleRow]
      .map(row => row.map(field => `"${field}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "modelo_importacao_agendamentos.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

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
    "Bairro",         // NOVO
    "Cidade",         // NOVO
    "Logradouro",
    "Número",
    "Complemento",
    "Observações"
  ];

  const csvData = appointments.map((appointment: Appointment) => {
    const client = getClient(appointment.clientId);
    const service = getService(appointment.serviceId);
    const technician = getTechnician(appointment.technicianId);
    const { date, time } = formatDateTime(appointment.scheduledDate.toString());

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
      appointment.bairro || "",       // NOVO
      appointment.cidade || "",       // NOVO
      appointment.logradouro,
      appointment.numero,
      appointment.complemento || "",
      appointment.notes || ""
    ];
  });

    const csvContent = [csvHeaders, ...csvData]
      .map((row: any[]) => row.map((field: any) => `"${field}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `agendamentos_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

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
              console.log("🆕 [DEBUG] Novo Agendamento - Limpando selectedAppointment e prefilledData");
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
                  <label className="text-sm font-medium mb-2 block">Buscar Cliente</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Nome do cliente..."
                      value={searchTerm}
                      onChange={(e) => {
                        console.log("🔍 [FILTER] Busca alterada:", e.target.value);
                        setSearchTerm(e.target.value);
                      }}
                      className="pl-10"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">Serviço</label>
                  <Select value={selectedService} onValueChange={(value) => {
                    console.log("🔍 [FILTER] Serviço alterado:", value);
                    setSelectedService(value);
                  }}>
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
                  <label className="text-sm font-medium mb-2 block">Técnicos/Equipes</label>
                  <Select value={selectedTechnician} onValueChange={(value) => {
                    console.log("🔍 [FILTER] Técnico/Equipe alterado:", value);
                    setSelectedTechnician(value);
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os técnicos e equipes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os técnicos e equipes</SelectItem>
                      {technicians.map((technician: Technician) => (
                        <SelectItem key={`tech-${technician.id}`} value={technician.id.toString()}>
                          👤 {technician.name}
                        </SelectItem>
                      ))}
                      {teams.map((team: any) => (
                        <SelectItem key={`team-${team.id}`} value={`team-${team.id}`}>
                          👥 {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">Status</label>
                  <Select value={selectedStatus} onValueChange={(value) => {
                    console.log("🔍 [FILTER] Status alterado:", value);
                    setSelectedStatus(value);
                  }}>
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
              </div>

              {/* View Mode Toggle and Clear Filters */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pt-4 border-t border-gray-100">
                {/* View Mode Toggle */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <span className="text-sm font-medium text-gray-700">Modo de Visualização:</span>
                  <div className="bg-white border border-gray-200 rounded p-0.5 shadow-sm w-full max-w-sm sm:w-auto">
                    <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as "list" | "calendar")} className="w-full">
                      <TabsList className="grid w-full grid-cols-2 h-auto sm:h-8 bg-gray-50 p-0 gap-1 sm:gap-0">
                        <TabsTrigger 
                          value="list" 
                          className="flex items-center justify-center gap-2 py-2 px-3 sm:py-1 sm:px-3 text-sm font-medium rounded border shadow-none data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-burnt-yellow data-[state=active]:border-burnt-yellow w-full"
                        >
                          <List className="h-4 w-4" />
                          <span className="text-sm sm:text-xs">Lista</span>
                        </TabsTrigger>
                        <TabsTrigger 
                          value="calendar" 
                          className="flex items-center justify-center gap-2 py-2 px-3 sm:py-1 sm:px-3 text-sm font-medium rounded border shadow-none data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-burnt-yellow data-[state=active]:border-burnt-yellow w-full"
                        >
                          <Calendar className="h-4 w-4" />
                          <span className="text-sm sm:text-xs">Calendário</span>
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                </div>
                
                {/* Clear Filters Button */}
                <Button 
                  onClick={() => {
                    console.log("🔍 [FILTER] Limpando todos os filtros");
                    setSelectedDate("");
                    setSearchTerm("");
                    setSelectedService("all");
                    setSelectedTechnician("all");
                    setSelectedStatus("all");
                  }}
                  variant="outline"
                  className="w-full sm:w-auto"
                  type="button"
                >
                  Limpar Filtros
                </Button>
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
                {appointments.length === 0 ? "Nenhum agendamento encontrado" : "Nenhum agendamento encontrado com os filtros aplicados"}
              </h3>
              <p className="text-gray-600 text-center mb-6">
                {appointments.length === 0 
                  ? "Comece criando seu primeiro agendamento para organizar seus atendimentos técnicos."
                  : "Tente ajustar os filtros ou limpar todos os filtros para ver mais agendamentos."
                }
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
          <div className="grid gap-4">
            {filteredAppointments.map((appointment: Appointment) => {
              const client = getClient(appointment.clientId);
              const service = getService(appointment.serviceId);
              const responsible = getResponsibleInfo(appointment);
              const { date, time } = formatDateTime(appointment.scheduledDate.toString());

              return (
                <Card key={appointment.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-3">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {client?.name || "Cliente não encontrado"}
                          </h3>
                          <Badge className={getStatusColor(appointment.status)}>
                            {getStatusText(appointment.status)}
                          </Badge>
                          <Badge className={getPriorityColor(appointment.priority)}>
                            {getPriorityText(appointment.priority)}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                          <div className="flex items-center space-x-2">
                            <Calendar className="h-4 w-4" />
                            <span>{date} às {time}</span>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <User className="h-4 w-4" />
                            <span>{responsible.displayName}</span>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <MapPin className="h-4 w-4" />
                            <span>
                              {client
                                ? (
                                    <>
                                      {client.logradouro || "Logradouro não informado"}
                                      {client.numero ? `, ${client.numero}` : ""}
                                      {client.complemento ? `, ${client.complemento}` : ""}
                                      {client.bairro ? `, ${client.bairro}` : ""}
                                      {client.cidade ? `, ${client.cidade}` : ""}
                                      {client.cep ? ` - ${client.cep}` : ""}
                                    </>
                                  )
                                : <span style={{ color: "red" }}>Cliente não encontrado</span>
                              }
                            </span>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <Clock className="h-4 w-4" />
                            <span>{service?.name || "Serviço não encontrado"}</span>
                          </div>
                        </div>
                        
                        {appointment.notes && (
                          <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                            <p className="text-sm text-gray-700">{appointment.notes}</p>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex space-x-2 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(appointment)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(appointment)}
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
        )
      ) : (
        /* Calendar View */
        <Card>
          <CardContent className="p-6">
            {filteredAppointments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Calendar className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {appointments.length === 0 ? "Nenhum agendamento encontrado" : "Nenhum agendamento encontrado com os filtros aplicados"}
                </h3>
                <p className="text-gray-600 text-center mb-6">
                  {appointments.length === 0 
                    ? "Comece criando seu primeiro agendamento para organizar seus atendimentos técnicos."
                    : "Tente ajustar os filtros ou limpar todos os filtros para ver mais agendamentos."
                  }
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
              />
            )}
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
    </div>
  );
}
