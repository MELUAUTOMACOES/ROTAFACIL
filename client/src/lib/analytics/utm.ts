/**
 * 📊 UTM Parameters Management
 * 
 * Captura e persiste parâmetros UTM da URL para rastreamento de campanhas.
 * Os UTMs são salvos no sessionStorage para persistir durante a navegação.
 */

// Chave usada no sessionStorage
const UTM_STORAGE_KEY = 'rotafacil_utm_params';

// Lista de parâmetros UTM suportados
const UTM_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;

// Tipo para os parâmetros UTM
export interface UtmParams {
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_content?: string;
    utm_term?: string;
}

/**
 * Extrai parâmetros UTM da URL atual
 * @returns Objeto com os UTMs encontrados (pode estar vazio)
 */
export function captureUtmParams(): UtmParams {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const utms: UtmParams = {};

        UTM_PARAMS.forEach(param => {
            const value = urlParams.get(param);
            if (value) {
                utms[param] = value;
            }
        });

        return utms;
    } catch (error) {
        console.error('[Analytics] Erro ao capturar UTMs:', error);
        return {};
    }
}

/**
 * Persiste os UTMs no sessionStorage
 * Mantém UTMs existentes se não houver novos na URL
 * @param utms - Parâmetros UTM a serem salvos
 */
export function persistUtmParams(utms: UtmParams): void {
    try {
        // Se há novos UTMs, salva
        if (Object.keys(utms).length > 0) {
            sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(utms));
        }
    } catch (error) {
        console.error('[Analytics] Erro ao persistir UTMs:', error);
    }
}

/**
 * Recupera UTMs salvos no sessionStorage
 * @returns Objeto com os UTMs persistidos ou vazio
 */
export function getStoredUtmParams(): UtmParams {
    try {
        const stored = sessionStorage.getItem(UTM_STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored) as UtmParams;
        }
        return {};
    } catch (error) {
        console.error('[Analytics] Erro ao recuperar UTMs:', error);
        return {};
    }
}

/**
 * Inicializa o sistema de UTM: captura da URL e persiste
 * Deve ser chamado uma vez no carregamento da página
 * @returns Os UTMs ativos (novos ou existentes)
 */
export function initializeUtm(): UtmParams {
    const newUtms = captureUtmParams();

    // Se há novos UTMs na URL, persiste
    if (Object.keys(newUtms).length > 0) {
        persistUtmParams(newUtms);
        return newUtms;
    }

    // Caso contrário, retorna os existentes
    return getStoredUtmParams();
}
