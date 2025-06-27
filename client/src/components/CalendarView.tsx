import { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, MapPin, User, Edit } from "lucide-react";
import type { Appointment, Client, Service, Technician, Team } from "@shared/schema";

interface CalendarViewProps {
  appointments: Appointment[];
  clients: Client[];
  services: Service[];
  technicians: Technician[];
  teams: Team[];
  onEditAppointment: (appointment: Appointment) => void;
  onUpdateAppointment: (appointment: Appointment, newDate: Date, newTime: string) => void;
}

export default function CalendarView({
  appointments,
  clients,
  services,
  technicians,
  teams,
  onEditAppointment,
  onUpdateAppointment
}: CalendarViewProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [draggedAppointment, setDraggedAppointment] = useState<Appointment | null>(null);

  // Função para obter dados do cliente
  const getClient = (clientId: number | null) => clientId ? clients.find((c: Client) => c.id === clientId) : null;
  
  // Função para obter dados do serviço
  const getService = (serviceId: number) => services.find((s: Service) => s.id === serviceId);
  
  // Função para obter dados do técnico
  const getTechnician = (technicianId: number | null) => technicianId ? technicians.find((t: Technician) => t.id === technicianId) : null;
  
  // Função para obter dados da equipe
  const getTeam = (teamId: number | null) => teamId ? teams.find((t: Team) => t.id === teamId) : null;

  // Sistema de cores para técnicos e equipes
  const getResponsibleColor = (appointment: Appointment) => {
    const colors = [
      { bg: 'bg-blue-100', border: 'border-blue-500', text: 'text-blue-800', accent: 'bg-blue-500' },
      { bg: 'bg-green-100', border: 'border-green-500', text: 'text-green-800', accent: 'bg-green-500' },
      { bg: 'bg-purple-100', border: 'border-purple-500', text: 'text-purple-800', accent: 'bg-purple-500' },
      { bg: 'bg-orange-100', border: 'border-orange-500', text: 'text-orange-800', accent: 'bg-orange-500' },
      { bg: 'bg-pink-100', border: 'border-pink-500', text: 'text-pink-800', accent: 'bg-pink-500' },
      { bg: 'bg-indigo-100', border: 'border-indigo-500', text: 'text-indigo-800', accent: 'bg-indigo-500' },
      { bg: 'bg-yellow-100', border: 'border-yellow-500', text: 'text-yellow-800', accent: 'bg-yellow-500' },
      { bg: 'bg-red-100', border: 'border-red-500', text: 'text-red-800', accent: 'bg-red-500' },
      { bg: 'bg-teal-100', border: 'border-teal-500', text: 'text-teal-800', accent: 'bg-teal-500' },
      { bg: 'bg-cyan-100', border: 'border-cyan-500', text: 'text-cyan-800', accent: 'bg-cyan-500' }
    ];

    let colorIndex = 0;
    
    if (appointment.technicianId) {
      colorIndex = appointment.technicianId % colors.length;
      console.log(`🎨 [CALENDAR] Técnico ID ${appointment.technicianId} → Cor index ${colorIndex}`);
    } else if (appointment.teamId) {
      colorIndex = (appointment.teamId + 100) % colors.length;
      console.log(`🎨 [CALENDAR] Equipe ID ${appointment.teamId} → Cor index ${colorIndex}`);
    } else {
      return { bg: 'bg-gray-100', border: 'border-gray-400', text: 'text-gray-800', accent: 'bg-gray-400' };
    }

    return colors[colorIndex];
  };

  // Função para obter informações do responsável
  const getResponsibleInfo = (appointment: Appointment) => {
    if (appointment.technicianId) {
      const technician = getTechnician(appointment.technicianId);
      return {
        type: 'technician' as const,
        name: technician?.name || "Técnico não encontrado",
        displayName: `👤 ${technician?.name || "Técnico não encontrado"}`
      };
    } else if (appointment.teamId) {
      const team = getTeam(appointment.teamId);
      return {
        type: 'team' as const,
        name: team?.name || "Equipe não encontrada",
        displayName: `👥 ${team?.name || "Equipe não encontrada"}`
      };
    }
    return {
      type: 'none' as const,
      name: "Responsável não atribuído",
      displayName: "❌ Responsável não atribuído"
    };
  };

  // Gerar array com os próximos 7 dias
  const generateWeekDays = () => {
    const days = [];
    const startDate = selectedDate;
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      days.push(date);
    }
    
    return days;
  };

  // Filtrar agendamentos por data
  const getAppointmentsByDate = (date: Date) => {
    return appointments.filter(apt => {
      const aptDate = new Date(apt.scheduledDate);
      return aptDate.toDateString() === date.toDateString();
    }).sort((a, b) => {
      const timeA = new Date(a.scheduledDate).getTime();
      const timeB = new Date(b.scheduledDate).getTime();
      return timeA - timeB;
    });
  };

  // Funções de Drag & Drop
  const handleDragStart = useCallback((e: React.DragEvent, appointment: Appointment) => {
    console.log("🔄 [DRAG] Iniciando drag do agendamento:", appointment.id);
    setDraggedAppointment(appointment);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetDate: Date, targetHour: number) => {
    e.preventDefault();
    
    if (!draggedAppointment) return;

    const newDate = new Date(targetDate);
    newDate.setHours(targetHour, 0, 0, 0);
    
    console.log("🔄 [DROP] Movendo agendamento:", {
      appointmentId: draggedAppointment.id,
      from: draggedAppointment.scheduledDate,
      to: newDate.toISOString()
    });

    onUpdateAppointment(draggedAppointment, newDate, `${targetHour.toString().padStart(2, '0')}:00`);
    setDraggedAppointment(null);
  }, [draggedAppointment, onUpdateAppointment]);

  const weekDays = generateWeekDays();
  const hours = Array.from({ length: 12 }, (_, i) => i + 7); // 7h às 18h

  return (
    <div className="space-y-4">
      {/* Navegação da semana */}
      <div className="flex items-center justify-between">
        <Button
          onClick={() => {
            const newDate = new Date(selectedDate);
            newDate.setDate(selectedDate.getDate() - 7);
            setSelectedDate(newDate);
            console.log("📅 [CALENDAR] Navegando para semana anterior:", newDate.toDateString());
          }}
          variant="outline"
          size="sm"
        >
          ← Semana Anterior
        </Button>
        
        <h3 className="text-lg font-semibold">
          {selectedDate.toLocaleDateString('pt-BR', { 
            day: '2-digit', 
            month: 'long', 
            year: 'numeric' 
          })}
        </h3>
        
        <Button
          onClick={() => {
            const newDate = new Date(selectedDate);
            newDate.setDate(selectedDate.getDate() + 7);
            setSelectedDate(newDate);
            console.log("📅 [CALENDAR] Navegando para próxima semana:", newDate.toDateString());
          }}
          variant="outline"
          size="sm"
        >
          Próxima Semana →
        </Button>
      </div>

      {/* Grid da agenda */}
      <Card>
        <CardContent className="p-0">
          <div className="grid grid-cols-8 border-b">
            <div className="p-2 text-center text-sm font-medium border-r">Horário</div>
            {weekDays.map(day => (
              <div key={day.toISOString()} className="p-2 text-center text-sm font-medium border-r last:border-r-0">
                <div className="font-semibold">
                  {day.toLocaleDateString('pt-BR', { weekday: 'short' })}
                </div>
                <div className="text-xs text-gray-600">
                  {day.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                </div>
              </div>
            ))}
          </div>

          {/* Grade de horários */}
          {hours.map(hour => (
            <div key={hour} className="grid grid-cols-8 border-b last:border-b-0 min-h-[80px]">
              <div className="p-2 text-sm text-gray-600 border-r flex items-center justify-center">
                {hour.toString().padStart(2, '0')}:00
              </div>
              
              {weekDays.map(day => {
                const dayAppointments = getAppointmentsByDate(day).filter(apt => {
                  const aptHour = new Date(apt.scheduledDate).getHours();
                  return aptHour === hour;
                });

                return (
                  <div
                    key={`${day.toISOString()}-${hour}`}
                    className="border-r last:border-r-0 p-1 relative"
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, day, hour)}
                  >
                    {dayAppointments.map(appointment => {
                      const client = getClient(appointment.clientId);
                      const service = getService(appointment.serviceId);
                      const responsible = getResponsibleInfo(appointment);
                      const colors = getResponsibleColor(appointment);

                      return (
                        <div
                          key={appointment.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, appointment)}
                          onClick={() => {
                            console.log("👁️ [CALENDAR] Clique no agendamento:", appointment.id);
                            onEditAppointment(appointment);
                          }}
                          className={`
                            ${colors.bg} ${colors.border} ${colors.text}
                            border-l-4 rounded-r-md p-2 mb-1 cursor-pointer
                            hover:shadow-md transition-shadow text-xs
                            ${draggedAppointment?.id === appointment.id ? 'opacity-50' : ''}
                          `}
                        >
                          <div className="font-medium truncate">
                            {client?.name || "Cliente não encontrado"}
                          </div>
                          <div className="text-xs opacity-80 truncate">
                            {service?.name || "Serviço não encontrado"}
                          </div>
                          <div className="text-xs opacity-70 truncate">
                            {responsible.displayName}
                          </div>
                          <div className="text-xs opacity-60 mt-1">
                            {new Date(appointment.scheduledDate).toLocaleTimeString('pt-BR', { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Legenda de cores */}
      <Card>
        <CardContent className="p-4">
          <h4 className="text-sm font-medium mb-3">Legenda de Cores</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {/* Técnicos */}
            {technicians.map((technician: Technician) => {
              const colorIndex = technician.id % 10;
              const colors = [
                { bg: 'bg-blue-100', border: 'border-blue-500', text: 'text-blue-800' },
                { bg: 'bg-green-100', border: 'border-green-500', text: 'text-green-800' },
                { bg: 'bg-purple-100', border: 'border-purple-500', text: 'text-purple-800' },
                { bg: 'bg-orange-100', border: 'border-orange-500', text: 'text-orange-800' },
                { bg: 'bg-pink-100', border: 'border-pink-500', text: 'text-pink-800' },
                { bg: 'bg-indigo-100', border: 'border-indigo-500', text: 'text-indigo-800' },
                { bg: 'bg-yellow-100', border: 'border-yellow-500', text: 'text-yellow-800' },
                { bg: 'bg-red-100', border: 'border-red-500', text: 'text-red-800' },
                { bg: 'bg-teal-100', border: 'border-teal-500', text: 'text-teal-800' },
                { bg: 'bg-cyan-100', border: 'border-cyan-500', text: 'text-cyan-800' }
              ][colorIndex];

              return (
                <div key={`tech-${technician.id}`} className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded ${colors.bg} ${colors.border} border-l-4`}></div>
                  <span className="text-xs truncate">👤 {technician.name}</span>
                </div>
              );
            })}

            {/* Equipes */}
            {teams.map((team: any) => {
              const colorIndex = (team.id + 100) % 10;
              const colors = [
                { bg: 'bg-blue-100', border: 'border-blue-500', text: 'text-blue-800' },
                { bg: 'bg-green-100', border: 'border-green-500', text: 'text-green-800' },
                { bg: 'bg-purple-100', border: 'border-purple-500', text: 'text-purple-800' },
                { bg: 'bg-orange-100', border: 'border-orange-500', text: 'text-orange-800' },
                { bg: 'bg-pink-100', border: 'border-pink-500', text: 'text-pink-800' },
                { bg: 'bg-indigo-100', border: 'border-indigo-500', text: 'text-indigo-800' },
                { bg: 'bg-yellow-100', border: 'border-yellow-500', text: 'text-yellow-800' },
                { bg: 'bg-red-100', border: 'border-red-500', text: 'text-red-800' },
                { bg: 'bg-teal-100', border: 'border-teal-500', text: 'text-teal-800' },
                { bg: 'bg-cyan-100', border: 'border-cyan-500', text: 'text-cyan-800' }
              ][colorIndex];

              return (
                <div key={`team-${team.id}`} className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded ${colors.bg} ${colors.border} border-l-4`}></div>
                  <span className="text-xs truncate">👥 {team.name}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}