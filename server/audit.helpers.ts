/**
 * Helper para registrar ações de auditoria por empresa
 * Usado para rastrear todas as alterações feitas pelos usuários
 */

import { db } from "./db";
import { companyAuditLogs, users } from "@shared/schema";
import { eq, and, lt } from "drizzle-orm";

interface AuditParams {
    userId: number;
    companyId?: number | null;
    userName?: string;
    feature: string;
    action: string;
    resourceId?: string | number | null;
    description?: string;
    metadata?: object | null;
    ipAddress?: string | null;
}

/**
 * Registra uma ação de auditoria para a empresa
 * Fire-and-forget: não bloqueia a requisição principal
 */
export async function trackCompanyAudit(params: AuditParams): Promise<void> {
    const {
        userId,
        companyId,
        userName,
        feature,
        action,
        resourceId,
        description,
        metadata,
        ipAddress,
    } = params;

    console.log(`📝 [AUDIT] ${feature}.${action} (User: ${userId}, Company: ${companyId})`);

    try {
        // Buscar nome do usuário se não fornecido
        let finalUserName = userName;
        if (!finalUserName && userId) {
            const user = await db.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
            finalUserName = user[0]?.name || `User #${userId}`;
        }

        await db.insert(companyAuditLogs).values({
            userId,
            companyId: companyId || null,
            userName: finalUserName,
            feature,
            action,
            resourceId: resourceId?.toString() || null,
            description: description || null,
            metadata: metadata || null,
            ipAddress: ipAddress || null,
        });

        console.log(`✅ [AUDIT] Registrado com sucesso`);
    } catch (error: any) {
        console.error(`❌ [AUDIT] Erro ao registrar auditoria:`, error.message);
    }
}

/**
 * Limpa registros de auditoria com mais de 30 dias
 * Deve ser chamado periodicamente (ex: cron job ou no startup)
 */
export async function cleanupOldAuditLogs(): Promise<number> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    try {
        const result = await db
            .delete(companyAuditLogs)
            .where(lt(companyAuditLogs.createdAt, thirtyDaysAgo));

        const deletedCount = result.rowCount || 0;
        if (deletedCount > 0) {
            console.log(`🧹 [AUDIT] Limpeza: ${deletedCount} registros antigos removidos`);
        }
        return deletedCount;
    } catch (error: any) {
        console.error(`❌ [AUDIT] Erro na limpeza:`, error.message);
        return 0;
    }
}

// Helpers para descrições legíveis
export const FEATURE_NAMES: Record<string, string> = {
    clients: "Clientes",
    appointments: "Agendamentos",
    vehicles: "Veículos",
    technicians: "Técnicos",
    teams: "Equipes",
    services: "Serviços",
    maintenances: "Manutenções",
    routes: "Rotas",
    checklists: "Checklists",
    users: "Usuários",
    business_rules: "Regras de Negócio",
    auth: "Autenticação",
    find_date: "Busca de Data",
};

export const ACTION_NAMES: Record<string, string> = {
    create: "criou",
    update: "atualizou",
    delete: "excluiu",
    login: "fez login",
    logout: "fez logout",
    optimize: "otimizou",
    confirm: "confirmou",
    finalize: "finalizou",
    cancel: "cancelou",
    search: "buscou",
};

export function getAuditDescription(feature: string, action: string, resourceId?: string | number | null): string {
    const featureName = FEATURE_NAMES[feature] || feature;
    const actionName = ACTION_NAMES[action] || action;

    if (resourceId) {
        return `${actionName} ${featureName} #${resourceId}`;
    }
    return `${actionName} ${featureName}`;
}
