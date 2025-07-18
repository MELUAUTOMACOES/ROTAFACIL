import { useState, useMemo, useCallback } from "react";
import { Calendar, dateFnsLocalizer, Event, Views } from "react-big-calendar";
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
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

// Configure date-fns localizer for Portuguese Brazil with Monday as first day of week
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date) => startOfWeek(date, { weekStartsOn: 1 }),
  getDay,
  locales: {
    'pt-BR': ptBR,
  },
});

// Define color palette for teams/technicians
const COLORS = [
  '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
  '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
  '#aec7e8', '#ffbb78', '#98df8a', '#ff9896', '#c5b0d5',
  '#c49c94', '#f7b6d3', '#c7c7c7', '#dbdb8d', '#9edae5'
];

interface CalendarEvent extends Event {
  appointment: Appointment;
  responsible?: {
    type: 'technician' | 'team' | 'none';
    id: number | null;
    name: string;
  };
}

// Utility function to safely get responsible information
const getSafeResponsible = (event: CalendarEvent | any) => {
  return event.responsible ?? { type: 'none' as const, id: null, name: 'Não informado' };
};

interface AppointmentCalendarProps {
  appointments: Appointment[];
  clients: Client[];
  services: Service[];
  technicians: Technician[];
  teams: Team[];
}

// Custom Month Event Component - SEGURO com verificação de responsible
const MonthEvent = ({ event }: { event: CalendarEvent }) => {
  console.log('🎨 [MONTH EVENT] Renderizando evento no mês:', event.title, 'ID:', event.id);
  
  const responsible = getSafeResponsible(event);
  const responsibleIcon = responsible.type === 'team' ? '👥' : responsible.type === 'technician' ? '👤' : '❌';
  
  return (
    <div style={{ 
      fontSize: '10px', 
      padding: '2px 4px', 
      overflow: 'hidden', 
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      width: '100%',
      height: '100%',
      backgroundColor: 'inherit',
      color: 'inherit',
      cursor: 'pointer'
    }}>
      <div style={{ fontWeight: 'bold', marginBottom: '1px' }}>
        {event.title.split(' - ')[0]}
      </div>
      <div style={{ fontSize: '9px', opacity: 0.8 }}>
        {responsibleIcon} {responsible.name}
      </div>
    </div>
  );
};

// Custom Week/Day Event Component - SEGURO com verificação de responsible
const TimeEvent = ({ event }: { event: CalendarEvent }) => {
  const responsible = getSafeResponsible(event);
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
  
  console.log('📅 [CALENDAR] Modo atual:', view);
  console.log('📅 [CALENDAR] Data atual:', date.toISOString());
  console.log('📅 [CALENDAR] Total appointments recebidos:', appointments.length);
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
    console.log('🔄 [CALENDAR] Processando agendamentos para o calendário:', appointments.length);
    console.log('🔄 [CALENDAR] View atual durante processamento:', view);
    
    if (!appointments.length) {
      console.log('⚠️ [CALENDAR] Nenhum appointment encontrado!');
      return [];
    }
    
    const events = appointments.map((appointment) => {
      const client = getClient(appointment.clientId);
      const service = getService(appointment.serviceId);
      const responsible = getResponsibleInfo(appointment);
      
      // CORREÇÃO: Força conversão para objeto Date real
      const startDate = new Date(appointment.scheduledDate);
      let endDate: Date;
      let allDay = false;

      // Verifica se a data é válida
      if (isNaN(startDate.getTime())) {
        console.error('❌ [CALENDAR] Data inválida para agendamento:', appointment.id, appointment.scheduledDate);
        return null;
      }

      // Se o agendamento é "dia todo"
      if (appointment.allDay) {
        // Para eventos "dia todo", definir início e fim no mesmo dia
        endDate = new Date(startDate);
        endDate.setHours(23, 59, 59, 999); // Fim do dia
        allDay = true;
        console.log('📅 [CALENDAR] Evento dia todo:', appointment.id, 'Start:', startDate, 'End:', endDate);
      } else {
        // Para eventos com horário específico, usar duração do serviço
        endDate = new Date(startDate.getTime() + (service?.duration || 60) * 60000);
        console.log('⏰ [CALENDAR] Evento com horário:', appointment.id, 'Start:', startDate, 'End:', endDate);
      }

      const event = {
        id: appointment.id,
        title: `${client?.name || 'Cliente'} - ${service?.name || 'Serviço'}`,
        start: startDate,
        end: endDate,
        allDay: allDay,
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
      
      console.log('✅ [CALENDAR] Evento criado:', {
        id: event.id,
        title: event.title,
        start: event.start,
        end: event.end,
        allDay: event.allDay,
        startType: typeof event.start,
        endType: typeof event.end
      });
      
      return event;
    }).filter(Boolean) as CalendarEvent[];
    
    console.log('🎯 [CALENDAR] Total de eventos processados:', events.length);
    
    // TESTE: Adiciona múltiplos eventos mock para garantir que funciona
    const mockEvents = [
      {
        id: -1,
        title: 'TESTE - Mock Hoje',
        start: new Date(), // Data de hoje
        end: new Date(Date.now() + 60 * 60 * 1000), // 1 hora depois
        allDay: false,
        appointment: null as any,
        responsible: { type: 'none' as const, id: null, name: 'Mock Hoje' },
        resource: {
          responsibleType: 'none' as const,
          responsibleId: null,
          responsibleName: 'Mock Hoje',
          status: 'scheduled',
          priority: 'normal'
        }
      },
      {
        id: -2,
        title: 'TESTE - Mock Dia Todo',
        start: new Date(2025, 6, 18), // 18 de julho de 2025
        end: new Date(2025, 6, 18, 23, 59), // Fim do dia
        allDay: true,
        appointment: null as any,
        responsible: { type: 'team' as const, id: -1, name: 'Mock Equipe' },
        resource: {
          responsibleType: 'team' as const,
          responsibleId: -1,
          responsibleName: 'Mock Equipe',
          status: 'scheduled',
          priority: 'normal'
        }
      },
      {
        id: -3,
        title: 'TESTE - Mock Amanhã',
        start: new Date(Date.now() + 24 * 60 * 60 * 1000), // Amanhã
        end: new Date(Date.now() + 24 * 60 * 60 * 1000 + 60 * 60 * 1000), // 1 hora depois
        allDay: false,
        appointment: null as any,
        responsible: { type: 'technician' as const, id: -1, name: 'Mock Técnico' },
        resource: {
          responsibleType: 'technician' as const,
          responsibleId: -1,
          responsibleName: 'Mock Técnico',
          status: 'scheduled',
          priority: 'normal'
        }
      }
    ];
    
    console.log('🧪 [CALENDAR] Adicionando eventos mock para teste:', mockEvents);
    events.push(...mockEvents);
    
    // TESTE EXTREMO: Evento simples para hoje
    const eventoSimples = {
      id: 999,
      title: 'EVENTO SIMPLES TESTE',
      start: new Date(2025, 6, 18, 10, 0), // 18 de julho de 2025, 10:00
      end: new Date(2025, 6, 18, 11, 0),   // 18 de julho de 2025, 11:00
      allDay: false,
      appointment: null as any,
      responsible: { type: 'none' as const, id: null, name: 'Evento Simples' }
    };
    
    console.log('🚨 [CALENDAR] Evento simples para teste:', eventoSimples);
    console.log('🚨 [CALENDAR] Start é Date?', eventoSimples.start instanceof Date);
    console.log('🚨 [CALENDAR] End é Date?', eventoSimples.end instanceof Date);
    
    // Adiciona evento simples que deveria aparecer no mês
    events.push(eventoSimples as any);
    
    console.log('🎯 [CALENDAR] TOTAL FINAL de eventos:', events.length);
    console.log('🎯 [CALENDAR] Primeiros 3 eventos:', events.slice(0, 3));
    
    return events;
  }, [appointments, clients, services, technicians, teams, view]);

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
    
    const responsibleType = responsible?.type ?? 'none';
    const responsibleId = responsible?.id ?? null;

    if (responsibleType !== 'none' && responsibleId) {
      const colorKey = `${responsibleType}-${responsibleId}`;
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
 
  console.log('calendarEvents:', calendarEvents);
  console.log('📊 [CALENDAR] Renderizando calendário com', calendarEvents.length, 'eventos no view:', view);
  
  // VALIDAÇÃO: Verificar se todos os eventos têm responsible correto
  console.log('🔍 [VALIDATION] Verificando campo responsible em todos os eventos:');
  calendarEvents.forEach((event, index) => {
    const responsible = getSafeResponsible(event);
    console.log(`   Evento ${index + 1}:`, {
      id: event.id,
      title: event.title,
      start: event.start,
      end: event.end,
      allDay: event.allDay,
      responsible: responsible,
      hasResponsible: !!event.responsible
    });
  });
  
  return (
    <div className="h-full">
      <ResponsibleLegend />
      
      <div style={{ width: '100%' }}>
        <DnDCalendar
          localizer={localizer}
          events={calendarEvents}
          startAccessor="start"
          endAccessor="end"
          style={{ height: '600px', width: '100%' }}
          view={view}
          onView={(newView) => {
            console.log('📱 [CALENDAR] Mudando view de', view, 'para', newView);
            setView(newView);
          }}
          date={date}
          onNavigate={(newDate) => {
            console.log('📅 [CALENDAR] Navegando para nova data:', newDate.toISOString());
            setDate(newDate);
          }}
          eventPropGetter={eventStyleGetter}
          onEventDrop={handleEventDrop}
          onEventResize={handleEventResize}
          onSelectEvent={handleSelectEvent}
          selectable
          resizable
          draggableAccessor={() => true}
          resizableAccessor={() => true}
          components={{
            month: { event: MonthEvent },
            week: { event: TimeEvent },
            day: { event: TimeEvent },
            agenda: { event: TimeEvent },
          }}
          views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
          culture="pt-BR"
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
            showMore: (total) => `+${total}`,
            work_week: "Semana de trabalho",
            yesterday: "Ontem",
            tomorrow: "Amanhã"
          }}
          formats={{
            dateFormat: 'dd',
            dayFormat: 'eeee',
            dayHeaderFormat: 'eeee dd/MM',
            dayRangeHeaderFormat: ({ start, end }, culture, localizer) =>
              `${localizer?.format(start, 'dd MMM', culture)} - ${localizer?.format(end, 'dd MMM yyyy', culture)}`,
            monthHeaderFormat: 'MMMM yyyy',
            agendaHeaderFormat: ({ start, end }, culture, localizer) =>
              `${localizer?.format(start, 'dd MMM', culture)} - ${localizer?.format(end, 'dd MMM yyyy', culture)}`,
            agendaDateFormat: 'eee dd/MM',
            agendaTimeFormat: 'HH:mm',
            agendaTimeRangeFormat: ({ start, end }, culture, localizer) =>
              `${localizer?.format(start, 'HH:mm', culture)} - ${localizer?.format(end, 'HH:mm', culture)}`,
            weekdayFormat: 'eeee',
            selectRangeFormat: ({ start, end }, culture, localizer) =>
              `${localizer?.format(start, 'dd MMM', culture)} - ${localizer?.format(end, 'dd MMM yyyy', culture)}`
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