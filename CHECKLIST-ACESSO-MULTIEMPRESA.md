# Checklist de Validação - Acesso Multiempresa e Desativação por Empresa

## Pré-requisitos
- Backend rodando: `pnpm run dev:api`
- Frontend rodando: `pnpm run dev:web`
- Banco de dados atualizado: `pnpm run db:push`

---

## Cenário 1: Usuário com 1 empresa ativa (fluxo normal)

**Setup:**
1. Criar usuário com membership ativa em apenas uma empresa

**Teste:**
1. Fazer login
2. ✅ Deve ir direto para `/inicio` (sem seleção de empresa)
3. ✅ Deve ver Sidebar e menus normalmente
4. ✅ Não deve passar por AccessPending

**Validação backend:**
```bash
# Verificar no banco
SELECT u.email, m.company_id, m.is_active 
FROM users u 
JOIN memberships m ON u.id = m.user_id 
WHERE u.email = 'usuario@teste.com';
```

---

## Cenário 2: Usuário com 2+ empresas ativas

**Setup:**
1. Criar usuário com 2 ou mais memberships ativas

**Teste:**
1. Fazer login
2. ✅ Deve aparecer modal de seleção de empresa
3. ✅ Selecionar uma empresa
4. ✅ Deve ir para `/inicio`
5. ✅ Sidebar deve mostrar dropdown de troca de empresa
6. ✅ Trocar para outra empresa
7. ✅ Deve funcionar normalmente (queries devem recarregar)

---

## Cenário 3: Usuário sem empresa ativa + convite pendente

**Setup:**
1. Criar usuário sem nenhuma membership ativa
2. Criar convite pendente para este usuário (email exato)

**Teste:**
1. Fazer login
2. ✅ Deve ser redirecionado para `/acesso-pendente`
3. ✅ Deve ver lista com convite(s) pendente(s)
4. ✅ Clicar em "Aceitar Convite"
5. ✅ Deve ir para `/convite/{token}`
6. ✅ Aceitar convite
7. ✅ Deve ganhar acesso à empresa e ir para `/inicio`

**Validação backend:**
```bash
# Verificar convites pendentes do usuário
GET /api/auth/my-invitations
Authorization: Bearer {token}
```

---

## Cenário 4: Usuário sem empresa ativa + sem convites

**Setup:**
1. Criar usuário sem nenhuma membership ativa
2. Sem convites pendentes para este usuário

**Teste:**
1. Fazer login
2. ✅ Deve ser redirecionado para `/acesso-pendente`
3. ✅ Deve ver mensagem: "Você não tem acesso a nenhuma empresa"
4. ✅ Deve ver texto: "Entre em contato com o administrador"
5. ✅ Botão "Sair" deve funcionar

---

## Cenário 5: Empresa A inativa + convite para Empresa B

**Setup:**
1. Criar usuário com membership inativa na Empresa A
2. Criar convite pendente para Empresa B

**Teste:**
1. Fazer login
2. ✅ Deve ir para `/acesso-pendente` (Empresa A está inativa)
3. ✅ Deve ver convite para Empresa B
4. ✅ Não deve ver Empresa A na lista
5. ✅ Aceitar convite da Empresa B
6. ✅ Deve ganhar acesso à Empresa B

**Validação backend:**
```sql
-- Verificar estado das memberships
SELECT company_id, is_active FROM memberships WHERE user_id = X;
```

---

## Cenário 6: Convite para empresa com membership inativa (CRÍTICO)

**Setup:**
1. Criar usuário com membership **INATIVA** na Empresa X
2. Admin da Empresa X cria novo convite para o mesmo usuário

**Teste:**
1. Usuário faz login → vai para AccessPending
2. Clica em "Aceitar Convite"
3. ✅ Backend deve **REATIVAR** a membership existente
4. ✅ **NÃO** deve criar membership duplicada
5. ✅ Convite marcado como "accepted"
6. ✅ Usuário ganha acesso à Empresa X

**Validação backend:**
```sql
-- ANTES do aceite
SELECT id, user_id, company_id, is_active FROM memberships 
WHERE user_id = X AND company_id = Y;
-- Deve retornar 1 row com is_active = false

-- DEPOIS do aceite
SELECT id, user_id, company_id, is_active FROM memberships 
WHERE user_id = X AND company_id = Y;
-- Deve retornar MESMA row com is_active = true (não deve ter 2 rows!)
```

**Logs esperados:**
```
🔄 [ACCEPT EXISTING] Membership inativa encontrada → REATIVANDO...
✅ [ACCEPT EXISTING] Membership reativada (ID: X)
```

---

## Cenário 7: Desativar usuário na empresa

**Setup:**
1. Admin logado na Empresa X
2. Usuário Y ativo na Empresa X

**Teste:**
1. Ir para "Gerenciamento de Usuários"
2. ✅ Ver usuário Y na seção "Usuários Ativos"
3. ✅ Clicar em "Desativar"
4. ✅ Confirmar desativação
5. ✅ Usuário Y deve sumir de "Usuários Ativos"
6. ✅ Usuário Y deve aparecer em "Usuários Desativados"
7. ✅ Badge "INATIVO" deve aparecer
8. ✅ Apenas botão "Reativar Acesso" deve estar disponível

**Validação backend:**
```bash
# Verificar que membership foi desativada
PATCH /api/company/users/{userId}/deactivate
```

```sql
-- Verificar que users.is_active NÃO foi alterado
SELECT is_active FROM users WHERE id = Y;
-- Deve continuar TRUE

-- Verificar que memberships.is_active foi alterado
SELECT is_active FROM memberships WHERE user_id = Y AND company_id = X;
-- Deve ser FALSE
```

---

## Cenário 8: Reativar usuário na empresa

**Setup:**
1. Usuário com membership inativa (do cenário 7)

**Teste:**
1. Ir para "Gerenciamento de Usuários"
2. ✅ Ver usuário na seção "Usuários Desativados"
3. ✅ Clicar em "Reativar Acesso"
4. ✅ Usuário deve sumir de "Usuários Desativados"
5. ✅ Usuário deve aparecer em "Usuários Ativos"
6. ✅ Botões "Editar" e "Desativar" devem estar disponíveis

**Validação backend:**
```bash
PATCH /api/company/users/{userId}/reactivate
```

---

## Cenário 9: Endpoint GET /api/company/users retorna 3 grupos

**Teste:**
```bash
GET /api/company/users
Authorization: Bearer {admin-token}
```

**Resposta esperada:**
```json
{
  "activeUsers": [
    {
      "id": 1,
      "name": "João Silva",
      "email": "joao@empresa.com",
      "role": "admin",
      "isActive": true,
      ...
    }
  ],
  "inactiveUsers": [
    {
      "id": 2,
      "name": "Maria Santos",
      "email": "maria@empresa.com",
      "role": "operador",
      "isActive": false,
      ...
    }
  ],
  "pendingInvites": [
    {
      "id": 10,
      "email": "novo@empresa.com",
      "role": "OPERADOR",
      "status": "pending",
      ...
    }
  ]
}
```

---

## Cenário 10: Não é possível desativar a si mesmo

**Teste:**
1. Admin tenta desativar sua própria conta
2. ✅ Deve retornar erro: "Você não pode desativar sua própria conta"

**Validação backend:**
```bash
PATCH /api/company/users/{admin-proprio-id}/deactivate
# Deve retornar 400
```

---

## Cenário 11: Interceptador não bloqueia /convite/:token

**Setup:**
1. Usuário sem empresa ativa com convite pendente

**Teste:**
1. Clicar em link de convite **antes** de fazer login
2. ✅ Deve salvar `pendingInviteToken` no localStorage
3. ✅ Deve redirecionar para `/login`
4. Fazer login
5. ✅ Deve detectar `pendingInviteToken`
6. ✅ Deve redirecionar para `/convite/{token}`
7. ✅ **NÃO** deve ser capturado pelo interceptador `AccessPending`
8. ✅ Deve permitir aceitar o convite
9. Após aceitar
10. ✅ Deve ganhar acesso à empresa

---

## Cenário 12: users.is_active nunca é alterado por admin de empresa

**Teste:**
1. Desativar usuário na empresa
2. Reativar usuário na empresa
3. Verificar banco de dados

**Validação:**
```sql
-- Verificar que users.is_active permanece inalterado
SELECT id, email, is_active FROM users WHERE id = X;
-- is_active deve continuar TRUE

-- Apenas memberships.is_active deve mudar
SELECT user_id, company_id, is_active FROM memberships WHERE user_id = X;
```

---

## Comandos Úteis de Debug

### Verificar estado de um usuário
```sql
SELECT 
  u.id as user_id,
  u.email,
  u.is_active as user_active,
  m.company_id,
  m.is_active as membership_active,
  c.name as company_name
FROM users u
LEFT JOIN memberships m ON u.id = m.user_id
LEFT JOIN companies c ON m.company_id = c.id
WHERE u.email = 'usuario@teste.com';
```

### Verificar convites pendentes
```sql
SELECT 
  i.email,
  i.status,
  i.expires_at,
  c.name as company_name
FROM invitations i
JOIN companies c ON i.company_id = c.id
WHERE i.email = 'usuario@teste.com' AND i.status = 'pending';
```

### Verificar logs do backend
```bash
# Buscar logs de aceite de convite com membership inativa
grep "REATIVANDO" server-logs.txt

# Buscar logs de desativação/reativação
grep "DEACTIVATE\|REACTIVATE" server-logs.txt
```

---

## Checklist Final

Antes de considerar a implementação completa, verificar:

- [ ] Todos os 12 cenários testados
- [ ] Nenhum erro de TypeScript (`pnpm run check`)
- [ ] Backend starta sem erros (`pnpm run dev:api`)
- [ ] Frontend starta sem erros (`pnpm run dev:web`)
- [ ] Nenhuma membership duplicada criada (verificar unique constraint)
- [ ] `users.is_active` nunca alterado por admin de empresa
- [ ] Logs de backend confirmam reativação de memberships inativas
- [ ] AccessPending funciona para casos edge
- [ ] Interceptador não bloqueia `/convite/:token`
- [ ] UserManagement mostra 3 grupos separados
- [ ] Desativar/Reativar funcionam corretamente
