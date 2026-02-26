/**
 * Script de Migração: Atribuir companyId aos dados antigos
 * 
 * Este script atribui companyId aos registros que não têm (NULL),
 * com base no relacionamento user -> membership -> company.
 * 
 * IMPORTANTE: Rode este script ANTES de ativar multi-tenancy em produção!
 */

import { db } from "../server/db";
import {
  users,
  memberships,
  clients,
  services,
  technicians,
  vehicles,
  appointments,
  businessRules,
  teams,
  teamMembers,
  checklists,
} from "@shared/schema";
import { eq, isNull, and } from "drizzle-orm";

async function migrateCompanyId() {
  console.log("🔄 Iniciando migração de companyId...\n");

  // 1. Obter todos os usuários com memberships
  const allMemberships = await db
    .select({
      userId: memberships.userId,
      companyId: memberships.companyId,
      companyName: memberships.companyName,
    })
    .from(memberships);

  console.log(`📊 Encontradas ${allMemberships.length} memberships no sistema.\n`);

  // 2. Agrupar por userId para detectar usuários com múltiplas empresas
  const userCompanies = new Map<number, Array<{ companyId: number; companyName: string }>>();
  
  for (const m of allMemberships) {
    if (!userCompanies.has(m.userId)) {
      userCompanies.set(m.userId, []);
    }
    userCompanies.get(m.userId)!.push({
      companyId: m.companyId,
      companyName: m.companyName || `Empresa ${m.companyId}`,
    });
  }

  console.log(`👥 Total de usuários: ${userCompanies.size}`);
  const usersWithMultipleCompanies = Array.from(userCompanies.entries()).filter(
    ([_, companies]) => companies.length > 1
  );
  console.log(`⚠️  Usuários com múltiplas empresas: ${usersWithMultipleCompanies.length}\n`);

  // 3. Migrar dados para cada tabela
  const tables = [
    { name: "clients", table: clients },
    { name: "services", table: services },
    { name: "technicians", table: technicians },
    { name: "vehicles", table: vehicles },
    { name: "appointments", table: appointments },
    { name: "businessRules", table: businessRules },
    { name: "teams", table: teams },
    { name: "teamMembers", table: teamMembers },
    { name: "checklists", table: checklists },
  ];

  const stats: Record<string, { updated: number; skipped: number; multipleCompanies: number }> = {};

  for (const { name, table } of tables) {
    console.log(`\n📋 Migrando tabela: ${name}...`);
    
    // Buscar registros sem companyId
    const records = await db
      .select()
      .from(table)
      .where(isNull((table as any).companyId));

    console.log(`   Encontrados ${records.length} registros sem companyId`);

    let updated = 0;
    let skipped = 0;
    let multipleCompanies = 0;

    for (const record of records) {
      const userId = (record as any).userId;
      if (!userId) {
        console.log(`   ⚠️  Registro ${(record as any).id} sem userId, pulando...`);
        skipped++;
        continue;
      }

      const companies = userCompanies.get(userId);
      if (!companies || companies.length === 0) {
        console.log(`   ⚠️  User ${userId} sem memberships, pulando registro ${(record as any).id}...`);
        skipped++;
        continue;
      }

      // Se usuário tem apenas 1 empresa, atribuir automaticamente
      if (companies.length === 1) {
        const companyId = companies[0].companyId;
        await db
          .update(table)
          .set({ companyId } as any)
          .where(eq((table as any).id, (record as any).id));
        updated++;
      } else {
        // Usuário com múltiplas empresas: atribuir à primeira (principal)
        // Em produção, você pode querer pedir confirmação manual
        const companyId = companies[0].companyId;
        console.log(
          `   ⚠️  User ${userId} tem ${companies.length} empresas. ` +
          `Atribuindo registro ${(record as any).id} à empresa principal: ${companies[0].companyName} (ID: ${companyId})`
        );
        await db
          .update(table)
          .set({ companyId } as any)
          .where(eq((table as any).id, (record as any).id));
        multipleCompanies++;
      }
    }

    stats[name] = { updated, skipped, multipleCompanies };
    console.log(`   ✅ ${updated} atualizados, ${skipped} pulados, ${multipleCompanies} com múltiplas empresas`);
  }

  // 4. Relatório final
  console.log("\n" + "=".repeat(60));
  console.log("📊 RELATÓRIO FINAL DA MIGRAÇÃO");
  console.log("=".repeat(60) + "\n");

  for (const [tableName, stat] of Object.entries(stats)) {
    console.log(`${tableName.padEnd(20)} | ${stat.updated} atualizados | ${stat.skipped} pulados | ${stat.multipleCompanies} multi-empresa`);
  }

  const totalUpdated = Object.values(stats).reduce((sum, s) => sum + s.updated, 0);
  const totalMulti = Object.values(stats).reduce((sum, s) => sum + s.multipleCompanies, 0);

  console.log("\n" + "=".repeat(60));
  console.log(`✅ Total de registros atualizados: ${totalUpdated + totalMulti}`);
  
  if (totalMulti > 0) {
    console.log(`\n⚠️  ATENÇÃO: ${totalMulti} registros foram atribuídos à empresa PRINCIPAL`);
    console.log(`   de usuários com múltiplas empresas. Revise se necessário!`);
  }

  console.log("\n✅ Migração concluída!\n");
}

// Executar migração
migrateCompanyId()
  .then(() => {
    console.log("🎉 Script finalizado com sucesso!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Erro na migração:", error);
    process.exit(1);
  });
