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
  teamId?: number
): Promise<{ valid: boolean; message?: string }> {
  
  // Obter dia da semana (0 = domingo, 1 = segunda, ..., 6 = sábado)
  const dayOfWeek = scheduledDate.getDay();
  const dayNames = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
  const dayName = dayNames[dayOfWeek];
  
  // Validar técnico
  if (technicianId) {
    const technicians = await storage.getTechnicians(userId);
    const technician = technicians.find(t => t.id === technicianId);
    
    if (!technician) {
      return { valid: false, message: 'Técnico não encontrado' };
    }
    
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
    const teams = await storage.getTeams(userId);
    const team = teams.find(t => t.id === teamId);
    
    if (!team) {
      return { valid: false, message: 'Equipe não encontrada' };
    }
    
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
