/**
 * 📊 EGRESS LOGGING UTILITY
 * Helper para medir tamanho das respostas JSON (instrumentação temporária)
 * 
 * Este utilitário centralizado é usado para logar o tamanho de payloads JSON
 * nas respostas da API, facilitando o monitoramento de egress de dados.
 */

/**
 * Calcula e loga o tamanho de um payload JSON
 * @param req - Request object do Express
 * @param body - O objeto/array que será serializado
 */
export function logEgressSize(req: any, body: any): void {
    try {
        const sizeBytes = JSON.stringify(body).length;
        const sizeKB = (sizeBytes / 1024).toFixed(2);

        // Se for array, mostrar quantidade de itens
        const arrayLength = Array.isArray(body)
            ? ` (${body.length} items)`
            : Array.isArray(body?.items)
                ? ` (${body.items.length} items)`
                : '';

        console.log(`📊 [EGRESS] ${req.method} ${req.path} → ${sizeKB} KB${arrayLength}`);
    } catch (err) {
        // Se falhar, não quebra a resposta - apenas loga o erro
        console.error('❌ [EGRESS] Erro ao calcular tamanho:', err);
    }
}
