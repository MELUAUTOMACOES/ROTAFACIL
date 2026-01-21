import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import { registerRoutes } from "./routes";
// 🔧 Vite só é importado em desenvolvimento
import { log } from "./vite";

const app = express();
const isProduction = process.env.NODE_ENV === "production";

// 🛡️ Security Headers (Helmet)
app.use(helmet({
  contentSecurityPolicy: isProduction, // Ativo em produção, desativado em dev
  crossOriginEmbedderPolicy: false, // Permite carregar recursos externos (ex: mapas)
}));

// 🌐 CORS Configuration
const corsOptions = {
  origin: isProduction
    ? process.env.APP_URL || true // Em produção, usa APP_URL ou permite qualquer origem
    : true, // Em desenvolvimento, permite qualquer origem
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: false }));

// 🏥 Health check endpoint (antes de middlewares de logging/auth)
app.get("/api/health", (_req, res) => {
  res.status(200).send("ok");
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // 🔒 Verificar configuração de segurança
  if (process.env.DEV_MODE === 'true') {
    console.error('');
    console.error('═══════════════════════════════════════════════════════════');
    console.error('🚨 ALERTA CRÍTICO DE SEGURANÇA: DEV_MODE ATIVO! 🚨');
    console.error('═══════════════════════════════════════════════════════════');
    console.error('⚠️  Autenticação desativada - TODOS viram admin!');
    console.error('⚠️  NUNCA use em produção ou com banco de dados real!');
    console.error('⚠️  Para desativar: DEV_MODE=false no arquivo .env');
    console.error('═══════════════════════════════════════════════════════════');
    console.error('');
  } else {
    console.log('✅ Modo de segurança: PRODUÇÃO (autenticação ativa)');
  }

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // 🔧 Vite middleware APENAS em desenvolvimento
  // Em produção, o frontend é servido por Nginx/Caddy via EasyPanel
  if (!isProduction) {
    const { setupVite } = await import("./vite");
    await setupVite(app, server);
    console.log('🔧 Modo desenvolvimento: Vite middleware ativo');
  } else {
    console.log('🚀 Modo produção: Backend API-only (frontend via proxy externo)');
  }

  // 📌 Porta configurável via env (padrão 5000)
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(port, "0.0.0.0", () => {
    log(`🚀 API rodando na porta ${port}`);
  });
})();
