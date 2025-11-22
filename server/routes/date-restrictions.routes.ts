import type { Express } from "express";
import { storage } from "../storage";
import { insertDateRestrictionSchema, dateRestrictions } from "@shared/schema";
import { db } from "../db";
import { and, eq, sql } from "drizzle-orm";
import { updateDailyAvailability } from "../availability-helpers";

export function registerDateRestrictionsRoutes(app: Express, authenticateToken: any) {
  // Listar restrições de data com intervalo opcional
  app.get("/api/date-restrictions", authenticateToken, async (req: any, res) => {
    try {
      const { start, end } = req.query;

      let startDate: Date | undefined;
      let endDate: Date | undefined;

      if (start) {
        startDate = new Date(String(start));
      }
      if (end) {
        endDate = new Date(String(end));
      }

      const restrictions = await storage.getDateRestrictions(req.user.userId, startDate, endDate);
      res.json(restrictions);
    } catch (error: any) {
      console.error("❌ Erro ao listar restrições de data:", error);
      res.status(500).json({ message: error.message || "Erro ao listar restrições de data" });
    }
  });

  // Criar nova restrição de data
  app.post("/api/date-restrictions", authenticateToken, async (req: any, res) => {
    try {
      // Converter date recebido como string (ISO) para Date local usando apenas a parte de data
      const raw = req.body;

      const rawDate: unknown = raw.date;
      let parsedDate: Date;

      if (typeof rawDate === "string") {
        const [datePart] = rawDate.split("T");
        const [yearStr, monthStr, dayStr] = datePart.split("-");
        const year = Number(yearStr);
        const month = Number(monthStr);
        const day = Number(dayStr);

        if (!year || !month || !day) {
          throw new Error("Data inválida para restrição de data.");
        }

        // new Date(ano, mês-1, dia) cria data local sem aplicar fuso sobre a string
        parsedDate = new Date(year, month - 1, day);
      } else if (rawDate instanceof Date) {
        parsedDate = new Date(rawDate);
      } else {
        throw new Error("Data inválida para restrição de data.");
      }

      parsedDate.setHours(0, 0, 0, 0);

      const data = insertDateRestrictionSchema.parse({
        ...raw,
        date: parsedDate,
      });

      const restriction = await storage.createDateRestriction({
        ...data,
        date: parsedDate,
      }, req.user.userId);

      // Atualizar disponibilidade diária para refletir a restrição
      await updateDailyAvailability(
        req.user.userId,
        restriction.date,
        restriction.responsibleType as 'technician' | 'team',
        restriction.responsibleId,
      );

      res.json(restriction);
    } catch (error: any) {
      console.error("❌ Erro ao criar restrição de data:", error);
      res.status(400).json({ message: error.message || "Erro ao criar restrição de data" });
    }
  });

  // Remover restrição de data
  app.delete("/api/date-restrictions/:id", authenticateToken, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);

      const existing = await db.select().from(dateRestrictions).where(and(
        eq(dateRestrictions.id, id),
        eq(dateRestrictions.userId, req.user.userId),
      ));

      if (!existing.length) {
        return res.status(404).json({ message: "Restrição de data não encontrada" });
      }

      const restriction = existing[0];

      const success = await storage.deleteDateRestriction(id, req.user.userId);
      if (!success) {
        return res.status(404).json({ message: "Restrição de data não encontrada" });
      }

      // Recalcular disponibilidade para o dia após remover a restrição
      await updateDailyAvailability(
        req.user.userId,
        restriction.date,
        restriction.responsibleType as 'technician' | 'team',
        restriction.responsibleId,
      );

      res.json({ message: "Restrição de data removida com sucesso" });
    } catch (error: any) {
      console.error("❌ Erro ao remover restrição de data:", error);
      res.status(500).json({ message: error.message || "Erro ao remover restrição de data" });
    }
  });
}
