import crypto from "crypto";

/**
 * Normaliza um endereço para servir de chave previsível e consistente no cache.
 * Remove acentos, padroniza minúsculas e remove caracteres voláteis.
 */
export function normalizeAddressForCache(address: string | null | undefined): string {
  if (!address) return "";
  return address
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .toLowerCase()
    .replace(/[^\w\s\-,]/g, "") // permite apenas alfanumerico, espacos, virgulas e hifens
    .replace(/\s+/g, " ") // retira espaços múltiplos
    .replace(/\s*,\s*/g, ",") // retira espaços em volta das vírgulas (ex: "rua x , 10" -> "rua x,10")
    .trim();
}

/**
 * Gera um SHA-256 fixo da string normalizada para busca indexada O(1) no banco (address_hash)
 */
export function generateAddressHash(normalizedAddress: string): string {
  if (!normalizedAddress) return "";
  return crypto.createHash("sha256").update(normalizedAddress).digest("hex");
}
