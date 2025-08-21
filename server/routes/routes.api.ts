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
} from "@shared/schema";
import { eq, and, gte, lte, like, or, desc, inArray, sql, asc } from "drizzle-orm";

// Extend Request type for authenticated user
interface AuthenticatedRequest extends Request {
  user: {
    userId: number;
  };
}

// Helper para ler URL do OSRM
function getOsrmUrl() {
  const filePath = path.join(__dirname, "../osrm_url.txt");
  try {
    return fs.readFileSync(filePath, "utf8").trim();
  } catch (err) {
    console.error("Arquivo osrm_url.txt não encontrado ou não lido!", err);
    return null;
  }
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
});

// Schema para atualização de status
const updateStatusSchema = z.object({
  status: z.enum(["draft", "optimized", "running", "done", "canceled"]),
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

  const coordStr = coordinates.map((c) => c.join(",")).join(";");
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

  const coordStr = coordinates.map((c) => c.join(",")).join(";");
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
async function geocodeEnderecoServer(
  endereco: string,
): Promise<{ lat: number; lon: number }> {
  const makeUrl = (q: string) =>
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&addressdetails=0&extratags=0&q=${encodeURIComponent(q)}`;

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

    // padroniza para 6 casas (coerente com o que salvamos no DB)
    return { lat: Number(lat.toFixed(6)), lon: Number(lon.toFixed(6)) };
  } finally {
    clearTimeout(timer);
  }
}

export function registerRoutesAPI(app: Express) {
  // Middleware simples de autenticação (reutilizando a lógica existente)
  const authenticateToken = (req: any, res: any, next: any) => {
    // Em modo DEV, criar um usuário fake para testes
    if (process.env.DEV_MODE === "true") {
      req.user = { userId: 1 };
      return next();
    }

    // TODO: Implementar autenticação real
    req.user = { userId: 1 };
    next();
  };

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

  // ==== POST /api/routes/:id/optimize ====
  app.post("/api/routes/:id/optimize", async (req, res) => {
    try {
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
        })
        .from(stopsTbl)
        .where(eq(stopsTbl.routeId, routeId))
        .orderBy(asc(stopsTbl.order));

      if (stops.length < 2) {
        return res.status(400).json({ message: "É preciso pelo menos 2 paradas para otimizar." });
      }

      // garante coords válidas
      const coords = stops.map(s => {
        const lat = Number(s.lat), lng = Number(s.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          throw new Error(`Parada ${s.id} sem coordenadas válidas.`);
        }
        return { lat, lng };
      });

      // 2) OSRM /table (matriz)
      const OSRM_URL = getOsrmUrl();
      if (!OSRM_URL) {
        return res.status(500).json({ message: "OSRM não configurado (osrm_url.txt)." });
      }

      const coordStr = coords.map(c => `${c.lng},${c.lat}`).join(";");
      const tableUrl = `${OSRM_URL}/table/v1/driving/${coordStr}?annotations=duration,distance`;
      const tableResp = await fetch(tableUrl);
      if (!tableResp.ok) {
        const t = await tableResp.text();
        return res.status(500).json({ message: `Falha no OSRM table: ${t.slice(0,200)}` });
      }
      const tableData: any = await tableResp.json();
      const matrix: number[][] = tableData.durations;
      const distances: number[][] = tableData.distances;

      if (!Array.isArray(matrix) || matrix.length !== coords.length) {
        return res.status(500).json({ message: "Matriz inválida do OSRM." });
      }

      // 3) Chama o solver TSP em Python (igual ao seu /api/rota/tsp)
      const { spawn } = await import("child_process");
      const py = spawn("python3", ["./server/solve_tsp.py"]);
      const input = JSON.stringify({ matrix, terminarNoPontoInicial });
      let out = "", err = "";
      py.stdout.on("data", (d: Buffer) => (out += d.toString()));
      py.stderr.on("data", (d: Buffer) => (err += d.toString()));
      py.stdin.write(input); py.stdin.end();

      const tspResult = await new Promise<any>((resolve, reject) => {
        py.on("close", (code: number) => {
          if (code !== 0) return reject(new Error(err || "Python returned non-zero code"));
          try { resolve(JSON.parse(out)); }
          catch (e: any) { reject(new Error("Erro parseando saída do Python: " + e.message)); }
        });
      });

      // tspResult.order é um array de índices [0..n-1] na nova ordem
      const newOrderIdx: number[] = tspResult.order;
      if (!Array.isArray(newOrderIdx) || newOrderIdx.length !== stops.length) {
        return res.status(500).json({ message: "Retorno TSP inválido." });
      }

      // 4) Atualiza order das paradas
      // mapeia: índice -> stop.id  | novo order = posição + 1
      const updates = newOrderIdx.map((idx, pos) => ({
        id: stops[idx].id,
        newOrder: pos + 1,
      }));

      // Drizzle: atualiza em série (simples e seguro)
      for (const u of updates) {
        await db.update(stopsTbl)
          .set({ order: u.newOrder })
          .where(eq(stopsTbl.id, u.id));
      }

      // 5) Recalcular métricas (somando a distância/duração na ordem encontrada)
      let totalDistance = 0;
      let totalDuration = 0;
      for (let i = 0; i < newOrderIdx.length - 1; i++) {
        const from = newOrderIdx[i];
        const to   = newOrderIdx[i+1];
        totalDuration += Number(matrix[from][to] ?? 0);
        totalDistance += Number(distances[from][to] ?? 0);
      }

      // 6) Atualizar polyline_geojson com a rota na nova ordem
      // monta coords na ordem
      const orderedCoords = newOrderIdx.map(i => coords[i]);
      const osrmCoords = orderedCoords.map(c => `${c.lng},${c.lat}`).join(";");
      const routeUrl = `${OSRM_URL}/route/v1/driving/${osrmCoords}?overview=full&geometries=geojson`;
      const routeResp = await fetch(routeUrl);
      let polylineGeoJson: any = null;
      if (routeResp.ok) {
        const rjson: any = await routeResp.json();
        polylineGeoJson = rjson?.routes?.[0]?.geometry || null;
      }

      await db.update(routesTbl)
        .set({
          distanceTotal: Math.round(totalDistance),
          durationTotal: Math.round(totalDuration),
          stopsCount: stops.length,
          polylineGeoJson: polylineGeoJson ? JSON.stringify(polylineGeoJson) : routesTbl.polylineGeoJson,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(routesTbl.id, routeId));

      // 7) ok: o front vai refazer o GET /api/routes/:id
      return res.json({ ok: true });
    } catch (e: any) {
      console.error("❌ /api/routes/:id/optimize erro:", e?.message, e?.stack);
      return res.status(500).json({ message: e?.message || "Erro ao otimizar" });
    }
  });

  // ==== POST /api/routes ====
  app.post(
    "/api/routes/optimize",
    authenticateToken,
    async (req: any, res: Response) => {
      console.log("==== LOG INÍCIO: /api/routes/optimize ====");
      console.log("Body recebido:", JSON.stringify(req.body, null, 2));

      try {
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

        const { appointmentIds, endAtStart, vehicleId, title, preview } =
          validation.data;
        const appointmentIdsNorm = appointmentIds.map((id: any) => Number(id));

        // 🔎 Carrega Business Rules do usuário (para fallback de endereço inicial)
        const brs = await db
          .select()
          .from(businessRules)
          .where(eq(businessRules.userId, req.user.userId))
          .limit(1);

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
          .where(eq(appointments.userId, req.user.userId));

        const selectedAppointments = appointmentList.filter((app) =>
          appointmentIdsNorm.includes(app.id),
        );

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
        const responsibles = selectedAppointments
          .map((a: any) => {
            if (a.technicianId && !a.teamId)
              return `technician:${a.technicianId}`;
            if (a.teamId && !a.technicianId) return `team:${a.teamId}`;
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
          const cep = checa(addr.cep);
          const estado = checa(addr.estado);

          const full = [
            logradouro,
            numero,
            complemento,
            bairro,
            cidade,
            cep,
            estado,
            "Brasil",
          ]
            .filter(Boolean)
            .join(", ");

          const semNumero = [logradouro, bairro, cidade, cep, estado, "Brasil"]
            .filter(Boolean)
            .join(", ");

          const soCepCidade = [cep, cidade, estado, "Brasil"]
            .filter(Boolean)
            .join(", ");

          return [full, semNumero, soCepCidade].filter(
            (s) => s && s.length >= 8,
          ) as string[];
        };

        try {
          console.log("🏁 Determinando ponto inicial com fallbacks…");

          let entidade: EntityAddr | null = null;

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
                  eq(technicians.userId, req.user.userId),
                ),
              )
              .limit(1);

            if (tech) entidade = tech as EntityAddr;
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
                  eq(teams.userId, req.user.userId),
                ),
              )
              .limit(1);

            if (team) entidade = team as EntityAddr;
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

          // 2.3 Geocodifica na ordem
          let sucesso: { lat: number; lon: number } | null = null;
          for (let i = 0; i < tentativas.length; i++) {
            const end = tentativas[i];
            try {
              const r = await geocodeEnderecoServer(end);
              sucesso = r;
              startAddress = end;
              console.log(`✅ Início geocodificado:`, r, "para:", end);
              break;
            } catch (e: any) {
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
            startCoordinates = [
              Number(sucesso.lon.toFixed(6)),
              Number(sucesso.lat.toFixed(6)),
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
            .replace(/\p{Diacritic}/gu, "")
            .replace(/\s+/g, "")
            .toLowerCase();

        // Monta estrutura local dos agendamentos
        const appointmentData = selectedAppointments.map((app) => {
          const aptAddress = [
            app.aptLogradouro,
            app.aptNumero,
            app.aptBairro,
            app.aptCidade,
            app.aptCep,
            "Brasil",
          ]
            .filter(Boolean)
            .join(", ");

          const clientAddress = [
            app.clientLogradouro,
            app.clientNumero,
            app.clientBairro,
            app.clientCidade,
            app.clientCep,
            "Brasil",
          ]
            .filter(Boolean)
            .join(", ");

          // lat/lng já salvos no cliente (se houver)
          const lat = app.clientLat != null ? Number(app.clientLat) : undefined;
          const lng = app.clientLng != null ? Number(app.clientLng) : undefined;

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
            continue; // já tem lat/lng do cliente
          }

          // 1) tentar geocodificar o ENDEREÇO DO AGENDAMENTO (prioritário para roteirização)
          try {
            const geo = await geocodeEnderecoServer(app.address);
            app.lat = Number(geo.lat);
            app.lng = Number(geo.lon);

            // Se o endereço do agendamento “bate” com o endereço do cliente, persistimos no cliente (cura legado)
            if (
              app.clientId &&
              app.clientAddress &&
              norm(app.clientAddress) === norm(app.address)
            ) {
              try {
                const updatePayload1: Partial<typeof clients.$inferInsert> = {};
                if (Number.isFinite(app.lat)) updatePayload1.lat = to6(app.lat as number);
                if (Number.isFinite(app.lng)) updatePayload1.lng = to6(app.lng as number);

                if (Object.keys(updatePayload1).length > 0) {
                  await db
                    .update(clients)
                    .set(updatePayload1)
                    .where(eq(clients.id, app.clientId));
                  console.log(`💾 Coordenadas salvas no cliente ${app.clientId}`);
                } else {
                  console.log(`ℹ️ Sem payload para atualizar cliente ${app.clientId} (lat/lng ausentes)`);
                }
              } catch (e: any) {
                console.warn(
                  `⚠️ Falha ao persistir lat/lng do cliente ${app.clientId}:`,
                  e.message,
                );
              }
            }

            // Respeitar Nominatim (1 req/s)
            await sleep(1100);
            continue;
          } catch (e1: any) {
            console.warn(
              `❌ Geocodificação (agendamento) falhou para ${app.id}:`,
              e1.message,
            );
          }

          // 2) fallback: tentar geocodificar o ENDEREÇO DO CLIENTE (se existir)
          if (app.clientAddress) {
            try {
              const geo2 = await geocodeEnderecoServer(app.clientAddress);
              app.lat = Number(geo2.lat);
              app.lng = Number(geo2.lon);

              // Como é o endereço do cliente, podemos persistir
              if (app.clientId) {
                try {
                  const updatePayload2: Partial<typeof clients.$inferInsert> = {};
                  if (Number.isFinite(app.lat)) updatePayload2.lat = to6(app.lat as number);
                  if (Number.isFinite(app.lng)) updatePayload2.lng = to6(app.lng as number);

                  if (Object.keys(updatePayload2).length > 0) {
                    await db
                      .update(clients)
                      .set(updatePayload2)
                      .where(eq(clients.id, app.clientId));
                    console.log(
                      `💾 Coordenadas salvas no cliente ${app.clientId} (via endereço do cliente)`,
                    );
                  } else {
                    console.log(`ℹ️ Sem payload para atualizar cliente ${app.clientId} (lat/lng ausentes)`);
                  }
                } catch (e: any) {
                  console.warn(
                    `⚠️ Falha ao persistir lat/lng do cliente ${app.clientId}:`,
                    e.message,
                  );
                }
              }

              await sleep(1100);
              continue;
            } catch (e2: any) {
              console.warn(
                `❌ Geocodificação (cliente) falhou para ${app.id}:`,
                e2.message,
              );
            }
          }

          // 3) se nada funcionou, aborta com erro claro
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

        // Alimenta a coordinates em formato OSRM
        for (const app of appointmentData) {
          coordinates.push(
            normalizeToOsrm(app.lat as number, app.lng as number),
          ); // [lng,lat]
        }

        console.log("📍 Coordenadas preparadas (OSRM [lng,lat]):", coordinates);

        // 4. Obter matriz de distâncias/tempos do OSRM
        console.log("🧮 Calculando matriz OSRM...");
        const { durations, distances } = await getOSRMMatrix(coordinates);

        // 5. Resolver TSP
        console.log("🔄 Resolvendo TSP...");
        const tourOrder = solveTSP(distances, endAtStart);

        // 6. Calcular totais
        let totalDistance = 0;
        let totalDuration = 0;

        for (let i = 0; i < tourOrder.length - 1; i++) {
          const from = tourOrder[i];
          const to = tourOrder[i + 1];
          totalDistance += distances[from][to];
          totalDuration += durations[from][to];
        }

        console.log(
          "📊 Totais calculados - Distância:",
          totalDistance,
          "m, Duração:",
          totalDuration,
          "s",
        );

        // 7. Gerar polyline GeoJSON
        const routeCoordinates = tourOrder.map((idx) => coordinates[idx]);
        let polylineGeoJson = null;

        try {
          polylineGeoJson = await getOSRMRoute(routeCoordinates);
          console.log("🗺️ Polyline gerada com sucesso");
        } catch (error) {
          console.log("⚠️ Erro ao gerar polyline:", error);
        }

        // 8. Preparar dados da rota
        const routeTitle =
          title || `Rota ${new Date().toLocaleDateString("pt-BR")}`;
        const routeDate = selectedAppointments[0]?.scheduledDate || new Date();

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
          status: "draft" as const,
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
            serviceName: app?.serviceName ?? "",
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
            .from(routesTbl);
          nextDisplayNumber = (maxRes?.maxNum ?? 0) + 1;
        }

        // 11. Salvar no banco (se preview === false)
        console.log("💾 Salvando rota no banco...");
        const [savedRoute] = await db
          .insert(routesTbl)
          .values({
            ...routeData,
            displayNumber: nextDisplayNumber,
          })
          .returning();

        // Salvar paradas
        if (stopData.length > 0) {
          const stopDataWithRouteId = stopData.map((stop) => ({
            ...stop,
            routeId: savedRoute.id,
          }));
          await db.insert(stopsTbl).values(stopDataWithRouteId);
          console.log("✅ Paradas salvas:", stopDataWithRouteId.length);
        }

        const responseData = {
          route: {
            id: savedRoute.id,
            title: savedRoute.title,
            date: savedRoute.date,
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
        console.log("Mensagem:", error.message);
        console.log("Stack:", error.stack);
        console.log("==== LOG FIM: /api/routes/optimize (EXCEÇÃO) ====");
        res
          .status(500)
          .json({ error: "Erro interno do servidor", details: error.message });
      }
    },
  );

  // GET /api/routes - Listar rotas com filtros
  app.get("/api/routes", authenticateToken, async (req: any, res: Response) => {
    console.log("==== LOG INÍCIO: /api/routes ====");
    console.log("Query params:", JSON.stringify(req.query, null, 2));

    try {
      const {
        from,
        to,
        status,
        responsibleType,
        responsibleId,
        vehicleId,
        search,
      } = req.query;

      const conditions = [];

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
        conditions.push(eq(routesTbl.vehicleId, vehicleId as string));
      }

      if (search) {
        conditions.push(like(routesTbl.title, `%${search}%`));
      }

      const baseQuery = db
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
        })
        .from(routesTbl);

      const routeList =
        conditions.length > 0
          ? await baseQuery
              .where(and(...conditions))
              .orderBy(desc(routesTbl.createdAt))
          : await baseQuery.orderBy(desc(routesTbl.createdAt));

      console.log("✅ Rotas encontradas:", routeList.length);
      console.log("==== LOG FIM: /api/routes (SUCESSO) ====");

      res.json(routeList);
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
        const routeId = req.params.id;

        // Buscar rota
        const [route] = await db
          .select()
          .from(routesTbl)
          .where(eq(routesTbl.id, routeId));

        if (!route) {
          console.log("❌ ERRO: Rota não encontrada");
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

        // 2) Converter appointmentId (UUID fake) -> número
        const appointmentNumericIds = stopsRaw
          .map((s) => uuidToNumber(s.appointmentId as unknown as string))
          .filter(
            (n): n is number => typeof n === "number" && Number.isFinite(n),
          );

        let appointmentsWithClients: Array<{
          id: number;
          clientId: number | null;
          clientName: string | null;
          scheduledDate: Date | null;
        }> = [];

        // 3) Buscar appointments + clients apenas dos IDs necessários (com inArray)
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
            .where(
              and(
                eq(appointments.userId, (req as any).user.userId),
                inArray(appointments.id, appointmentNumericIds),
              ),
            );
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

        // 5) Enriquecer as paradas com clientName e scheduledDate
        const stops = stopsRaw.map((s) => {
          const numericId = uuidToNumber(s.appointmentId as unknown as string);
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

        res.json({
          route,
          stops,
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

        const [updated] = await db
          .update(routesTbl)
          .set({ status })
          .where(eq(routesTbl.id, routeId))
          .returning();

        if (!updated)
          return res.status(404).json({ error: "Rota não encontrada" });
        res.json({ ok: true, route: updated });
      } catch (e: any) {
        console.error("Erro ao atualizar status:", e);
        res
          .status(500)
          .json({ error: "Erro ao atualizar status", details: e.message });
      }
    },
  );
}