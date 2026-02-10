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

// 🚫 Desabilitar ETag globalmente para evitar 304 Not Modified
// Isso garante que o frontend sempre receba 200 com body JSON completo
app.set('etag', false);

// 🔒 Middleware para garantir no-cache em rotas /api
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});

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

  await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // 🔧 Vite middleware APENAS em desenvolvimento
  // Em produção, o frontend é servido por Nginx/Caddy via EasyPanel
  if (!isProduction) {
    const { createServer } = await import("http");
    const server = createServer(app);

    const { setupVite } = await import("./vite");
    await setupVite(app, server);
    console.log('🔧 Modo desenvolvimento: Vite middleware ativo');

    // Em dev, usar server.listen() para suportar HMR
    const port = Number(process.env.PORT) || 5000;
    server.listen(port, "0.0.0.0", () => {
      console.log(`🚀 API rodando na porta ${port}`);
    });
  } else {
    console.log('🚀 Modo produção: Servindo frontend estático + API');

    // 📁 Servir arquivos estáticos do build (JS, CSS, imagens, etc.)
    const distPath = new URL('../dist/public', import.meta.url).pathname;
    app.use(express.static(distPath));

    // 🔄 SPA Fallback: retornar index.html para todas as rotas não-API
    // Isso permite navegação direta e refresh em qualquer rota do frontend
    app.get('*', (_req, res) => {
      const indexPath = new URL('../dist/public/index.html', import.meta.url).pathname;
      res.sendFile(indexPath);
    });

    // Em produção, usar app.listen() diretamente
    const port = Number(process.env.PORT) || 5000;
    app.listen(port, "0.0.0.0", () => {
      console.log(`🚀 API rodando na porta ${port}`);
    });
  }
})();
