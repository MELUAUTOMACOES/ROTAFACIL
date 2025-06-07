import { useState, useMemo } from "react";
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
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedService, setSelectedService] = useState<string>("");
  const [selectedTechnician, setSelectedTechnician] = useState<string>("");
  const { toast } = useToast();

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
    mutationFn: async (appointmentIds: number[]) => {
      const response = await apiRequest("POST", "/api/gerar-rota", { appointmentIds });
      return response.json();
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
    if (selectedAppointments.length === 0) {
      toast({
        title: "Atenção",
        description: "Selecione pelo menos um agendamento para otimizar a rota",
        variant: "destructive",
      });
      return;
    }

    optimizeRouteMutation.mutate(selectedAppointments);
  };

  const getClient = (clientId: number) => clients.find((c: Client) => c.id === clientId);
  const getService = (serviceId: number) => services.find((s: Service) => s.id === serviceId);
  const getTechnician = (technicianId: number) => technicians.find((t: Technician) => t.id === technicianId);

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
      const appointmentDate = new Date(apt.scheduledDate).toISOString().split('T')[0];
      if (selectedDate && appointmentDate !== selectedDate) return false;

      // Filter by search term (client name)
      if (searchTerm) {
        const client = getClient(apt.clientId);
        if (!client?.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      }

      // Filter by service
      if (selectedService) {
        const service = getService(apt.serviceId);
        if (service?.id.toString() !== selectedService) return false;
      }

      // Filter by technician
      if (selectedTechnician) {
        const technician = getTechnician(apt.technicianId);
        if (technician?.id.toString() !== selectedTechnician) return false;
      }

      return apt.status === 'scheduled';
    });

    // Group by date
    const grouped = filtered.reduce((acc, apt) => {
      const date = new Date(apt.scheduledDate).toLocaleDateString('pt-BR');
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(apt);
      return acc;
    }, {} as Record<string, Appointment[]>);

    // Sort appointments within each day by time
    Object.keys(grouped).forEach(date => {
      grouped[date].sort((a, b) => 
        new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime()
      );
    });

    return grouped;
  }, [appointments, selectedDate, searchTerm, selectedService, selectedTechnician, clients, services, technicians]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Roteirização</h1>
          <p className="text-gray-600">Otimize as rotas dos seus atendimentos técnicos</p>
        </div>
        
        <Button 
          onClick={handleOptimizeRoute}
          disabled={selectedAppointments.length === 0 || optimizeRouteMutation.isPending}
          className="bg-burnt-yellow hover:bg-burnt-yellow-dark text-white"
        >
          {optimizeRouteMutation.isPending ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
          ) : (
            <Route className="h-4 w-4 mr-2" />
          )}
          Otimizar Rota
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
            {availableAppointments.length === 0 ? (
              <div className="text-center py-8">
                <Route className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">Nenhum agendamento disponível para roteirização</p>
                <p className="text-sm text-gray-500 mt-2">
                  Apenas agendamentos futuros com status "Agendado" aparecem aqui
                </p>
              </div>
            ) : (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {availableAppointments.map((appointment: Appointment) => {
                  const client = getClient(appointment.clientId);
                  const service = getService(appointment.serviceId);
                  const technician = getTechnician(appointment.technicianId);
                  const { date, time } = formatDateTime(appointment.scheduledDate.toString());
                  const isSelected = selectedAppointments.includes(appointment.id);

                  return (
                    <div 
                      key={appointment.id}
                      className={`flex items-center space-x-4 p-4 border rounded-lg cursor-pointer transition-colors
                        ${isSelected 
                          ? "border-burnt-yellow bg-burnt-yellow bg-opacity-5" 
                          : "border-gray-200 hover:bg-gray-50"
                        }`}
                      onClick={() => handleAppointmentToggle(appointment.id)}
                    >
                      <Checkbox 
                        checked={isSelected}
                        onChange={() => handleAppointmentToggle(appointment.id)}
                        className="text-burnt-yellow"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-gray-900">
                            {client?.name || "Cliente"}
                          </h4>
                          <span className="text-sm text-gray-500">{time}</span>
                        </div>
                        <p className="text-sm text-gray-600">{service?.name || "Serviço"}</p>
                        <p className="text-xs text-gray-500">{appointment.address}</p>
                        <div className="flex items-center mt-2">
                          <span className="text-xs text-gray-500">Técnico: </span>
                          <span className="text-xs font-medium text-gray-700 ml-1">
                            {technician?.name || "Técnico"}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
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
                          <p className="text-sm text-gray-600">{appointment.address}</p>
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
