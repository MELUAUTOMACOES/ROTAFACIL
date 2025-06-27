import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Route, MapPin, Clock, Navigation, TrendingUp, Filter, Search, Calendar } from "lucide-react";
import type { Appointment, Client, Service, Technician } from "@shared/schema";

interface OptimizedRoute {
  optimizedOrder: Appointment[];
  totalDistance: number;
  estimatedTime: number;
}

export default function Routes() {
  const [selectedAppointments, setSelectedAppointments] = useState<number[]>([]);
  const [optimizedRoute, setOptimizedRoute] = useState<OptimizedRoute | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedService, setSelectedService] = useState<string>("");
  const [selectedTechnician, setSelectedTechnician] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const { toast } = useToast();

  // Monitor fullscreen changes and DOM state
  useEffect(() => {
    const handleFullscreenChange = () => {
      const fullscreenElement = document.fullscreenElement || (document as any).webkitFullscreenElement;
      const isNowFullscreen = !!fullscreenElement;
      console.log("🖼️ [DEBUG] Fullscreen changed:", isNowFullscreen);
      setIsFullscreen(isNowFullscreen);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    // Check initial fullscreen state
    handleFullscreenChange();

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Log component mount and render state
  useEffect(() => {
    console.log("🔄 [DEBUG] Routes component mounted/updated");
    console.log("🔄 [DEBUG] Selected appointments:", selectedAppointments.length);
    console.log("🔄 [DEBUG] Optimized route:", !!optimizedRoute);
    console.log("🔄 [DEBUG] Is fullscreen:", isFullscreen);
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

  const optimizeRouteMutation = useMutation({
    mutationFn: async (appointmentIds: number[]): Promise<OptimizedRoute> => {
      if (appointmentIds.length === 0) {
        throw new Error("Selecione pelo menos um agendamento para otimizar a rota");
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
    setSelectedAppointments(prev => 
      prev.includes(appointmentId)
        ? prev.filter(id => id !== appointmentId)
        : [...prev, appointmentId]
    );
  };

  const handleOptimizeRoute = () => {
    console.log("🚀 [DEBUG] handleOptimizeRoute chamado");
    console.log("🚀 [DEBUG] Selected appointments:", selectedAppointments);
    console.log("🚀 [DEBUG] DOM ready state:", document.readyState);
    console.log("🚀 [DEBUG] Is fullscreen:", isFullscreen);
    
    if (selectedAppointments.length === 0) {
      console.log("❌ [DEBUG] Nenhum agendamento selecionado");
      toast({
        title: "Atenção",
        description: "Selecione pelo menos um agendamento para otimizar a rota",
        variant: "destructive",
      });
      return;
    }

    // Verificar se o DOM está pronto e os elementos necessários existem
    if (document.readyState !== 'complete') {
      console.log("⏳ [DEBUG] DOM ainda não está completamente carregado, aguardando...");
      setTimeout(() => handleOptimizeRoute(), 100);
      return;
    }

    console.log("✅ [DEBUG] Iniciando otimização de rota");
    try {
      optimizeRouteMutation.mutate(selectedAppointments);
    } catch (error) {
      console.error("❌ [DEBUG] Erro ao executar mutação:", error);
      toast({
        title: "Erro",
        description: "Erro interno ao otimizar rota. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const getClient = (clientId: number | null) => clientId ? clients.find((c: Client) => c.id === clientId) : null;
  const getService = (serviceId: number) => services.find((s: Service) => s.id === serviceId);
  const getTechnician = (technicianId: number | null) => technicianId ? technicians.find((t: Technician) => t.id === technicianId) : null;

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('pt-BR'),
      time: date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };
  };

  // Filter and organize appointments
  const filteredAndGroupedAppointments = useMemo(() => {
    let filtered = appointments.filter((apt: Appointment) => {
      // Filter by date
      const appointmentDate = new Date(apt.scheduledDate);
      const localDate = new Date(appointmentDate.getTime() - appointmentDate.getTimezoneOffset() * 60000).toISOString().split('T')[0];
      if (selectedDate && localDate !== selectedDate) return false;

      // Filter by search term (client name)
      if (searchTerm) {
        const client = getClient(apt.clientId);
        if (!client?.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      }

      // Filter by service
      if (selectedService && selectedService !== "all") {
        const service = getService(apt.serviceId);
        if (service?.id.toString() !== selectedService) return false;
      }

      // Filter by technician
      if (selectedTechnician && selectedTechnician !== "all") {
        const technician = getTechnician(apt.technicianId);
        if (technician?.id.toString() !== selectedTechnician) return false;
      }

      // Filter by status
      if (selectedStatus && selectedStatus !== "all") {
        if (apt.status !== selectedStatus) return false;
      }

      return true;
    });

    // Group by date
    const grouped = filtered.reduce((acc: Record<string, Appointment[]>, apt: Appointment) => {
      const date = new Date(apt.scheduledDate).toLocaleDateString('pt-BR');
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(apt);
      return acc;
    }, {} as Record<string, Appointment[]>);

    // Sort appointments within each day by time
    Object.keys(grouped).forEach(date => {
      grouped[date].sort((a: Appointment, b: Appointment) => 
        new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime()
      );
    });

    return grouped;
  }, [appointments, selectedDate, searchTerm, selectedService, selectedTechnician, selectedStatus, clients, services, technicians]);

  return (
    <div className={`space-y-6 ${isFullscreen ? 'min-h-screen p-4' : ''}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Roteirização</h1>
          <p className="text-gray-600">Otimize as rotas dos seus atendimentos técnicos</p>
        </div>
        
        <div className="flex-shrink-0">
          <Button 
            onClick={handleOptimizeRoute}
            disabled={selectedAppointments.length === 0 || optimizeRouteMutation.isPending}
            className="bg-burnt-yellow hover:bg-burnt-yellow-dark text-white w-full sm:w-auto"
            type="button"
          >
            {optimizeRouteMutation.isPending ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
            ) : (
              <Route className="h-4 w-4 mr-2" />
            )}
            Otimizar Rota
          </Button>
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
              <label className="text-sm font-medium mb-2 block">Buscar Cliente</label>
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
              <Select value={selectedService} onValueChange={setSelectedService}>
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
              <label className="text-sm font-medium mb-2 block">Técnico</label>
              <Select value={selectedTechnician} onValueChange={setSelectedTechnician}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os técnicos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os técnicos</SelectItem>
                  {technicians.map((technician: Technician) => (
                    <SelectItem key={technician.id} value={technician.id.toString()}>
                      {technician.name}
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
          </div>
        </CardContent>
      </Card>

      <div className={`grid gap-6 ${isFullscreen ? 'grid-cols-1 xl:grid-cols-2' : 'grid-cols-1 lg:grid-cols-2'}`}>
        {/* Appointments Selection */}
        <Card>
          <CardHeader className="border-b border-gray-100">
            <CardTitle className="flex items-center">
              <MapPin className="h-5 w-5 mr-2 text-burnt-yellow" />
              Selecionar Atendimentos
            </CardTitle>
            <p className="text-sm text-gray-600">
              Escolha os atendimentos para incluir na rota ({selectedAppointments.length} selecionados)
            </p>
          </CardHeader>
          <CardContent className="p-6">
            {Object.keys(filteredAndGroupedAppointments).length === 0 ? (
              <div className="text-center py-8">
                <Route className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">Nenhum agendamento encontrado</p>
                <p className="text-sm text-gray-500 mt-2">
                  Ajuste os filtros para ver os agendamentos disponíveis
                </p>
              </div>
            ) : (
              <div className="space-y-6 max-h-96 overflow-y-auto">
                {Object.entries(filteredAndGroupedAppointments).map(([date, dayAppointments]) => (
                  <div key={date}>
                    <div className="flex items-center mb-3">
                      <Calendar className="h-4 w-4 mr-2 text-burnt-yellow" />
                      <h3 className="font-semibold text-gray-900">{date}</h3>
                      <span className="ml-2 text-sm text-gray-500">({(dayAppointments as Appointment[]).length} agendamentos)</span>
                    </div>
                    <div className="space-y-3 pl-6">
                      {(dayAppointments as Appointment[]).map((appointment: Appointment) => {
                        const client = getClient(appointment.clientId);
                        const service = getService(appointment.serviceId);
                        const technician = getTechnician(appointment.technicianId);
                        const { time } = formatDateTime(appointment.scheduledDate.toString());
                        const isSelected = selectedAppointments.includes(appointment.id);

                        return (
                          <div 
                            key={appointment.id}
                            className={`flex items-center space-x-4 p-3 border rounded-lg cursor-pointer transition-colors
                              ${isSelected 
                                ? "border-burnt-yellow bg-burnt-yellow bg-opacity-5" 
                                : "border-gray-200 hover:bg-gray-50"
                              }`}
                            onClick={() => handleAppointmentToggle(appointment.id)}
                          >
                            <Checkbox 
                              checked={isSelected}
                              onCheckedChange={() => handleAppointmentToggle(appointment.id)}
                              className="text-burnt-yellow"
                            />
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-1">
                                <h4 className="font-medium text-gray-900">
                                  {client?.name || "Cliente"}
                                </h4>
                                <span className="text-sm text-gray-500">{time}</span>
                              </div>
                              <p className="text-sm text-gray-600">{service?.name || "Serviço"}</p>
                              <p className="text-xs text-gray-500">
                                {appointment.logradouro}, {appointment.numero} - {appointment.cep}
                              </p>
                              <div className="flex items-center justify-between mt-1">
                                <div className="flex items-center">
                                  <span className="text-xs text-gray-500">Técnico: </span>
                                  <span className="text-xs font-medium text-gray-700 ml-1">
                                    {technician?.name || "Técnico"}
                                  </span>
                                </div>
                                <Badge 
                                  className={`text-xs px-2 py-1 ${
                                    appointment.status === 'completed' ? 'bg-green-100 text-green-800' :
                                    appointment.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                                    appointment.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                                    appointment.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                    'bg-gray-100 text-gray-800'
                                  }`}
                                >
                                  {appointment.status === 'completed' ? 'Concluído' :
                                   appointment.status === 'in_progress' ? 'Em Andamento' :
                                   appointment.status === 'scheduled' ? 'Agendado' :
                                   appointment.status === 'cancelled' ? 'Cancelado' :
                                   appointment.status}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Optimized Route */}
        <Card>
          <CardHeader className="border-b border-gray-100">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center">
                <Navigation className="h-5 w-5 mr-2 text-burnt-yellow" />
                Rota Otimizada
              </CardTitle>
              {optimizedRoute && (
                <div className="text-sm text-gray-600">
                  <span className="font-medium">Distância total:</span> {optimizedRoute.totalDistance} km
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {!optimizedRoute ? (
              <div className="text-center py-8">
                <Route className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">Selecione agendamentos e clique em "Otimizar Rota"</p>
                <p className="text-sm text-gray-500 mt-2">
                  A rota otimizada aparecerá aqui
                </p>
              </div>
            ) : (
              <div>
                {/* Map Placeholder */}
                <div className="bg-gray-100 rounded-lg h-64 flex items-center justify-center mb-6">
                  <div className="text-center">
                    <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 font-medium">Mapa da rota otimizada</p>
                    <p className="text-sm text-gray-500">Integração com Google Maps</p>
                  </div>
                </div>
                
                {/* Route Steps */}
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900 flex items-center">
                    <Clock className="h-4 w-4 mr-2" />
                    Sequência da Rota
                  </h4>
                  
                  {optimizedRoute.optimizedOrder.map((appointment, index) => {
                    const client = getClient(appointment.clientId);
                    const service = getService(appointment.serviceId);
                    const { time } = formatDateTime(appointment.scheduledDate.toString());
                    // Simulate distance and duration for each stop
                    const distance = (Math.random() * 5 + 1).toFixed(1);
                    const duration = Math.round(Math.random() * 10 + 5);
                    
                    return (
                      <div key={appointment.id} className="flex items-start space-x-4">
                        <div className="w-8 h-8 bg-burnt-yellow rounded-full flex items-center justify-center text-white font-medium text-sm flex-shrink-0">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <h5 className="font-medium text-gray-900">{client?.name || "Cliente"}</h5>
                          <p className="text-sm text-gray-600">
                            {appointment.logradouro}, {appointment.numero} - {appointment.cep}
                          </p>
                          <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                            <span>{time}</span>
                            <span>{distance} km</span>
                            <span>{duration} min</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {/* Route Summary */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Tempo total estimado:</span>
                      <span className="font-medium text-gray-900">
                        {Math.floor(optimizedRoute.estimatedTime / 60)}h {optimizedRoute.estimatedTime % 60}min
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Economia de combustível:</span>
                      <span className="font-medium text-green-600 flex items-center">
                        <TrendingUp className="h-3 w-3 mr-1" />
                        25%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
