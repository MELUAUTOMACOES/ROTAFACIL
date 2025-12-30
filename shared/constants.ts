/**
 * 🔐 Constantes compartilhadas - LGPD e Cookies
 * 
 * Este arquivo centraliza as versões de termos e políticas.
 * Ao alterar o conteúdo dos termos, incremente a versão correspondente.
 */

// 🔐 LGPD - Versão atual do termo de aceite
export const LGPD_VERSION = "v1.0-2025-01";

// 🍪 Cookie consent - Versão atual da política de cookies
export const COOKIE_POLICY_VERSION = "v1.0-2025-01";

// Tipos de consentimento de cookies
export type CookieConsentType = "all" | "essential" | null;

// Chave do localStorage para consentimento de cookies
export const COOKIE_CONSENT_KEY = "rotafacil_cookie_consent";
