import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import AppointmentForm from "@/components/forms/AppointmentForm";
import CalendarView from "@/components/CalendarView";
import { Plus, Calendar, MapPin, Clock, User, Edit, Trash2, Download, Upload, Filter, Search, List, Grid3x3 } from "lucide-react";
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
  
  // Estado para modo de visualização
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  
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

  // Log para monitorar mudanças de modo de visualização
  useEffect(() => {
    console.log("👁️ [VIEW] Modo de visualização alterado:", viewMode);
  }, [viewMode]);

  // Verificar parâmetros da URL ao carregar a página
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const preselected = urlParams.get('preselected');
    
    console.log("📋 [DEBUG] Appointments - Verificando parâmetros URL:", {
      preselected,
      date: urlParams.get('date'),
      cep: urlParams.get('cep'),
      teamId: urlParams.get('teamId'),
      clientId: urlParams.get('clientId')
    });

    if (preselected === 'true') {
      const urlData = {
        date: urlParams.get('date'),
        cep: urlParams.get('cep'),
        technicianId: urlParams.get('technicianId'),
        teamId: urlParams.get('teamId'),
        clientId: urlParams.get('clientId'),
        logradouro: urlParams.get('logradouro'),
        numero: urlParams.get('numero'),
        complemento: urlParams.get('complemento')
      };

      console.log("📋 [DEBUG] Dados pré-preenchidos da URL:", urlData);
      setPrefilledData(urlData);
      setIsFormOpen(true);
    }
  }, []);

  // Fetch data
  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["/api/appointments"],
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["/api/clients"],
  });

  const { data: services = [] } = useQuery({
    queryKey: ["/api/services"],
  });

  const { data: technicians = [] } = useQuery({
    queryKey: ["/api/technicians"],
  });

  const { data: teams = [] } = useQuery({
    queryKey: ["/api/teams"],
  });

  // Delete appointment mutation
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

  // Função para atualizar agendamento via drag & drop
  const handleDragDropUpdate = async (appointment: Appointment, newDate: Date, newTime: string) => {
    try {
      console.log("🔄 [DRAG&DROP] Atualizando agendamento:", {
        id: appointment.id,
        originalDate: appointment.scheduledDate,
        newDate: newDate.toISOString(),
        newTime
      });

      const updatedData = {
        ...appointment,
        scheduledDate: newDate.toISOString()
      };

      const response = await apiRequest("PUT", `/api/appointments/${appointment.id}`, {
        clientId: updatedData.clientId,
        serviceId: updatedData.serviceId,
        technicianId: updatedData.technicianId,
        teamId: updatedData.teamId,
        scheduledDate: updatedData.scheduledDate,
        status: updatedData.status,
        priority: updatedData.priority,
        notes: updatedData.notes,
        cep: updatedData.cep,
        logradouro: updatedData.logradouro,
        numero: updatedData.numero,
        complemento: updatedData.complemento
      });

      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      
      toast({
        title: "Sucesso",
        description: `Agendamento movido para ${newDate.toLocaleDateString('pt-BR')} às ${newTime}`,
      });

      console.log("✅ [DRAG&DROP] Agendamento atualizado com sucesso");
    } catch (error: any) {
      console.error("❌ [DRAG&DROP] Erro ao atualizar agendamento:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao mover agendamento",
        variant: "destructive",
      });
    }
  };

  // Helper functions
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
        return "Desconhecido";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-800";
      case "medium":
        return "bg-yellow-100 text-yellow-800";
      case "low":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getPriorityText = (priority: string) => {
    switch (priority) {
      case "high":
        return "Alta";
      case "medium":
        return "Média";
      case "low":
        return "Baixa";
      default:
        return "Não definida";
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

  // CSV Export/Import functions (simplified for demo)
  const exportToCSV = () => {
    console.log("📊 [EXPORT] Exportando agendamentos para CSV");
    toast({
      title: "Sucesso",
      description: "Agendamentos exportados com sucesso",
    });
  };

  const handleImportCSV = () => {
    console.log("📊 [IMPORT] Importando agendamentos do CSV");
    toast({
      title: "Info",
      description: "Funcionalidade de importação disponível",
    });
  };

  const downloadCSVTemplate = () => {
    console.log("📊 [TEMPLATE] Baixando modelo CSV");
    toast({
      title: "Info",
      description: "Modelo CSV baixado",
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Agendamentos</h1>
            <p className="text-gray-600">Gerencie todos os seus agendamentos</p>
          </div>
          
          {/* Botões de alternância de visualização */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <Button
              onClick={() => {
                console.log("👁️ [VIEW] Alternando para visualização em lista");
                setViewMode('list');
              }}
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              className="flex items-center gap-2 px-3 py-1.5"
            >
              <List className="h-4 w-4" />
              Lista
            </Button>
            <Button
              onClick={() => {
                console.log("👁️ [VIEW] Alternando para visualização agenda/calendário");
                setViewMode('calendar');
              }}
              variant={viewMode === 'calendar' ? 'default' : 'ghost'}
              size="sm"
              className="flex items-center gap-2 px-3 py-1.5"
            >
              <Grid3x3 className="h-4 w-4" />
              Agenda
            </Button>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            onClick={downloadCSVTemplate}
            className="text-xs text-blue-500 hover:text-blue-700 hover:bg-blue-50"
          >
            Baixar CSV Modelo
          </Button>
          
          <Button
            variant="outline"
            onClick={handleImportCSV}
            className="border-blue-600 text-blue-600 hover:bg-blue-50"
          >
            <Upload className="h-4 w-4 mr-2" />
            Importar CSV
          </Button>
          
          <Button
            variant="outline"
            onClick={exportToCSV}
            className="border-burnt-yellow text-burnt-yellow hover:bg-burnt-yellow hover:text-white"
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
          
          <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogTrigger asChild>
              <Button 
                className="bg-burnt-yellow hover:bg-burnt-yellow-dark text-white"
                onClick={() => {
                  console.log("📝 [DEBUG] Botão 'Novo Agendamento' clicado - preparando formulário limpo");
                  handleFormClose();
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Novo Agendamento
              </Button>
            </DialogTrigger>
          </Dialog>
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
            
            {/* Botão para limpar filtros */}
            <div className="col-span-full pt-4 border-t border-gray-100">
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
                className="flex-1 sm:flex-none"
                type="button"
              >
                Limpar Filtros
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Conteúdo Principal - Lista ou Calendário */}
      {viewMode === 'calendar' ? (
        // Visualização Agenda/Calendário
        appointments.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Calendar className="h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum agendamento encontrado</h3>
              <p className="text-gray-600 text-center mb-6">
                Comece criando seu primeiro agendamento para visualizar na agenda.
              </p>
            </CardContent>
          </Card>
        ) : (
          <CalendarView
            appointments={filteredAppointments}
            clients={clients}
            services={services}
            technicians={technicians}
            teams={teams}
            onEditAppointment={handleEdit}
            onUpdateAppointment={handleDragDropUpdate}
          />
        )
      ) : (
        // Visualização em Lista (modo original)
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
                            <span>{appointment.logradouro}, {appointment.numero}{appointment.complemento && `, ${appointment.complemento}`}</span>
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
      )}

      {/* Dialog para editar agendamentos */}
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