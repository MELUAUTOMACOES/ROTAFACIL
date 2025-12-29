/**
 * 📱 Device Detection
 * 
 * Detecta o tipo de dispositivo do usuário para segmentação de métricas.
 */

export type DeviceType = 'mobile' | 'desktop';

/**
 * Detecta se o dispositivo é mobile ou desktop
 * Usa combinação de userAgent e largura da tela para maior precisão
 * @returns 'mobile' ou 'desktop'
 */
export function getDeviceType(): DeviceType {
    try {
        // Padrões comuns de userAgent para dispositivos móveis
        const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
        const isMobileUA = mobileRegex.test(navigator.userAgent);

        // Verificação adicional pela largura da tela (768px é breakpoint comum)
        const isMobileWidth = window.innerWidth < 768;

        // Considera mobile se qualquer uma das condições for verdadeira
        return (isMobileUA || isMobileWidth) ? 'mobile' : 'desktop';
    } catch (error) {
        console.error('[Analytics] Erro ao detectar dispositivo:', error);
        return 'desktop'; // fallback seguro
    }
}

/**
 * Retorna informações detalhadas do navegador
 * Útil para debugging e análise mais profunda
 */
export function getBrowserInfo(): { userAgent: string; language: string; platform: string } {
    try {
        return {
            userAgent: navigator.userAgent,
            language: navigator.language,
            platform: navigator.platform,
        };
    } catch (error) {
        console.error('[Analytics] Erro ao obter info do navegador:', error);
        return {
            userAgent: 'unknown',
            language: 'unknown',
            platform: 'unknown',
        };
    }
}
