import { db } from "./db";
import {
  dailyAvailability,
  appointments,
  services,
  technicians,
  teams,
  teamMembers,
  dateRestrictions,
  type Appointment
} from "../shared/schema";
import { eq, and, sql } from "drizzle-orm";

/**
 * Calcula e atualiza a disponibilidade para um dia específico e responsável
 */
export async function updateDailyAvailability(
  userId: number,
  date: Date,
  responsibleType: 'technician' | 'team',
  responsibleId: number
) {


  // Normalizar data para início do dia para comparação consistente
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  // Verificar se existe restrição de data para este responsável neste dia
  const restriction = await db.query.dateRestrictions.findFirst({
    where: and(
      eq(dateRestrictions.userId, userId),
      eq(dateRestrictions.responsibleType, responsibleType),
      eq(dateRestrictions.responsibleId, responsibleId),
      sql`${dateRestrictions.date} >= ${startOfDay.toISOString()}`,
      sql`${dateRestrictions.date} <= ${endOfDay.toISOString()}`
    ),
  });

  if (restriction) {
    console.log(`⛔ [AVAILABILITY] Dia ${startOfDay.toISOString().split('T')[0]} marcado como RESTRITO para ${responsibleType} #${responsibleId} (${restriction.title})`);

    const existingAvailability = await db.query.dailyAvailability.findFirst({
      where: and(
        eq(dailyAvailability.userId, userId),
        eq(dailyAvailability.date, startOfDay),
        eq(dailyAvailability.responsibleType, responsibleType),
        eq(dailyAvailability.responsibleId, responsibleId)
      ),
    });

    const availabilityData = {
      userId,
      date: startOfDay,
      responsibleType,
      responsibleId,
      totalMinutes: 0,
      usedMinutes: 0,
      availableMinutes: 0,
      appointmentCount: 0,
      status: 'full' as const,
      updatedAt: new Date(),
    };

    if (existingAvailability) {
      await db
        .update(dailyAvailability)
        .set(availabilityData)
        .where(eq(dailyAvailability.id, existingAvailability.id));
    } else {
      await db.insert(dailyAvailability).values({
        ...availabilityData,
        createdAt: new Date(),
      });
    }

    return;
  }

  // Buscar horários de trabalho do técnico ou equipe
  let horarioInicioTrabalho: string;
  let horarioFimTrabalho: string;
  let horarioAlmocoMinutos: number;
  let diasTrabalho: string[];

  if (responsibleType === 'technician') {
    const technician = await db.query.technicians.findFirst({
      where: and(
        eq(technicians.id, responsibleId),
        eq(technicians.userId, userId)
      ),
    });

    if (!technician) {
      console.warn(`⚠️ [AVAILABILITY] Técnico #${responsibleId} não encontrado`);
      return;
    }

    horarioInicioTrabalho = technician.horarioInicioTrabalho || '08:00';
    horarioFimTrabalho = technician.horarioFimTrabalho || '18:00';
    horarioAlmocoMinutos = technician.horarioAlmocoMinutos || 60;
    diasTrabalho = technician.diasTrabalho || ['segunda', 'terca', 'quarta', 'quinta', 'sexta'];
  } else {
    const team = await db.query.teams.findFirst({
      where: and(
        eq(teams.id, responsibleId),
        eq(teams.userId, userId)
      ),
    });

    if (!team) {
      console.warn(`⚠️ [AVAILABILITY] Equipe #${responsibleId} não encontrada`);
      return;
    }

    horarioInicioTrabalho = team.horarioInicioTrabalho || '08:00';
    horarioFimTrabalho = team.horarioFimTrabalho || '18:00';
    horarioAlmocoMinutos = team.horarioAlmocoMinutos || 60;
    diasTrabalho = team.diasTrabalho || ['segunda', 'terca', 'quarta', 'quinta', 'sexta'];
  }

  // Verificar se o dia da semana está nos dias de trabalho
  const dayOfWeek = date.getDay(); // 0 = domingo, 1 = segunda, etc.
  const dayNames = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
  const currentDayName = dayNames[dayOfWeek];

  if (!diasTrabalho.includes(currentDayName)) {
    console.log(`📅 [AVAILABILITY] ${responsibleType} #${responsibleId} não trabalha às ${currentDayName}s`);
    // Dia de folga - disponibilidade zero
    const availabilityData = {
      userId,
      date,
      responsibleType,
      responsibleId,
      totalMinutes: 0,
      usedMinutes: 0,
      availableMinutes: 0,
      appointmentCount: 0,
      status: 'available' as const,
      updatedAt: new Date(),
    };

    const existingAvailability = await db.query.dailyAvailability.findFirst({
      where: and(
        eq(dailyAvailability.userId, userId),
        eq(dailyAvailability.date, date),
        eq(dailyAvailability.responsibleType, responsibleType),
        eq(dailyAvailability.responsibleId, responsibleId)
      ),
    });

    if (existingAvailability) {
      await db
        .update(dailyAvailability)
        .set(availabilityData)
        .where(eq(dailyAvailability.id, existingAvailability.id));
    } else {
      await db.insert(dailyAvailability).values({
        ...availabilityData,
        createdAt: new Date(),
      });
    }
    return;
  }

  // Calcular total de minutos disponíveis no dia (descontando almoço)
  const [startHour, startMinute] = horarioInicioTrabalho.split(':').map(Number);
  const [endHour, endMinute] = horarioFimTrabalho.split(':').map(Number);
  const totalMinutesBeforeLunch = (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
  const totalMinutes = totalMinutesBeforeLunch - horarioAlmocoMinutos;

  // Buscar agendamentos do dia para o responsável

  // Buscar agendamentos do dia para o responsável e cruzamentos
  // 1. Agendamentos diretos do responsável
  const dayAppointments = await db.query.appointments.findMany({
    where: and(
      eq(appointments.userId, userId),
      responsibleType === 'technician'
        ? eq(appointments.technicianId, responsibleId)
        : eq(appointments.teamId, responsibleId),
      sql`${appointments.scheduledDate} >= ${startOfDay.toISOString()}`,
      sql`${appointments.scheduledDate} <= ${endOfDay.toISOString()}`,
      sql`${appointments.status} != 'cancelled'` // Ignorar cancelados
    ),
  });

  // Calcular minutos usados
  let usedMinutes = 0;

  // 1.1 Somar agendamentos diretos
  for (const apt of dayAppointments) {
    if (apt.allDay) {
      usedMinutes = totalMinutes;
      break;
    }
    const service = await db.query.services.findFirst({
      where: eq(services.id, apt.serviceId),
    });
    if (service) {
      usedMinutes += service.duration;
    }
  }

  // 2. Cruzamento: Verificar agendamentos conflitantes
  if (usedMinutes < totalMinutes) { // Só verifica se ainda tiver tempo
    if (responsibleType === 'technician') {
      // TÉCNICO: Verificar se as EQUIPES que ele participa têm agendamento
      const myTeams = await db.query.teamMembers.findMany({
        where: eq(teamMembers.technicianId, responsibleId),
      });

      for (const tm of myTeams) {
        if (usedMinutes >= totalMinutes) break;

        const teamAppts = await db.query.appointments.findMany({
          where: and(
            eq(appointments.userId, userId),
            eq(appointments.teamId, tm.teamId),
            sql`${appointments.scheduledDate} >= ${startOfDay.toISOString()}`,
            sql`${appointments.scheduledDate} <= ${endOfDay.toISOString()}`,
            sql`${appointments.status} != 'cancelled'` // Ignorar cancelados
          ),
        });

        if (teamAppts.length > 0) {

          // REGRA DE NEGÓCIO: Se a equipe trabalha, o membro não trabalha avulso no mesmo dia.
          // Bloqueio total do dia.
          usedMinutes = totalMinutes;
          break;
        }
      }
    } else {
      // EQUIPE: Verificar se os MEMBROS têm agendamento individual
      const members = await db.query.teamMembers.findMany({
        where: eq(teamMembers.teamId, responsibleId),
      });

      for (const member of members) {
        if (usedMinutes >= totalMinutes) break;

        const memberAppts = await db.query.appointments.findMany({
          where: and(
            eq(appointments.userId, userId),
            eq(appointments.technicianId, member.technicianId),
            sql`${appointments.scheduledDate} >= ${startOfDay.toISOString()}`,
            sql`${appointments.scheduledDate} <= ${endOfDay.toISOString()}`,
            sql`${appointments.status} != 'cancelled'` // Ignorar cancelados
          ),
        });

        for (const apt of memberAppts) {
          console.log(`🔒 [AVAILABILITY] Equipe #${responsibleId} bloqueada: Membro #${member.technicianId} tem agendamento individual`);
          // Se um membro está ocupado, a equipe (como unidade indivisível) não pode trabalhar
          // Consideramos "block" total ou somamos o tempo? 
          // Regra conservadora: Soma o tempo do agendamento do membro como tempo indisponível para a equipe
          if (apt.allDay) {
            usedMinutes = totalMinutes;
            break;
          }
          const service = await db.query.services.findFirst({
            where: eq(services.id, apt.serviceId),
          });
          if (service) {
            usedMinutes += service.duration;
          }
        }
      }
    }
  }

  // Garantir que não estoure o total (embora logicamente signifique 'indisponível')
  if (usedMinutes > totalMinutes) {
    usedMinutes = totalMinutes;
  }

  const availableMinutes = totalMinutes - usedMinutes;

  // Determinar status
  let status: 'available' | 'partial' | 'full' | 'exceeded';
  if (usedMinutes === 0) {
    status = 'available';
  } else if (usedMinutes < totalMinutes) {
    status = 'partial';
  } else if (usedMinutes === totalMinutes) {
    status = 'full';
  } else {
    status = 'exceeded';
  }

  // Inserir ou atualizar disponibilidade
  const existingAvailability = await db.query.dailyAvailability.findFirst({
    where: and(
      eq(dailyAvailability.userId, userId),
      eq(dailyAvailability.date, date),
      eq(dailyAvailability.responsibleType, responsibleType),
      eq(dailyAvailability.responsibleId, responsibleId)
    ),
  });

  const availabilityData = {
    userId,
    date,
    responsibleType,
    responsibleId,
    totalMinutes,
    usedMinutes,
    availableMinutes,
    appointmentCount: dayAppointments.length, // Mantemos contagem de appts DIRETA, mas tempo reflete cruzamento
    status,
    updatedAt: new Date(),
  };

  if (existingAvailability) {
    await db
      .update(dailyAvailability)
      .set(availabilityData)
      .where(eq(dailyAvailability.id, existingAvailability.id));

    await db.insert(dailyAvailability).values({
      ...availabilityData,
      createdAt: new Date(),
    });
  }
}

/**
 * Valida se existe restrição de data para técnico/equipe no dia informado
 */
export async function validateDateRestriction(
  userId: number,
  date: Date,
  technicianId: number | null,
  teamId: number | null,
): Promise<{ valid: boolean; message?: string }> {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  // Técnico individual
  if (technicianId) {
    const restriction = await db.query.dateRestrictions.findFirst({
      where: and(
        eq(dateRestrictions.userId, userId),
        eq(dateRestrictions.responsibleType, 'technician'),
        eq(dateRestrictions.responsibleId, technicianId),
        sql`${dateRestrictions.date} >= ${startOfDay.toISOString()}`,
        sql`${dateRestrictions.date} <= ${endOfDay.toISOString()}`
      ),
    });

    if (restriction) {
      const tech = await db.query.technicians.findFirst({
        where: and(eq(technicians.id, technicianId), eq(technicians.userId, userId)),
      });

      const displayDate = startOfDay.toLocaleDateString('pt-BR');
      return {
        valid: false,
        message: `O técnico ${tech?.name || '#' + technicianId} está indisponível em ${displayDate} (${restriction.title}).`,
      };
    }
  }

  // Equipe
  if (teamId) {
    const restriction = await db.query.dateRestrictions.findFirst({
      where: and(
        eq(dateRestrictions.userId, userId),
        eq(dateRestrictions.responsibleType, 'team'),
        eq(dateRestrictions.responsibleId, teamId),
        sql`${dateRestrictions.date} >= ${startOfDay.toISOString()}`,
        sql`${dateRestrictions.date} <= ${endOfDay.toISOString()}`
      ),
    });

    if (restriction) {
      const team = await db.query.teams.findFirst({
        where: and(eq(teams.id, teamId), eq(teams.userId, userId)),
      });

      const displayDate = startOfDay.toLocaleDateString('pt-BR');
      return {
        valid: false,
        message: `A equipe ${team?.name || '#' + teamId} está indisponível em ${displayDate} (${restriction.title}).`,
      };
    }
  }

  return { valid: true };
}

/**
 * Valida se um técnico ou equipe pode ter agendamento em determinado dia
 * Regra: Se técnico está em equipe e equipe tem agendamento no dia, técnico não pode ter agendamento individual
 * E vice-versa: se técnico tem agendamento individual, equipes que ele faz parte não podem ter agendamentos
 */
export async function validateTechnicianTeamConflict(
  userId: number,
  date: Date,
  technicianId: number | null,
  teamId: number | null,
  excludeAppointmentId?: number
): Promise<{ valid: boolean; message?: string }> {
  console.log(`🔍 [VALIDATION] Validando conflito técnico/equipe para ${date.toISOString()}`);

  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  // Caso 1: Criando agendamento para TÉCNICO individual
  if (technicianId && !teamId) {
    // Verificar se o técnico faz parte de alguma equipe
    const technicianTeams = await db.query.teamMembers.findMany({
      where: eq(teamMembers.technicianId, technicianId),
    });

    if (technicianTeams.length > 0) {
      // Verificar se alguma dessas equipes tem agendamentos no dia
      for (const tm of technicianTeams) {
        const teamAppointments = await db.query.appointments.findMany({
          where: and(
            eq(appointments.userId, userId),
            eq(appointments.teamId, tm.teamId),
            sql`${appointments.scheduledDate} >= ${startOfDay.toISOString()}`,
            sql`${appointments.scheduledDate} <= ${endOfDay.toISOString()}`,
            excludeAppointmentId ? sql`${appointments.id} != ${excludeAppointmentId}` : sql`true`
          ),
        });

        if (teamAppointments.length > 0) {
          // Buscar nome da equipe
          const team = await db.query.teams.findFirst({
            where: eq(sql`id`, tm.teamId),
          });

          return {
            valid: false,
            message: `O técnico faz parte da equipe "${team?.name || 'desconhecida'}" que já possui agendamentos neste dia. Apenas um pode ter agendamentos no mesmo dia.`
          };
        }
      }
    }
  }

  // Caso 2: Criando agendamento para EQUIPE
  if (teamId && !technicianId) {
    // Buscar todos os técnicos da equipe
    const teamTechnicians = await db.query.teamMembers.findMany({
      where: eq(teamMembers.teamId, teamId),
    });

    // Verificar se algum técnico da equipe tem agendamento individual no dia
    for (const tm of teamTechnicians) {
      const techAppointments = await db.query.appointments.findMany({
        where: and(
          eq(appointments.userId, userId),
          eq(appointments.technicianId, tm.technicianId),
          sql`${appointments.scheduledDate} >= ${startOfDay.toISOString()}`,
          sql`${appointments.scheduledDate} <= ${endOfDay.toISOString()}`,
          excludeAppointmentId ? sql`${appointments.id} != ${excludeAppointmentId}` : sql`true`
        ),
      });

      if (techAppointments.length > 0) {
        // Buscar nome do técnico
        const technician = await db.query.technicians.findFirst({
          where: eq(sql`id`, tm.technicianId),
        });

        return {
          valid: false,
          message: `O técnico "${technician?.name || 'desconhecido'}" da equipe já possui agendamentos individuais neste dia. Apenas um pode ter agendamentos no mesmo dia.`
        };
      }
    }
  }

  console.log(`✅ [VALIDATION] Sem conflitos técnico/equipe`);
  return { valid: true };
}

/**
 * Atualiza disponibilidade para todos os responsáveis afetados por um agendamento
 */
export async function updateAvailabilityForAppointment(
  userId: number,
  appointment: Appointment
) {
  const date = new Date(appointment.scheduledDate);

  // Atualizar disponibilidade do técnico
  if (appointment.technicianId) {
    await updateDailyAvailability(userId, date, 'technician', appointment.technicianId);

    // Se o técnico faz parte de equipes, atualizar disponibilidade delas também
    const technicianTeams = await db.query.teamMembers.findMany({
      where: eq(teamMembers.technicianId, appointment.technicianId),
    });

    for (const tm of technicianTeams) {
      await updateDailyAvailability(userId, date, 'team', tm.teamId);
    }
  }

  // Atualizar disponibilidade da equipe
  if (appointment.teamId) {
    await updateDailyAvailability(userId, date, 'team', appointment.teamId);

    // Atualizar disponibilidade de todos os técnicos da equipe
    const teamTechs = await db.query.teamMembers.findMany({
      where: eq(teamMembers.teamId, appointment.teamId),
    });

    for (const tm of teamTechs) {
      await updateDailyAvailability(userId, date, 'technician', tm.technicianId);
    }
  }
}
