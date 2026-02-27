/**
 * Helper para trabalhar com timezone de São Paulo (UTC-3 / America/Sao_Paulo)
 * 
 * Importante: O PostgreSQL armazena timestamps em UTC, mas precisamos comparar
 * datas considerando o horário local de São Paulo para features de romaneio/prestador.
 */

/**
 * Converte uma data UTC para o horário de São Paulo (UTC-3)
 * 
 * Nota: Aqui estamos usando UTC-3 fixo. Se precisar considerar horário de verão,
 * seria necessário usar uma lib como date-fns-tz ou luxon com timezone America/Sao_Paulo.
 */
export function toSaoPauloTime(date: Date): Date {
  const utcDate = new Date(date);
  // Subtrai 3 horas para converter UTC para São Paulo
  utcDate.setHours(utcDate.getHours() - 3);
  return utcDate;
}

/**
 * Obtém a data atual em São Paulo (UTC-3)
 */
export function nowInSaoPaulo(): Date {
  return toSaoPauloTime(new Date());
}

/**
 * Obtém uma string de data (YYYY-MM-DD) considerando timezone de São Paulo
 * 
 * @param date Data em UTC ou objeto Date
 * @returns String no formato YYYY-MM-DD considerando horário de São Paulo
 */
export function getDateInSaoPaulo(date: Date): string {
  const spDate = toSaoPauloTime(date);
  const year = spDate.getFullYear();
  const month = String(spDate.getMonth() + 1).padStart(2, '0');
  const day = String(spDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Cria início e fim do dia para uma data em São Paulo
 * 
 * @param date Data de referência (pode ser string YYYY-MM-DD ou Date)
 * @returns { startOfDay, endOfDay } em UTC, mas representando o dia completo em São Paulo
 */
export function getDayBoundsInSaoPaulo(date: Date | string): { startOfDay: Date; endOfDay: Date } {
  let targetDate: Date;
  
  if (typeof date === 'string') {
    // Parse YYYY-MM-DD considerando como horário de São Paulo
    targetDate = new Date(date + 'T00:00:00-03:00');
  } else {
    // Converter data UTC para São Paulo e pegar início do dia
    targetDate = toSaoPauloTime(date);
  }
  
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  // Converter de volta para UTC (adicionar 3 horas)
  startOfDay.setHours(startOfDay.getHours() + 3);
  
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);
  // Converter de volta para UTC (adicionar 3 horas)
  endOfDay.setHours(endOfDay.getHours() + 3);
  
  return { startOfDay, endOfDay };
}

/**
 * Formata uma data para comparação SQL considerando São Paulo
 * Retorna string YYYY-MM-DD baseada no horário de São Paulo
 */
export function formatDateForSQLComparison(date: Date): string {
  return getDateInSaoPaulo(date);
}
