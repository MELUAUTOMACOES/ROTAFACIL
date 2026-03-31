import { Express, Request, Response } from "express";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { db } from "../db";
import {
  routes as routesTbl,
  routeStops as stopsTbl,
  appointments,
  clients,
  technicians,
  teams,
  businessRules,
  routeAudits,
  users,
  geocodingCache,
  services,
} from "@shared/schema";
import { eq, and, gte, lte, like, or, desc, inArray, sql, asc, ne } from "drizzle-orm";
import { trackFeatureUsage } from "./metrics.routes";
import { logEgressSize } from "../utils/egressLogger";
import { authenticateToken } from "../middleware/auth.middleware";
import { normalizeAddressForCache, generateAddressHash } from "../utils/geocodeCache";

// Extend Request type for authenticated user
interface AuthenticatedRequest extends Request {
  user: {
    userId: number;
    companyId?: number | null;
  };
}

// Helper para ler URL do OSRM
function getOsrmUrl() {
  // 1. Prioridade: Variável de ambiente (Ideal para Deploy/Render)
  if (process.env.OSRM_URL) {
    console.log("Variável de ambiente OSRM_URL encontrada:", process.env.OSRM_URL);
    return process.env.OSRM_URL.trim();
  }

  // 2. Fallback: Arquivo txt em vários locais possíveis
  const candidates = [
    path.join(__dirname, "../osrm_url.txt"), // Localização original relativa (src/routes/ -> src/)
    path.join(__dirname, "osrm_url.txt"),    // Mesmo diretório
    path.join(process.cwd(), "server/osrm_url.txt"), // Caminho a partir da raiz (dev)
    path.join(process.cwd(), "osrm_url.txt"),        // Caminho a partir da raiz (prod/dist - se copiado)
  ];

  for (const filePath of candidates) {
    try {
      if (fs.existsSync(filePath)) {
        console.log("Arquivo de configuração OSRM encontrado em:", filePath);
        return fs.readFileSync(filePath, "utf8").trim();
      }
    } catch (err) {
      // continua procurando
    }
  }

  console.error("Nenhuma configuração de OSRM encontrada (ENV ou arquivo).");
  return null;
}


// Helper para converter ID numérico para UUID válido
function numberToUUID(num: number): string {
  const padded = num.toString().padStart(32, "0");
  return [
    padded.slice(0, 8),
    padded.slice(8, 12),
    padded.slice(12, 16),
    padded.slice(16, 20),
    padded.slice(20, 32),
  ].join("-");
}

// Helper para registrar auditoria de rotas
async function createRouteAudit(
  routeId: string,
  userId: number,
  action: string,
  description: string,
  metadata?: any
) {
  try {
    await db.insert(routeAudits).values({
      routeId,
      userId,
      action,
      description,
      metadata: metadata ? JSON.stringify(metadata) : null,
    });
  } catch (error) {
    console.error("Erro ao registrar auditoria:", error);
  }
}

// Helper para filtrar por companyId (OBRIGATÓRIO - multi-tenant)
function ownerFilter(table: any, companyId: number) {
  return eq(table.companyId, companyId);
}

async function resolveStartForRoute(
  userId: number,
  responsibleType: "technician" | "team",
  responsibleId: string | number,
  companyId: number
): Promise<{ lat: number; lng: number; address: string }> {
  // 1) tenta endereço do técnico/equipe; 2) cai para endereço da empresa (businessRules); 3) fallback Curitiba
  type EntityAddr = {
    enderecoInicioCep?: string | null;
    enderecoInicioLogradouro?: string | null;
    enderecoInicioNumero?: string | null;
    enderecoInicioComplemento?: string | null;
    enderecoInicioBairro?: string | null;
    enderecoInicioCidade?: string | null;
    enderecoInicioEstado?: string | null;
  };

  const buildTentativas = (addr: {
    logradouro?: string | null; numero?: string | null; complemento?: string | null;
    bairro?: string | null; cidade?: string | null; cep?: string | null; estado?: string | null;
  }) => {
    const checa = (s?: string | null) => (s && `${s}`.trim().length ? s.trim() : null);
    const logradouro = checa(addr.logradouro);
    const numero = checa(addr.numero);
    const complemento = checa(addr.complemento);
    const bairro = checa(addr.bairro);
    const cidade = checa(addr.cidade);
    const cep = checa(addr.cep);
    const estado = checa(addr.estado);

    const tentList: string[] = [];

    // [MELHORIA PARTE 2] Tratamento Inteligente para Rodovias
    if (logradouro && /(rodovia|br[\-\s]?\d+)/i.test(logradouro)) {
       const match = logradouro.match(/br[\s\-]?(\d+)/i);
       const brCode = match ? `BR-${match[1]}` : logradouro;
       
       console.log(`🛣️ [RODOVIA DETECTADA] Logradouro original: ${logradouro}`);
       // Rodovias costumam falhar se o Bairro e CEP são genéricos. O mapa aceita melhor BR-XXX, Cidade
       const rodoviaSimples = [brCode, cidade, estado, "Brasil"].filter(Boolean).join(", ");
       const rodoviaComNumero = [brCode, numero, cidade, estado, "Brasil"].filter(Boolean).join(", ");
       
       tentList.push(rodoviaSimples, rodoviaComNumero);
       console.log(`   -> Variação extra 1: ${rodoviaSimples}`);
       console.log(`   -> Variação extra 2: ${rodoviaComNumero}`);
    }

    // Complemento removido da primeira tentativa para melhorar acerto no Nominatim
    const full = [logradouro, numero, bairro, cidade, cep, estado, "Brasil"].filter(Boolean).join(", ");
    const semNumero = [logradouro, bairro, cidade, cep, estado, "Brasil"].filter(Boolean).join(", ");
    const soCepCidade = [cep, cidade, estado, "Brasil"].filter(Boolean).join(", ");
    
    tentList.push(full, semNumero, soCepCidade);
    return Array.from(new Set(tentList.filter((s) => s && s.length >= 8))); // remove duplicates
  };

  let tentativas: string[] = [];

  if (responsibleType === "technician") {
    const [t] = await db
      .select({
        enderecoInicioCep: technicians.enderecoInicioCep,
        enderecoInicioLogradouro: technicians.enderecoInicioLogradouro,
        enderecoInicioNumero: technicians.enderecoInicioNumero,
        enderecoInicioComplemento: technicians.enderecoInicioComplemento,
        enderecoInicioBairro: technicians.enderecoInicioBairro,
        enderecoInicioCidade: technicians.enderecoInicioCidade,
        enderecoInicioEstado: technicians.enderecoInicioEstado,
      })
      .from(technicians)
      .where(and(eq(technicians.id, Number(responsibleId)), ownerFilter(technicians, companyId)))
      .limit(1);

    if (t?.enderecoInicioCidade && (t.enderecoInicioCep || t.enderecoInicioLogradouro)) {
      tentativas = buildTentativas({
        logradouro: t.enderecoInicioLogradouro, numero: t.enderecoInicioNumero,
        complemento: t.enderecoInicioComplemento, bairro: t.enderecoInicioBairro,
        cidade: t.enderecoInicioCidade, cep: t.enderecoInicioCep, estado: t.enderecoInicioEstado,
      });
    }
  } else {
    const [tm] = await db
      .select({
        enderecoInicioCep: teams.enderecoInicioCep,
        enderecoInicioLogradouro: teams.enderecoInicioLogradouro,
        enderecoInicioNumero: teams.enderecoInicioNumero,
        enderecoInicioComplemento: teams.enderecoInicioComplemento,
        enderecoInicioBairro: teams.enderecoInicioBairro,
        enderecoInicioCidade: teams.enderecoInicioCidade,
        enderecoInicioEstado: teams.enderecoInicioEstado,
      })
      .from(teams)
      .where(and(eq(teams.id, Number(responsibleId)), ownerFilter(teams, companyId)))
      .limit(1);

    if (tm?.enderecoInicioCidade && (tm.enderecoInicioCep || tm.enderecoInicioLogradouro)) {
      tentativas = buildTentativas({
        logradouro: tm.enderecoInicioLogradouro, numero: tm.enderecoInicioNumero,
        complemento: tm.enderecoInicioComplemento, bairro: tm.enderecoInicioBairro,
        cidade: tm.enderecoInicioCidade, cep: tm.enderecoInicioCep, estado: tm.enderecoInicioEstado,
      });
    }
  }

  if (!tentativas.length) {
    const brs = await db.select().from(businessRules).where(ownerFilter(businessRules, companyId)).limit(1);
    if (brs.length) {
      const br = brs[0];
      tentativas = buildTentativas({
        logradouro: br.enderecoEmpresaLogradouro, numero: br.enderecoEmpresaNumero,
        complemento: br.enderecoEmpresaComplemento ?? null, bairro: br.enderecoEmpresaBairro,
        cidade: br.enderecoEmpresaCidade, cep: br.enderecoEmpresaCep, estado: br.enderecoEmpresaEstado,
      });
    }
  }

  // Salva rastreio das strings testadas para criar "alias negativo" de cache e apontar todas pro que der certo
  const failedEnds: string[] = [];

  // geocodifica na ordem, com fallback Curitiba
  for (const end of tentativas) {
    if (!end || end.trim() === "") continue;
    
    const norm = normalizeAddressForCache(end);
    const hash = generateAddressHash(norm);

    try {
      // 1. Tentar Resgatar do Cache
      const cached = await db.select().from(geocodingCache).where(eq(geocodingCache.addressHash, hash)).limit(1);
      if (cached.length > 0 && (cached[0].confidenceLevel === "high" || cached[0].confidenceLevel === "medium")) {
        console.log(`✅ [START_CACHE_HIT] Origem resgatada do cache: ${end} (Source: ${cached[0].source})`);
        return { lat: cached[0].lat, lng: cached[0].lng, address: end };
      }
    } catch(e) {
      console.warn("⚠️ [START_CACHE_WARN] Erro ao ler cache de start location:", e);
    }

    try {
      console.log(`🌐 [START_GEOCODE] Buscando na API o ponto inicial: ${end}`);
      const r = await geocodeEnderecoServer(end);
      
      const resLat = Number(r.lat);
      const resLng = Number(r.lon);

      // 2. Salvar o endereço que teve Sucesso
      const toSave = [{
          addressHash: hash,
          normalizedAddress: norm,
          postalCode: null, street: null, number: null, neighborhood: null,
          city: r.addressDetails?.city || r.addressDetails?.town || null,
          state: r.addressDetails?.state || null,
          country: r.addressDetails?.country_code || null,
          lat: resLat, 
          lng: resLng,
          source: "nominatim_full_address_start",
          confidenceLevel: "high",
          confidenceReason: "start_location_match",
          rawProviderDisplayName: r.displayName || null,
          providerPayloadSummary: null,
      }];

      // 3. E salvar um "Alias" para todos que falharam na mesma tentativa para não repeti-los na próxima Otimização
      for (const failedEnd of failedEnds) {
          const fnorm = normalizeAddressForCache(failedEnd);
          toSave.push({
             addressHash: generateAddressHash(fnorm),
             normalizedAddress: fnorm,
             postalCode: null, street: null, number: null, neighborhood: null,
             city: r.addressDetails?.city || r.addressDetails?.town || null,
             state: r.addressDetails?.state || null,
             country: r.addressDetails?.country_code || null,
             lat: resLat, 
             lng: resLng,
             source: "start_location_fallback_alias",
             confidenceLevel: "medium",
             confidenceReason: "alias_from_successful_fallback",
             rawProviderDisplayName: r.displayName || null,
             providerPayloadSummary: null,
          });
      }

      for (const item of toSave) {
          try {
             await db.insert(geocodingCache).values(item).onConflictDoNothing();
          } catch(e) {}
      }
      
      console.log(`✅ [START_CACHE_SAVE] Cache atualizado com sucesso (Inclui aliases de tentativas falhas)`);
      return { lat: resLat, lng: resLng, address: end };
    } catch {
      failedEnds.push(end); // Falhou, adiciona a lista para virar Alias negativo depois
    }
  }

  return { lat: -25.4284, lng: -49.2654, address: "Curitiba - PR, Brasil" };
}

// Helper inverso: UUID "fake" -> número (remove hifens, tira zeros à esquerda)
function uuidToNumber(uuidStr: string): number | null {
  if (!uuidStr || typeof uuidStr !== "string") return null;
  const compact = uuidStr.replace(/-/g, "");
  if (!/^[0-9a-fA-F]{32}$/.test(compact)) return null;
  // Nosso UUID é composto só por zeros + dígitos (sem letras), pois vem de número padLeft(32,'0')
  // Removemos zeros à esquerda e parseamos
  const numeric = compact.replace(/^0+/, "");
  if (numeric === "") return 0;
  const asNum = Number(numeric);
  return Number.isFinite(asNum) ? asNum : null;
}

// Schema de validação para otimização
const optimizeRouteSchema = z.object({
  appointmentIds: z.array(z.union([z.string(), z.number()])),
  endAtStart: z.boolean(),
  responsibleType: z.enum(["technician", "team"]).optional(),
  responsibleId: z.union([z.string(), z.number()]).optional(),
  vehicleId: z.string().optional(),
  title: z.string().optional(),
  preview: z.boolean().optional(),
  skipOptimization: z.boolean().optional(),
  status: z.enum(["draft", "confirmado", "finalizado", "cancelado"]).optional(),
});

// Schema para atualização de status
const updateStatusSchema = z.object({
  status: z.enum(["draft", "confirmado", "finalizado", "cancelado"]),
});

// Algoritmo TSP simples: Nearest Neighbor + 2-opt
function solveTSP(
  distanceMatrix: number[][],
  endAtStart: boolean = false,
): number[] {
  const n = distanceMatrix.length;
  if (n <= 1) return [0];

  console.log("🧮 Iniciando TSP com", n, "pontos, endAtStart:", endAtStart);

  // 1. Nearest Neighbor a partir do ponto 0 (início)
  const visited = new Set<number>();
  const tour = [0];
  visited.add(0);

  let current = 0;
  while (visited.size < n) {
    let nearest = -1;
    let minDistance = Infinity;

    for (let i = 0; i < n; i++) {
      if (!visited.has(i) && distanceMatrix[current][i] < minDistance) {
        minDistance = distanceMatrix[current][i];
        nearest = i;
      }
    }

    if (nearest !== -1) {
      tour.push(nearest);
      visited.add(nearest);
      current = nearest;
    }
  }

  console.log("🔄 Tour inicial (Nearest Neighbor):", tour);

  // 2. Melhoria 2-opt (versão simplificada)
  for (let iterations = 0; iterations < 50; iterations++) {
    let improved = false;

    for (let i = 1; i < tour.length - 2; i++) {
      for (let j = i + 1; j < tour.length - 1; j++) {
        // Calcular ganho da troca 2-opt
        const before =
          distanceMatrix[tour[i - 1]][tour[i]] +
          distanceMatrix[tour[j]][tour[j + 1]];
        const after =
          distanceMatrix[tour[i - 1]][tour[j]] +
          distanceMatrix[tour[i]][tour[j + 1]];

        if (after < before) {
          // Inverter segmento entre i e j
          const segment = tour.slice(i, j + 1).reverse();
          tour.splice(i, j - i + 1, ...segment);
          improved = true;
        }
      }
    }

    if (!improved) break;
  }

  console.log("✅ Tour otimizado:", tour);

  // Se endAtStart=false, remover volta ao início
  if (!endAtStart && tour.length > 1) {
    return tour;
  }

  // Se endAtStart=true, garantir que volta ao início
  if (endAtStart && tour[tour.length - 1] !== 0) {
    tour.push(0);
  }

  return tour;
}

// Função para buscar matriz OSRM
async function getOSRMMatrix(
  coordinates: [number, number][],
): Promise<{ durations: number[][]; distances: number[][] }> {
  const OSRM_URL = getOsrmUrl()?.replace(/\/$/, "") || null;
  if (!OSRM_URL) {
    throw new Error("OSRM URL não configurado");
  }

  // Montagem blindada para evitar logs ou envios de `-49..293`
  const coordStr = coordinates.map((c) => {
    const lng = Number(c[0]);
    const lat = Number(c[1]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      throw new Error(`Coordenada inválida na Matriz OSRM: lng=${c[0]}, lat=${c[1]}`);
    }
    return `${lng.toFixed(6)},${lat.toFixed(6)}`;
  }).join(";");

  const osrmUrl = `${OSRM_URL}/table/v1/driving/${coordStr}?annotations=duration,distance`;

  console.log("🌐 Chamando OSRM matrix:", osrmUrl);

  const response = await fetch(osrmUrl);
  const data = await response.json();

  if (!data.durations || !data.distances) {
    throw new Error("OSRM não retornou matriz válida");
  }

  return {
    durations: data.durations,
    distances: data.distances,
  };
}

// Função para buscar polyline OSRM
async function getOSRMRoute(coordinates: [number, number][]): Promise<any> {
  const OSRM_URL = getOsrmUrl()?.replace(/\/$/, "") || null;
  if (!OSRM_URL) {
    throw new Error("OSRM URL não configurado");
  }

  // Montagem blindada
  const coordStr = coordinates.map((c) => {
    const lng = Number(c[0]);
    const lat = Number(c[1]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      throw new Error(`Coordenada inválida na Polyline OSRM: lng=${c[0]}, lat=${c[1]}`);
    }
    return `${lng.toFixed(6)},${lat.toFixed(6)}`;
  }).join(";");
  
  const osrmUrl = `${OSRM_URL}/route/v1/driving/${coordStr}?overview=full&geometries=geojson`;

  console.log("🗺️ Chamando OSRM route:", osrmUrl);

  const response = await fetch(osrmUrl);
  const data = await response.json();

  if (!data.routes || data.routes.length === 0) {
    throw new Error("OSRM não retornou rota válida");
  }

  return data.routes[0].geometry;
}

// --- Helper de geocodificação (Nominatim) — versão robusta ---
function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// Normaliza CEP para formato "12345-678" (aceita com ou sem traço)
function formatCep(cep: string | null | undefined): string | null {
  if (!cep) return null;
  const clean = cep.replace(/\D/g, ''); // Remove tudo que não é número
  if (clean.length !== 8) return null; // CEP inválido
  return `${clean.substring(0, 5)}-${clean.substring(5)}`; // Formata: 12345-678
}

async function geocodeEnderecoServer(
  endereco: string,
): Promise<{ lat: number; lon: number; addressDetails?: any; displayName?: string }> {
  // Use addressdetails=1 para garantir retorno de informações estruturadas (cidade, estado, país)
  const makeUrl = (q: string) =>
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&addressdetails=1&extratags=0&q=${encodeURIComponent(q)}`;

  const headers = {
    "User-Agent": "RotaFacil/1.0 (contato@rotafacil.com)", // personalize com seu email/domínio
    "Accept-Language": "pt-BR",
  } as Record<string, string>;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000); // 8s de timeout

  try {
    // 1ª tentativa (endereço como veio)
    let res = await fetch(makeUrl(endereco), {
      headers,
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
    let data = await res.json();

    // Fallback simples: tentar com ", Brasil" se não encontrou nada
    if (!Array.isArray(data) || data.length === 0) {
      res = await fetch(makeUrl(`${endereco}, Brasil`), { headers });
      if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
      data = await res.json();
      if (!Array.isArray(data) || data.length === 0)
        throw new Error("Endereço não encontrado");
    }

    const lat = parseFloat(data[0].lat);
    const lon = parseFloat(data[0].lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon))
      throw new Error("Coordenadas inválidas");

    const addressDetails = data[0].address || {};
    const displayName = data[0].display_name;

    // padroniza para 6 casas (coerente com o que salvamos no DB)
    return { 
      lat: Number(lat.toFixed(6)), 
      lon: Number(lon.toFixed(6)),
      addressDetails,
      displayName
    };
  } catch (err: any) {
    const errInfo = err.cause ? `(Causa: ${err.cause.message || err.cause.code || "desconhecida"})` : '';
    const name = err.name && err.name !== "Error" ? `[${err.name}]` : '';
    throw new Error(`${name} ${err.message} ${errInfo}`.trim());
  } finally {
    clearTimeout(timer);
  }
}

export function registerRoutesAPI(app: Express) {
  // 🔐 authenticateToken real importado de server/middleware/auth.middleware.ts
  // Valida JWT e popula req.user com userId, companyId, role, isSuperAdmin.

  // Endpoint temporário para migração display_number
  app.post(
    "/api/routes/migrate-display-numbers",
    authenticateToken,
    async (req: any, res: Response) => {
      console.log("🚀 Simulando migração display_number (in-memory)...");
      console.log("✅ Migração simulada concluída");
      res.json({
        success: true,
        message:
          "Migração simulada - novas rotas usarão displayNumber automaticamente",
        note: "As rotas existentes mostrarão displayNumber: null até serem recriadas",
      });
    },
  );

  // Endpoint para obter URL do OSRM
  app.get("/api/osrm-url", (req: any, res: Response) => {
    try {
      const osrmUrl = getOsrmUrl();
      if (!osrmUrl) {
        return res.status(500).send("OSRM não configurado");
      }
      res.type("text/plain").send(osrmUrl);
    } catch (error) {
      console.error("❌ Erro ao obter URL do OSRM:", error);
      res.status(500).send("Erro ao obter URL do OSRM");
    }
  });

  // Endpoint para obter ponto inicial (técnico/equipe/empresa)
  app.post(
    "/api/routes/start-point",
    authenticateToken,
    async (req: any, res: Response) => {
      try {
        const { responsibleType, responsibleId } = req.body;

        if (!responsibleType || !responsibleId) {
          return res.status(400).json({
            message: "responsibleType e responsibleId são obrigatórios"
          });
        }

        if (responsibleType !== "technician" && responsibleType !== "team") {
          return res.status(400).json({
            message: "responsibleType deve ser 'technician' ou 'team'"
          });
        }

        const startInfo = await resolveStartForRoute(
          req.user.userId,
          responsibleType,
          responsibleId,
          req.user.companyId
        );

        res.json(startInfo);
      } catch (error) {
        console.error("❌ Erro ao resolver ponto inicial:", error);
        res.status(500).json({ message: "Erro ao resolver ponto inicial" });
      }
    },
  );

  // Endpoint para atualizar a DATA da rota
  app.patch("/api/routes/:id/date", authenticateToken, async (req: any, res: Response) => {
    try {
      const routeId = req.params.id;
      const { date } = req.body;

      // 🔒 Guard: companyId obrigatório
      if (!req.user?.companyId) {
        return res.status(403).json({ message: "Empresa inválida. Faça login novamente." });
      }

      if (!date) {
        return res.status(400).json({ message: "Data é obrigatória" });
      }

      const newDate = new Date(date);
      if (isNaN(newDate.getTime())) {
        return res.status(400).json({ message: "Data inválida" });
      }

      const [updatedRoute] = await db
        .update(routesTbl)
        .set({ date: newDate, updatedAt: new Date() })
        .where(and(eq(routesTbl.id, routeId), ownerFilter(routesTbl, req.user.companyId)))
        .returning();

      if (!updatedRoute) {
        return res.status(404).json({ message: "Rota não encontrada" });
      }

      // Registrar auditoria
      await createRouteAudit(
        routeId,
        req.user.userId,
        "update_date",
        `Alterou a data da rota para ${newDate.toLocaleDateString()}`
      );

      res.json(updatedRoute);
    } catch (error: any) {
      console.error("❌ Erro ao atualizar data da rota:", error);
      res.status(500).json({ message: "Erro ao atualizar data da rota" });
    }
  });

  // ==== POST /api/routes/:id/optimize ====
  app.post("/api/routes/:id/optimize", authenticateToken, async (req: any, res) => {
    try {
      const { companyId } = req.user;
      if (!companyId) return res.status(403).json({ error: "Empresa não selecionada ou inválida." });

      const routeId = req.params.id;
      const terminarNoPontoInicial = !!req.body?.terminarNoPontoInicial;

      // 1) Carrega rota e paradas
      const [route] = await db.select().from(routesTbl).where(eq(routesTbl.id, routeId));
      if (!route) return res.status(404).json({ message: "Rota não encontrada" });

      const stops = await db
        .select({
          id: stopsTbl.id,
          order: stopsTbl.order,
          lat: stopsTbl.lat,
          lng: stopsTbl.lng,
          appointmentNumericId: stopsTbl.appointmentNumericId,
        })
        .from(stopsTbl)
        .where(eq(stopsTbl.routeId, routeId))
        .orderBy(asc(stopsTbl.order));

      if (stops.length < 2) {
        return res.status(400).json({ message: "É preciso pelo menos 2 paradas para otimizar." });
      }

      // garante coords válidas, coleciona faltantes
      const missing: Array<{ stopId: string; appointmentNumericId: number | null }> = [];
      const stopCoords = stops.map((s) => {
        const lat = Number(s.lat);
        const lng = Number(s.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          missing.push({ stopId: s.id, appointmentNumericId: (s as any).appointmentNumericId ?? null });
        }
        return { lat, lng };
      });
      if (missing.length) {
        return res.status(400).json({
          error: "Paradas sem lat/lng",
          missing,
        });
      }

      // 2) Determina ponto inicial (depot) igual ao pipeline de Agendamentos
      const startInfo = await resolveStartForRoute(
        req.user.userId,
        route.responsibleType as "technician" | "team",
        route.responsibleId,
        req.user.companyId
      );
      const startLngLat: [number, number] = [
        Number(Number(startInfo.lng).toFixed(6)),
        Number(Number(startInfo.lat).toFixed(6)),
      ];

      // 3) OSRM /table (matriz) com DEPOT + STOPS em formato [lng,lat]
      const OSRM_URL = getOsrmUrl();
      if (!OSRM_URL) {
        return res.status(500).json({ message: "OSRM não configurado (osrm_url.txt)." });
      }

      const osrmCoords: [number, number][] = [
        startLngLat,
        ...stopCoords.map((c) => [Number(c.lng.toFixed(6)), Number(c.lat.toFixed(6))] as [number, number]),
      ];
      // Regex replace para duplo ponto ou virgula, garantindo padrao "lng,lat" do OSRM
      const coordStr = osrmCoords.map((c) => {
         const lng = Number(c[0]);
         const lat = Number(c[1]);
         if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
           throw new Error(`Coordenadas inválidas detectadas no /table: lng=${c[0]}, lat=${c[1]}`);
         }
         return `${lng.toFixed(6)},${lat.toFixed(6)}`;
      }).join(";");
      const tableUrl = `${OSRM_URL}/table/v1/driving/${coordStr}?annotations=duration,distance`;
      console.log("🧮 [/api/routes/:id/optimize] Chamando OSRM table:", tableUrl);
      const tableResp = await fetch(tableUrl);
      if (!tableResp.ok) {
        const t = await tableResp.text();
        return res.status(500).json({ message: `Falha no OSRM table: ${t.slice(0, 200)}` });
      }
      const tableData: any = await tableResp.json();
      const matrix: number[][] = tableData.durations;
      const distances: number[][] = tableData.distances;

      // Validações da matriz
      const n = osrmCoords.length; // depot + stops
      const isSquare = Array.isArray(matrix) && matrix.length === n && matrix.every((row: any) => Array.isArray(row) && row.length === n);
      const hasNaN = isSquare ? matrix.some((row) => row.some((v) => !Number.isFinite(v))) : true;
      console.log(`🧪 Matriz OSRM: ${n}x${n}, hasNaN=${hasNaN}, terminarNoPontoInicial=${terminarNoPontoInicial}`);
      if (!isSquare || hasNaN) {
        return res.status(500).json({ message: "Matriz inválida do OSRM.", n, hasNaN });
      }

      // 4) Chama o solver TSP via OR-Tools usando o Python do venv (Windows)
      const { spawn } = await import("child_process");

      // __dirname aqui aponta para ...\server\routes
      const pyBin = path.join(__dirname, "..", "py", ".venv", "Scripts", "python.exe");
      const tspScript = path.join(__dirname, "..", "solve_tsp.py");

      const input = JSON.stringify({ matrix, terminarNoPontoInicial });
      let out = "", err = "";

      const py = spawn(pyBin, [tspScript], { stdio: ["pipe", "pipe", "pipe"] });

      py.stdout.on("data", (d: Buffer) => (out += d.toString()));
      py.stderr.on("data", (d: Buffer) => (err += d.toString()));
      py.on("error", (e) => console.error("❌ Erro ao iniciar Python do venv:", e));

      py.stdin.write(input);
      py.stdin.end();

      const tspResult = await new Promise<any>((resolve, reject) => {
        py.on("close", (code: number) => {
          if (code !== 0) return reject(new Error(err || `Python exited with code ${code}\n${err}`));
          try { resolve(JSON.parse(out)); }
          catch (e: any) { reject(new Error("Erro parseando saída do Python: " + e.message)); }
        });
      });

      // 5) Valida o retorno do TSP e mapeia para as paradas (ignorando o depósito 0)
      const tspOrder: number[] = Array.isArray(tspResult.order) ? tspResult.order : [];
      console.log("🧭 TSP order recebido:", JSON.stringify(tspOrder));

      if (!tspOrder.length) {
        return res.status(500).json({ message: "TSP inválido: ordem vazia", stdout: out.trim(), stderr: err.trim() });
      }

      // Remove retornos ao depósito (0) e converte índices de [1..n-1] -> [0..stops-1]
      const mappedStops = tspOrder.filter((idx) => idx > 0 && idx < n).map((idx) => idx - 1);
      const uniqueMapped = Array.from(new Set(mappedStops));
      if (uniqueMapped.length !== stops.length) {
        return res.status(500).json({
          message: "TSP inválido: quantidade de nós não cobre todas as paradas",
          expectedStops: stops.length,
          receivedOrderLength: tspOrder.length,
          mappedUnique: uniqueMapped.length,
          order: tspOrder,
          n,
          stdout: out.trim(),
          stderr: err.trim(),
        });
      }

      // 6) Atualiza order das paradas conforme sequência otimizada
      const updates = uniqueMapped.map((stopIdx, pos) => ({ id: stops[stopIdx].id, newOrder: pos + 1 }));

      // Drizzle: atualiza em série (simples e seguro)
      for (const u of updates) {
        await db.update(stopsTbl)
          .set({ order: u.newOrder })
          .where(eq(stopsTbl.id, u.id));
      }

      // 7) Recalcular métricas com base na ordem TSP (considerando depósito na matriz)
      let totalDistance = 0;
      let totalDuration = 0;
      // Caminho: 0 (depósito) -> seq[0] -> seq[1] -> ... -> seq[last] -> (opcional volta 0)
      const seqWithDepot: number[] = [0, ...uniqueMapped.map((i) => i + 1)];
      for (let i = 0; i < seqWithDepot.length - 1; i++) {
        const from = seqWithDepot[i];
        const to = seqWithDepot[i + 1];
        totalDuration += Number(matrix[from][to] ?? 0);
        totalDistance += Number(distances[from][to] ?? 0);
      }
      if (terminarNoPontoInicial) {
        totalDuration += Number(matrix[seqWithDepot[seqWithDepot.length - 1]][0] ?? 0);
        totalDistance += Number(distances[seqWithDepot[seqWithDepot.length - 1]][0] ?? 0);
      }

      // 8) Atualizar polyline_geojson com a rota na nova ordem (inclui o PONTO INICIAL e, se solicitado, retorno ao início)
      const orderedStopLngLat: [number, number][] = uniqueMapped.map((i) => [
        Number(stopCoords[i].lng.toFixed(6)),
        Number(stopCoords[i].lat.toFixed(6)),
      ]);
      const lineCoords: [number, number][] = terminarNoPontoInicial
        ? [startLngLat, ...orderedStopLngLat, startLngLat]
        : [startLngLat, ...orderedStopLngLat];

      const routeCoordsStr = lineCoords.map(p => {
        const lng = Number(p[0]);
        const lat = Number(p[1]);
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
          throw new Error(`Coordenadas inválidas na polyline reotimização: lng=${p[0]}, lat=${p[1]}`);
        }
        return `${lng.toFixed(6)},${lat.toFixed(6)}`;
      }).join(";");
      const routeUrl = `${OSRM_URL}/route/v1/driving/${routeCoordsStr}?overview=full&geometries=geojson`;
      const routeResp = await fetch(routeUrl);

      let polylineGeoJson: any = null;
      let osrmDistance: number | null = null;
      let osrmDuration: number | null = null;

      if (routeResp.ok) {
        const rjson: any = await routeResp.json();
        polylineGeoJson = rjson?.routes?.[0]?.geometry || null;
        osrmDistance = Number(rjson?.routes?.[0]?.distance ?? NaN);
        osrmDuration = Number(rjson?.routes?.[0]?.duration ?? NaN);
      }

      // Totais: prefira os do OSRM (incluem o trecho início → primeira parada)
      const distanceToSave = Number.isFinite(osrmDistance!) ? Math.round(osrmDistance!) : Math.round(totalDistance);
      const durationToSave = Number.isFinite(osrmDuration!) ? Math.round(osrmDuration!) : Math.round(totalDuration);

      await db.update(routesTbl)
        .set({
          distanceTotal: distanceToSave,
          durationTotal: durationToSave,
          stopsCount: stops.length,
          polylineGeoJson: polylineGeoJson ? JSON.stringify(polylineGeoJson) : routesTbl.polylineGeoJson,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(routesTbl.id, routeId));

      // Registra auditoria
      await createRouteAudit(
        routeId,
        req.user.userId,
        "optimize",
        `Otimizou a rota`,
        { stopsCount: stops.length, distanceTotal: distanceToSave, durationTotal: durationToSave }
      );

      // Tracking metrics
      trackFeatureUsage(req.user.userId, "routes", "optimize", null, {
        routeId,
        stops: stops.length,
        dist: distanceToSave
      });

      // 9) ok: o front vai refazer o GET /api/routes/:id
      return res.json({ ok: true });
    } catch (e: any) {
      console.error("❌ /api/routes/:id/optimize erro:", e?.message, e?.stack);
      return res.status(500).json({ message: e?.message || "Erro ao otimizar" });
    }
  });

  // ==== POST /api/routes/optimize ====
  app.post(
    "/api/routes/optimize",
    authenticateToken,
    async (req: any, res: Response) => {
      console.log("==== LOG INÍCIO: /api/routes/optimize ====");
      console.log("Body recebido:", JSON.stringify(req.body, null, 2));

      try {
        // 🔒 Guard: companyId obrigatório (garante isolamento multi-empresa)
        if (!req.user?.companyId) {
          console.log("❌ [OPTIMIZE] req.user.companyId ausente — bloqueando acesso");
          return res.status(403).json({ message: "Empresa inválida. Faça login novamente." });
        }
        const validation = optimizeRouteSchema.safeParse(req.body);
        if (!validation.success) {
          console.log("❌ ERRO: Validação falhou");
          console.log("Erros:", validation.error.errors);
          console.log(
            "==== LOG FIM: /api/routes/optimize (ERRO VALIDAÇÃO) ====",
          );
          return res
            .status(400)
            .json({
              error: "Dados inválidos",
              details: validation.error.errors,
            });
        }

        const { appointmentIds, endAtStart, vehicleId, title, preview, skipOptimization, status } =
          validation.data;
        const appointmentIdsNorm = appointmentIds.map((id: any) => Number(id));

        // 🔎 Carrega Business Rules do usuário (para fallback de endereço inicial)
        const brs = await db
          .select()
          .from(businessRules)
          .where(ownerFilter(businessRules, req.user.companyId))
          .limit(1);

        // 🚫 Validação: Máximo de paradas por rota
        if (brs.length > 0) {
          const maxStops = (brs[0] as any).maximoParadasPorRota;
          if (maxStops && Number(maxStops) > 0 && appointmentIdsNorm.length > Number(maxStops)) {
            console.log(`❌ [MAX STOPS] Tentativa de criar rota com ${appointmentIdsNorm.length} paradas, limite: ${maxStops}`);
            return res.status(400).json({
              error: `Limite de paradas excedido`,
              message: `O máximo de paradas por rota é ${maxStops}. Você selecionou ${appointmentIdsNorm.length} agendamentos.`,
              maxStops: Number(maxStops),
              requested: appointmentIdsNorm.length,
            });
          }
        }

        // 1. Buscar agendamentos + dados do cliente (incluindo lat/lng e endereço)
        console.log("🔍 Buscando agendamentos:", appointmentIdsNorm);
        const appointmentList = await db
          .select({
            id: appointments.id,
            clientId: appointments.clientId,
            serviceId: appointments.serviceId,
            technicianId: appointments.technicianId,
            teamId: appointments.teamId,
            scheduledDate: appointments.scheduledDate,

            // endereço do agendamento
            aptCep: appointments.cep,
            aptLogradouro: appointments.logradouro,
            aptNumero: appointments.numero,
            aptComplemento: appointments.complemento,
            aptBairro: appointments.bairro,
            aptCidade: appointments.cidade,

            // dados do cliente
            clientName: clients.name,
            clientCep: clients.cep,
            clientLogradouro: clients.logradouro,
            clientNumero: clients.numero,
            clientComplemento: clients.complemento,
            clientBairro: clients.bairro,
            clientCidade: clients.cidade,
            clientLat: clients.lat,
            clientLng: clients.lng,
          })
          .from(appointments)
          .leftJoin(clients, eq(appointments.clientId, clients.id))
          .where(ownerFilter(appointments, req.user.companyId));

        // Reordenar conforme a lista de IDs recebida (para respeitar a seleção do usuário)
        const appointmentMap = new Map(appointmentList.map((app) => [app.id, app]));
        const selectedAppointments = appointmentIdsNorm
          .map((id) => appointmentMap.get(id))
          .filter((app): app is typeof appointmentList[0] => app !== undefined);

        if (selectedAppointments.length === 0) {
          console.log("❌ ERRO: Nenhum agendamento encontrado");
          console.log(
            "==== LOG FIM: /api/routes/optimize (SEM AGENDAMENTOS) ====",
          );
          return res
            .status(404)
            .json({ error: "Nenhum agendamento encontrado" });
        }

        console.log(
          "✅ Agendamentos encontrados:",
          selectedAppointments.length,
        );

        // ✅ Garantir responsável único entre os agendamentos selecionados
        // Prioridade: se tem teamId, usa equipe; senão, usa técnico
        const responsibles = selectedAppointments
          .map((a: any) => {
            if (a.teamId) return `team:${a.teamId}`;
            if (a.technicianId) return `technician:${a.technicianId}`;
            return null;
          })
          .filter(Boolean);


        const uniqueResponsibles = Array.from(new Set(responsibles));
        if (uniqueResponsibles.length !== 1) {
          console.log(
            "❌ ERRO: Responsáveis diferentes encontrados:",
            uniqueResponsibles,
          );
          console.log(
            "==== LOG FIM: /api/routes/optimize (RESPONSÁVEL INVÁLIDO) ====",
          );
          return res.status(400).json({
            error: "Seleção inválida",
            details:
              "Todos os agendamentos devem pertencer ao mesmo responsável (mesmo técnico ou mesma equipe).",
          });
        }

        const [respType, respId] = uniqueResponsibles[0]!.split(":");
        const derivedResponsibleType = respType as "technician" | "team";
        const derivedResponsibleId = respId;

        // 2. Determinar endereço de início (técnico/equipe -> empresa) e geocodificar
        let startAddress = "Endereço não configurado";
        let startCoordinates: [number, number] = [-49.2654, -25.4284]; // fallback Curitiba (lng,lat)

        type EntityAddr = {
          enderecoInicioCep?: string | null;
          enderecoInicioLogradouro?: string | null;
          enderecoInicioNumero?: string | null;
          enderecoInicioComplemento?: string | null;
          enderecoInicioBairro?: string | null;
          enderecoInicioCidade?: string | null;
          enderecoInicioEstado?: string | null;
          name?: string | null;
        };

        const buildTentativas = (addr: {
          logradouro?: string | null;
          numero?: string | null;
          complemento?: string | null;
          bairro?: string | null;
          cidade?: string | null;
          cep?: string | null;
          estado?: string | null;
        }) => {
          const checa = (s?: string | null) =>
            s && `${s}`.trim().length ? s.trim() : null;

          const logradouro = checa(addr.logradouro);
          const numero = checa(addr.numero);
          const complemento = checa(addr.complemento);
          const bairro = checa(addr.bairro);
          const cidade = checa(addr.cidade);
          const cepNormalizado = formatCep(addr.cep); // Normaliza CEP para formato com traço
          const estado = checa(addr.estado);

          const tentList: string[] = [];

          // [MELHORIA PARTE 2] Tratamento Inteligente para Rodovias
          if (logradouro && /(rodovia|br[\-\s]?\d+)/i.test(logradouro)) {
             const match = logradouro.match(/br[\s\-]?(\d+)/i);
             const brCode = match ? `BR-${match[1]}` : logradouro;
             
             console.log(`🛣️ [RODOVIA DETECTADA] Logradouro original: ${logradouro}`);
             const rodoviaSimples = [brCode, cidade, estado, "Brasil"].filter(Boolean).join(", ");
             const rodoviaComNumero = [brCode, numero, cidade, estado, "Brasil"].filter(Boolean).join(", ");
             
             tentList.push(rodoviaSimples, rodoviaComNumero);
             console.log(`   -> Variação extra 1: ${rodoviaSimples}`);
             console.log(`   -> Variação extra 2: ${rodoviaComNumero}`);
          }

          // Complemento removido para focar Nominatim apenas no local macro
          const full = [
            logradouro,
            numero,
            bairro,
            cidade,
            cepNormalizado,
            estado,
            "Brasil",
          ]
            .filter(Boolean)
            .join(", ");

          const semNumero = [logradouro, bairro, cidade, cepNormalizado, estado, "Brasil"]
            .filter(Boolean)
            .join(", ");

          const soCepCidade = [cepNormalizado, cidade, estado, "Brasil"]
            .filter(Boolean)
            .join(", ");

          tentList.push(full, semNumero, soCepCidade);
          return Array.from(new Set(tentList.filter((s) => s && s.length >= 8))); // remove duplicates
        };

        let responsibleName = "Prestador";
        let entidade: EntityAddr | null = null;

        try {
          console.log("🏁 Determinando ponto inicial com fallbacks…");

          if (derivedResponsibleType === "technician") {
            const [tech] = await db
              .select({
                name: technicians.name,
                enderecoInicioCep: technicians.enderecoInicioCep,
                enderecoInicioLogradouro: technicians.enderecoInicioLogradouro,
                enderecoInicioNumero: technicians.enderecoInicioNumero,
                enderecoInicioComplemento:
                  technicians.enderecoInicioComplemento,
                enderecoInicioBairro: technicians.enderecoInicioBairro,
                enderecoInicioCidade: technicians.enderecoInicioCidade,
                enderecoInicioEstado: technicians.enderecoInicioEstado,
              })
              .from(technicians)
              .where(
                and(
                  eq(technicians.id, Number(derivedResponsibleId)),
                  eq(technicians.companyId, req.user.companyId),
                ),
              )
              .limit(1);

            if (tech) {
              entidade = tech as EntityAddr;
              if (tech.name) responsibleName = tech.name;
            }
          } else if (derivedResponsibleType === "team") {
            const [team] = await db
              .select({
                name: teams.name,
                enderecoInicioCep: teams.enderecoInicioCep,
                enderecoInicioLogradouro: teams.enderecoInicioLogradouro,
                enderecoInicioNumero: teams.enderecoInicioNumero,
                enderecoInicioComplemento: teams.enderecoInicioComplemento,
                enderecoInicioBairro: teams.enderecoInicioBairro,
                enderecoInicioCidade: teams.enderecoInicioCidade,
                enderecoInicioEstado: teams.enderecoInicioEstado,
              })
              .from(teams)
              .where(
                and(
                  eq(teams.id, Number(derivedResponsibleId)),
                  eq(teams.companyId, req.user.companyId),
                ),
              )
              .limit(1);

            if (team) {
              entidade = team as EntityAddr;
              if (team.name) responsibleName = team.name;
            }
          }

          // 2.1 Tenta endereço próprio do técnico/equipe
          let tentativas: string[] = [];
          if (
            entidade?.enderecoInicioCidade &&
            (entidade.enderecoInicioCep || entidade.enderecoInicioLogradouro)
          ) {
            tentativas = buildTentativas({
              logradouro: entidade.enderecoInicioLogradouro,
              numero: entidade.enderecoInicioNumero,
              complemento: entidade.enderecoInicioComplemento,
              bairro: entidade.enderecoInicioBairro,
              cidade: entidade.enderecoInicioCidade,
              cep: entidade.enderecoInicioCep,
              estado: entidade.enderecoInicioEstado,
            });
            console.log("🏠 Tentativas (técnico/equipe):", tentativas);
          }

          if ((!tentativas || tentativas.length === 0) && brs.length > 0) {
            const br = brs[0];
            tentativas = buildTentativas({
              logradouro: br.enderecoEmpresaLogradouro,
              numero: br.enderecoEmpresaNumero,
              complemento: br.enderecoEmpresaComplemento ?? null,
              bairro: br.enderecoEmpresaBairro,
              cidade: br.enderecoEmpresaCidade,
              cep: br.enderecoEmpresaCep,
              estado: br.enderecoEmpresaEstado,
            });
            console.log("🏢 Tentativas (empresa):", tentativas);
          }

          // 2.3 Geocodifica na ordem (com Cache integrado e Aliases)
          let sucesso: { lat: number; lon: number } | null = null;
          const failedEndsGlobal: string[] = [];

          for (let i = 0; i < tentativas.length; i++) {
            const end = tentativas[i];
            if (!end || end.trim() === "") continue;

            const norm = normalizeAddressForCache(end);
            const hash = generateAddressHash(norm);

            try {
              const cached = await db.select().from(geocodingCache).where(eq(geocodingCache.addressHash, hash)).limit(1);
              if (cached.length > 0 && (cached[0].confidenceLevel === "high" || cached[0].confidenceLevel === "medium")) {
                console.log(`✅ [START_CACHE_HIT] Origem resgatada do cache: ${end} (Source: ${cached[0].source})`);
                sucesso = { lat: cached[0].lat, lon: cached[0].lng }; // ⚠️ campo do banco é 'lng', mapeado como 'lon' para compatibilidade
                startAddress = end;
                break;
              }
            } catch(e) {}

            try {
              console.log(`🌐 [START_GEOCODE] Buscando na API o ponto inicial: ${end}`);
              const r = await geocodeEnderecoServer(end);
              sucesso = r;
              startAddress = end;
              console.log(`✅ Início geocodificado:`, r, "para:", end);
              
              const resLat = Number(r.lat);
              const resLng = Number(r.lon);

              const toSave = [{
                  addressHash: hash,
                  normalizedAddress: norm,
                  postalCode: null, street: null, number: null, neighborhood: null,
                  city: r.addressDetails?.city || r.addressDetails?.town || null,
                  state: r.addressDetails?.state || null,
                  country: r.addressDetails?.country_code || null,
                  lat: resLat, 
                  lng: resLng,
                  source: "nominatim_full_address_start",
                  confidenceLevel: "high",
                  confidenceReason: "start_location_match",
                  rawProviderDisplayName: r.displayName || null,
                  providerPayloadSummary: null,
              }];

              for (const failedEnd of failedEndsGlobal) {
                  const fnorm = normalizeAddressForCache(failedEnd);
                  toSave.push({
                     addressHash: generateAddressHash(fnorm),
                     normalizedAddress: fnorm,
                     postalCode: null, street: null, number: null, neighborhood: null,
                     city: r.addressDetails?.city || r.addressDetails?.town || null,
                     state: r.addressDetails?.state || null,
                     country: r.addressDetails?.country_code || null,
                     lat: resLat, 
                     lng: resLng,
                     source: "start_location_fallback_alias",
                     confidenceLevel: "medium",
                     confidenceReason: "alias_from_successful_fallback",
                     rawProviderDisplayName: r.displayName || null,
                     providerPayloadSummary: null,
                  });
              }

              for (const item of toSave) {
                  try {
                     await db.insert(geocodingCache).values(item).onConflictDoNothing();
                  } catch(e) {}
              }
              console.log(`✅ [START_CACHE_SAVE] Cache atualizado com sucesso e aliases para Start`);
              break;
            } catch (e: any) {
              failedEndsGlobal.push(end);
              console.log(
                `❌ Falha geocodificando tentativa ${i + 1}:`,
                end,
                "-",
                e.message,
              );
            }
          }

          if (sucesso) {
            // OSRM = [lng, lat] — arredondado a 6 casas
            // Number() explícito: garante número mesmo se Drizzle retornar string em algum edge case
            const sLng = Number(sucesso.lon);
            const sLat = Number(sucesso.lat);
            startCoordinates = [
              Number.isFinite(sLng) ? Number(sLng.toFixed(6)) : -49.2654,
              Number.isFinite(sLat) ? Number(sLat.toFixed(6)) : -25.4284,
            ];
          } else {
            console.warn(
              "⚠️ Não foi possível geocodificar o início. Usando fallback Curitiba.",
            );
            if (brs.length > 0) {
              const br = brs[0];
              startAddress = `${br.enderecoEmpresaLogradouro}, ${br.enderecoEmpresaNumero ?? ""}, ${br.enderecoEmpresaBairro}, ${br.enderecoEmpresaCidade}, ${br.enderecoEmpresaCep}, ${br.enderecoEmpresaEstado}, Brasil`;
            } else {
              startAddress = "Curitiba - PR, Brasil";
            }
          }
        } catch (e: any) {
          console.warn("⚠️ Erro ao determinar/geocodificar início:", e.message);
        }

        // 3. Preparar coordenadas para OSRM (início + agendamentos)
        const coordinates: [number, number][] = [startCoordinates];

        // Helpers p/ validar/normalizar coordenadas em formato OSRM ([lng,lat])
        const BRAZIL_BOUNDS = {
          latMin: -34.0,
          latMax: 5.5,
          lngMin: -74.5,
          lngMax: -34.0,
        };
        const inBrazil = (lat: number, lng: number) =>
          lat >= BRAZIL_BOUNDS.latMin &&
          lat <= BRAZIL_BOUNDS.latMax &&
          lng >= BRAZIL_BOUNDS.lngMin &&
          lng <= BRAZIL_BOUNDS.lngMax;

        const to6 = (n: number) => Number(n.toFixed(6));
        const normalizeToOsrm = (
          lat: number,
          lng: number,
        ): [number, number] => {
          // Detecta se vieram invertidos e corrige
          const a = { lat, lng };
          const b = { lat: lng, lng: lat }; // swap
          const pick =
            inBrazil(a.lat, a.lng) && !inBrazil(b.lat, b.lng)
              ? a
              : inBrazil(b.lat, b.lng) && !inBrazil(a.lat, a.lng)
                ? b
                : a;
          return [to6(pick.lng), to6(pick.lat)]; // OSRM = [lng, lat]
        };

        // Normalizador de string p/ comparar endereços (evita sobrescrever lat/lng do cliente em endereços “diferentes”)
        const norm = (s: string) =>
          (s || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/\s+/g, "")
            .toLowerCase();

        // Monta estrutura local dos agendamentos
        const appointmentData = selectedAppointments.map((app) => {
          // Normaliza CEPs para formato com traço (12345-678)
          const aptCepFormatado = formatCep(app.aptCep);
          const clientCepFormatado = formatCep(app.clientCep);

          const aptAddress = [
            app.aptLogradouro,
            app.aptNumero,
            app.aptBairro,
            app.aptCidade,
            aptCepFormatado,
            "Brasil",
          ]
            .filter(Boolean)
            .join(", ");

          const clientAddress = [
            app.clientLogradouro,
            app.clientNumero,
            app.clientBairro,
            app.clientCidade,
            clientCepFormatado,
            "Brasil",
          ]
            .filter(Boolean)
            .join(", ");

          // lat/lng já salvos no cliente (se houver)
          const lat = app.clientLat != null ? Number(app.clientLat) : undefined;
          const lng = app.clientLng != null ? Number(app.clientLng) : undefined;

          console.log(`📋 [AGENDAMENTO ${app.id}] Dados iniciais:`);
          console.log(`   Cliente: ${app.clientName} (ID: ${app.clientId})`);
          console.log(`   Endereço Agendamento: ${aptAddress}`);
          console.log(`   Endereço Cliente: ${clientAddress}`);
          console.log(`   Coordenadas do BANCO (clientLat/Lng): ${lat ? `${lat}, ${lng}` : 'NÃO TEM'}`);

          return {
            ...app,
            address: aptAddress, // endereço do agendamento (prioritário p/ roteirizar)
            clientAddress, // endereço cadastrado do cliente (fallback p/ geocodificação)
            lat,
            lng,
          };
        });

        // Fallback: geocodificar o que estiver sem coordenadas e (quando fizer sentido) persistir no cliente
        for (let i = 0; i < appointmentData.length; i++) {
          const app = appointmentData[i];

          if (Number.isFinite(app.lat) && Number.isFinite(app.lng)) {
            // Cheap geofencing para evitar reaproveitar lixo antigo no BD (como ES -20,-40 em endereços PR)
            const st = ((app as any).aptEstado || (app as any).clientEstado || "").toUpperCase();
            const ct = (app.aptCidade || app.clientCidade || "").toUpperCase();
            const isSuspiciousBox = (st === "PR" || ct === "CURITIBA") && 
                                   (app.lat! > -22 || app.lat! < -27 || app.lng! > -47 || app.lng! < -55);
                                   
            if (isSuspiciousBox) {
              console.warn(`⚠️ [AGENDAMENTO ${app.id}] Coordenada do banco (${app.lat}, ${app.lng}) IGNORADA pois é flagrantemente fora do PR/Sul. Recalculando...`);
              app.lat = undefined;
              app.lng = undefined;
            } else {
              console.log(`✅ [AGENDAMENTO ${app.id}] JÁ TEM COORDENADAS DO BANCO: ${app.lat}, ${app.lng}`);
              continue; // já tem lat/lng do cliente
            }
          }

          console.log(`🔍 [AGENDAMENTO ${app.id}] SEM coordenadas válidas, iniciando geocodificação...`);

          // ================= CACHE NORMALIZATION & HASH =================
          const cepToTry = formatCep(app.aptCep || app.clientCep); // declarado aqui para uso no cache CEP puro também
          const addressToSearch = app.address || app.clientAddress || (cepToTry ? `CEP ${cepToTry}, Brasil` : "");
          const normalizedStr = normalizeAddressForCache(addressToSearch);
          const addrHash = generateAddressHash(normalizedStr);

          // 1) VERIFICAR CACHE COMPARTILHADO
          try {
            const cachedArray = await db
              .select()
              .from(geocodingCache)
              .where(eq(geocodingCache.addressHash, addrHash))
              .limit(1);

            if (cachedArray.length > 0) {
              const cached = cachedArray[0];
              // Reutiliza direto se a confiança for media ou alta.
              if (cached.confidenceLevel === "high" || cached.confidenceLevel === "medium") {
                 app.lat = cached.lat;
                 app.lng = cached.lng;
                 console.log(`✅ [CACHE HIT] Agendamento ${app.id} resgatado do cache. Fonte: ${cached.source} (${cached.confidenceLevel})`);
                 continue; // prula requisição Nominatim
              } else {
                 console.log(`ℹ️ [CACHE BYPASS] Agendamento ${app.id} tem cache, mas a confiança é LOW. Tentando revalidar...`);
              }
            }
          } catch(e: any) {
            console.warn(`⚠️ Falha ao buscar cache de geocodificação: ${e.message}`);
          }

          // 2) TENTATIVA A: Endereço do Agendamento (Completo)
          try {
            console.log(`🌐 [TENTATIVA 1] Geocodificando ENDEREÇO DO AGENDAMENTO:`);
            console.log(`   Endereço: "${app.address}"`);
            const geo = await geocodeEnderecoServer(app.address);
            app.lat = Number(geo.lat);
            app.lng = Number(geo.lon);
            console.log(`✅ [TENTATIVA 1 OK] Coordenadas: ${app.lat}, ${app.lng}`);

            // Salvar no Cache de Confiança HIGH (match direto por endereço completo)
            try {
              await db.insert(geocodingCache).values({
                addressHash: addrHash,
                normalizedAddress: normalizedStr,
                postalCode: null,
                street: null,
                number: null,
                neighborhood: null,
                city: geo.addressDetails?.city || geo.addressDetails?.town || null,
                state: geo.addressDetails?.state || null,
                country: geo.addressDetails?.country_code || null,
                lat: app.lat,
                lng: app.lng,
                source: "nominatim_full_address",
                confidenceLevel: "high",
                confidenceReason: "full_address_match",
                rawProviderDisplayName: geo.displayName || null,
                providerPayloadSummary: null,
              }).onConflictDoNothing(); // se já existe hash (ex do low confidence de antes), não sobrescreve pra já
            } catch(e){}

            // Salvar no Cliente se bater com Cliente original (legado script)
            if (app.clientId && app.clientAddress && norm(app.clientAddress) === norm(app.address)) {
              try {
                await db.update(clients).set({ lat: to6(app.lat), lng: to6(app.lng) }).where(eq(clients.id, app.clientId));
              } catch (e: any) {}
            }

            await sleep(1100);
            continue;
          } catch (e1: any) {
            console.warn(`❌ [TENTATIVA 1 FALHOU] Agendamento ${app.id}: ${e1.message}`);
          }

          // 3) TENTATIVA B: Endereço do Cliente
          if (app.clientAddress && norm(app.clientAddress) !== norm(app.address)) {
            try {
              console.log(`🌐 [TENTATIVA 2] Geocodificando ENDEREÇO DO CLIENTE:`);
              console.log(`   Endereço: "${app.clientAddress}"`);
              const geo2 = await geocodeEnderecoServer(app.clientAddress);
              app.lat = Number(geo2.lat);
              app.lng = Number(geo2.lon);
              console.log(`✅ [TENTATIVA 2 OK] Coordenadas: ${app.lat}, ${app.lng}`);

              // Cache
              try {
                const normClient = normalizeAddressForCache(app.clientAddress);
                await db.insert(geocodingCache).values({
                  addressHash: generateAddressHash(normClient),
                  normalizedAddress: normClient,
                  postalCode: null,
                  street: null,
                  number: null,
                  neighborhood: null,
                  city: geo2.addressDetails?.city || geo2.addressDetails?.town || null,
                  state: geo2.addressDetails?.state || null,
                  country: geo2.addressDetails?.country_code || null,
                  lat: app.lat, 
                  lng: app.lng,
                  source: "nominatim_full_address_client",
                  confidenceLevel: "high",
                  confidenceReason: "client_address_match",
                  rawProviderDisplayName: geo2.displayName || null,
                  providerPayloadSummary: null,
                }).onConflictDoNothing();
              } catch(e){}

              if (app.clientId) {
                try {
                  await db.update(clients).set({ lat: to6(app.lat), lng: to6(app.lng) }).where(eq(clients.id, app.clientId));
                } catch(e){}
              }

              await sleep(1100);
              continue;
            } catch (e2: any) {
              console.warn(`❌ [TENTATIVA 2 FALHOU] Agendamento ${app.id}: ${e2.message}`);
            }
          }

          // 3.5) TENTATIVA INTERMEDIÁRIA: RODOVIAS (exclusiva para agendamentos)
          const checkRod = app.aptLogradouro || app.clientLogradouro || "";
          if (checkRod && /(rodovia|br[\-\s]?\d+)/i.test(checkRod)) {
             try {
                 console.log(`🛣️ [RODOVIA DETECTADA NO AGENDAMENTO ${app.id}] Logradouro: ${checkRod}`);
                 const match = checkRod.match(/br[\s\-]?(\d+)/i);
                 const brCode = match ? `BR-${match[1]}` : checkRod;
                 
                 const numStr = app.aptNumero || app.clientNumero || "";
                 const cid = app.aptCidade || app.clientCidade || "";
                 const est = ((app as any).aptEstado || (app as any).clientEstado || "");
                 
                 const rodoviaSimples = [brCode, cid, est, "Brasil"].filter(Boolean).join(", ");
                 const rodoviaComNumero = [brCode, numStr, cid, est, "Brasil"].filter(Boolean).join(", ");
                 
                 let geoRod = null;
                 
                 console.log(`   [RODOVIA TENTATIVA 1] ${rodoviaSimples}`);
                 try { 
                   geoRod = await geocodeEnderecoServer(rodoviaSimples); 
                 } catch(e) { }
                 
                 if (!geoRod && numStr) {
                     console.log(`   [RODOVIA TENTATIVA 2] ${rodoviaComNumero}`);
                     try { geoRod = await geocodeEnderecoServer(rodoviaComNumero); } catch(e){}
                 }
                 
                 if (geoRod) {
                     app.lat = Number(geoRod.lat);
                     app.lng = Number(geoRod.lon);
                     console.log(`✅ [RODOVIA DETECTADA OK] Coordenadas: ${app.lat}, ${app.lng}`);
                     
                     try {
                         await db.insert(geocodingCache).values({
                             addressHash: addrHash, // atrela ao hash original do bloco para que não precise recalcular "Rodovia Br..." futuramente
                             normalizedAddress: normalizedStr,
                             postalCode: null, street: null, number: null, neighborhood: null,
                             city: geoRod.addressDetails?.city || geoRod.addressDetails?.town || null,
                             state: geoRod.addressDetails?.state || null,
                             country: geoRod.addressDetails?.country_code || null,
                             lat: app.lat, lng: app.lng,
                             source: "nominatim_rodovia_fallback",
                             confidenceLevel: "medium", // Alias indireto derivado de tentativa resumida
                             confidenceReason: "alias_from_rodovia_fallback",
                             rawProviderDisplayName: geoRod.displayName || null,
                             providerPayloadSummary: null,
                         }).onConflictDoNothing();
                     } catch(e) {}
                     
                     if (app.clientId) {
                       try { await db.update(clients).set({ lat: to6(app.lat), lng: to6(app.lng) }).where(eq(clients.id, app.clientId)); } catch(e){}
                     }

                     await sleep(1100);
                     continue;
                 } else {
                     console.log(`❌ [RODOVIA TENTATIVAS FALHARAM] Continuando fluxo normal...`);
                 }
             } catch(e) {}
          } else if (checkRod) {
             // 3.6) TENTATIVA INTERMEDIÁRIA: URBANO ENXUTO (exclusiva para agendamentos comuns)
             // Se não for rodovia, tenta variações limpas sem CEP e sem complemento antes de apelar pro ViaCEP
             try {
                console.log(`🏙️ [URBANO DETECTADO NO AGENDAMENTO ${app.id}] Iniciando variações enxutas...`);
                const numStr = app.aptNumero || app.clientNumero || "";
                const bai = app.aptBairro || app.clientBairro || "";
                const cid = app.aptCidade || app.clientCidade || "";
                const est = ((app as any).aptEstado || (app as any).clientEstado || "");
                
                const varsUrb = [
                  [checkRod, numStr, bai, cid, est, "Brasil"].filter(Boolean).join(", "),
                  [checkRod, bai, cid, est, "Brasil"].filter(Boolean).join(", "),
                  [checkRod, numStr, cid, est, "Brasil"].filter(Boolean).join(", "),
                  [checkRod, cid, est, "Brasil"].filter(Boolean).join(", ")
                ];
                
                // Remove duplicates
                const uniqueVarsUrb = Array.from(new Set(varsUrb));
                let geoUrb = null;
                
                for (let v = 0; v < uniqueVarsUrb.length; v++) {
                    const tentativaAtual = uniqueVarsUrb[v];
                    console.log(`   [URBANO TENTATIVA ${v+1}] ${tentativaAtual}`);
                    try { 
                        geoUrb = await geocodeEnderecoServer(tentativaAtual); 
                        if (geoUrb) break;
                    } catch(e) {}
                }
                
                if (geoUrb) {
                     app.lat = Number(geoUrb.lat);
                     app.lng = Number(geoUrb.lon);
                     console.log(`✅ [URBANO OK] Coordenadas: ${app.lat}, ${app.lng}`);
                     
                     try {
                         await db.insert(geocodingCache).values({
                             addressHash: addrHash, // atrela ao hash original do agendamento
                             normalizedAddress: normalizedStr,
                             postalCode: null, street: null, number: null, neighborhood: null,
                             city: geoUrb.addressDetails?.city || geoUrb.addressDetails?.town || null,
                             state: geoUrb.addressDetails?.state || null,
                             country: geoUrb.addressDetails?.country_code || null,
                             lat: app.lat, lng: app.lng,
                             source: "nominatim_urbano_fallback",
                             confidenceLevel: "medium", // Alias indireto derivado de tentativa resumida
                             confidenceReason: "alias_from_urbano_fallback",
                             rawProviderDisplayName: geoUrb.displayName || null,
                             providerPayloadSummary: null,
                         }).onConflictDoNothing();
                     } catch(e) {}
                     
                     if (app.clientId) {
                       try { await db.update(clients).set({ lat: to6(app.lat), lng: to6(app.lng) }).where(eq(clients.id, app.clientId)); } catch(e){}
                     }

                     await sleep(1100);
                     continue;
                 } else {
                     console.log(`❌ [URBANO FALHOU] Tentando normalização nominal do logradouro...`);
                     
                     // 3.7) NORMALIZAÇÃO NOMINAL DO LOGRADOURO
                     // Aplica substituições leves no nome da rua antes de desistir para o ViaCEP
                     try {
                         const normLogr = (s: string) => s
                           .replace(/\bDoutor\b/gi, 'Dr')
                           .replace(/\bDoutora\b/gi, 'Dra')
                           .replace(/\bSanto\b/gi, 'St')
                           .replace(/\bSanta\b/gi, 'Sta')
                           .replace(/\bProfessor\b/gi, 'Prof')
                           .replace(/\bProfessora\b/gi, 'Profa')
                           .replace(/\bPresidente\b/gi, 'Pres')
                           .replace(/\bEngenheiro\b/gi, 'Eng')
                           .replace(/\bDeputado\b/gi, 'Dep')
                           .replace(/\bGeneral\b/gi, 'Gen')
                           .replace(/\bCoronel\b/gi, 'Cel')
                           .replace(/-([A-Za-z])/g, '$1'); // remove hífens internos: Arco-Verde -> ArcVerde

                         const logradouroNorm = normLogr(checkRod);
                         
                         // Só entra se a normalização produziu algo diferente
                         if (logradouroNorm !== checkRod) {
                             const numStr2 = app.aptNumero || app.clientNumero || "";
                             const cid2 = app.aptCidade || app.clientCidade || "";
                             const est2 = ((app as any).aptEstado || (app as any).clientEstado || "");
                             
                             // Remove prefixo de tipo logradouro (Rua, Avenida, etc.) para variante sem tipo
                             const semTipo = logradouroNorm.replace(/^(Rua|Av|Avenida|Estrada|Travessa|Alameda|Largo|Praça|Viela)\s+/i, '').trim();
                             
                             const varsNorm: string[] = [
                               [logradouroNorm, numStr2, cid2, est2, "Brasil"].filter(Boolean).join(", "),
                               [logradouroNorm, cid2, est2, "Brasil"].filter(Boolean).join(", "),
                             ];
                             if (semTipo !== logradouroNorm) {
                               varsNorm.push([semTipo, numStr2, cid2, est2, "Brasil"].filter(Boolean).join(", "));
                             }
                             
                             let geoNorm = null;
                             for (let vn = 0; vn < varsNorm.length; vn++) {
                                 const tentNorm = varsNorm[vn];
                                 console.log(`   [LOGRADOURO NORMALIZADO TENTATIVA ${vn+1}] ${tentNorm}`);
                                 try {
                                     geoNorm = await geocodeEnderecoServer(tentNorm);
                                     if (geoNorm) break;
                                 } catch(e) {}
                             }
                             
                             if (geoNorm) {
                                 app.lat = Number(geoNorm.lat);
                                 app.lng = Number(geoNorm.lon);
                                 console.log(`✅ [LOGRADOURO NORMALIZADO OK] Coordenadas: ${app.lat}, ${app.lng}`);
                                 
                                 try {
                                     await db.insert(geocodingCache).values({
                                         addressHash: addrHash,
                                         normalizedAddress: normalizedStr,
                                         postalCode: null, street: null, number: null, neighborhood: null,
                                         city: geoNorm.addressDetails?.city || geoNorm.addressDetails?.town || null,
                                         state: geoNorm.addressDetails?.state || null,
                                         country: geoNorm.addressDetails?.country_code || null,
                                         lat: app.lat, lng: app.lng,
                                         source: "nominatim_logradouro_norm_fallback",
                                         confidenceLevel: "medium",
                                         confidenceReason: "alias_from_logradouro_normalization",
                                         rawProviderDisplayName: geoNorm.displayName || null,
                                         providerPayloadSummary: null,
                                     }).onConflictDoNothing();
                                 } catch(e) {}
                                 
                                 if (app.clientId) {
                                     try { await db.update(clients).set({ lat: to6(app.lat), lng: to6(app.lng) }).where(eq(clients.id, app.clientId)); } catch(e) {}
                                 }
                                 
                                 await sleep(1100);
                                 continue;
                             } else {
                                 console.log(`❌ [LOGRADOURO NORMALIZADO FALHOU] Seguindo para ViaCEP...`);
                             }
                         } else {
                             console.log(`ℹ️ [LOGRADOURO NORMALIZADO] Sem diferença após normalização, pulando...`);
                         }
                     } catch(e) {}
                 }
             } catch(e) {}
          }

          // 4) TENTATIVA C: Intermedíario Reconstrução com ViaCEP
          const cepOnlyNum = (app.aptCep || app.clientCep || "").replace(/\D/g, "");
          if (cepOnlyNum && cepOnlyNum.length === 8) {
             try {
               console.log(`🌐 [TENTATIVA 3 - VIA CEP] Tentando reconstruir endereço corrompido...`);
               const viacepRes = await fetch(`https://viacep.com.br/ws/${cepOnlyNum}/json/`);
               const viacepData = await viacepRes.json();
               
               if (!viacepData.erro && viacepData.logradouro) {
                  const numStr = app.aptNumero || app.clientNumero || "";
                  const rebuiltAddr = [viacepData.logradouro, numStr, viacepData.bairro, viacepData.localidade, viacepData.uf, viacepData.cep, "Brasil"].filter(Boolean).join(", ");
                  console.log(`   [VIA CEP] Endereço Reconstruído: "${rebuiltAddr}"`);
                  
                  // Geocodifica endereço limpo
                  const geoV = await geocodeEnderecoServer(rebuiltAddr);
                  app.lat = Number(geoV.lat);
                  app.lng = Number(geoV.lon);
                  console.log(`✅ [TENTATIVA 3 OK] Nominatim Rebuild obteve Coordenadas: ${app.lat}, ${app.lng}`);

                  // Cache da reconstrução (Medium/High depending on accuracy)
                  try {
                    const normRc = normalizeAddressForCache(rebuiltAddr);
                    await db.insert(geocodingCache).values({
                      addressHash: generateAddressHash(normRc),
                      normalizedAddress: normRc,
                      postalCode: formatCep(viacepData.cep) || null,
                      street: viacepData.logradouro || null,
                      number: numStr || null,
                      neighborhood: viacepData.bairro || null,
                      city: viacepData.localidade || null,
                      state: viacepData.uf || null,
                      country: "br",
                      lat: app.lat, 
                      lng: app.lng,
                      source: "nominatim_rebuilt_from_viacep",
                      confidenceLevel: "medium", // Resultado de aproximação válido e aceitável para roteirização
                      confidenceReason: "rebuilt_from_via_cep_postal",
                      rawProviderDisplayName: geoV.displayName || null,
                      providerPayloadSummary: null,
                    }).onConflictDoNothing();
                  } catch(e){}
                  
                  await sleep(1100);
                  continue;
               } else {
                  console.log(`   ⚠️ [VIA CEP] Retornou vazio ou apenas cidade (CEP genérico), não é o suficiente para reconstruir logradouro.`);
               }
             } catch(eC: any) {
               console.warn(`❌ [TENTATIVA 3 FALHOU] Erro na ponte ViaCEP: ${eC.message}`);
             }
          }

          // 5) ÚLTIMO FALLBACK: APENAS COM CEP PURO RIGOROSO
          // cepToTry já foi declarado acima no início do bloco de geocodificação
          if (cepToTry) {
            try {
              console.log(`🌐 [TENTATIVA ULTIMA] Geocodificando apenas com CEP puro diretamente no Nominatim...`);
              const geo3 = await geocodeEnderecoServer(`CEP ${cepToTry}, Brasil`);
              
              // === Nova regra: Validação contextual do fallback de CEP ===
              const normalizeTexto = (t: string | null | undefined) => (t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
              const expCidade = normalizeTexto(app.aptCidade || app.clientCidade);
              const expBairro = normalizeTexto(app.aptBairro || app.clientBairro);
              
              const addrInfo = geo3.addressDetails || {};
              const retCountryCode = normalizeTexto(addrInfo.country_code); 
              const retCity = normalizeTexto(addrInfo.city || addrInfo.town || addrInfo.municipality || addrInfo.village);
              const retState = normalizeTexto(addrInfo.state);
              const retSuburb = normalizeTexto(addrInfo.suburb || addrInfo.neighbourhood || addrInfo.district);

              let blockReason = "";
              let finalConfidenceReason = "only_postal_code_validated";

              // Validação Base (Bloqueante)
              if (retCountryCode && retCountryCode !== "br") {
                blockReason = "País diferente do Brasil";
              } else if (retCity && expCidade && !retCity.includes(expCidade) && !expCidade.includes(retCity)) {
                blockReason = `Cidade incompatível (retornou ${retCity}, esperava ${expCidade})`;
              }

              // Validação Secundária: Bairro (Não bloqueante, apenas reforço de confiança e log)
              if (!blockReason && retSuburb && expBairro) {
                 if (retSuburb.includes(expBairro) || expBairro.includes(retSuburb)) {
                    console.log(`   ✅ [Reforço] Bairro coincidiu (${retSuburb}). Resultado fortalecido.`);
                    finalConfidenceReason = "postal_code_with_neighborhood_match";
                 } else {
                    console.log(`   ⚠️ [Tolerado] Bairro diferente (Retornou ${retSuburb}, esperado ${expBairro}). Assumindo pelo match de Cidade/País.`);
                    finalConfidenceReason = "postal_code_city_match_neighborhood_diff";
                 }
              }

              if (blockReason) {
                 console.warn(`❌ CEP Result Rejeitado preventivamente. Motivo: ${blockReason}`);
                 throw new Error(`Validação de contexto do CEP falhou: ${blockReason}`);
              }
              
              app.lat = Number(geo3.lat);
              app.lng = Number(geo3.lon);
              console.log(`✅ [TENTATIVA ULTIMA OK] Coordenadas obtidas e aceitas rigorosamente: ${app.lat}, ${app.lng}`);

              // Salva no cache com Confiança LOW (pois CEP centraliza no meio e não na residência)
              try {
                const normCepOnly = normalizeAddressForCache(`CEP ${cepToTry}, Brasil`);
                await db.insert(geocodingCache).values({
                  addressHash: generateAddressHash(normCepOnly),
                  normalizedAddress: normCepOnly,
                  postalCode: formatCep(cepToTry) || null,
                  street: null,
                  number: null,
                  neighborhood: retSuburb || null,
                  city: addrInfo.city || addrInfo.town || null,
                  state: addrInfo.state || null,
                  country: "br",
                  lat: app.lat, 
                  lng: app.lng,
                  source: "nominatim_postal_code_only",
                  confidenceLevel: "low",
                  confidenceReason: finalConfidenceReason,
                  rawProviderDisplayName: geo3.displayName || null,
                  providerPayloadSummary: null,
                }).onConflictDoNothing();
              } catch(e){}

              await sleep(1100);
              continue;
            } catch (e3: any) {
              console.warn(`❌ Geocodificação cega via (CEP puro) falhou para ${app.id}:`, e3.message);
            }
          }

          // 6) se nada funcionou, aborta com erro claro
          console.log(
            "❌ Agendamento sem coordenadas após fallbacks:",
            app.id,
            app.address,
            app.clientAddress,
          );
          return res.status(400).json({
            error: "Agendamento sem coordenadas",
            details: `Não foi possível geocodificar o agendamento ${app.id}. Verifique o endereço.`,
          });
        }

        // Validação final: todo mundo precisa ter lat/lng agora
        const stillMissing = appointmentData.filter(
          (a) => !(Number.isFinite(a.lat) && Number.isFinite(a.lng)),
        );
        if (stillMissing.length) {
          console.log(
            "❌ Ainda existem agendamentos sem coordenadas:",
            stillMissing.map((m) => m.id),
          );
          return res.status(400).json({
            error: "Agendamento sem coordenadas",
            details:
              "Há clientes sem lat/lng. Ajuste o endereço e tente novamente.",
          });
        }

        // Log FINAL com todas as coordenadas que serão usadas
        console.log("====================================");
        console.log("📍 COORDENADAS FINAIS PARA OTIMIZAÇÃO:");
        console.log("====================================");
        appointmentData.forEach((app) => {
          console.log(`Agendamento ${app.id} (Cliente: ${app.clientName}):`);
          console.log(`  Endereço: ${app.address}`);
          console.log(`  Coordenadas: LAT=${app.lat}, LNG=${app.lng}`);
        });
        console.log("====================================");

        // Alimenta a coordinates em formato OSRM
        for (const app of appointmentData) {
          coordinates.push(
            normalizeToOsrm(app.lat as number, app.lng as number),
          ); // [lng,lat]
        }

        console.log("📍 Coordenadas preparadas (OSRM [lng,lat]):", coordinates);

        // 4. Obter matriz de distâncias/tempos do OSRM (APENAS SE OTIMIZAR)
        let durations: number[][] | null = null;
        let distances: number[][] | null = null;
        let tourOrder: number[] = [];
        let totalDistance = 0;
        let totalDuration = 0;

        if (skipOptimization) {
          console.log("⏩ Pulando otimização (skipOptimization=true)");

          // Manter ordem original: [0 (depot), 1, 2, 3, ..., n]
          tourOrder = Array.from({ length: coordinates.length }, (_, i) => i);
          if (endAtStart) {
            tourOrder.push(0);
          }

          // NÃO chamamos getOSRMMatrix aqui para economizar requisições
        } else {
          console.log("🧮 Calculando matriz OSRM...");
          const matrixData = await getOSRMMatrix(coordinates);
          durations = matrixData.durations;
          distances = matrixData.distances;

          console.log("🔄 Resolvendo TSP...");
          tourOrder = solveTSP(distances, endAtStart);

          // Calcular totais baseados na matriz (cálculo inicial)
          for (let i = 0; i < tourOrder.length - 1; i++) {
            const from = tourOrder[i];
            const to = tourOrder[i + 1];
            totalDistance += distances[from][to];
            totalDuration += durations[from][to];
          }
        }

        console.log("📊 Totais preliminares:", totalDistance, "m,", totalDuration, "s");

        // 7. Gerar polyline GeoJSON E atualizar totais finais
        const routeCoordinates = tourOrder.map((idx) => coordinates[idx]);
        let polylineGeoJson: any = null;

        try {
          const OSRM_URL_ROUTE = getOsrmUrl()?.replace(/\/$/, "") || null;
          if (OSRM_URL_ROUTE) {
            // Formatação segura de coordenadas para envio ao OSRM 
            const coordStr = routeCoordinates.map((c) => {
              const lng = Number(c[0]);
              const lat = Number(c[1]);
              if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
                throw new Error(`Coordenadas inválidas detectadas ao montar URL do OSRM: lng=${c[0]}, lat=${c[1]}`);
              }
              // Transforma em string com '.' explícito garantido para evitar localidade injetando ',' ou ".."   
              return `${lng.toFixed(6)},${lat.toFixed(6)}`;
            }).join(";");
            
            // PROVA E CORREÇÃO: Remove qualquer traço duplicado que possa ter surgido na coordStr
            const cleanCoordStr = coordStr.trim().replace(/^--+/, "-");
            
            // Montagem usando concatenação explícita para evitar qualquer phantom dash em template literals
            const osrmUrl = OSRM_URL_ROUTE + "/route/v1/driving/" + cleanCoordStr + "?overview=full&geometries=geojson";
            console.log("🗺️ Chamando OSRM route:", osrmUrl);

            const response = await fetch(osrmUrl);
            const data = await response.json();

            if (data.routes && data.routes.length > 0) {
              polylineGeoJson = data.routes[0].geometry;

              // Usar os totais precisos retornados pela API de rotas
              const osrmDist = Number(data.routes[0].distance);
              const osrmDur = Number(data.routes[0].duration);

              if (Number.isFinite(osrmDist)) totalDistance = osrmDist;
              if (Number.isFinite(osrmDur)) totalDuration = osrmDur;

              console.log("🗺️ Polyline gerada com sucesso. Totais finais:", totalDistance, totalDuration);
            } else {
              console.warn("⚠️ OSRM não retornou rota válida.");
            }
          } else {
            throw new Error("OSRM URL não configurado");
          }
        } catch (error: any) {
          console.log("⚠️ Erro ao gerar polyline:", error.message);
        }

        // 8. Preparar dados da rota
        // 8. Preparar dados da rota
        const routeDate = selectedAppointments[0]?.scheduledDate || new Date();

        // Formatar data para DD/MM/YYYY (garantindo timezone correto)
        const dateObj = typeof routeDate === 'string' ? new Date(routeDate + 'T12:00:00') : new Date(new Date(routeDate).toISOString().split('T')[0] + 'T12:00:00');
        const dateStr = dateObj.toLocaleDateString("pt-BR");

        const routeTitle =
          title || `Rota ${dateStr} - ${responsibleName}`;

        const routeData = {
          title: routeTitle,
          date: routeDate,
          vehicleId: vehicleId || null,
          responsibleType: derivedResponsibleType,
          responsibleId: derivedResponsibleId,
          endAtStart,
          distanceTotal: Math.round(totalDistance),
          durationTotal: Math.round(totalDuration),
          stopsCount: selectedAppointments.length,
          status: (status || "draft") as "draft" | "confirmado" | "finalizado" | "cancelado",
          polylineGeoJson,
        };

        // Preparar dados das paradas
        const stopData = [];
        for (let i = 1; i < tourOrder.length; i++) {
          // Pular índice 0 (início)
          const appointmentIndex = tourOrder[i] - 1; // Ajustar índice
          if (
            appointmentIndex >= 0 &&
            appointmentIndex < appointmentData.length
          ) {
            const app = appointmentData[appointmentIndex];
            stopData.push({
              appointmentId: numberToUUID(Number(app.id)),
              appointmentNumericId: Number(app.id), // 🔧 CRITICAL: ID numérico para validação
              order: i,
              lat: app.lat,
              lng: app.lng,
              address: app.address,
            });
          }
        }

        const start = {
          address: startAddress,
          lat: startCoordinates[1],
          lng: startCoordinates[0],
        };

        // Preparar stops enriquecidos para resposta
        const stops = stopData.map((stop) => {
          const app = appointmentData.find(
            (a) => numberToUUID(Number(a.id)) === stop.appointmentId,
          );
          return {
            order: stop.order,
            appointmentId: stop.appointmentId,
            appointmentNumericId: app?.id ?? null,
            clientName: app?.clientName || "Cliente",
            serviceName: "",
            scheduledDate: app?.scheduledDate ?? null,
            address: stop.address,
            lat: stop.lat,
            lng: stop.lng,
          };
        });

        // 9. Se preview !== false, NÃO salvar no banco (apenas retornar dados)
        if (preview !== false) {
          console.log("📋 Modo PREVIEW - não salvando no banco");
          const responseData = {
            route: {
              id: null,
              ...routeData,
              isOptimized: !skipOptimization, // Indica se a rota foi otimizada
              responsible: {
                type: derivedResponsibleType,
                id: derivedResponsibleId,
              },
            },
            start,
            stops,
          };

          console.log("✅ Rota otimizada (PREVIEW)");
          console.log("📍 Start adicionado ao payload:", startAddress);
          console.log(
            "==== LOG FIM: /api/routes/optimize (SUCESSO - PREVIEW) ====",
          );
          return res.json(responseData);
        }

        // 10. Calcular próximo displayNumber
        let nextDisplayNumber = 1;
        {
          const [maxRes] = await db
            .select({
              maxNum: sql<number>`COALESCE(MAX(${routesTbl.displayNumber}), 0)`,
            })
            .from(routesTbl)
            .where(ownerFilter(routesTbl, req.user.companyId)); // 🔧 Filtrar por companyId para numeração sequencial por empresa
          nextDisplayNumber = (maxRes?.maxNum ?? 0) + 1;
        }

        // 11. Salvar no banco (se preview === false)
        console.log("💾 Salvando rota no banco...");
        const [savedRoute] = await db
          .insert(routesTbl)
          .values({
            title: routeData.title,
            date: routeData.date,
            vehicleId: routeData.vehicleId ? Number(routeData.vehicleId) : null,
            responsibleType: routeData.responsibleType,
            responsibleId: routeData.responsibleId,
            endAtStart: routeData.endAtStart,
            distanceTotal: routeData.distanceTotal,
            durationTotal: routeData.durationTotal,
            stopsCount: routeData.stopsCount,
            status: routeData.status,
            polylineGeoJson: routeData.polylineGeoJson,
            displayNumber: nextDisplayNumber,
            userId: req.user.userId,
            companyId: req.user.companyId, // 🔒 Isolamento multi-tenant obrigatório
          })
          .returning();

        // Salvar paradas
        if (stopData.length > 0) {
          const stopDataWithRouteId = stopData.map((stop) => ({
            routeId: savedRoute.id,
            appointmentId: stop.appointmentId,
            appointmentNumericId: stop.appointmentNumericId, // 🔧 CRITICAL: ID numérico para validação
            order: stop.order,
            lat: stop.lat ?? 0,
            lng: stop.lng ?? 0,
            address: stop.address,
          }));
          await db.insert(stopsTbl).values(stopDataWithRouteId);
          console.log("✅ Paradas salvas:", stopDataWithRouteId.length);
        }


        const responseData = {
          route: {
            id: savedRoute.id,
            title: savedRoute.title,
            date: savedRoute.date,
            isOptimized: !skipOptimization, // Indica se a rota foi otimizada
            vehicleId: savedRoute.vehicleId,
            responsible: {
              type: savedRoute.responsibleType,
              id: savedRoute.responsibleId,
            },
            endAtStart: savedRoute.endAtStart,
            distanceTotal: savedRoute.distanceTotal,
            durationTotal: savedRoute.durationTotal,
            stopsCount: savedRoute.stopsCount,
            status: savedRoute.status,
            polylineGeoJson: savedRoute.polylineGeoJson,
            displayNumber: savedRoute.displayNumber,
          },
          start,
          stops,
        };

        console.log("✅ Rota otimizada e salva com sucesso");
        console.log("📍 Start adicionado ao payload:", startAddress);
        console.log("==== LOG FIM: /api/routes/optimize (SUCESSO) ====");

        res.json(responseData);
      } catch (error: any) {
        console.log("❌ ERRO na otimização:");

        console.error(error);
        console.log("==== LOG FIM: /api/routes/optimize (ERRO) ====");
        res.status(500).json({
          message: error?.message || "Erro interno na otimização da rota"
        });
      }
    });
  // GET /api/routes - Listar rotas com filtros PAGINADOS
  app.get("/api/routes", authenticateToken, async (req: any, res: Response) => {
    console.log("==== LOG INÍCIO: /api/routes ====");
    console.log("Query params:", JSON.stringify(req.query, null, 2));

    try {
      // 🔒 Guard: companyId obrigatório (garante isolamento multi-empresa)
      if (!req.user?.companyId) {
        console.log("❌ [GET /api/routes] req.user.companyId ausente — bloqueando acesso");
        return res.status(403).json({ message: "Empresa inválida. Faça login novamente." });
      }

      const {
        from,
        to,
        status,
        responsibleType,
        responsibleId,
        vehicleId,
        search,
      } = req.query;

      // ✅ Paginação: defaults page=1, pageSize=20, max=50
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize as string) || 20));
      const offset = (page - 1) * pageSize;

      const conditions = [];

      // 🔒 Filtro estrito por companyId — isolamento multi-tenant
      conditions.push(ownerFilter(routesTbl, req.user.companyId));

      if (from) {
        conditions.push(gte(routesTbl.date, new Date(from as string)));
      }

      if (to) {
        conditions.push(lte(routesTbl.date, new Date(to as string)));
      }

      if (status) {
        conditions.push(eq(routesTbl.status, status as string));
      }

      if (responsibleType) {
        conditions.push(eq(routesTbl.responsibleType, responsibleType as string));
      }

      if (responsibleId) {
        conditions.push(eq(routesTbl.responsibleId, responsibleId as string));
      }

      if (vehicleId) {
        conditions.push(eq(routesTbl.vehicleId, Number(vehicleId)));
      }

      if (search) {
        conditions.push(like(routesTbl.title, `%${search}%`));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // 1) Contar total para paginação
      const countResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(routesTbl)
        .where(whereClause);
      const total = countResult[0]?.count || 0;

      // 2) Buscar rotas paginadas com joins para responsibleName
      const routeList = await db
        .select({
          id: routesTbl.id,
          title: routesTbl.title,
          date: routesTbl.date,
          vehicleId: routesTbl.vehicleId,
          responsibleType: routesTbl.responsibleType,
          responsibleId: routesTbl.responsibleId,
          endAtStart: routesTbl.endAtStart,
          distanceTotal: routesTbl.distanceTotal,
          durationTotal: routesTbl.durationTotal,
          stopsCount: routesTbl.stopsCount,
          status: routesTbl.status,
          displayNumber: routesTbl.displayNumber,
          createdAt: routesTbl.createdAt,
          // Join para nome do responsável
          technicianName: technicians.name,
          teamName: teams.name,
        })
        .from(routesTbl)
        .leftJoin(technicians, and(
          eq(routesTbl.responsibleType, 'technician'),
          eq(routesTbl.responsibleId, sql`${technicians.id}::text`)
        ))
        .leftJoin(teams, and(
          eq(routesTbl.responsibleType, 'team'),
          eq(routesTbl.responsibleId, sql`${teams.id}::text`)
        ))
        .where(whereClause)
        .orderBy(desc(routesTbl.createdAt))
        .limit(pageSize)
        .offset(offset);

      // 3) Mapear resultado com responsibleName
      const rawItems = routeList.map((r) => ({
        ...r,
        responsibleName: r.technicianName || r.teamName || null,
        technicianName: undefined,
        teamName: undefined,
      }));

      // 4) Enriquecer com tempos estimado e real (batch queries por performance)
      let items = rawItems;
      if (rawItems.length > 0) {
        const routeIds = rawItems.map((r) => r.id);

        // 4a) Buscar paradas + serviços para calcular estimatedServiceMinutes
        const stopsWithServices = await db
          .select({
            routeId: stopsTbl.routeId,
            serviceDuration: services.duration, // minutos
          })
          .from(stopsTbl)
          .innerJoin(appointments, eq(stopsTbl.appointmentNumericId, appointments.id))
          .innerJoin(services, eq(appointments.serviceId, services.id))
          .where(inArray(stopsTbl.routeId, routeIds));

        // Somar duração dos serviços por routeId
        const estimatedMap = new Map<string, number>();
        for (const row of stopsWithServices) {
          const prev = estimatedMap.get(row.routeId) ?? 0;
          estimatedMap.set(row.routeId, prev + (row.serviceDuration ?? 0));
        }

        // 4b) Buscar agendamentos para calcular realExecutionMinutes
        const stopsWithExec = await db
          .select({
            routeId: stopsTbl.routeId,
            executionStartedAt: appointments.executionStartedAt,
            executionFinishedAt: appointments.executionFinishedAt,
          })
          .from(stopsTbl)
          .innerJoin(appointments, eq(stopsTbl.appointmentNumericId, appointments.id))
          .where(
            and(
              inArray(stopsTbl.routeId, routeIds),
              sql`${appointments.executionStartedAt} IS NOT NULL`,
              sql`${appointments.executionFinishedAt} IS NOT NULL`
            )
          );

        // Somar tempo real de execução por routeId (em minutos)
        const realMap = new Map<string, number>();
        for (const row of stopsWithExec) {
          if (row.executionStartedAt && row.executionFinishedAt) {
            const diffMs = new Date(row.executionFinishedAt).getTime() - new Date(row.executionStartedAt).getTime();
            if (diffMs > 0) {
              const diffMin = Math.round(diffMs / 60000);
              const prev = realMap.get(row.routeId) ?? 0;
              realMap.set(row.routeId, prev + diffMin);
            }
          }
        }

        // Montar items enriquecidos
        items = rawItems.map((r) => ({
          ...r,
          estimatedServiceMinutes: estimatedMap.get(r.id) ?? null,
          realExecutionMinutes: realMap.size > 0 ? (realMap.get(r.id) ?? null) : null,
        }));
      }

      const result = {
        items,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        }
      };

      console.log(`✅ Rotas encontradas: ${items.length} de ${total} (página ${page})`);
      console.log("==== LOG FIM: /api/routes (SUCESSO) ====");

      logEgressSize(req, result);
      res.json(result);
    } catch (error: any) {
      console.log("❌ ERRO na listagem:");
      console.log("Mensagem:", error.message);
      console.log("==== LOG FIM: /api/routes (ERRO) ====");
      res
        .status(500)
        .json({ error: "Erro interno do servidor", details: error.message });
    }
  });

  // GET /api/routes/:id - Buscar rota específica
  app.get(
    "/api/routes/:id",
    authenticateToken,
    async (req: any, res: Response) => {
      console.log("==== LOG INÍCIO: /api/routes/:id ====");
      console.log("Route ID:", req.params.id);

      try {
        // 🔒 Guard: companyId obrigatório
        if (!req.user?.companyId) {
          return res.status(403).json({ message: "Empresa inválida. Faça login novamente." });
        }

        const routeId = req.params.id;

        // Buscar rota garantindo ownership por userId
        const [route] = await db
          .select()
          .from(routesTbl)
          .where(and(
            eq(routesTbl.id, routeId),
            ownerFilter(routesTbl, req.user.companyId)
          ));

        if (!route) {
          console.log("❌ ERRO: Rota não encontrada ou sem permissão");
          console.log("==== LOG FIM: /api/routes/:id (NÃO ENCONTRADA) ====");
          return res.status(404).json({ error: "Rota não encontrada" });
        }

        // 1) Buscar paradas da rota
        const stopsRaw = await db
          .select()
          .from(stopsTbl)
          .where(eq(stopsTbl.routeId, routeId))
          .orderBy(stopsTbl.order);

        console.log("🧩 Enriquecendo paradas com dados do cliente...");

        // 2) Resolver appointmentId para número (aceita UUID fake OU número)
        const appointmentNumericIds = stopsRaw
          .map((s) => {
            const raw = String(s.appointmentId ?? "");
            // tenta UUID -> número
            const fromUuid = uuidToNumber(raw);
            if (typeof fromUuid === "number" && Number.isFinite(fromUuid)) return fromUuid;

            // fallback: tenta parsear número puro
            const asNum = Number(raw);
            return Number.isFinite(asNum) ? asNum : null;
          })
          .filter((n): n is number => typeof n === "number" && Number.isFinite(n));

        let appointmentsWithClients: Array<{
          id: number;
          clientId: number | null;
          clientName: string | null;
          scheduledDate: Date | null;
        }> = [];

        // 3) Buscar appointments + clients apenas dos IDs necessários (com inArray)
        // Não filtramos por userId aqui pois o isolamento já está garantido pela rota
        if (appointmentNumericIds.length > 0) {
          appointmentsWithClients = await db
            .select({
              id: appointments.id,
              clientId: appointments.clientId,
              clientName: clients.name,
              scheduledDate: appointments.scheduledDate,
            })
            .from(appointments)
            .leftJoin(clients, eq(appointments.clientId, clients.id))
            .where(inArray(appointments.id, appointmentNumericIds));
        }

        // 4) Montar map id->dados para resolver rápido
        const appMap = new Map<
          number,
          { clientName: string | null; scheduledDate: Date | null }
        >();
        for (const a of appointmentsWithClients) {
          appMap.set(a.id, {
            clientName: a.clientName ?? null,
            scheduledDate: a.scheduledDate ?? null,
          });
        }

        // 5) Enriquecer as paradas com clientName e scheduledDate (robusto)
        const stops = stopsRaw.map((s) => {
          const raw = String(s.appointmentId ?? "");

          // tenta UUID -> número
          let numericId = uuidToNumber(raw);
          // fallback: número puro
          if (numericId == null) {
            const asNum = Number(raw);
            numericId = Number.isFinite(asNum) ? asNum : null;
          }

          const extra = numericId != null ? appMap.get(numericId) : undefined;

          return {
            ...s,
            appointmentNumericId: numericId ?? null,
            clientName: extra?.clientName ?? null,
            scheduledDate: extra?.scheduledDate ?? null,
          };
        });

        console.log(
          "✅ Rota encontrada com",
          stops.length,
          "paradas (enriquecidas com clientName)",
        );

        // calcula início com base no responsável da rota
        const start = await resolveStartForRoute(
          (req as any).user.userId,
          route.responsibleType as "technician" | "team",
          route.responsibleId,
          (req as any).user.companyId
        );

        res.json({
          route,
          stops,
          start, // { lat, lng, address }
        });

      } catch (error: any) {
        console.log("❌ ERRO na busca:");
        console.log("Mensagem:", error.message);
        console.log("==== LOG FIM: /api/routes/:id (ERRO) ====");
        res
          .status(500)
          .json({ error: "Erro interno do servidor", details: error.message });
      }
    },
  );

  // GET /api/routes/:id/available-appointments
  app.get(
    "/api/routes/:id/available-appointments",
    authenticateToken,
    async (req: any, res: Response) => {
      try {
        // 🔒 Guard: companyId obrigatório
        if (!req.user?.companyId) {
          return res.status(403).json({ message: "Empresa inválida. Faça login novamente." });
        }

        const routeId = req.params.id;

        // 1. Obter a rota para saber a data — verificando ownership
        const [route] = await db
          .select({
            id: routesTbl.id,
            date: routesTbl.date,
            userId: routesTbl.userId,
            responsibleType: routesTbl.responsibleType,
            responsibleId: routesTbl.responsibleId,
          })
          .from(routesTbl)
          .where(and(
            eq(routesTbl.id, routeId),
            ownerFilter(routesTbl, req.user.companyId)
          ))
          .limit(1);

        if (!route) {
          return res.status(404).json({ message: "Rota não encontrada" });
        }

        // 2. Definir range do dia
        const routeDate = new Date(route.date);
        const start = new Date(routeDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(routeDate);
        end.setHours(23, 59, 59, 999);

        // 3. Buscar candidates: Agendamentos do dia, status scheduled/rescheduled, mesmo userId
        const candidatesFull = await db
          .select({
            id: appointments.id,
            clientId: appointments.clientId,
            scheduledDate: appointments.scheduledDate,
            status: appointments.status,
            cep: appointments.cep,
            logradouro: appointments.logradouro,
            numero: appointments.numero,
            bairro: appointments.bairro,
            cidade: appointments.cidade,
            clientName: clients.name,
          })
          .from(appointments)
          .leftJoin(clients, eq(appointments.clientId, clients.id))
          .where(
            and(
              ownerFilter(appointments, req.user.companyId),
              gte(appointments.scheduledDate, start),
              lte(appointments.scheduledDate, end),
              or(
                eq(appointments.status, "scheduled"),
                eq(appointments.status, "rescheduled")
              )
            )
          );

        if (candidatesFull.length === 0) return res.json([]);

        const candidateIds = candidatesFull.map((c) => c.id);

        // 4. Buscar bloqueios (appointments em rotas bloqueadas)
        //    Regra atualizada: "o unico que pode aparecer são agendamentos em romaneios como rascunho" (além de sem rota).
        //    Ou seja, devemos excluir apenas se estiver em 'confirmado' ou 'finalizado'.
        //    'draft' e 'cancelado' não bloqueiam o agendamento de ser listado.

        const activeStops = await db
          .select({
            numericId: stopsTbl.appointmentNumericId,
          })
          .from(stopsTbl)
          .innerJoin(routesTbl, eq(stopsTbl.routeId, routesTbl.id))
          .where(
            and(
              inArray(stopsTbl.appointmentNumericId, candidateIds),
              inArray(routesTbl.status, ["confirmado", "finalizado"])
            )
          );

        const occupiedSet = new Set(activeStops.map((s) => s.numericId));

        // 🔍 DEBUG LOGS - ENHANCED
        console.log("==================== [available-appointments] DEBUG ====================");
        console.log("[available-appointments] Route ID:", routeId);
        console.log("[available-appointments] Route Date:", route.date);
        console.log("[available-appointments] Date Range:", start.toISOString(), "to", end.toISOString());
        console.log("[available-appointments] candidateIds:", candidateIds);
        console.log("[available-appointments] Is ID 24 in candidates?", candidateIds.includes(24));
        console.log("[available-appointments] activeStops (blocked by ID):", activeStops);
        console.log("[available-appointments] occupiedSet:", Array.from(occupiedSet));
        console.log("[available-appointments] Is ID 24 in occupiedSet?", occupiedSet.has(24));

        // 5. Filtrar APENAS por appointment ID
        // NÃO bloquear por cliente - usuário pode ter múltiplos agendamentos para o mesmo cliente
        const available = candidatesFull.filter(
          (c) => !occupiedSet.has(c.id)
        );

        console.log("[available-appointments] available (final):", available.map(a => ({ id: a.id, clientName: a.clientName })));
        console.log("[available-appointments] Is ID 24 in final list?", available.some(a => a.id === 24));
        console.log("========================================================================");

        res.json(available);
      } catch (error: any) {
        console.error("❌ Erro ao buscar agendamentos disponíveis:", error);
        res
          .status(500)
          .json({ message: "Erro ao buscar agendamentos disponíveis" });
      }
    }
  );

  app.post(
    "/api/routes/:routeId/stops",
    authenticateToken,
    async (req: any, res: Response) => {
      try {
        const { companyId } = req.user;
        if (!companyId) return res.status(403).json({ error: "Empresa não selecionada ou inválida." });

        const { routeId } = req.params;
        const { appointmentIds } = req.body as { appointmentIds: (string | number)[] };

        if (!Array.isArray(appointmentIds) || appointmentIds.length === 0) {
          return res.status(400).json({ message: "appointmentIds (array) é obrigatório" });
        }

        // rota existe e pertence à empresa?
        const [route] = await db
          .select({ id: routesTbl.id })
          .from(routesTbl)
          .where(and(
            eq(routesTbl.id, routeId),
            ownerFilter(routesTbl, req.user.companyId)
          ))
          .limit(1);
        if (!route) return res.status(404).json({ message: "Rota não encontrada" });

        // normaliza ids -> número e remove inválidos/duplicados
        const idsNum = Array.from(
          new Set(
            appointmentIds
              .map((v) => Number(v))
              .filter((n) => Number.isFinite(n))
          )
        );
        if (idsNum.length === 0) {
          return res.status(400).json({ message: "IDs de agendamento inválidos" });
        }

        // evita re-inserir agendamentos já existentes como paradas
        const already = await db
          .select({ appointmentId: stopsTbl.appointmentId })
          .from(stopsTbl)
          .where(eq(stopsTbl.routeId, routeId));
        const alreadyNums = new Set(
          already
            .map((s) => uuidToNumber(String(s.appointmentId)))
            .filter((n): n is number => typeof n === "number")
        );
        const toInsertNums = idsNum.filter((n) => !alreadyNums.has(n));
        if (toInsertNums.length === 0) {
          return res.json({ ok: true, inserted: 0, skipped: idsNum.length });
        }

        // 🚫 Validação: Máximo de paradas por rota
        const [brRule] = await db
          .select()
          .from(businessRules)
          .where(ownerFilter(businessRules, req.user.companyId))
          .limit(1);
        if (brRule) {
          const maxStops = (brRule as any).maximoParadasPorRota;
          const currentStops = already.length;
          const totalAfterAdd = currentStops + toInsertNums.length;
          if (maxStops && Number(maxStops) > 0 && totalAfterAdd > Number(maxStops)) {
            const remaining = Math.max(0, Number(maxStops) - currentStops);
            console.log(`❌ [MAX STOPS] Tentativa de adicionar ${toInsertNums.length} paradas. Atual: ${currentStops}, Máx: ${maxStops}`);
            return res.status(400).json({
              message: `Limite de paradas excedido. A rota já possui ${currentStops} parada(s) e o máximo é ${maxStops}. Você pode adicionar no máximo ${remaining} parada(s).`,
              maxStops: Number(maxStops),
              currentStops,
              requested: toInsertNums.length,
              remaining,
            });
          }
        }

        // 🔒 VALIDAÇÃO: Bloquear agendamentos que já estão em rotas confirmadas/finalizadas
        // NÃO bloquear por cliente - usuário pode ter múltiplos agendamentos para o mesmo cliente
        const blockedCheck = await db
          .select({
            numericId: stopsTbl.appointmentNumericId,
          })
          .from(stopsTbl)
          .innerJoin(routesTbl, eq(stopsTbl.routeId, routesTbl.id))
          .where(
            and(
              inArray(stopsTbl.appointmentNumericId, toInsertNums),
              inArray(routesTbl.status, ["confirmado", "finalizado"])
            )
          );

        const blockedApptIds = new Set(blockedCheck.map(s => s.numericId));

        const blocked = toInsertNums.filter(id => blockedApptIds.has(id));

        if (blocked.length > 0) {
          return res.status(400).json({
            message: `Não é possível adicionar: ${blocked.length} agendamento(s) já está(ão) em rota confirmada ou finalizada.`,
            blockedIds: blocked,
          });
        }

        // busca dados dos agendamentos + cliente
        const rows = await db
          .select({
            id: appointments.id,
            clientId: appointments.clientId,

            // endereço do agendamento
            aptCep: appointments.cep,
            aptLogradouro: appointments.logradouro,
            aptNumero: appointments.numero,
            aptComplemento: appointments.complemento,
            aptBairro: appointments.bairro,
            aptCidade: appointments.cidade,

            // cliente
            clientName: clients.name,
            clientLat: clients.lat,
            clientLng: clients.lng,
            clientCep: clients.cep,
            clientLogradouro: clients.logradouro,
            clientNumero: clients.numero,
            clientComplemento: clients.complemento,
            clientBairro: clients.bairro,
            clientCidade: clients.cidade,
          })
          .from(appointments)
          .leftJoin(clients, eq(appointments.clientId, clients.id))
          .where(and(
            ownerFilter(appointments, req.user.companyId),
            inArray(appointments.id, toInsertNums),
          ));

        if (rows.length === 0) {
          return res.status(404).json({ message: "Agendamentos não encontrados" });
        }

        // próxima ordem
        const [mx] = await db
          .select({ maxOrder: sql<number>`COALESCE(MAX(${stopsTbl.order}), 0)` })
          .from(stopsTbl)
          .where(eq(stopsTbl.routeId, routeId));
        let nextOrder = (mx?.maxOrder ?? 0) + 1;

        // helper de endereço amigável
        const buildAddress = (r: any) => {
          const log = r.aptLogradouro || r.clientLogradouro;
          const num = r.aptNumero || r.clientNumero;
          const bai = r.aptBairro || r.clientBairro;
          const cid = r.aptCidade || r.clientCidade;
          const cepNormalizado = formatCep(r.aptCep || r.clientCep);
          return [log, num, bai, cid, cepNormalizado, "Brasil"].filter(Boolean).join(", ");
        };

        // monta inserts (geocodifica se faltou lat/lng do cliente)
        const inserts: Array<typeof stopsTbl.$inferInsert> = [];
        for (const r of rows) {
          let lat = Number(r.clientLat);
          let lng = Number(r.clientLng);
          const address = buildAddress(r);

          if (!(Number.isFinite(lat) && Number.isFinite(lng)) || (Number(lat) === 0 && Number(lng) === 0)) {
            // tenta geocodificar
            try {
              const g = await geocodeEnderecoServer(address);
              lat = Number(g.lat);
              lng = Number(g.lon);

              // opcional: persiste no cliente se existir
              if (r.clientId) {
                await db.update(clients)
                  .set({
                    lat: Number(lat.toFixed(6)),
                    lng: Number(lng.toFixed(6)),
                  })
                  .where(eq(clients.id, r.clientId));
              }
            } catch (e: any) {
              return res.status(400).json({
                message: `Não foi possível obter coordenadas para o agendamento ${r.id}`,
                details: e?.message || String(e),
              });
            }
          }

          console.log(`📝 [ADD STOPS] Preparando insert para agendamento ID ${r.id}`);

          inserts.push({
            routeId,
            appointmentId: numberToUUID(r.id),
            appointmentNumericId: r.id, // 🔧 CRITICAL: Necessário para validação de romaneios
            order: nextOrder++,
            lat: Number(lat.toFixed(6)),
            lng: Number(lng.toFixed(6)),
            address,
          });
        }

        if (inserts.length > 0) {
          console.log(`📝 [ADD STOPS] Inserindo ${inserts.length} paradas:`, inserts.map(i => ({ appointmentNumericId: i.appointmentNumericId, appointmentId: i.appointmentId })));
          await db.insert(stopsTbl).values(inserts);

          // Verificar o que foi realmente salvo
          const savedStops = await db
            .select({ appointmentNumericId: stopsTbl.appointmentNumericId, appointmentId: stopsTbl.appointmentId })
            .from(stopsTbl)
            .where(eq(stopsTbl.routeId, routeId));
          console.log(`✅ [ADD STOPS] Paradas salvas no banco:`, savedStops);

          // atualiza contador
          const [{ cnt }] = await db
            .select({ cnt: sql<number>`COUNT(*)` })
            .from(stopsTbl)
            .where(eq(stopsTbl.routeId, routeId));
          await db
            .update(routesTbl)
            .set({
              stopsCount: Number(cnt),
              updatedAt: sql`CURRENT_TIMESTAMP`
            })
            .where(eq(routesTbl.id, routeId));

          // Registra auditoria com detalhes dos endereços
          for (const insert of inserts) {
            await createRouteAudit(
              routeId,
              req.user.userId,
              "add_stop",
              `Incluiu o endereço: ${insert.address}`,
              { address: insert.address, order: insert.order }
            );
          }
        }

        return res.json({ ok: true, inserted: inserts.length, skipped: idsNum.length - inserts.length });
      } catch (e: any) {
        console.error("[POST /routes/:routeId/stops] Erro:", e);
        return res.status(500).json({ message: e?.message || "Erro ao adicionar paradas" });
      }
    },
  );

  // DELETE /api/routes/:routeId/stops/:stopId - Remover parada da rota
  app.delete(
    "/api/routes/:routeId/stops/:stopId",
    authenticateToken,
    async (req: any, res: Response) => {
      try {
        const { routeId, stopId } = req.params;

        console.log(`🗑️ Tentando remover parada ${stopId} da rota ${routeId}`);

        // 1) Garante que a parada existe e pertence à rota
        const [stopRow] = await db
          .select({
            id: stopsTbl.id,
            routeId: stopsTbl.routeId,
            order: stopsTbl.order,
            address: stopsTbl.address,
          })
          .from(stopsTbl)
          .where(eq(stopsTbl.id, stopId))
          .limit(1);

        if (!stopRow) {
          console.log("❌ Parada não encontrada:", stopId);
          return res.status(404).json({ message: "Parada não encontrada" });
        }

        if (String(stopRow.routeId) !== String(routeId)) {
          console.log("❌ Parada não pertence à rota:", stopRow.routeId, "vs", routeId);
          return res.status(400).json({ message: "Parada não pertence à rota informada" });
        }

        // 2) Remove a parada
        await db.delete(stopsTbl).where(eq(stopsTbl.id, stopId));
        console.log("✅ Parada removida:", stopId);

        // 3) Reordena as demais paradas (1..n)
        const remainingStops = await db
          .select({ id: stopsTbl.id, order: stopsTbl.order })
          .from(stopsTbl)
          .where(eq(stopsTbl.routeId, routeId))
          .orderBy(asc(stopsTbl.order));

        for (let i = 0; i < remainingStops.length; i++) {
          const newOrder = i + 1;
          if (remainingStops[i].order !== newOrder) {
            await db
              .update(stopsTbl)
              .set({ order: newOrder })
              .where(eq(stopsTbl.id, remainingStops[i].id));
          }
        }

        // 4) Atualiza contador da rota
        await db
          .update(routesTbl)
          .set({
            stopsCount: remainingStops.length,
            updatedAt: sql`CURRENT_TIMESTAMP`
          })
          .where(eq(routesTbl.id, routeId));

        console.log(`✅ Rota ${routeId} atualizada com ${remainingStops.length} paradas`);

        // Registra auditoria com endereço removido
        await createRouteAudit(
          routeId,
          req.user.userId,
          "remove_stop",
          `Removeu o endereço: ${stopRow.address}`,
          { stopId, address: stopRow.address }
        );

        // 5) Sempre responde JSON
        return res.json({ ok: true, stopsCount: remainingStops.length });
      } catch (e: any) {
        console.error("[DELETE /stops] Erro:", e);
        return res.status(500).json({ message: e?.message || "Erro ao remover parada" });
      }
    },
  );

  // PATCH /api/routes/:routeId/stops/reorder - Reordenar paradas
  app.patch(
    "/api/routes/:routeId/stops/reorder",
    authenticateToken,
    async (req: any, res: Response) => {
      try {
        const { routeId } = req.params;
        const { stopIds } = req.body;

        if (!Array.isArray(stopIds) || stopIds.length === 0) {
          return res.status(400).json({ message: 'stopIds (array) é obrigatório' });
        }

        console.log(`🔄 [REORDER] Paradas reordenadas da rota ${routeId}:`, stopIds);

        // Verificar se todos os stopIds pertencem à rota e capturar ordem anterior
        const existingStops = await db
          .select({
            id: stopsTbl.id,
            order: stopsTbl.order,
            address: stopsTbl.address
          })
          .from(stopsTbl)
          .where(eq(stopsTbl.routeId, routeId));

        const existingIds = new Set(existingStops.map(s => s.id));
        const oldOrderMap = new Map(existingStops.map(s => [s.id, { order: s.order, address: s.address }]));

        for (const stopId of stopIds) {
          if (!existingIds.has(stopId)) {
            return res.status(400).json({ message: `Stop ${stopId} não pertence a esta rota` });
          }
        }

        // Identificar mudanças de ordem para auditoria
        const orderChanges: Array<{ address: string; oldOrder: number; newOrder: number }> = [];

        // Atualizar a ordem das paradas (1..n)
        for (let i = 0; i < stopIds.length; i++) {
          const newOrder = i + 1;
          const stopInfo = oldOrderMap.get(stopIds[i]);

          if (stopInfo && stopInfo.order !== newOrder) {
            orderChanges.push({
              address: stopInfo.address,
              oldOrder: stopInfo.order,
              newOrder: newOrder
            });
          }

          await db
            .update(stopsTbl)
            .set({ order: newOrder })
            .where(eq(stopsTbl.id, stopIds[i]));
        }

        console.log(`✅ Paradas reordenadas, reconstruindo polyline & métricas...`);

        // Busca informações da rota para obter o ponto inicial
        const [route] = await db
          .select({
            id: routesTbl.id,
            responsibleType: routesTbl.responsibleType,
            responsibleId: routesTbl.responsibleId,
          })
          .from(routesTbl)
          .where(eq(routesTbl.id, routeId))
          .limit(1);

        if (!route) {
          return res.status(404).json({ message: 'Rota não encontrada' });
        }

        // Resolve o ponto inicial (empresa/equipe/técnico)
        const startInfo = await resolveStartForRoute(
          req.user.userId,
          route.responsibleType as "technician" | "team",
          route.responsibleId,
          req.user.companyId
        );
        const startLngLat: [number, number] = [
          Number(Number(startInfo.lng).toFixed(6)),
          Number(Number(startInfo.lat).toFixed(6)),
        ];

        console.log(`📍 [REORDER] Ponto inicial resolvido:`, {
          address: startInfo.address,
          startLngLat,
          responsibleType: route.responsibleType,
          responsibleId: route.responsibleId,
        });

        // Recarrega paradas na nova ordem
        const orderedStops = await db
          .select({ lat: stopsTbl.lat, lng: stopsTbl.lng })
          .from(stopsTbl)
          .where(eq(stopsTbl.routeId, routeId))
          .orderBy(asc(stopsTbl.order));

        // Se não houver paradas, apenas atualiza contador e sai
        if (orderedStops.length === 0) {
          await db
            .update(routesTbl)
            .set({
              stopsCount: 0,
              updatedAt: sql`CURRENT_TIMESTAMP`
            })
            .where(eq(routesTbl.id, routeId));
          return res.json({ ok: true, routeId, stopIds, rebuilt: false });
        }

        // ==== Recalcula polyline + totais ====
        const OSRM_URL = getOsrmUrl();
        if (!OSRM_URL) {
          // ainda assim finalize sem polyline
          await db
            .update(routesTbl)
            .set({
              stopsCount: orderedStops.length,
              updatedAt: sql`CURRENT_TIMESTAMP`
            })
            .where(eq(routesTbl.id, routeId));
          return res.json({ ok: true, routeId, stopIds, rebuilt: false, warn: "OSRM não configurado" });
        }

        // ✅ CORREÇÃO: Inclui o ponto inicial ANTES das paradas
        const allCoords: [number, number][] = [
          startLngLat,  // ← Ponto inicial (empresa/equipe/técnico)
          ...orderedStops.map(s => [Number(s.lng), Number(s.lat)] as [number, number])
        ];
        const coordStr = allCoords.map(c => {
          const lng = Number(c[0]);
          const lat = Number(c[1]);
          if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
            throw new Error(`Coordenadas inválidas no REORDER: lng=${c[0]}, lat=${c[1]}`);
          }
          return `${lng.toFixed(6)},${lat.toFixed(6)}`;
        }).join(";");

        console.log(`🗺️ [REORDER] Recalculando rota com ${allCoords.length} pontos (1 início + ${orderedStops.length} paradas)`);
        console.log(`📄 [REORDER] Coordenadas para OSRM:`, allCoords);

        // route → geojson
        let polylineGeoJson: any = null;
        try {
          const routeResp = await fetch(`${OSRM_URL}/route/v1/driving/${coordStr}?overview=full&geometries=geojson`);
          if (routeResp.ok) {
            const rjson: any = await routeResp.json();
            polylineGeoJson = rjson?.routes?.[0]?.geometry || null;
          }
        } catch { }

        // table → durations/distances entre pares consecutivos (incluindo do início até primeira parada)
        let totalDistance = 0;
        let totalDuration = 0;
        try {
          const tableResp = await fetch(`${OSRM_URL}/table/v1/driving/${coordStr}?annotations=duration,distance`);
          if (tableResp.ok) {
            const tjson: any = await tableResp.json();
            const durations: number[][] = tjson?.durations || [];
            const distances: number[][] = tjson?.distances || [];
            // Soma trajeto do início (índice 0) até todas as paradas
            for (let i = 0; i < allCoords.length - 1; i++) {
              totalDuration += Number(durations?.[i]?.[i + 1] ?? 0);
              totalDistance += Number(distances?.[i]?.[i + 1] ?? 0);
            }
          }
        } catch { }

        await db
          .update(routesTbl)
          .set({
            stopsCount: orderedStops.length,
            distanceTotal: Math.round(totalDistance),
            durationTotal: Math.round(totalDuration),
            polylineGeoJson: polylineGeoJson ? JSON.stringify(polylineGeoJson) : routesTbl.polylineGeoJson,
            updatedAt: sql`CURRENT_TIMESTAMP`,
          })
          .where(eq(routesTbl.id, routeId));

        console.log(`✅ [REORDER] Polyline & métricas atualizadas`);

        // Registra auditoria com detalhes das mudanças
        if (orderChanges.length > 0) {
          for (const change of orderChanges) {
            await createRouteAudit(
              routeId,
              req.user.userId,
              "reorder",
              `Alterou ordem: ${change.address} (posição ${change.oldOrder} → ${change.newOrder})`,
              {
                address: change.address,
                oldOrder: change.oldOrder,
                newOrder: change.newOrder
              }
            );
          }
        }

        // IMPORTANTE: Retornar o ponto inicial na resposta
        return res.json({
          ok: true,
          routeId,
          stopIds,
          rebuilt: true,
          start: {
            lat: startInfo.lat,
            lng: startInfo.lng,
            address: startInfo.address,
          },
        });
      } catch (e: any) {
        console.error('[reorder stops] error:', e);
        return res.status(500).json({ message: 'Falha ao reordenar paradas' });
      }
    },
  );

  // PATCH /api/routes/:id/status - Atualizar status da rota
  app.patch(
    "/api/routes/:id/status",
    authenticateToken,
    async (req: any, res: Response) => {
      try {
        const routeId = req.params.id;
        const parsed = updateStatusSchema.safeParse(req.body);
        if (!parsed.success)
          return res.status(400).json({ error: "Status inválido" });
        const { status } = parsed.data;

        // Busca o status anterior para registrar na auditoria — verifica ownership por companyId
        const [currentRoute] = await db
          .select()
          .from(routesTbl)
          .where(and(
            eq(routesTbl.id, routeId),
            ownerFilter(routesTbl, req.user.companyId)
          ));

        if (!currentRoute)
          return res.status(404).json({ error: "Rota não encontrada" });

        const previousStatus = currentRoute.status;

        // Validação: Se estiver confirmando ou finalizando, verificar se algum agendamento já está em outro romaneio confirmado/finalizado
        if (status === 'confirmado' || status === 'finalizado') {
          console.log(`🔍 [VALIDAÇÃO] Validando status ${status} para rota ${routeId}`);

          // Buscar agendamentos desta rota
          const stopsThisRoute = await db
            .select({ appointmentNumericId: stopsTbl.appointmentNumericId })
            .from(stopsTbl)
            .where(eq(stopsTbl.routeId, routeId));

          console.log(`🔍 [VALIDAÇÃO] Paradas desta rota:`, stopsThisRoute);

          const apptIds = stopsThisRoute
            .map(s => s.appointmentNumericId)
            .filter((id): id is number => id !== null && id !== undefined);

          console.log(`🔍 [VALIDAÇÃO] IDs de agendamentos a verificar:`, apptIds);

          if (apptIds.length > 0) {
            // 🔧 CORREÇÃO: Verificar status atual dos agendamentos ANTES de validar conflitos
            // Agendamentos remarcados (status 'scheduled' ou 'rescheduled') PODEM ser usados em novos romaneios
            // mesmo que tenham histórico em romaneios finalizados
            const appointmentsStatus = await db
              .select({
                id: appointments.id,
                status: appointments.status,
              })
              .from(appointments)
              .where(inArray(appointments.id, apptIds));

            console.log(`🔍 [VALIDAÇÃO] Status dos agendamentos:`, appointmentsStatus);

            // Filtrar apenas agendamentos que NÃO podem ser reutilizados:
            // - 'completed': já foi concluído
            // - 'in_progress': está em andamento
            // - 'cancelled': foi cancelado (não pode ser reutilizado)
            // PERMITE: 'scheduled' e 'rescheduled' (foram remarcados, PODEM ser usados)
            const nonReusableIds = appointmentsStatus
              .filter(a => a.status === 'completed' || a.status === 'in_progress' || a.status === 'cancelled')
              .map(a => a.id);

            const rescheduledIds = appointmentsStatus
              .filter(a => a.status === 'scheduled' || a.status === 'rescheduled')
              .map(a => a.id);

            if (rescheduledIds.length > 0) {
              console.log(`✅ [VALIDAÇÃO] Agendamentos remarcados (permitidos):`, rescheduledIds);
            }

            // Se não há agendamentos não-reutilizáveis, todos foram remarcados → pode prosseguir
            if (nonReusableIds.length === 0) {
              console.log(`✅ [VALIDAÇÃO] Todos os agendamentos foram remarcados, pode prosseguir`);
            } else {
              console.log(`🔍 [VALIDAÇÃO] Verificando conflitos para agendamentos não-reutilizáveis:`, nonReusableIds);

              // Validar apenas os agendamentos que NÃO podem ser reutilizados
              const conflictingRoutes = await db
                .select({
                  routeId: routesTbl.id,
                  routeDisplayNumber: routesTbl.displayNumber,
                  routeStatus: routesTbl.status,
                  appointmentNumericId: stopsTbl.appointmentNumericId,
                })
                .from(stopsTbl)
                .innerJoin(routesTbl, eq(stopsTbl.routeId, routesTbl.id))
                .where(
                  and(
                    inArray(stopsTbl.appointmentNumericId, nonReusableIds),
                    or(
                      eq(routesTbl.status, 'confirmado'),
                      eq(routesTbl.status, 'finalizado')
                    ),
                    ne(routesTbl.id, routeId) // Excluir a rota atual
                  )
                );

              console.log(`🔍 [VALIDAÇÃO] Romaneios conflitantes encontrados (${conflictingRoutes.length}):`, conflictingRoutes);

              if (conflictingRoutes.length > 0) {
                // Agrupar agendamentos únicos e seus romaneios
                const conflictMap = new Map<number, Set<number>>();
                conflictingRoutes.forEach(c => {
                  if (!conflictMap.has(c.appointmentNumericId!)) {
                    conflictMap.set(c.appointmentNumericId!, new Set());
                  }
                  conflictMap.get(c.appointmentNumericId!)!.add(c.routeDisplayNumber);
                });

                // Formatar mensagem concisa
                const conflictingApptIds = Array.from(conflictMap.keys());
                const firstConflict = conflictingRoutes[0];

                const message = conflictingApptIds.length === 1
                  ? `Não foi possível ${status === 'confirmado' ? 'confirmar' : 'finalizar'} o romaneio. Agendamento #${conflictingApptIds[0]} já está no romaneio #${firstConflict.routeDisplayNumber}.`
                  : `Não foi possível ${status === 'confirmado' ? 'confirmar' : 'finalizar'} o romaneio. Agendamentos #${conflictingApptIds.join(', #')} já estão em romaneios confirmados/finalizados.`;

                console.error(`❌ [VALIDAÇÃO] BLOQUEANDO: ${message}`);

                return res.status(400).json({ error: message });
              } else {
                console.log(`✅ [VALIDAÇÃO] Nenhum conflito encontrado, pode prosseguir`);
              }
            }
          } else {
            console.log(`⚠️ [VALIDAÇÃO] Nenhum agendamento encontrado nesta rota`);
          }

          // 🔧 CORREÇÃO: Resetar executionStatus para agendamentos remarcados quando confirmar a rota
          // Quando uma rota é confirmada, agendamentos com status 'scheduled' ou 'rescheduled'
          // devem ter seu executionStatus resetado para null, pois são "novos" agendamentos
          // que ainda precisam ser executados (mesmo que tenham executionStatus antigo de rotas anteriores)
          if (status === 'confirmado' && apptIds.length > 0) {
            // Buscar status atual dos agendamentos
            const appointmentStatusForReset = await db
              .select({
                id: appointments.id,
                status: appointments.status,
                executionStatus: appointments.executionStatus,
              })
              .from(appointments)
              .where(inArray(appointments.id, apptIds));

            // Filtrar agendamentos que são scheduled/rescheduled E têm executionStatus antigo
            const toReset = appointmentStatusForReset
              .filter(a =>
                (a.status === 'scheduled' || a.status === 'rescheduled') &&
                a.executionStatus !== null
              )
              .map(a => a.id);

            if (toReset.length > 0) {
              console.log(`🔄 [RESET] Resetando executionStatus de ${toReset.length} agendamentos remarcados:`, toReset);

              // Resetar executionStatus para null
              await db
                .update(appointments)
                .set({
                  executionStatus: null,
                  executionNotes: null
                })
                .where(inArray(appointments.id, toReset));

              console.log(`✅ [RESET] executionStatus resetado para agendamentos remarcados`);
            }

            // 🔧 CORREÇÃO: Atualizar status dos agendamentos para 'confirmed' quando romaneio for confirmado
            // Isso indica que o agendamento está em um romaneio confirmado e próximo de ser executado
            const scheduledOrRescheduledIds = appointmentStatusForReset
              .filter(a => a.status === 'scheduled' || a.status === 'rescheduled')
              .map(a => a.id);

            if (scheduledOrRescheduledIds.length > 0) {
              console.log(`🔄 [CONFIRM] Atualizando ${scheduledOrRescheduledIds.length} agendamentos para status 'confirmed'`);

              await db
                .update(appointments)
                .set({ status: 'confirmed' })
                .where(inArray(appointments.id, scheduledOrRescheduledIds));

              console.log(`✅ [CONFIRM] Agendamentos atualizados para status 'confirmed'`);
            }
          }
        } else if (status === 'draft' || status === 'cancelado') {
          console.log(`🔄 [REVERT] Rota indo para ${status}. Verificando agendamentos para reverter.`);
          
          const stopsThisRoute = await db
            .select({ appointmentNumericId: stopsTbl.appointmentNumericId })
            .from(stopsTbl)
            .where(eq(stopsTbl.routeId, routeId));

          const apptIds = stopsThisRoute
            .map(s => s.appointmentNumericId)
            .filter((id): id is number => id !== null && id !== undefined);

          if (apptIds.length > 0) {
            const appointmentsForRevert = await db
              .select({ id: appointments.id, status: appointments.status })
              .from(appointments)
              .where(inArray(appointments.id, apptIds));

            // Só revertemos agendamentos que estão de fato confirmados (evita mexer em 'completed' ou 'cancelled' ou se já era 'scheduled')
            const idsToRevert = appointmentsForRevert
              .filter(a => a.status === 'confirmed')
              .map(a => a.id);

            if (idsToRevert.length > 0) {
              console.log(`🔄 [REVERT] Atualizando ${idsToRevert.length} agendamentos de volta para 'scheduled'`);
              await db
                .update(appointments)
                .set({ status: 'scheduled' })
                .where(inArray(appointments.id, idsToRevert));
              console.log(`✅ [REVERT] Agendamentos revertidos com sucesso`);
            }
          }
        }


        const [updated] = await db
          .update(routesTbl)
          .set({ status, updatedAt: sql`CURRENT_TIMESTAMP` })
          .where(and(eq(routesTbl.id, routeId), ownerFilter(routesTbl, req.user.companyId)))
          .returning();

        // Mapeia os status para português
        const statusLabels: Record<string, string> = {
          draft: "Rascunho",
          confirmado: "Confirmado",
          finalizado: "Finalizado",
          cancelado: "Cancelado",
        };

        // Registra auditoria da mudança de status
        await createRouteAudit(
          routeId,
          req.user.userId,
          "status_change",
          `Alterou o status de "${statusLabels[previousStatus] || previousStatus}" para "${statusLabels[status] || status}"`,
          { previousStatus, newStatus: status }
        );

        res.json({ ok: true, route: updated });
      } catch (e: any) {
        console.error("Erro ao atualizar status:", e);
        res
          .status(500)
          .json({ error: "Erro ao atualizar status", details: e.message });
      }
    },
  );

  // GET /api/routes/:id/audits - Buscar histórico de auditoria da rota
  app.get(
    "/api/routes/:id/audits",
    authenticateToken,
    async (req: any, res: Response) => {
      try {
        const routeId = req.params.id;
        const userId = req.user.userId;

        // Verifica se a rota existe e pertence à empresa
        const [route] = await db
          .select()
          .from(routesTbl)
          .where(and(
            eq(routesTbl.id, routeId),
            ownerFilter(routesTbl, req.user.companyId)
          ));

        if (!route) {
          return res.status(404).json({ error: "Rota não encontrada" });
        }

        // Busca histórico de auditoria (últimas 40 alterações)
        const audits = await db
          .select({
            id: routeAudits.id,
            routeId: routeAudits.routeId,
            userId: routeAudits.userId,
            userName: users.name,
            action: routeAudits.action,
            description: routeAudits.description,
            metadata: routeAudits.metadata,
            createdAt: routeAudits.createdAt,
          })
          .from(routeAudits)
          .leftJoin(users, eq(routeAudits.userId, users.id))
          .where(eq(routeAudits.routeId, routeId))
          .orderBy(desc(routeAudits.createdAt))
          .limit(40);

        res.json(audits);
      } catch (e: any) {
        console.error("Erro ao buscar auditoria:", e);
        res
          .status(500)
          .json({ error: "Erro ao buscar auditoria", details: e.message });
      }
    },
  );

  // POST /api/routes/:id/audit-export - Registrar exportação de PDF
  app.post(
    "/api/routes/:id/audit-export",
    authenticateToken,
    async (req: any, res: Response) => {
      try {
        const routeId = req.params.id;
        const userId = req.user.userId;

        // Verifica se a rota existe e pertence à empresa
        const [route] = await db
          .select()
          .from(routesTbl)
          .where(and(
            eq(routesTbl.id, routeId),
            ownerFilter(routesTbl, req.user.companyId)
          ));

        if (!route) {
          return res.status(404).json({ error: "Rota não encontrada" });
        }

        // Registra auditoria de exportação
        await createRouteAudit(
          routeId,
          userId,
          "export_pdf",
          "Exportou a rota em PDF",
          { exportDate: new Date().toISOString() }
        );

        res.json({ ok: true });
      } catch (e: any) {
        console.error("Erro ao registrar exportação:", e);
        res
          .status(500)
          .json({ error: "Erro ao registrar exportação", details: e.message });
      }
    },
  );
}