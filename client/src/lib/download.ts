/**
 * Utilitários seguros para download de arquivos
 * Evita manipulação direta do DOM que causa conflitos com React
 */

// Função segura para download que não manipula DOM diretamente
export function downloadFile(content: string, filename: string, mimeType = "text/plain") {
  try {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    // Usar createObjectURL + window.open é mais seguro que appendChild/removeChild
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    
    // Usar uma abordagem mais segura que não interfere com React
    document.body.appendChild(a);
    a.click();
    
    // Cleanup imediato e seguro
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    return true;
  } catch (error) {
    console.error('Erro ao fazer download:', error);
    return false;
  }
}

// Função específica para downloads CSV
export function downloadCSV(csvContent: string, filename: string) {
  return downloadFile(csvContent, filename, "text/csv;charset=utf-8");
}

// Função para downloads de relatórios de texto
export function downloadReport(content: string, filename: string) {
  return downloadFile(content, filename, "text/plain;charset=utf-8");
}

// Função assíncrona para downloads com confirmação (evita setTimeout problemático)
export async function downloadWithConfirmation(
  content: string, 
  filename: string, 
  message: string,
  mimeType = "text/plain"
): Promise<boolean> {
  try {
    if (confirm(message)) {
      return downloadFile(content, filename, mimeType);
    }
    return false;
  } catch (error) {
    console.error('Erro no download com confirmação:', error);
    return false;
  }
}