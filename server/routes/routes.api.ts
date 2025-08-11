import { Express, Request, Response } from "express";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { db } from "../db";
import { routes, routeStops, appointments, clients, technicians, teams, businessRules } from "@shared/schema";
import { eq, and, gte, lte, like, or, desc } from "drizzle-orm";

// Extend Request type for authenticated user
interface AuthenticatedRequest extends Request {
  user: {
    userId: number;
  };
}

// Helper para ler URL do OSRM
function getOsrmUrl() {
  const filePath = path.join(__dirname, '../osrm_url.txt');
  try {
    return fs.readFileSync(filePath, 'utf8').trim();
  } catch (err) {
    console.error('Arquivo osrm_url.txt não encontrado ou não lido!', err);
    return null;
  }
}

// Helper para converter ID numérico para UUID válido
function numberToUUID(num: number): string {
  const padded = num.toString().padStart(32, '0');
  return [
    padded.slice(0, 8),
    padded.slice(8, 12),
    padded.slice(12, 16),
    padded.slice(16, 20),
    padded.slice(20, 32)
  ].join('-');
}

// Schema de validação para otimização
const optimizeRouteSchema = z.object({
  appointmentIds: z.array(z.string()),
  endAtStart: z.boolean(),
  responsibleType: z.enum(['technician', 'team']),
  responsibleId: z.string(),
  vehicleId: z.string().optional(),
  title: z.string().optional()
});

// Algoritmo TSP simples: Nearest Neighbor + 2-opt
function solveTSP(distanceMatrix: number[][], endAtStart: boolean = false): number[] {
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
        const before = distanceMatrix[tour[i-1]][tour[i]] + distanceMatrix[tour[j]][tour[j+1]];
        const after = distanceMatrix[tour[i-1]][tour[j]] + distanceMatrix[tour[i]][tour[j+1]];
        
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
async function getOSRMMatrix(coordinates: [number, number][]): Promise<{ durations: number[][], distances: number[][] }> {
  const OSRM_URL = getOsrmUrl()?.replace(/\/$/, '') || null;
  if (!OSRM_URL) {
    throw new Error("OSRM URL não configurado");
  }
  
  const coordStr = coordinates.map(c => c.join(',')).join(';');
  const osrmUrl = `${OSRM_URL}/table/v1/driving/${coordStr}?annotations=duration,distance`;
  
  console.log("🌐 Chamando OSRM matrix:", osrmUrl);
  
  const response = await fetch(osrmUrl);
  const data = await response.json();
  
  if (!data.durations || !data.distances) {
    throw new Error("OSRM não retornou matriz válida");
  }
  
  return {
    durations: data.durations,
    distances: data.distances
  };
}

// Função para buscar polyline OSRM
async function getOSRMRoute(coordinates: [number, number][]): Promise<any> {
  const OSRM_URL = getOsrmUrl()?.replace(/\/$/, '') || null;
  if (!OSRM_URL) {
    throw new Error("OSRM URL não configurado");
  }
  
  const coordStr = coordinates.map(c => c.join(',')).join(';');
  const osrmUrl = `${OSRM_URL}/route/v1/driving/${coordStr}?overview=full&geometries=geojson`;
  
  console.log("🗺️ Chamando OSRM route:", osrmUrl);
  
  const response = await fetch(osrmUrl);
  const data = await response.json();
  
  if (!data.routes || data.routes.length === 0) {
    throw new Error("OSRM não retornou rota válida");
  }
  
  return data.routes[0].geometry;
}

export function registerRoutesAPI(app: Express) {
  
  // Middleware simples de autenticação (reutilizando a lógica existente)
  const authenticateToken = (req: any, res: any, next: any) => {
    // Em modo DEV, criar um usuário fake para testes
    if (process.env.DEV_MODE === 'true') {
      req.user = { userId: 1 };
      return next();
    }
    
    // TODO: Implementar autenticação real
    req.user = { userId: 1 };
    next();
  };
  
  // POST /api/routes/optimize - Otimizar rota
  app.post('/api/routes/optimize', authenticateToken, async (req: any, res: Response) => {
    console.log("==== LOG INÍCIO: /api/routes/optimize ====");
    console.log("Body recebido:", JSON.stringify(req.body, null, 2));
    
    try {
      const validation = optimizeRouteSchema.safeParse(req.body);
      if (!validation.success) {
        console.log("❌ ERRO: Validação falhou");
        console.log("Erros:", validation.error.errors);
        console.log("==== LOG FIM: /api/routes/optimize (ERRO VALIDAÇÃO) ====");
        return res.status(400).json({ error: "Dados inválidos", details: validation.error.errors });
      }
      
      const { appointmentIds, endAtStart, responsibleType, responsibleId, vehicleId, title } = validation.data;
      
      // 1. Buscar agendamentos com coordenadas
      console.log("🔍 Buscando agendamentos:", appointmentIds);
      const appointmentList = await db
        .select({
          id: appointments.id,
          clientId: appointments.clientId,
          serviceId: appointments.serviceId,
          scheduledDate: appointments.scheduledDate,
          cep: appointments.cep,
          logradouro: appointments.logradouro,
          numero: appointments.numero,
          complemento: appointments.complemento,
          bairro: appointments.bairro,
          cidade: appointments.cidade,
          clientName: clients.name,
        })
        .from(appointments)
        .leftJoin(clients, eq(appointments.clientId, clients.id))
        .where(eq(appointments.userId, req.user.userId));
      
      const selectedAppointments = appointmentList.filter(app => 
        appointmentIds.includes(app.id.toString())
      );
      
      if (selectedAppointments.length === 0) {
        console.log("❌ ERRO: Nenhum agendamento encontrado");
        console.log("==== LOG FIM: /api/routes/optimize (SEM AGENDAMENTOS) ====");
        return res.status(404).json({ error: "Nenhum agendamento encontrado" });
      }
      
      console.log("✅ Agendamentos encontrados:", selectedAppointments.length);
      
      // 2. Obter endereço de início (empresa ou técnico/equipe)
      let startAddress = "Endereço da empresa";
      let startCoordinates: [number, number] = [-49.2654, -25.4284]; // Curitiba padrão
      
      // Buscar regras de negócio para endereço da empresa
      const businessRule = await db
        .select()
        .from(businessRules)
        .where(eq(businessRules.userId, req.user.userId))
        .limit(1);
      
      if (businessRule.length > 0) {
        const rule = businessRule[0];
        startAddress = `${rule.enderecoEmpresaLogradouro}, ${rule.enderecoEmpresaNumero}, ${rule.enderecoEmpresaBairro}, ${rule.enderecoEmpresaCidade}`;
        
        // TODO: Geocodificar endereço da empresa se necessário
        console.log("🏢 Usando endereço da empresa:", startAddress);
      }
      
      // TODO: Implementar busca de endereço específico do técnico/equipe se necessário
      
      // 3. Preparar coordenadas para OSRM (início + agendamentos)
      const coordinates: [number, number][] = [startCoordinates];
      const appointmentData = selectedAppointments.map(app => ({
        ...app,
        address: `${app.logradouro}, ${app.numero}, ${app.bairro}, ${app.cidade}`,
        clientName: app.clientName || "Cliente",
        serviceName: (app as any).serviceName ?? "", // se não tiver join com services, fica ""
        scheduledDate: app.scheduledDate ?? null,
        // TODO: substituir mocks por coords reais quando existirem
        lat: -25.4284 + Math.random() * 0.1,
        lng: -49.2654 + Math.random() * 0.1
      }));
      
      appointmentData.forEach(app => {
        coordinates.push([app.lng, app.lat]);
      });
      
      console.log("📍 Coordenadas preparadas:", coordinates.length, "pontos");
      
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
      
      console.log("📊 Totais calculados - Distância:", totalDistance, "m, Duração:", totalDuration, "s");
      
      // 7. Gerar polyline GeoJSON
      const routeCoordinates = tourOrder.map(idx => coordinates[idx]);
      let polylineGeoJson = null;
      
      try {
        polylineGeoJson = await getOSRMRoute(routeCoordinates);
        console.log("🗺️ Polyline gerada com sucesso");
      } catch (error) {
        console.log("⚠️ Erro ao gerar polyline:", error);
      }
      
      // 8. Salvar rota no banco
      const routeTitle = title || `Rota ${new Date().toLocaleDateString('pt-BR')}`;
      const routeDate = selectedAppointments[0]?.scheduledDate || new Date();
      
      console.log("💾 Salvando rota no banco...");
      const [savedRoute] = await db
        .insert(routes)
        .values({
          title: routeTitle,
          date: routeDate,
          vehicleId: vehicleId || null,
          responsibleType,
          responsibleId,
          endAtStart,
          distanceTotal: Math.round(totalDistance),
          durationTotal: Math.round(totalDuration),
          stopsCount: selectedAppointments.length,
          status: "optimized",
          polylineGeoJson
        })
        .returning();
      
      // 9. Salvar paradas
      const stopData = [];
      for (let i = 1; i < tourOrder.length; i++) { // Pular índice 0 (início)
        const appointmentIndex = tourOrder[i] - 1; // Ajustar índice
        if (appointmentIndex >= 0 && appointmentIndex < appointmentData.length) {
          const app = appointmentData[appointmentIndex];
          stopData.push({
            routeId: savedRoute.id,
            appointmentId: numberToUUID(Number(app.id)),
            order: i,
            lat: app.lat,
            lng: app.lng,
            address: app.address
          });
        }
      }
      
      if (stopData.length > 0) {
        await db.insert(routeStops).values(stopData);
        console.log("✅ Paradas salvas:", stopData.length);
      }
      
      // 10. Preparar resposta — incluir bloco 'start' e enriquecer 'stops'
      const stops = stopData.map(stop => {
        const app = appointmentData.find(a => numberToUUID(Number(a.id)) === stop.appointmentId);
        return {
          order: stop.order,
          appointmentId: stop.appointmentId,
          appointmentNumericId: app?.id ?? null,
          clientName: app?.clientName || "Cliente",
          serviceName: app?.serviceName ?? "",
          scheduledDate: app?.scheduledDate ?? null,
          address: stop.address,
          lat: stop.lat,
          lng: stop.lng
        };
      });

      const start = {
        address: startAddress,
        lat: startCoordinates[1],
        lng: startCoordinates[0]
      };

      const responseData = {
        route: {
          id: savedRoute.id,
          title: savedRoute.title,
          date: savedRoute.date,
          vehicleId: savedRoute.vehicleId,
          responsible: {
            type: savedRoute.responsibleType,
            id: savedRoute.responsibleId
          },
          endAtStart: savedRoute.endAtStart,
          distanceTotal: savedRoute.distanceTotal,
          durationTotal: savedRoute.durationTotal,
          stopsCount: savedRoute.stopsCount,
          status: savedRoute.status,
          polylineGeoJson: savedRoute.polylineGeoJson
        },
        start,
        stops
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
      res.status(500).json({ error: "Erro interno do servidor", details: error.message });
    }
  });
  
  // GET /api/routes - Listar rotas com filtros
  app.get('/api/routes', authenticateToken, async (req: any, res: Response) => {
    console.log("==== LOG INÍCIO: /api/routes ====");
    console.log("Query params:", JSON.stringify(req.query, null, 2));
    
    try {
      const { from, to, status, responsibleType, responsibleId, vehicleId, search } = req.query;
      
      const conditions = [];
      
      if (from) {
        conditions.push(gte(routes.date, new Date(from as string)));
      }
      
      if (to) {
        conditions.push(lte(routes.date, new Date(to as string)));
      }
      
      if (status) {
        conditions.push(eq(routes.status, status as string));
      }
      
      if (responsibleType) {
        conditions.push(eq(routes.responsibleType, responsibleType as string));
      }
      
      if (responsibleId) {
        conditions.push(eq(routes.responsibleId, responsibleId as string));
      }
      
      if (vehicleId) {
        conditions.push(eq(routes.vehicleId, vehicleId as string));
      }
      
      if (search) {
        conditions.push(like(routes.title, `%${search}%`));
      }
      
      const baseQuery = db
        .select({
          id: routes.id,
          title: routes.title,
          date: routes.date,
          vehicleId: routes.vehicleId,
          responsibleType: routes.responsibleType,
          responsibleId: routes.responsibleId,
          endAtStart: routes.endAtStart,
          distanceTotal: routes.distanceTotal,
          durationTotal: routes.durationTotal,
          stopsCount: routes.stopsCount,
          status: routes.status,
          createdAt: routes.createdAt
        })
        .from(routes);
      
      const routeList = conditions.length > 0 
        ? await baseQuery.where(and(...conditions)).orderBy(desc(routes.createdAt))
        : await baseQuery.orderBy(desc(routes.createdAt));
      
      console.log("✅ Rotas encontradas:", routeList.length);
      console.log("==== LOG FIM: /api/routes (SUCESSO) ====");
      
      res.json(routeList);
      
    } catch (error: any) {
      console.log("❌ ERRO na listagem:");
      console.log("Mensagem:", error.message);
      console.log("==== LOG FIM: /api/routes (ERRO) ====");
      res.status(500).json({ error: "Erro interno do servidor", details: error.message });
    }
  });
  
  // GET /api/routes/:id - Buscar rota específica
  app.get('/api/routes/:id', authenticateToken, async (req: any, res: Response) => {
    console.log("==== LOG INÍCIO: /api/routes/:id ====");
    console.log("Route ID:", req.params.id);
    
    try {
      const routeId = req.params.id;
      
      // Buscar rota
      const [route] = await db
        .select()
        .from(routes)
        .where(eq(routes.id, routeId));
      
      if (!route) {
        console.log("❌ ERRO: Rota não encontrada");
        console.log("==== LOG FIM: /api/routes/:id (NÃO ENCONTRADA) ====");
        return res.status(404).json({ error: "Rota não encontrada" });
      }
      
      // Buscar paradas
      const stops = await db
        .select()
        .from(routeStops)
        .where(eq(routeStops.routeId, routeId))
        .orderBy(routeStops.order);
      
      console.log("✅ Rota encontrada com", stops.length, "paradas");
      console.log("==== LOG FIM: /api/routes/:id (SUCESSO) ====");
      
      res.json({
        route,
        stops
      });
      
    } catch (error: any) {
      console.log("❌ ERRO na busca:");
      console.log("Mensagem:", error.message);
      console.log("==== LOG FIM: /api/routes/:id (ERRO) ====");
      res.status(500).json({ error: "Erro interno do servidor", details: error.message });
    }
  });
}