import { useMemo } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar, CheckCircle, AlertCircle, Clock, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
}: AvailabilityCalendarProps) {

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

  return (
    <div className="space-y-4">
      {/* Header com navegação */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Visualização de disponibilidade por equipe/técnico
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePreviousMonth}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleToday}
          >
            Hoje
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNextMonth}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Legenda */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-3">Legenda:</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-100 border border-green-300 rounded"></div>
            <span className="text-xs">Disponível</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-100 border border-yellow-300 rounded"></div>
            <span className="text-xs">Parcialmente ocupado</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-100 border border-blue-300 rounded"></div>
            <span className="text-xs">Completo</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-100 border border-red-300 rounded"></div>
            <span className="text-xs">Excedido</span>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t">
          <p className="text-xs text-gray-600">
            <strong>Nota:</strong> Cada técnico e equipe possui horários de trabalho individuais definidos em seus cadastros.
          </p>
        </div>
      </Card>

      {/* Calendário */}
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
          {calendarDays.map((day, index) => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const dayData = availabilityByDay.get(dateKey);
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isTodayDate = isToday(day);

            return (
              <div
                key={index}
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

                    return (
                      <div
                        key={responsible.key}
                        className={`text-xs p-1 rounded border ${getStatusColor(responsibleData.status)}`}
                        title={`${responsible.name}: ${responsibleData.appointments.length} agendamento(s), ${formatMinutes(responsibleData.usedMinutes)} usado de ${formatMinutes(responsibleData.totalMinutes)}`}
                      >
                        <div className="flex items-center gap-1 justify-between">
                          <div className="flex items-center gap-1 truncate min-w-0">
                            <span>{responsible.type === 'team' ? '👥' : '👤'}</span>
                            <span className="truncate">{responsible.name}</span>
                          </div>
                          {getStatusIcon(responsibleData.status)}
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
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
