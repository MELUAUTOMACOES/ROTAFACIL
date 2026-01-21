/**
 * ⚠️ ARQUIVO APENAS PARA DESENVOLVIMENTO ⚠️
 * 
 * Este arquivo configura o Vite middleware para HMR durante desenvolvimento.
 * Em PRODUÇÃO, o backend é API-only e o frontend é servido por Nginx/Caddy.
 * 
 * NÃO importar em produção - usar import dinâmico condicional em server/index.ts
 */

import { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

/**
 * Função de log simples - pode ser usada em dev e prod
 */
export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

/**
 * ⚠️ APENAS DESENVOLVIMENTO ⚠️
 * Configura Vite middleware para HMR e serve o frontend em dev
 */
export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: ["localhost", "127.0.0.1"],
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

// ❌ serveStatic REMOVIDO - não necessário em arquitetura API-only
// O frontend é servido por Nginx/Caddy no EasyPanel
