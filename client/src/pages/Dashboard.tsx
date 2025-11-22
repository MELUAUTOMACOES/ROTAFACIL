import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { getAuthHeaders } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Calendar, 
  Users, 
  CheckCircle, 
  DollarSign,
  Plus,
  Route,
  UserPlus,
  BarChart3,
  MapPin,
  Clock,
  TrendingUp
} from "lucide-react";
import type { Appointment, Client, Technician } from "@shared/schema";

interface DashboardStats {
  todayAppointments: number;
  activeTechnicians: number;
  completionRate: number;
  monthRevenue: number;
}

interface TodayAppointment {
  id: number;
  time: string;
  client: string;
  service: string;
  address: string;
  status: string;
  technician: string;
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  
  const { data: appointments = [] } = useQuery<Appointment[]>({
    queryKey: ["/api/appointments"],
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: technicians = [] } = useQuery<Technician[]>({
    queryKey: ["/api/technicians"],
  });

  // Calculate stats
  const today = new Date().toDateString();
  const todayAppointments = appointments.filter((apt: Appointment) => 
    new Date(apt.scheduledDate).toDateString() === today
  );
  
  const activeTechnicians = technicians.filter((tech: Technician) => tech.isActive);
  const completedAppointments = appointments.filter((apt: Appointment) => apt.status === "completed");
  const completionRate = appointments.length > 0 
    ? Math.round((completedAppointments.length / appointments.length) * 100)
    : 0;

  const stats: DashboardStats = {
    todayAppointments: todayAppointments.length,
    activeTechnicians: activeTechnicians.length,
    completionRate,
    monthRevenue: 24500, // This would come from a real calculation
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "in_progress":
        return "bg-yellow-100 text-yellow-800";
      case "scheduled":
        return "bg-blue-100 text-blue-800";
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
      default:
        return status;
    }
  };

  const formatTime = (dateInput: string | Date) => {
    const date = (typeof dateInput === 'string' || typeof dateInput === 'number')
      ? new Date(dateInput)
      : dateInput;
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-8">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Agendamentos Hoje</p>
                <p className="text-3xl font-bold text-gray-900">{stats.todayAppointments}</p>
              </div>
              <div className="w-12 h-12 bg-burnt-yellow bg-opacity-10 rounded-lg flex items-center justify-center">
                <Calendar className="text-burnt-yellow h-6 w-6" />
              </div>
            </div>
            <div className="mt-4 flex items-center">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <span className="text-green-600 text-sm font-medium ml-1">+8%</span>
              <span className="text-gray-600 text-sm ml-2">vs. ontem</span>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Técnicos Ativos</p>
                <p className="text-3xl font-bold text-gray-900">{stats.activeTechnicians}</p>
              </div>
              <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
                <Users className="text-blue-600 h-6 w-6" />
              </div>
            </div>
            <div className="mt-4 flex items-center">
              <span className="text-gray-600 text-sm">
                {activeTechnicians.filter((t: Technician) => 
                  todayAppointments.some((a: Appointment) => a.technicianId === t.id)
                ).length} em campo agora
              </span>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Taxa de Conclusão</p>
                <p className="text-3xl font-bold text-gray-900">{stats.completionRate}%</p>
              </div>
              <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center">
                <CheckCircle className="text-green-600 h-6 w-6" />
              </div>
            </div>
            <div className="mt-4 flex items-center">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <span className="text-green-600 text-sm font-medium ml-1">+5%</span>
              <span className="text-gray-600 text-sm ml-2">este mês</span>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Receita do Mês</p>
                <p className="text-3xl font-bold text-gray-900">R$ {stats.monthRevenue.toLocaleString()}</p>
              </div>
              <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center">
                <DollarSign className="text-purple-600 h-6 w-6" />
              </div>
            </div>
            <div className="mt-4 flex items-center">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <span className="text-green-600 text-sm font-medium ml-1">+12%</span>
              <span className="text-gray-600 text-sm ml-2">vs. mês passado</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Schedule */}
        <Card>
          <CardHeader className="border-b border-gray-100">
            <div className="flex items-center justify-between">
              <CardTitle>Agenda de Hoje</CardTitle>
              <Button variant="link" className="text-burnt-yellow hover:text-burnt-yellow-dark">
                Ver todos
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {todayAppointments.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">Nenhum agendamento para hoje</p>
              </div>
            ) : (
              <div className="space-y-4">
                {todayAppointments.slice(0, 3).map((appointment: Appointment) => {
                  const client = clients.find((c: Client) => c.id === appointment.clientId);
                  const technician = technicians.find((t: Technician) => t.id === appointment.technicianId);
                  const addressText = [
                    appointment.logradouro,
                    appointment.numero,
                    appointment.bairro,
                    appointment.cidade,
                    appointment.cep,
                  ].filter(Boolean).join(', ');
                  
                  return (
                    <div key={appointment.id} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                      <div className="w-12 h-12 bg-burnt-yellow rounded-lg flex items-center justify-center">
                        <span className="text-white font-semibold text-sm">
                          {formatTime(appointment.scheduledDate)}
                        </span>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{client?.name || "Cliente"}</h4>
                        <p className="text-sm text-gray-600">{appointment.notes || "Serviço"}</p>
                        <p className="text-xs text-gray-500">{addressText}</p>
                      </div>
                      <div className="text-right">
                        <Badge className={getStatusColor(appointment.status)}>
                          {getStatusText(appointment.status)}
                        </Badge>
                        <p className="text-xs text-gray-500 mt-1">{technician?.name || "Técnico"}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader className="border-b border-gray-100">
            <CardTitle>Ações Rápidas</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 gap-4">
              <Button
                variant="outline"
                className="flex items-center justify-start p-4 h-auto border-gray-200 hover:bg-gray-50"
                onClick={() => setLocation("/appointments")}
              >
                <div className="w-10 h-10 bg-burnt-yellow rounded-lg flex items-center justify-center mr-4">
                  <Plus className="text-white h-5 w-5" />
                </div>
                <div className="text-left">
                  <h4 className="font-medium text-gray-900">Novo Agendamento</h4>
                  <p className="text-sm text-gray-600">Criar um novo atendimento</p>
                </div>
              </Button>
              
              <Button
                variant="outline"
                className="flex items-center justify-start p-4 h-auto border-gray-200 hover:bg-gray-50"
                onClick={() => setLocation("/appointments")}
              >
                <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center mr-4">
                  <Route className="text-white h-5 w-5" />
                </div>
                <div className="text-left">
                  <h4 className="font-medium text-gray-900">Otimizar Rota</h4>
                  <p className="text-sm text-gray-600">Gerar rota para hoje</p>
                </div>
              </Button>
              
              <Button
                variant="outline"
                className="flex items-center justify-start p-4 h-auto border-gray-200 hover:bg-gray-50"
                onClick={() => setLocation("/clients")}
              >
                <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center mr-4">
                  <UserPlus className="text-white h-5 w-5" />
                </div>
                <div className="text-left">
                  <h4 className="font-medium text-gray-900">Novo Cliente</h4>
                  <p className="text-sm text-gray-600">Cadastrar cliente</p>
                </div>
              </Button>
              
              <Button
                variant="outline"
                className="flex items-center justify-start p-4 h-auto border-gray-200 hover:bg-gray-50"
                onClick={() => setLocation("/business-rules")}
              >
                <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center mr-4">
                  <BarChart3 className="text-white h-5 w-5" />
                </div>
                <div className="text-left">
                  <h4 className="font-medium text-gray-900">Configurações</h4>
                  <p className="text-sm text-gray-600">Regras de negócio</p>
                </div>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader className="border-b border-gray-100">
          <CardTitle>Atividade Recente</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {appointments.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Nenhuma atividade recente</p>
            </div>
          ) : (
            <div className="space-y-4">
              {appointments.slice(0, 4).map((activity: Appointment) => {
                const client = clients.find((c: Client) => c.id === activity.clientId);
                const technician = technicians.find((t: Technician) => t.id === activity.technicianId);
                
                return (
                  <div key={activity.id} className="flex items-start space-x-4">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="text-green-600 h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-900">
                        <span className="font-medium">{technician?.name || "Técnico"}</span>{" "}
                        {activity.status === "completed" ? "concluiu" : "criou"} o atendimento na{" "}
                        <span className="font-medium">{client?.name || "Cliente"}</span>
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(activity.createdAt).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
