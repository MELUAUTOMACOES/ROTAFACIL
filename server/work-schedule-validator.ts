import type { DatabaseStorage } from './storage';

/**
 * Valida se um agendamento pode ser criado para um técnico ou equipe
 * considerando seus dias e horários de trabalho
 */
export async function validateWorkSchedule(
  storage: DatabaseStorage,
  userId: number,
  scheduledDate: Date,
  technicianId?: number,
  teamId?: number,
  companyId?: number
): Promise<{ valid: boolean; message?: string }> {
  console.log(`🔍 [WORK-SCHEDULE] Validando horário: technicianId=${technicianId || 'N/A'}, teamId=${teamId || 'N/A'}, companyId=${companyId || 'N/A'}`);
  
  // Obter dia da semana (0 = domingo, 1 = segunda, ..., 6 = sábado)
  const dayOfWeek = scheduledDate.getDay();
  const dayNames = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
  const dayName = dayNames[dayOfWeek];
  
  // Validar técnico
  if (technicianId) {
    const technicians = await storage.getTechnicians(companyId!);
    const technician = technicians.find(t => t.id === technicianId);
    
    if (!technician) {
      console.log(`❌ [WORK-SCHEDULE] Técnico id=${technicianId} não encontrado na empresa companyId=${companyId}`);
      return { valid: false, message: 'Técnico não encontrado nesta empresa' };
    }
    console.log(`✅ [WORK-SCHEDULE] Técnico encontrado: "${technician.name}" (id=${technician.id})`);
    
    const workDays = technician.diasTrabalho || ['segunda', 'terca', 'quarta', 'quinta', 'sexta'];
    
    if (!workDays.includes(dayName)) {
      const dayNameDisplay = dayName.charAt(0).toUpperCase() + dayName.slice(1);
      return { 
        valid: false, 
        message: `O técnico ${technician.name} não trabalha em ${dayNameDisplay}. Dias de trabalho: ${workDays.join(', ')}.` 
      };
    }
  }
  
  // Validar equipe
  if (teamId) {
    const teams = await storage.getTeams(companyId!);
    const team = teams.find(t => t.id === teamId);
    
    if (!team) {
      console.log(`❌ [WORK-SCHEDULE] Equipe id=${teamId} não encontrada na empresa companyId=${companyId}`);
      return { valid: false, message: 'Equipe não encontrada nesta empresa' };
    }
    console.log(`✅ [WORK-SCHEDULE] Equipe encontrada: "${team.name}" (id=${team.id})`);
    
    const workDays = team.diasTrabalho || ['segunda', 'terca', 'quarta', 'quinta', 'sexta'];
    
    if (!workDays.includes(dayName)) {
      const dayNameDisplay = dayName.charAt(0).toUpperCase() + dayName.slice(1);
      return { 
        valid: false, 
        message: `A equipe ${team.name} não trabalha em ${dayNameDisplay}. Dias de trabalho: ${workDays.join(', ')}.` 
      };
    }
  }
  
  return { valid: true };
}
