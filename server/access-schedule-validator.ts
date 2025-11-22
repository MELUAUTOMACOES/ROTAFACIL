import type { AccessSchedule } from "@shared/schema";

/**
 * Obtém data/hora atual no timezone de Brasília
 */
function getBrasiliaTime(): Date {
  const now = new Date();
  // Converter para timezone de Brasília usando Intl.DateTimeFormat
  const brasiliaString = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(now);
  
  return new Date(brasiliaString);
}

/**
 * Valida se o horário atual está dentro da tabela de horários permitida
 * Usa timezone de Brasília (America/Sao_Paulo)
 */
export function isAccessAllowed(schedule: AccessSchedule | null | undefined): boolean {
  // Se não há schedule definido, acesso é sempre permitido
  if (!schedule || !schedule.schedules) {
    console.log('🕒 [ACCESS CHECK] Sem tabela de horário - acesso permitido');
    return true;
  }

  // Obter data/hora atual no horário de Brasília
  const brasiliaTime = getBrasiliaTime();
  const currentDay = brasiliaTime.getDay(); // 0 = domingo, 1 = segunda, etc.
  const currentHour = brasiliaTime.getHours();
  const currentMinute = brasiliaTime.getMinutes();
  const currentTime = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;
  
  console.log(`🕒 [ACCESS CHECK] Horário atual (Brasília): ${currentTime}, Dia: ${currentDay}`);
  
  // Mapear dia da semana para nome em inglês (como está no JSON)
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayName = dayNames[currentDay];
  
  console.log(`🕒 [ACCESS CHECK] Dia da semana: ${dayName}`);
  
  // Extrair horários do dia atual do schedule JSON
  const scheduleData = schedule.schedules as any;
  const daySchedules = scheduleData[dayName];
  
  console.log(`🕒 [ACCESS CHECK] Horários do dia:`, JSON.stringify(daySchedules));
  
  // Se não há horários definidos para este dia, acesso não é permitido
  if (!daySchedules || !Array.isArray(daySchedules) || daySchedules.length === 0) {
    console.log('🕒 [ACCESS CHECK] Sem horários para este dia - ACESSO NEGADO');
    return false;
  }
  
  // Verificar se o horário atual está dentro de alguma janela permitida
  for (const timeWindow of daySchedules) {
    const start = timeWindow.start;
    const end = timeWindow.end;
    
    console.log(`🕒 [ACCESS CHECK] Verificando janela: ${start} - ${end}`);
    
    // Comparar horários como strings no formato HH:MM
    if (currentTime >= start && currentTime <= end) {
      console.log(`✅ [ACCESS CHECK] DENTRO do horário permitido: ${start} - ${end}`);
      return true;
    }
  }
  
  console.log('❌ [ACCESS CHECK] FORA de todos os horários permitidos - ACESSO NEGADO');
  return false;
}

/**
 * Retorna mensagem de erro detalhada quando acesso não é permitido
 */
export function getAccessDeniedMessage(schedule: AccessSchedule | null | undefined): string {
  if (!schedule) {
    return "Acesso negado: nenhuma tabela de horário configurada.";
  }
  
  const now = new Date();
  const brasiliaTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const currentDay = brasiliaTime.getDay();
  const dayNames = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  
  return `Acesso negado: você não tem permissão para acessar a plataforma neste horário. Hoje é ${dayNames[currentDay]}. Verifique sua tabela de horário "${schedule.name}".`;
}

/**
 * Calcula quanto tempo falta (em minutos) até o fim do expediente atual
 * Retorna null se não há expediente ativo ou se não há mais expediente hoje
 */
export function getMinutesUntilEndOfShift(schedule: AccessSchedule | null | undefined): number | null {
  if (!schedule || !schedule.schedules) {
    return null;
  }

  // Obter data/hora atual no horário de Brasília
  const brasiliaTime = getBrasiliaTime();
  const currentDay = brasiliaTime.getDay();
  const currentHour = brasiliaTime.getHours();
  const currentMinute = brasiliaTime.getMinutes();
  const currentTime = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;
  
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayName = dayNames[currentDay];
  
  const scheduleData = schedule.schedules as any;
  const daySchedules = scheduleData[dayName];
  
  if (!daySchedules || !Array.isArray(daySchedules) || daySchedules.length === 0) {
    return null;
  }
  
  // Encontrar a janela de tempo atual
  for (const timeWindow of daySchedules) {
    const start = timeWindow.start;
    const end = timeWindow.end;
    
    if (currentTime >= start && currentTime <= end) {
      // Estamos dentro de uma janela de tempo
      const [endHour, endMinute] = end.split(':').map(Number);
      
      const endTotalMinutes = endHour * 60 + endMinute;
      const currentTotalMinutes = currentHour * 60 + currentMinute;
      
      const minutesLeft = endTotalMinutes - currentTotalMinutes;
      
      console.log(`⏰ [TIME CHECK] Minutos até fim do expediente: ${minutesLeft}`);
      
      return minutesLeft;
    }
  }
  
  return null;
}
