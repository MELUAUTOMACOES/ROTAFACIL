import { useState, useMemo, useCallback } from "react";
import { Calendar, momentLocalizer, Event, Views } from "react-big-calendar";
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";
import moment from "moment";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import AppointmentForm from "@/components/forms/AppointmentForm";
import type { Appointment, Client, Service, Technician, Team } from "@shared/schema";

// Create DnD Calendar
const DnDCalendar = withDragAndDrop(Calendar);

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

// Custom Month Event Component for better appointment display
const MonthEvent = ({ event }: { event: CalendarEvent }) => {
  const responsible = event.responsible;
  const responsibleIcon = responsible.type === 'team' ? '👥' : responsible.type === 'technician' ? '👤' : '❌';
  
  return (
    <div className="text-xs leading-tight cursor-pointer hover:opacity-80 transition-opacity p-1 rounded w-full h-full">
      <div className="font-semibold truncate">{event.title.split(' - ')[0]}</div>
      <div className="flex items-center gap-1">
        <span>{responsibleIcon}</span>
        <span className="truncate text-xs opacity-90">{responsible.name}</span>
      </div>
    </div>
  );
};

// Custom Week/Day Event Component
const TimeEvent = ({ event }: { event: CalendarEvent }) => {
  const responsible = event.responsible;
  const responsibleIcon = responsible.type === 'team' ? '👥' : responsible.type === 'technician' ? '👤' : '❌';
  
  return (
    <div className="text-xs p-1 cursor-pointer hover:opacity-80 transition-opacity w-full h-full">
      <div className="font-bold truncate mb-1">{event.title.split(' - ')[0]}</div>
      <div className="text-xs opacity-90 truncate">{event.title.split(' - ')[1]}</div>
      <div className="flex items-center gap-1 mt-1">
        <span>{responsibleIcon}</span>
        <span className="truncate">{responsible.name}</span>
      </div>
    </div>
  );
};

export default function AppointmentCalendar({ 
  appointments, 
  clients, 
  services, 
  technicians, 
  teams 
}: AppointmentCalendarProps) {
  const [view, setView] = useState<keyof typeof Views>(Views.MONTH);
  const [date, setDate] = useState(new Date());
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
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
        opacity: 0.9,
        color: 'white',
        border: '0px',
        display: 'block',
        fontSize: '12px',
        fontWeight: 'bold',
        cursor: 'pointer',
        userSelect: 'none'
      }
    };
  }, [responsibleColors]);

  // Handle event click for editing
  const handleSelectEvent = useCallback((event: CalendarEvent) => {
    // Only open edit dialog in week/day view, not in month view
    if (view === Views.WEEK || view === Views.DAY || view === Views.AGENDA) {
      setSelectedAppointment(event.appointment);
      setIsEditDialogOpen(true);
    }
  }, [view]);

  // Handle event movement (drag and drop)
  const handleEventDrop = useCallback(async ({ event, start, end }: { event: CalendarEvent; start: Date; end: Date }) => {
    const draggedEvent = event as CalendarEvent;
    
    console.log(`🎯 [CALENDAR] Arrastando agendamento ${draggedEvent.appointment.id} para ${start.toISOString()}`);

    // Check for conflicts with the same responsible
    const conflictingEvent = calendarEvents.find(e => 
      e.id !== draggedEvent.id && 
      e.responsible.type === draggedEvent.responsible.type &&
      e.responsible.id === draggedEvent.responsible.id &&
      ((start >= e.start && start < e.end) || (end > e.start && end <= e.end) ||
       (start <= e.start && end >= e.end))
    );

    if (conflictingEvent) {
      toast({
        title: "Horário ocupado",
        description: `Este horário já está ocupado por outro agendamento de ${draggedEvent.responsible.name}.`,
        variant: "destructive",
      });
      return;
    }

    // Check if trying to move to a slot with different responsible
    const targetSlotEvents = calendarEvents.filter(e => 
      e.id !== draggedEvent.id &&
      ((start >= e.start && start < e.end) || (end > e.start && end <= e.end) ||
       (start <= e.start && end >= e.end))
    );

    const conflictingResponsible = targetSlotEvents.find(e => 
      e.responsible.type !== draggedEvent.responsible.type || 
      e.responsible.id !== draggedEvent.responsible.id
    );

    if (conflictingResponsible) {
      toast({
        title: "Operação não permitida",
        description: `Não é possível mover agendamento entre responsáveis diferentes. Este agendamento pertence a ${draggedEvent.responsible.name}.`,
        variant: "destructive",
      });
      return;
    }

    // Update the appointment
    const newScheduledDate = start.toISOString();
    console.log(`✅ [CALENDAR] Atualizando agendamento ${draggedEvent.appointment.id} para ${newScheduledDate}`);
    
    try {
      await updateAppointmentMutation.mutateAsync({
        appointmentId: draggedEvent.appointment.id,
        scheduledDate: newScheduledDate
      });
      
      // Success is handled by the mutation's onSuccess callback
    } catch (error) {
      console.error('❌ [CALENDAR] Erro ao atualizar agendamento:', error);
      toast({
        title: "Erro ao mover agendamento",
        description: "Não foi possível atualizar o agendamento. Tente novamente.",
        variant: "destructive",
      });
    }
  }, [calendarEvents, toast, updateAppointmentMutation]);

  // Handle event resize (if needed)
  const handleEventResize = useCallback(async ({ event, start, end }: { event: CalendarEvent; start: Date; end: Date }) => {
    console.log(`📏 [CALENDAR] Redimensionando agendamento ${event.appointment.id} para ${start.toISOString()}`);
    
    // For now, just update the start time
    const newScheduledDate = start.toISOString();
    updateAppointmentMutation.mutate({
      appointmentId: event.appointment.id,
      scheduledDate: newScheduledDate
    });
  }, [updateAppointmentMutation]);

  // Handle closing edit dialog
  const handleCloseEditDialog = useCallback(() => {
    setIsEditDialogOpen(false);
    setSelectedAppointment(null);
  }, []);

  // Get appropriate event component based on view
  const getEventComponent = useCallback((view: keyof typeof Views) => {
    switch (view) {
      case Views.MONTH:
        return MonthEvent;
      case Views.WEEK:
      case Views.DAY:
        return TimeEvent;
      default:
        return MonthEvent;
    }
  }, []);

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
        <DnDCalendar
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
          onSelectEvent={handleSelectEvent}
          selectable
          resizable
          draggableAccessor={() => true}
          resizableAccessor={() => true}
          components={{
            event: getEventComponent(view)
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
            showMore: (total) => `+${total}`
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
              `${localizer?.format(start, 'HH:mm', culture)} - ${localizer?.format(end, 'HH:mm', culture)}`,
            weekdayFormat: (date, culture, localizer) =>
              localizer?.format(date, 'dddd', culture) || '',
            selectRangeFormat: ({ start, end }, culture, localizer) =>
              `${localizer?.format(start, 'DD MMM', culture)} - ${localizer?.format(end, 'DD MMM YYYY', culture)}`
          }}
          step={30}
          timeslots={2}
          min={new Date(0, 0, 0, 7, 0, 0)} // 7:00 AM
          max={new Date(0, 0, 0, 19, 0, 0)} // 7:00 PM
          popup
          popupOffset={30}
        />
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedAppointment && (
            <AppointmentForm
              appointment={selectedAppointment}
              onClose={handleCloseEditDialog}
              clients={clients}
              services={services}
              technicians={technicians}
              teams={teams}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}