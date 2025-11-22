import { useMemo, useState } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar, CheckCircle, AlertCircle, Clock, XCircle, ChevronDown, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DndContext, useDraggable, useDroppable, DragOverlay, DragStartEvent, DragEndEvent, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import type { Appointment, Service, Technician, Team, TeamMember, BusinessRules, DateRestriction } from '@shared/schema';

interface AvailabilityCalendarProps {
  appointments: Appointment[];
  services: Service[];
  technicians: Technician[];
  teams: Team[];
  teamMembers: TeamMember[];
  businessRules: BusinessRules | null;
  currentDate: Date;
  onDateChange: (date: Date) => void;
  dateRestrictions: DateRestriction[];
  onEditAppointment?: (appointment: Appointment) => void;
}

interface DayAvailability {
  date: Date;
  byResponsible: Map<string, {
    type: 'technician' | 'team';
    id: number;
    name: string;
    totalMinutes: number;
    usedMinutes: number;
    availableMinutes: number;
    appointments: Appointment[];
    allDayCount: number;
    status: 'available' | 'partial' | 'full' | 'exceeded';
  }>;
}

export default function AvailabilityCalendar({
  appointments,
  services,
  technicians,
  teams,
  teamMembers,
  businessRules,
  currentDate,
  onDateChange,
  dateRestrictions,
  onEditAppointment,
}: AvailabilityCalendarProps) {

  // Estado para controlar quais células estão expandidas (formato: "dateKey|responsibleKey")
  const [expandedCells, setExpandedCells] = useState<Set<string>>(new Set());

  // Estado para drag & drop
  const [activeAppointment, setActiveAppointment] = useState<Appointment | null>(null);

  // React Query
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Mutation para atualizar agendamento
  const updateAppointmentMutation = useMutation({
    mutationFn: async ({ id, newDate }: { id: number; newDate: Date }) => {
      const response = await fetch(`/api/appointments/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(localStorage.getItem("token") && {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          }),
        },
        body: JSON.stringify({ scheduledDate: newDate }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao atualizar agendamento");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
      toast({
        title: "Sucesso",
        description: "Agendamento movido com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao mover agendamento.",
        variant: "destructive",
      });
    },
  });

  // Função para toggle de expansão
  const toggleExpanded = (dateKey: string, responsibleKey: string) => {
    const cellKey = `${dateKey}|${responsibleKey}`;
    setExpandedCells(prev => {
      const newSet = new Set(prev);
      if (newSet.has(cellKey)) {
        newSet.delete(cellKey);
      } else {
        newSet.add(cellKey);
      }
      return newSet;
    });
  };

  // Handlers de drag & drop
  const handleDragStart = (event: DragStartEvent) => {
    const aptId = event.active.id as number;
    const apt = appointments.find(a => a.id === aptId);
    setActiveAppointment(apt || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveAppointment(null);

    if (!over) return;

    const aptId = active.id as number;
    const targetDateKey = over.id as string;

    // Verificar se estamos movendo para um dia diferente
    const appointment = appointments.find(a => a.id === aptId);
    if (!appointment) return;

    const currentDateKey = format(new Date(appointment.scheduledDate), 'yyyy-MM-dd');
    if (currentDateKey === targetDateKey) return; // Mesmo dia, não faz nada

    // Criar nova data mantendo o horário original
    const originalDate = new Date(appointment.scheduledDate);
    const [year, month, day] = targetDateKey.split('-').map(Number);
    const newDate = new Date(
      year,
      month - 1,
      day,
      originalDate.getHours(),
      originalDate.getMinutes(),
      originalDate.getSeconds(),
      originalDate.getMilliseconds()
    );

    // Atualizar via API
    updateAppointmentMutation.mutate({ id: aptId, newDate });
  };

  // Função helper para verificar se técnico/equipe trabalha em determinado dia
  const worksOnDay = (responsibleType: 'technician' | 'team', responsibleId: number, date: Date): boolean => {
    const dayOfWeek = getDay(date); // 0 = domingo, 1 = segunda, ..., 6 = sábado
    const dayNames = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
    const dayName = dayNames[dayOfWeek];

    if (responsibleType === 'technician') {
      const tech = technicians.find(t => t.id === responsibleId);
      if (!tech) return false;
      const workDays = tech.diasTrabalho || ['segunda', 'terca', 'quarta', 'quinta', 'sexta'];
      return workDays.includes(dayName);
    } else {
      const team = teams.find(t => t.id === responsibleId);
      if (!team) return false;
      const workDays = team.diasTrabalho || ['segunda', 'terca', 'quarta', 'quinta', 'sexta'];
      return workDays.includes(dayName);
    }
  };

  // Função helper para calcular minutos de trabalho por técnico/equipe
  const getTotalWorkMinutes = (responsibleType: 'technician' | 'team', responsibleId: number) => {
    if (responsibleType === 'technician') {
      const tech = technicians.find(t => t.id === responsibleId);
      if (!tech) return 600; // 10 horas padrão

      const [startHour, startMinute] = (tech.horarioInicioTrabalho || '08:00').split(':').map(Number);
      const [endHour, endMinute] = (tech.horarioFimTrabalho || '18:00').split(':').map(Number);
      const almocoMinutos = tech.horarioAlmocoMinutos || 60;

      const totalMinutes = (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
      return totalMinutes - almocoMinutos;
    } else {
      const team = teams.find(t => t.id === responsibleId);
      if (!team) return 600; // 10 horas padrão

      const [startHour, startMinute] = (team.horarioInicioTrabalho || '08:00').split(':').map(Number);
      const [endHour, endMinute] = (team.horarioFimTrabalho || '18:00').split(':').map(Number);
      const almocoMinutos = team.horarioAlmocoMinutos || 60;

      const totalMinutes = (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
      return totalMinutes - almocoMinutos;
    }
  };

  // Processar disponibilidade por dia
  const availabilityByDay = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);

    // Expandir para incluir dias da grade visual (início da semana do mês anterior / fim da semana do mês seguinte)
    const startDay = new Date(monthStart);
    const dayOfWeek = getDay(monthStart);
    startDay.setDate(monthStart.getDate() - dayOfWeek);

    const endDay = new Date(monthEnd);
    const endDayOfWeek = getDay(monthEnd);
    endDay.setDate(monthEnd.getDate() + (6 - endDayOfWeek));

    const daysInMonth = eachDayOfInterval({ start: startDay, end: endDay });

    const availabilityMap = new Map<string, DayAvailability>();

    // Inicializar mapa de disponibilidade para cada dia
    daysInMonth.forEach(day => {
      const dateKey = format(day, 'yyyy-MM-dd');
      availabilityMap.set(dateKey, {
        date: day,
        byResponsible: new Map(),
      });
    });

    // Processar agendamentos
    appointments.forEach(apt => {
      const aptDate = new Date(apt.scheduledDate);
      const dateKey = format(aptDate, 'yyyy-MM-dd');
      const dayData = availabilityMap.get(dateKey);

      if (!dayData) return;

      // Ignorar agendamentos cancelados
      if (apt.status === 'cancelled') return;

      // DEBUG: Log detalhado para os dias problemáticos
      if (dateKey.includes('2025-11-25') || dateKey.includes('2025-11-26')) {
        console.log(`🕵️ [DEBUG APT] Date: ${dateKey}, ID: ${apt.id}, TechID: ${apt.technicianId}, TeamID: ${apt.teamId}, ServiceID: ${apt.serviceId}, AllDay: ${apt.allDay}, Status: ${apt.status}`);
      }

      // Determinar todos os responsáveis impactados por este agendamento
      const responsiblesForAppointment: Array<{
        key: string;
        type: 'technician' | 'team';
        id: number;
        name: string;
      }> = [];

      // Lógica Exclusiva:
      // 1) Se tem técnico definido, é um agendamento do TÉCNICO.
      // 2) Se não tem técnico mas tem equipe, é um agendamento da EQUIPE.

      if (apt.technicianId) {
        const tech = technicians.find(t => t.id === apt.technicianId);
        if (tech) {
          responsiblesForAppointment.push({
            key: `tech-${tech.id}`,
            type: 'technician',
            id: tech.id,
            name: tech.name,
          });
        }
      } else if (apt.teamId) {
        const team = teams.find(t => t.id === apt.teamId);
        if (team) {
          responsiblesForAppointment.push({
            key: `team-${team.id}`,
            type: 'team',
            id: team.id,
            name: team.name,
          });
        }
      }

      if (responsiblesForAppointment.length === 0) return;

      // Remover duplicados por chave (caso técnico/equipe sejam adicionados mais de uma vez)
      const uniqueResponsibles = new Map<string, typeof responsiblesForAppointment[0]>();
      responsiblesForAppointment.forEach(r => {
        if (!uniqueResponsibles.has(r.key)) {
          uniqueResponsibles.set(r.key, r);
        }
      });

      // Obter duração em minutos (sempre em minutos conforme services.duration)
      let durationMinutes = 0;
      const isAllDay = apt.allDay;
      if (!isAllDay) {
        const service = services.find(s => s.id === apt.serviceId);
        durationMinutes = service?.duration || 60;

        // DEBUG: Log de duração
        if (dateKey.includes('2025-11-25') || dateKey.includes('2025-11-26')) {
          console.log(`   ⏱️ Duration: ${durationMinutes}m (Service: ${service?.name || 'Unknown'})`);
        }
      }

      // Aplicar o agendamento a todos os responsáveis impactados
      uniqueResponsibles.forEach(responsible => {
        if (!dayData.byResponsible.has(responsible.key)) {
          const totalMinutes = getTotalWorkMinutes(responsible.type, responsible.id);
          dayData.byResponsible.set(responsible.key, {
            type: responsible.type,
            id: responsible.id,
            name: responsible.name,
            totalMinutes: totalMinutes,
            usedMinutes: 0,
            availableMinutes: totalMinutes,
            appointments: [],
            allDayCount: 0,
            status: 'available',
          });
        }

        const responsibleData = dayData.byResponsible.get(responsible.key)!;
        responsibleData.appointments.push(apt);

        // Calcular tempo usado
        if (isAllDay) {
          // Se é dia inteiro, consome toda disponibilidade e incrementa contador
          responsibleData.allDayCount++;
          // Se já tinha tempo usado (de outros agendamentos), soma o total do dia
          // Se é o primeiro, define como total do dia
          if (responsibleData.usedMinutes < responsibleData.totalMinutes) {
            responsibleData.usedMinutes += responsibleData.totalMinutes;
          } else {
            // Já estava cheio ou excedido, soma mais um dia (caso raro de 2 full days) ou mantém lógica
            responsibleData.usedMinutes += responsibleData.totalMinutes;
          }
        } else {
          responsibleData.usedMinutes += durationMinutes;
        }

        // Calcular disponibilidade restante e status
        if (responsibleData.allDayCount > 0) {
          // Se tem dia inteiro
          if (responsibleData.usedMinutes > responsibleData.totalMinutes) {
            // Dia inteiro + outros agendamentos = EXCEDIDO
            responsibleData.status = 'exceeded';
            responsibleData.availableMinutes = responsibleData.totalMinutes - responsibleData.usedMinutes; // Fica negativo
          } else {
            // Apenas dia inteiro = COMPLETO
            responsibleData.status = 'full';
            responsibleData.availableMinutes = 0;
          }
        } else {
          // Agendamentos normais
          responsibleData.availableMinutes = responsibleData.totalMinutes - responsibleData.usedMinutes;

          // Log para debug do dia 26/11 ou 25/11
          if (dateKey.includes('2025-11-25') || dateKey.includes('2025-11-26')) {
            console.log(`🔍 [DEBUG] ${responsible.name} on ${dateKey}: Used=${responsibleData.usedMinutes}, Total=${responsibleData.totalMinutes}, Status=${responsibleData.status}`);
          }

          if (responsibleData.usedMinutes === 0) {
            responsibleData.status = 'available';
          } else if (responsibleData.usedMinutes < responsibleData.totalMinutes) {
            responsibleData.status = 'partial';
          } else if (responsibleData.usedMinutes === responsibleData.totalMinutes) {
            responsibleData.status = 'full';
          } else {
            responsibleData.status = 'exceeded';
          }
        }
      });
    });

    // Pós-processamento: Lógica de Exclusão Mútua
    // 1. Equipe com agendamento -> Bloqueia seus técnicos (Status 'full')
    // 2. Técnico com agendamento -> Bloqueia suas equipes (Status 'full')
    // 3. Técnico A com agendamento -> NÃO bloqueia Técnico B

    // Helper para garantir que o responsável exista no mapa do dia
    const ensureEntry = (dayData: DayAvailability, type: 'technician' | 'team', id: number) => {
      const key = type === 'technician' ? `tech-${id}` : `team-${id}`;
      if (!dayData.byResponsible.has(key)) {
        let name = '';
        let totalMinutes = 0;
        if (type === 'technician') {
          const t = technicians.find(x => x.id === id);
          name = t?.name || '';
          totalMinutes = getTotalWorkMinutes('technician', id);
        } else {
          const t = teams.find(x => x.id === id);
          name = t?.name || '';
          totalMinutes = getTotalWorkMinutes('team', id);
        }

        dayData.byResponsible.set(key, {
          type,
          id,
          name,
          totalMinutes,
          usedMinutes: 0,
          availableMinutes: totalMinutes,
          appointments: [],
          allDayCount: 0,
          status: 'available'
        });
      }
      return dayData.byResponsible.get(key)!;
    };

    availabilityMap.forEach((dayData) => {
      // Iterar sobre uma cópia dos valores para evitar problemas ao modificar o mapa
      const entries = Array.from(dayData.byResponsible.values());

      entries.forEach(data => {
        // Se tem agendamentos (seja normal ou dia inteiro)
        if (data.appointments.length > 0) {
          if (data.type === 'team') {
            // Regra: Equipe bloqueia seus técnicos
            const members = teamMembers.filter(tm => tm.teamId === data.id);
            members.forEach(tm => {
              const techData = ensureEntry(dayData, 'technician', tm.technicianId);
              // Só altera para 'full' se não estiver 'exceeded' (que é mais grave)
              if (techData.status !== 'exceeded') {
                techData.status = 'full';
                techData.availableMinutes = 0;
              }
            });
          } else { // technician
            // Regra: Técnico bloqueia suas equipes
            const myTeams = teamMembers.filter(tm => tm.technicianId === data.id);
            myTeams.forEach(tm => {
              const teamData = ensureEntry(dayData, 'team', tm.teamId);
              // Só altera para 'full' se não estiver 'exceeded'
              if (teamData.status !== 'exceeded') {
                teamData.status = 'full';
                teamData.availableMinutes = 0;
              }
            });
          }
        }
      });
    });

    return availabilityMap;
  }, [appointments, services, technicians, teams, currentDate, teamMembers]);

  // Mapear restrições por dia e responsável (ex.: "2025-11-15|technician-1")
  const restrictionsByDayAndResponsible = useMemo(() => {
    const map = new Map<string, DateRestriction[]>();

    dateRestrictions.forEach((r) => {
      const dateKey = format(new Date(r.date), 'yyyy-MM-dd');
      const key = `${dateKey}|${r.responsibleType}-${r.responsibleId}`;
      const existing = map.get(key) || [];
      existing.push(r);
      map.set(key, existing);
    });

    return map;
  }, [dateRestrictions]);

  // Obter todos os responsáveis únicos
  const allResponsibles = useMemo(() => {
    const responsibles: Array<{ key: string; type: 'technician' | 'team'; id: number; name: string }> = [];

    technicians.forEach(tech => {
      responsibles.push({
        key: `tech-${tech.id}`,
        type: 'technician',
        id: tech.id,
        name: tech.name,
      });
    });

    teams.forEach(team => {
      responsibles.push({
        key: `team-${team.id}`,
        type: 'team',
        id: team.id,
        name: team.name,
      });
    });

    return responsibles;
  }, [technicians, teams]);

  // Navegação de mês
  const handlePreviousMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() - 1);
    onDateChange(newDate);
  };

  const handleNextMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + 1);
    onDateChange(newDate);
  };

  const handleToday = () => {
    onDateChange(new Date());
  };

  // Obter cor baseada no status
  const getStatusColor = (status: 'available' | 'partial' | 'full' | 'exceeded') => {
    switch (status) {
      case 'available':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'partial':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'full':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'exceeded':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusIcon = (status: 'available' | 'partial' | 'full' | 'exceeded') => {
    switch (status) {
      case 'available':
        return <CheckCircle className="h-3 w-3" />;
      case 'partial':
        return <Clock className="h-3 w-3" />;
      case 'full':
        return <AlertCircle className="h-3 w-3" />;
      case 'exceeded':
        return <AlertCircle className="h-3 w-3" />;
      default:
        return <Clock className="h-3 w-3" />;
    }
  };

  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0 && mins > 0) {
      return `${hours}h ${mins}m`;
    } else if (hours > 0) {
      return `${hours}h`;
    } else {
      return `${mins}m`;
    }
  };

  // Obter dias do calendário (incluindo dias do mês anterior e próximo para preencher semanas)
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);

    // Começar no domingo anterior ou no primeiro dia do mês
    const startDay = new Date(monthStart);
    const dayOfWeek = getDay(monthStart);
    startDay.setDate(monthStart.getDate() - dayOfWeek);

    // Terminar no sábado seguinte ou no último dia do mês
    const endDay = new Date(monthEnd);
    const endDayOfWeek = getDay(monthEnd);
    endDay.setDate(monthEnd.getDate() + (6 - endDayOfWeek));

    return eachDayOfInterval({ start: startDay, end: endDay });
  }, [currentDate]);

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  // Sensores para drag & drop com restrição de ativação (evita conflito com clique)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Só ativa drag após mover 8px
      },
    })
  );

  return (
    <div className="space-y-4">
      {/* Header com navegação */}
      <div className="flex items-center justify-between bg-white p-4 rounded-lg border shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Gestão de disponibilidade
          </p>
        </div>
        <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-md border">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 hover:bg-white hover:shadow-sm"
            onClick={handlePreviousMonth}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-3 text-xs font-medium hover:bg-white hover:shadow-sm"
            onClick={handleToday}
          >
            Hoje
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 hover:bg-white hover:shadow-sm"
            onClick={handleNextMonth}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Legenda */}
      {/* Legenda */}
      <Card className="p-4 border-none shadow-sm bg-gray-50/50">
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <span className="font-semibold text-gray-700 mr-2">Legenda:</span>

          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
            <span className="text-gray-600">Disponível</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div>
            <span className="text-gray-600">Parcial</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
            <span className="text-gray-600">Completo</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
            <span className="text-gray-600">Excedido</span>
          </div>

          <div className="ml-auto text-gray-400 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            <span>Horários individuais considerados</span>
          </div>
        </div>
      </Card>

      {/* Calendário */}
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="border rounded-lg overflow-hidden bg-white">
          {/* Cabeçalho dos dias da semana */}
          <div className="grid grid-cols-7 bg-gray-100 border-b">
            {weekDays.map(day => (
              <div
                key={day}
                className="p-2 text-center text-xs font-semibold text-gray-700"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Dias do mês */}
          <div className="grid grid-cols-1 md:grid-cols-7">
            {
              calendarDays.map((day, index) => {
                const dateKey = format(day, 'yyyy-MM-dd');
                const dayData = availabilityByDay.get(dateKey);
                const isCurrentMonth = isSameMonth(day, currentDate);
                const isTodayDate = isToday(day);

                return (
                  <DroppableDay
                    key={index}
                    dateKey={dateKey}
                    className={`min-h-[120px] p-2 border-b border-r ${!isCurrentMonth ? 'bg-gray-50' : ''
                      } ${isTodayDate ? 'bg-blue-50' : ''}`}
                  >
                    {/* Número do dia */}
                    <div className={`text-xs font-semibold mb-2 ${!isCurrentMonth ? 'text-gray-400' : 'text-gray-900'
                      } ${isTodayDate ? 'text-blue-600' : ''}`}>
                      {format(day, 'd')}
                    </div>

                    {/* Disponibilidade por responsável */}
                    <div className="space-y-1">
                      {allResponsibles.map(responsible => {
                        // Verificar se o responsável trabalha neste dia
                        const worksThisDay = worksOnDay(responsible.type, responsible.id, day);

                        // Se não trabalha neste dia, não exibir
                        if (!worksThisDay) {
                          return null;
                        }

                        const restrictionKey = `${dateKey}|${responsible.type}-${responsible.id}`;
                        const restrictionsForResponsible = restrictionsByDayAndResponsible.get(restrictionKey);

                        if (restrictionsForResponsible && restrictionsForResponsible.length > 0) {
                          const reason = restrictionsForResponsible[0]?.title || 'Indisponível';
                          return (
                            <div
                              key={responsible.key}
                              className="text-xs p-1 rounded border bg-red-50 border-red-300"
                              title={`${responsible.name}: indisponível (${reason})`}
                            >
                              <div className="flex items-center gap-1 justify-between">
                                <div className="flex items-center gap-1 truncate min-w-0">
                                  <span>{responsible.type === 'team' ? '👥' : '👤'}</span>
                                  <span className="truncate text-red-700">{responsible.name}</span>
                                </div>
                                <XCircle className="h-3 w-3 text-red-600" />
                              </div>
                              <div className="text-[10px] mt-0.5 text-red-700 truncate">
                                {reason}
                              </div>
                            </div>
                          );
                        }

                        const responsibleData = dayData?.byResponsible.get(responsible.key);

                        if (!responsibleData) {
                          // Sem agendamentos para este responsável neste dia - DISPONÍVEL (verde)
                          return (
                            <div
                              key={responsible.key}
                              className="text-xs p-1 rounded border bg-green-50 border-green-200"
                            >
                              <div className="flex items-center gap-1 truncate">
                                <span>{responsible.type === 'team' ? '👥' : '👤'}</span>
                                <span className="truncate text-green-700">{responsible.name}</span>
                              </div>
                            </div>
                          );
                        }

                        const cellKey = `${dateKey}|${responsible.key}`;
                        const isExpanded = expandedCells.has(cellKey);

                        return (
                          <div
                            key={responsible.key}
                            className={`text-xs p-1 rounded border ${getStatusColor(responsibleData.status)}`}
                          >
                            <div
                              className="flex items-center gap-1 justify-between cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() => toggleExpanded(dateKey, responsible.key)}
                              title={`${responsible.name}: ${responsibleData.appointments.length} agendamento(s), ${formatMinutes(responsibleData.usedMinutes)} usado de ${formatMinutes(responsibleData.totalMinutes)}. Clique para ${isExpanded ? 'ocultar' : 'expandir'} detalhes.`}
                            >
                              <div className="flex items-center gap-1 truncate min-w-0">
                                <span>{responsible.type === 'team' ? '👥' : '👤'}</span>
                                <span className="truncate">{responsible.name}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                {getStatusIcon(responsibleData.status)}
                                <ChevronDown
                                  className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                />
                              </div>
                            </div>
                            <div className="text-xs mt-0.5 font-semibold">
                              {responsibleData.allDayCount > 0 ? (
                                <span className="text-red-700">
                                  {responsibleData.allDayCount} dia{responsibleData.allDayCount > 1 ? 's' : ''} inteiro{responsibleData.allDayCount > 1 ? 's' : ''}
                                  {responsibleData.appointments.length > responsibleData.allDayCount && (
                                    <span> + {responsibleData.appointments.length - responsibleData.allDayCount} evento{responsibleData.appointments.length - responsibleData.allDayCount > 1 ? 's' : ''}</span>
                                  )}
                                </span>
                              ) : responsibleData.status === 'exceeded' ? (
                                <span className="text-red-700">
                                  +{formatMinutes(Math.abs(responsibleData.availableMinutes))} excedido
                                </span>
                              ) : responsibleData.status === 'full' ? (
                                <span>Completo</span>
                              ) : (
                                <span>{formatMinutes(responsibleData.availableMinutes)} livre</span>
                              )}
                            </div>

                            {/* Eventos expandidos com drag & drop */}
                            {isExpanded && responsibleData.appointments.length > 0 && (
                              <div className="mt-2 pt-2 border-t space-y-1">
                                {responsibleData.appointments.map((apt, aptIndex) => (
                                  <DraggableAppointmentCard
                                    key={`${apt.id}-${aptIndex}`}
                                    appointment={apt}
                                    services={services}
                                    formatMinutes={formatMinutes}
                                    onEdit={onEditAppointment}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </DroppableDay>
                );
              })
            }
          </div >
        </div >

        {/* DragOverlay para preview durante drag */}
        <DragOverlay>
          {
            activeAppointment ? (
              <DraggableAppointmentCard
                appointment={activeAppointment}
                services={services}
                formatMinutes={formatMinutes}
                isDragging
              />
            ) : null
          }
        </DragOverlay >
      </DndContext >
    </div >
  );
}

// Componente para célula de dia (Droppable)
function DroppableDay({ dateKey, children, className }: { dateKey: string; children: React.ReactNode; className: string }) {
  const { setNodeRef, isOver } = useDroppable({
    id: dateKey,
  });

  return (
    <div
      ref={setNodeRef}
      className={`${className} ${isOver ? 'ring-2 ring-blue-400 ring-inset' : ''}`}
    >
      {children}
    </div>
  );
}

// Componente para card de agendamento (Draggable)
function DraggableAppointmentCard({
  appointment,
  services,
  formatMinutes,
  isDragging = false,
  onEdit,
}: {
  appointment: Appointment;
  services: Service[];
  formatMinutes: (minutes: number) => string;
  isDragging?: boolean;
  onEdit?: (appointment: Appointment) => void;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: appointment.id,
  });

  const service = services.find(s => s.id === appointment.serviceId);
  const serviceName = service?.name || 'Serviço sem nome';

  let timeInfo = '';
  if (appointment.allDay) {
    timeInfo = 'Dia inteiro';
  } else {
    const duration = service?.duration || 60;
    const startTime = format(new Date(appointment.scheduledDate), 'HH:mm');
    timeInfo = `${startTime} (${formatMinutes(duration)})`;
  }

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  const statusColor = appointment.status === 'confirmed' ? 'border-l-green-500' :
    appointment.status === 'pending' ? 'border-l-yellow-500' :
      appointment.status === 'completed' ? 'border-l-blue-500' : 'border-l-gray-300';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => !isDragging && onEdit?.(appointment)}
      className={`
        group relative text-xs p-2 bg-white rounded-md border border-gray-100 shadow-sm cursor-pointer transition-all duration-200
        border-l-[3px] ${statusColor}
        ${isDragging
          ? 'opacity-50 rotate-2 shadow-xl cursor-grabbing scale-105 z-50'
          : 'hover:shadow-md hover:scale-[1.02] hover:border-gray-200'
        }
      `}
    >
      <div className="flex flex-col gap-1">
        <div className="font-medium text-gray-900 truncate leading-tight" title={serviceName}>
          {serviceName}
        </div>
        <div className="flex items-center justify-between text-[10px] text-gray-500">
          <span className="font-medium">{timeInfo}</span>
          {appointment.status === 'pending' && <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" title="Pendente" />}
        </div>
      </div>
    </div>
  );
}
