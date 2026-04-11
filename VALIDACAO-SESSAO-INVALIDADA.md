# Validação - Sessão ativa quando empresa fica inválida

## Casos de teste obrigatórios

### Caso 1: Usuário logado tem acesso desativado durante a sessão

**Setup:**
1. Usuário está logado na Empresa B
2. Navegando normalmente no sistema

**Ação:**
```sql
-- Admin desativa o acesso do usuário
UPDATE memberships 
SET is_active = false 
WHERE user_id = X AND company_id = Y;
```

**Resultado esperado:**
- Em até 30 segundos (próxima revalidação), backend retorna `companyId: null` no `/api/auth/me`
- Frontend detecta mudança `companyId: válido → null`
- Toast aparece: "Acesso à empresa removido"
- Sistema redireciona automaticamente para **AccessPending (Hall)**
- Cache de queries é limpo
- Menus e dados da empresa desaparecem

**Logs esperados:**
```
[AUTH] Revalidando sessão...
⚠️ [AUTH/ME] Empresa atual INVÁLIDA: user 5 → JWT tinha empresa 2, mas membership não está mais ativa
   - Memberships ativas do usuário: 3, 7
⚠️ [AUTH] Empresa atual ficou INVÁLIDA. Redirecionando para Hall...
[APP] Evento company-invalidated recebido. Forçando AccessPending...
```

---

### Caso 2: Usuário perde acesso a TODAS as empresas

**Setup:**
1. Usuário está logado
2. Tem acesso apenas à Empresa A

**Ação:**
```sql
-- Desativar única membership
UPDATE memberships 
SET is_active = false 
WHERE user_id = X;
```

**Resultado esperado:**
- Em até 30s, sistema redireciona para Hall
- **Hall mostra:** "Você não tem acesso a nenhuma empresa"
- **Hall mostra:** Convites pendentes (se houver)
- **Hall NÃO mostra:** Lista de empresas disponíveis
- Botão "Sair" disponível

---

### Caso 3: Usuário perde acesso à Empresa A mas tem acesso à Empresa B

**Setup:**
1. Usuário logado na Empresa A
2. Tem membership ativa também na Empresa B

**Ação:**
```sql
UPDATE memberships 
SET is_active = false 
WHERE user_id = X AND company_id = A;
```

**Resultado esperado:**
- Sistema redireciona para Hall
- **Hall mostra:** "Empresas Disponíveis (1)"
- Card da Empresa B aparece com borda verde
- Botão "Selecionar Empresa" disponível
- Ao clicar, chama `switchCompany(B)` e redireciona para `/inicio`

---

### Caso 4: Usuário aceita convite enquanto está logado

**Setup:**
1. Usuário está logado na Empresa A (ou sem empresa)
2. Recebe convite da Empresa C

**Ação:**
1. Aceitar convite via `/convite/{token}`

**Resultado esperado:**
- Backend retorna `{ token: "novo-jwt", companyId: C, ... }`
- Frontend atualiza `localStorage.setItem("token", data.token)`
- Invalidar queries
- Redirecionar para `/inicio` **SEM precisar refresh manual**
- Usuário já está no contexto da Empresa C

**Logs esperados:**
```
🔑 [ACCEPT EXISTING] Novo JWT emitido com empresa 3
✅ [ACCEPT INVITE] Novo JWT recebido. Atualizando contexto...
```

---

### Caso 5: Membership inativa recebe novo convite

**Setup:**
1. Usuário tem membership INATIVA na Empresa X
2. Admin da Empresa X cria novo convite para o mesmo usuário

**Ação:**
1. Usuário aceita convite

**Resultado esperado:**
- Backend **REATIVA** membership existente (não cria duplicada)
- Retorna novo JWT com `companyId: X`
- Frontend atualiza contexto imediatamente
- Usuário entra na Empresa X sem refresh

**Logs backend:**
```
🔄 [ACCEPT EXISTING] Membership inativa encontrada → REATIVANDO...
✅ [ACCEPT EXISTING] Membership reativada (ID: 15)
🔑 [ACCEPT EXISTING] Novo JWT emitido com empresa 2
```

**Validação banco:**
```sql
-- Deve haver APENAS 1 membership
SELECT COUNT(*) FROM memberships 
WHERE user_id = X AND company_id = Y;
-- Resultado: 1

-- E deve estar ativa
SELECT is_active FROM memberships 
WHERE user_id = X AND company_id = Y;
-- Resultado: true
```

---

### Caso 6: Tentar navegar em empresa inválida

**Setup:**
1. Usuário foi desativado
2. Tenta acessar URL direta de uma tela (ex: `/clientes`)

**Resultado esperado:**
- Interceptador do App.tsx detecta `!user.companyId`
- Redireciona para Hall
- URL muda para raiz do sistema
- Menus não aparecem

---

## Checklist de validação técnica

### Backend

- [ ] `GET /api/auth/me` valida se `companyId` do JWT ainda tem membership ativa
- [ ] Se membership inativa, retorna `companyId: null` (não `undefined`, não o valor antigo)
- [ ] `POST /api/invitations/:token/accept-existing` retorna novo JWT com `companyId` atualizado
- [ ] Reativação de membership funciona corretamente
- [ ] Logs backend são claros e informativos

### Frontend

- [ ] `checkAuth()` é chamado a cada 30 segundos
- [ ] Detecta mudança de `companyId: válido → null`
- [ ] Dispara evento `company-invalidated`
- [ ] App.tsx escuta evento e força `AccessPending`
- [ ] `AccessPending` mostra empresas ativas disponíveis
- [ ] `AccessPending` permite selecionar outra empresa
- [ ] Aceite de convite atualiza token e contexto sem refresh manual
- [ ] Cache de queries é invalidado corretamente

### UX

- [ ] Toast informativo aparece quando empresa fica inválida
- [ ] Hall mostra estado correto (com/sem empresas, com/sem convites)
- [ ] Seleção de empresa funciona do Hall
- [ ] Usuário não vê menus/dados da empresa inválida
- [ ] Após aceitar convite, contexto muda imediatamente

---

## Comandos de debug

### Simular desativação manual

```sql
-- Desativar acesso de um usuário específico
UPDATE memberships 
SET is_active = false 
WHERE user_id = 5 AND company_id = 2;
```

### Verificar estado de membership

```sql
SELECT 
  u.id as user_id,
  u.email,
  m.company_id,
  m.is_active as membership_active,
  c.name as company_name
FROM users u
LEFT JOIN memberships m ON u.id = m.user_id
LEFT JOIN companies c ON m.company_id = c.id
WHERE u.id = 5;
```

### Monitorar logs backend

```bash
# Logs de validação de empresa
grep "AUTH/ME" logs.txt

# Logs de reativação
grep "REATIVANDO" logs.txt

# Logs de novo JWT emitido
grep "Novo JWT emitido" logs.txt
```

### Monitorar console frontend

```javascript
// Verificar revalidação periódica
[AUTH] Revalidando sessão...

// Verificar detecção de invalidação
⚠️ [AUTH] Empresa atual ficou INVÁLIDA. Redirecionando para Hall...

// Verificar evento disparado
[APP] Evento company-invalidated recebido. Forçando AccessPending...

// Verificar aceite de convite
✅ [ACCEPT INVITE] Novo JWT recebido. Atualizando contexto...
```

---

## Fluxo esperado ilustrado

### Fluxo 1: Desativação durante sessão ativa

```
Usuário logado na Empresa A (navegando)
          ↓
    (Admin desativa acesso)
          ↓
30s depois: checkAuth() revalida
          ↓
Backend retorna companyId: null
          ↓
Frontend detecta mudança
          ↓
Toast: "Acesso removido"
          ↓
Redireciona para Hall
          ↓
Hall mostra empresas ativas OU mensagem "sem acesso"
          ↓
Usuário seleciona outra empresa OU faz logout
```

### Fluxo 2: Aceitar convite com contexto atualizado

```
Usuário logado (Empresa A ou sem empresa)
          ↓
Clica em aceitar convite da Empresa B
          ↓
Backend: reativa/cria membership + emite novo JWT
          ↓
Frontend: atualiza localStorage + invalida queries
          ↓
Contexto muda para Empresa B
          ↓
Redireciona para /inicio (já na Empresa B)
          ↓
SEM refresh manual
```

---

## Riscos e observações

### ⚠️ Revalidação a cada 30s pode ser lenta para alguns casos

- Usuário pode continuar na empresa inválida por até 30 segundos
- Alternativa: polling mais agressivo (10s) ou WebSockets
- Trade-off: mais requests vs latência de detecção

### ⚠️ Race condition em accept-existing

- Se dois convites forem aceitos simultaneamente, pode criar memberships duplicadas
- Mitigação: unique constraint em DB já existe
- Sistema vai falhar graciosamente com erro 500 (constraint violation)

### ⚠️ window.location.reload() após aceitar convite

- Solução temporária para garantir contexto atualizado
- Ideal seria atualizar contexto sem reload
- Pode ser refinado futuramente

### ✅ Separação de users.is_active e memberships.is_active

- **users.is_active**: controle GLOBAL (ban de sistema)
- **memberships.is_active**: controle POR EMPRESA
- Admins de empresa **nunca** mexem em users.is_active
- Fluxo validado e seguro
