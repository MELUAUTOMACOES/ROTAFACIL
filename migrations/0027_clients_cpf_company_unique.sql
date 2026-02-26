-- Migration 0027: Trocar unique global de CPF para unique composto (company_id, cpf)
-- ============================================================

-- DIAGNÓSTICO OBRIGATÓRIO (executar ANTES de aplicar):
-- SELECT company_id, cpf, COUNT(*) FROM clients GROUP BY company_id, cpf HAVING COUNT(*) > 1;
-- Se retornar linhas, NÃO aplique esta migration — trate os duplicados primeiro.

-- 1) Remover constraint unique global de CPF
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_cpf_unique;

-- 2) Remover índice antigo de CPF (se existir)
DROP INDEX IF EXISTS idx_clients_cpf;

-- 3) Criar unique composto (company_id + cpf) — permite mesmo CPF em empresas diferentes
CREATE UNIQUE INDEX clients_cpf_company_unique ON clients (company_id, cpf);
