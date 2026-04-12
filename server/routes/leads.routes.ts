import { type Express } from "express";
import { storage } from "../storage";
import { insertLeadSchema, leads } from "@shared/schema";
import { Resend } from "resend";
import { sendLeadWhatsappNotification } from "../integrations/evolution";
import { db } from "../db";
import { gte, lte, and, desc } from "drizzle-orm";

export function registerLeadsRoutes(app: Express, authenticateToken: any) {
    // Public endpoint - Captura de Leads
    app.post("/api/leads", async (req: any, res) => {
        try {
            const data = insertLeadSchema.parse(req.body);
            const lead = await storage.createLead(data);

            try {
                if (process.env.RESEND_API_KEY) {
                    const resend = new Resend(process.env.RESEND_API_KEY);
                    const EMAIL_FROM = process.env.EMAIL_FROM || 'onboarding@resend.dev';

                    const emailHtml = `
            <h2>Novo Lead Recebido - RotaFácil</h2>
            <p><strong>Nome:</strong> ${lead.name}</p>
            <p><strong>Empresa:</strong> ${lead.companyName}</p>
            <p><strong>Telefone:</strong> ${lead.phone}</p>
            <p><strong>E-mail:</strong> ${lead.email}</p>
            <p><strong>Ramo:</strong> ${lead.otherIndustry ? lead.otherIndustry : lead.industry}</p>
            <p><strong>Funcionários:</strong> ${lead.employeeCount}</p>
            <p><strong>Técnicos em Campo:</strong> ${lead.technicianCount}</p>
            <p><strong>Veículos:</strong> ${lead.vehicleCount}</p>
            <p><strong>Entregas por Dia:</strong> ${lead.deliveriesPerDay}</p>
            <p><strong>Data:</strong> ${new Date(lead.createdAt).toLocaleString('pt-BR')}</p>
          `;

                    await resend.emails.send({
                        from: EMAIL_FROM,
                        to: 'meluautomacoes@gmail.com',
                        subject: 'Novo Lead - Agendamento de Demonstração (RotaFácil)',
                        html: emailHtml
                    });
                    console.log(`✅ [LEADS] E-mail enviado para meluautomacoes@gmail.com sobre novo lead: ${lead.email}`);
                } else {
                    console.log('⚠️ [LEADS] RESEND_API_KEY não configurada. E-mail de notificação não enviado.');
                }
            } catch (emailError) {
                console.error('❌ [LEADS] Erro ao enviar notificação de lead por e-mail:', emailError);
                // Continue anyway, lead was saved
            }

            // Integrar o disparo de WhatsApp complementar
            try {
                await sendLeadWhatsappNotification(lead);
            } catch (whatsError) {
                console.error("❌ [LEADS] Erro isolado no bloco de fetch do WhatsApp:", whatsError);
                // Continue anyway, lead was saved and email already tried
            }

            res.status(201).json(lead);
        } catch (error: any) {
            console.error("❌ [LEADS] Erro ao criar lead:", error);
            res.status(400).json({ message: error.message || "Erro ao criar lead" });
        }
    });

    // Admin endpoint - Listagem de Leads
    app.get("/api/leads", authenticateToken, async (req: any, res) => {
        try {
            // Must be superadmin
            if (!req.user.isSuperAdmin && req.user.email !== 'lucaspmastaler@gmail.com') {
                return res.status(403).json({ message: "Acesso negado. Apenas superadmins podem ver leads." });
            }

            const startDate = req.query.startDate as string | undefined;
            const endDate = req.query.endDate as string | undefined;

            // Se ambas as datas estiverem presentes, filtrar
            if (startDate && endDate) {
                const startDateTime = new Date(startDate);
                startDateTime.setHours(0, 0, 0, 0);
                
                const endDateTime = new Date(endDate);
                endDateTime.setHours(23, 59, 59, 999);

                const filteredLeads = await db
                    .select()
                    .from(leads)
                    .where(
                        and(
                            gte(leads.createdAt, startDateTime),
                            lte(leads.createdAt, endDateTime)
                        )
                    )
                    .orderBy(desc(leads.createdAt));

                return res.json(filteredLeads);
            }

            // Sem filtro: retornar todos
            const allLeads = await storage.getLeads();
            res.json(allLeads);
        } catch (error: any) {
            console.error("❌ [LEADS] Erro ao buscar leads:", error);
            res.status(500).json({ message: "Erro ao buscar leads" });
        }
    });
}
