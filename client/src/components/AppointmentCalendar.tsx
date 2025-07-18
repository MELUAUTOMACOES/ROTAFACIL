import { useState, useMemo, useCallback } from "react";
import { Calendar, momentLocalizer, Event, Views } from "react-big-calendar";
import moment from "moment";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Appointment, Client, Service, Technician, Team } from "@shared/schema";

// Configure moment for Portuguese locale
moment.locale('pt-br');
const localizer = momentLocalizer(moment);

// Define color palette for teams/technicians
const COLORS = [
  '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
  '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
  '#aec7e8', '#ffbb78', '#98df8a', '#ff9896', '#c5b0d5',
  '#c49c94', '#f7b6d3', '#c7c7c7', '#dbdb8d', '#9edae5'
];

interface CalendarEvent extends Event {
  appointment: Appointment;
  responsible: {
    type: 'technician' | 'team' | 'none';
    id: number | null;
    name: string;
  };
}

interface AppointmentCalendarProps {
  appointments: Appointment[];
  clients: Client[];
  services: Service[];
  technicians: Technician[];
  teams: Team[];
}

export default function AppointmentCalendar({ 
  appointments, 
  clients, 
  services, 
  technicians, 
  teams 
}: AppointmentCalendarProps) {
  const [view, setView] = useState<keyof typeof Views>(Views.MONTH);
  const [date, setDate] = useState(new Date());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Generate consistent colors for each responsible (technician/team)
  const responsibleColors = useMemo(() => {
    const colorMap = new Map<string, string>();
    let colorIndex = 0;

    // Add technicians
    technicians.forEach((tech) => {
      const key = `technician-${tech.id}`;
      colorMap.set(key, COLORS[colorIndex % COLORS.length]);
      colorIndex++;
    });

    // Add teams
    teams.forEach((team) => {
      const key = `team-${team.id}`;
      colorMap.set(key, COLORS[colorIndex % COLORS.length]);
      colorIndex++;
    });

    return colorMap;
  }, [technicians, teams]);

  // Helper functions
  const getClient = (clientId: number | null) => 
    clientId ? clients.find(c => c.id === clientId) : null;
  
  const getService = (serviceId: number) => 
    services.find(s => s.id === serviceId);
  
  const getTechnician = (technicianId: number | null) => 
    technicianId ? technicians.find(t => t.id === technicianId) : null;
  
  const getTeam = (teamId: number | null) => 
    teamId ? teams.find(t => t.id === teamId) : null;

  const getResponsibleInfo = (appointment: Appointment) => {
    if (appointment.technicianId) {
      const technician = getTechnician(appointment.technicianId);
      return {
        type: 'technician' as const,
        id: appointment.technicianId,
        name: technician?.name || "Técnico não encontrado"
      };
    } else if (appointment.teamId) {
      const team = getTeam(appointment.teamId);
      return {
        type: 'team' as const,
        id: appointment.teamId,
        name: team?.name || "Equipe não encontrada"
      };
    }
    return {
      type: 'none' as const,
      id: null,
      name: "Sem responsável"
    };
  };

  // Convert appointments to calendar events
  const calendarEvents: CalendarEvent[] = useMemo(() => {
    return appointments.map((appointment) => {
      const client = getClient(appointment.clientId);
      const service = getService(appointment.serviceId);
      const responsible = getResponsibleInfo(appointment);
      
      const startDate = new Date(appointment.scheduledDate);
      const endDate = new Date(startDate.getTime() + (service?.duration || 60) * 60000); // Add duration in minutes

      return {
        id: appointment.id,
        title: `${client?.name || 'Cliente'} - ${service?.name || 'Serviço'}`,
        start: startDate,
        end: endDate,
        appointment,
        responsible,
        resource: {
          responsibleType: responsible.type,
          responsibleId: responsible.id,
          responsibleName: responsible.name,
          status: appointment.status,
          priority: appointment.priority
        }
      };
    });
  }, [appointments, clients, services, technicians, teams]);

  // Update appointment mutation
  const updateAppointmentMutation = useMutation({
    mutationFn: async ({ appointmentId, scheduledDate }: { appointmentId: number; scheduledDate: string }) => {
      return await apiRequest("PATCH", `/api/appointments/${appointmentId}`, { scheduledDate });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      toast({
        title: "Sucesso",
        description: "Agendamento atualizado com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar agendamento",
        variant: "destructive",
      });
    },
  });

  // Custom event style function
  const eventStyleGetter = useCallback((event: CalendarEvent) => {
    const responsible = event.responsible;
    let backgroundColor = '#6b7280'; // default gray
    
    if (responsible.type !== 'none' && responsible.id) {
      const colorKey = `${responsible.type}-${responsible.id}`;
      backgroundColor = responsibleColors.get(colorKey) || '#6b7280';
    }

    return {
      style: {
        backgroundColor,
        borderRadius: '4px',
        opacity: 0.8,
        color: 'white',
        border: '0px',
        display: 'block',
        fontSize: '12px',
        fontWeight: 'bold'
      }
    };
  }, [responsibleColors]);

  // Handle event movement (drag and drop)
  const handleEventDrop = useCallback(async ({ event, start, end }: { event: CalendarEvent; start: Date; end: Date }) => {
    const draggedEvent = event as CalendarEvent;
    const targetSlot = { start, end };

    // Find if there's any other event at the target time
    const conflictingEvent = calendarEvents.find(e => 
      e.id !== draggedEvent.id && 
      ((start >= e.start && start < e.end) || (end > e.start && end <= e.end) ||
       (start <= e.start && end >= e.end))
    );

    if (conflictingEvent) {
      const conflictingResponsible = conflictingEvent.responsible;
      const draggedResponsible = draggedEvent.responsible;
      
      // Check if trying to move across different teams/technicians
      if (conflictingResponsible.type !== draggedResponsible.type || 
          conflictingResponsible.id !== draggedResponsible.id) {
        toast({
          title: "Operação não permitida",
          description: `Não é possível mover agendamento de ${draggedResponsible.name} para o horário de ${conflictingResponsible.name}. Só é permitido arrastar dentro da mesma equipe/técnico.`,
          variant: "destructive",
        });
        return;
      }

      // Same team/technician but slot is occupied
      toast({
        title: "Horário ocupado",
        description: `Este horário já está ocupado por outro agendamento de ${conflictingResponsible.name}.`,
        variant: "destructive",
      });
      return;
    }

    // Update the appointment
    const newScheduledDate = start.toISOString();
    updateAppointmentMutation.mutate({
      appointmentId: draggedEvent.appointment.id,
      scheduledDate: newScheduledDate
    });
  }, [calendarEvents, toast, updateAppointmentMutation]);

  // Handle event resize (if needed)
  const handleEventResize = useCallback(async ({ event, start, end }: { event: CalendarEvent; start: Date; end: Date }) => {
    // For now, just update the start time
    const newScheduledDate = start.toISOString();
    updateAppointmentMutation.mutate({
      appointmentId: event.appointment.id,
      scheduledDate: newScheduledDate
    });
  }, [updateAppointmentMutation]);

  // Custom event component
  const EventComponent = ({ event }: { event: CalendarEvent }) => {
    const responsible = event.responsible;
    const responsibleIcon = responsible.type === 'team' ? '👥' : responsible.type === 'technician' ? '👤' : '❌';
    
    return (
      <div className="text-xs">
        <div className="font-bold truncate">{event.title}</div>
        <div className="flex items-center gap-1 mt-1">
          <span>{responsibleIcon}</span>
          <span className="truncate">{responsible.name}</span>
        </div>
      </div>
    );
  };

  // Custom toolbar to show responsible colors legend
  const ResponsibleLegend = () => (
    <div className="mb-4 p-3 bg-gray-50 rounded-lg">
      <h4 className="text-sm font-semibold mb-2">Legenda de Cores:</h4>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
        {technicians.map((tech) => {
          const colorKey = `technician-${tech.id}`;
          const color = responsibleColors.get(colorKey);
          return (
            <div key={colorKey} className="flex items-center gap-2">
              <div 
                className="w-4 h-4 rounded" 
                style={{ backgroundColor: color }}
              />
              <span className="text-xs">👤 {tech.name}</span>
            </div>
          );
        })}
        {teams.map((team) => {
          const colorKey = `team-${team.id}`;
          const color = responsibleColors.get(colorKey);
          return (
            <div key={colorKey} className="flex items-center gap-2">
              <div 
                className="w-4 h-4 rounded" 
                style={{ backgroundColor: color }}
              />
              <span className="text-xs">👥 {team.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="h-full">
      <ResponsibleLegend />
      
      <div style={{ height: '600px' }}>
        <Calendar
          localizer={localizer}
          events={calendarEvents}
          startAccessor="start"
          endAccessor="end"
          style={{ height: '100%' }}
          view={view}
          onView={setView}
          date={date}
          onNavigate={setDate}
          eventPropGetter={eventStyleGetter}
          onEventDrop={handleEventDrop}
          onEventResize={handleEventResize}
          resizable
          draggableAccessor={() => true}
          components={{
            event: EventComponent
          }}
          views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
          messages={{
            next: "Próximo",
            previous: "Anterior",
            today: "Hoje",
            month: "Mês",
            week: "Semana", 
            day: "Dia",
            agenda: "Agenda",
            date: "Data",
            time: "Hora",
            event: "Evento",
            allDay: "Dia inteiro",
            noEventsInRange: "Não há agendamentos neste período.",
            showMore: (total) => `+ Ver mais (${total})`
          }}
          formats={{
            dateFormat: 'DD',
            dayFormat: (date, culture, localizer) => 
              localizer?.format(date, 'dddd', culture) || '',
            dayHeaderFormat: (date, culture, localizer) =>
              localizer?.format(date, 'dddd DD/MM', culture) || '',
            dayRangeHeaderFormat: ({ start, end }, culture, localizer) =>
              `${localizer?.format(start, 'DD MMM', culture)} - ${localizer?.format(end, 'DD MMM YYYY', culture)}`,
            monthHeaderFormat: (date, culture, localizer) =>
              localizer?.format(date, 'MMMM YYYY', culture) || '',
            agendaHeaderFormat: ({ start, end }, culture, localizer) =>
              `${localizer?.format(start, 'DD MMM', culture)} - ${localizer?.format(end, 'DD MMM YYYY', culture)}`,
            agendaDateFormat: 'ddd DD/MM',
            agendaTimeFormat: 'HH:mm',
            agendaTimeRangeFormat: ({ start, end }, culture, localizer) =>
              `${localizer?.format(start, 'HH:mm', culture)} - ${localizer?.format(end, 'HH:mm', culture)}`
          }}
          step={30}
          timeslots={2}
          min={new Date(0, 0, 0, 7, 0, 0)} // 7:00 AM
          max={new Date(0, 0, 0, 19, 0, 0)} // 7:00 PM
        />
      </div>
    </div>
  );
}