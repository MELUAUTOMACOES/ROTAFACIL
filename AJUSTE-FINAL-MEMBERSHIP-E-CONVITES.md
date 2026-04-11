# Ajuste final do frontend para membership inválida e gestão de convites pendentes

## 1. Onde o frontend ainda tratava como logout genérico

### Problema identificado

**Arquivo:** `client/src/lib/queryClient.ts:21-24`

**Tratamento anterior:**

```typescript
// ❌ PROBLEMA: Tratava todos os erros 401 como logout genérico
if (res.status === 401) {
   const event = new CustomEvent("unauthorized", { detail: { message: errorMessage, code } });
   window.dispatchEvent(event);
}
```

**Consequência:**

Quando o backend retornava **403 com `MEMBERSHIP_INACTIVE`** ou **`MEMBERSHIP_NOT_FOUND`**, o frontend:
- Não capturava esse erro específico
- Deixava o usuário continuar operando (até próxima revalidação)
- OU tratava como erro genérico sem preservar autenticação global

**Cenários que falhavam:**

1. **Backend bloqueia request com 403 MEMBERSHIP_INACTIVE**
   - Frontend não detectava código de erro específico
   - Não limpava contexto da empresa
   - Não redirecionava para Hall

2. **Usuário recebia apenas mensagem de erro genérica**
   - Sem ação proativa do sistema
   - Precisava refresh manual ou aguardar polling (30s)

---

## 2. O que foi alterado para levar ao Hall em caso de membership inválida

### Mudança 1: Interceptador de erro no queryClient

**Arquivo:** `client/src/lib/queryClient.ts`

**Alteração:**

```typescript
// 🔒 MEMBERSHIP INVÁLIDA: Tratar diferente de logout genérico
// Preserva autenticação global, mas redireciona para Hall
if (res.status === 403 && (errorCode === "MEMBERSHIP_INACTIVE" || errorCode === "MEMBERSHIP_NOT_FOUND")) {
  console.warn(`⚠️ [MEMBERSHIP] Empresa atual inválida detectada pelo backend:`, errorCode);
  const event = new CustomEvent("membership-invalidated", { 
    detail: { 
      message: errorMessage, 
      errorCode,
      companyId 
    } 
  });
  window.dispatchEvent(event);
  throw new Error(errorMessage);
}
```

**Comportamento:**

✅ Detecta erro 403 com código específico (`MEMBERSHIP_INACTIVE` ou `MEMBERSHIP_NOT_FOUND`)  
✅ Dispara evento customizado `membership-invalidated`  
✅ **NÃO dispara** evento `unauthorized` (que causaria logout global)  
✅ Preserva token JWT e autenticação do usuário

---

### Mudança 2: Listener no AuthProvider

**Arquivo:** `client/src/lib/auth.tsx`

**Alteração:**

```typescript
// 🔒 MEMBERSHIP INVÁLIDA (403 do backend): Preservar autenticação, limpar empresa, ir para Hall
const handleMembershipInvalidated = (e: Event) => {
  const detail = (e as CustomEvent).detail;
  console.warn('⚠️ [AUTH] Membership invalidada pelo backend:', detail);
  
  toast({
    title: "Acesso à empresa removido",
    description: detail.message || "Seu acesso a esta empresa foi desativado. Selecione outra empresa ou entre em contato com o administrador.",
    variant: "destructive",
  });

  // Atualizar contexto para limpar empresa atual (mantém autenticação global)
  setUser(prev => {
    if (!prev) return null;
    return {
      ...prev,
      companyId: undefined,
      companyRole: undefined,
      company: undefined,
    };
  });

  // Disparar evento para App.tsx forçar AccessPending
  window.dispatchEvent(new CustomEvent('force-access-pending'));
};

window.addEventListener("membership-invalidated", handleMembershipInvalidated as EventListener);
```

**Comportamento:**

✅ Toast informativo para o usuário  
✅ Limpa `companyId`, `companyRole` e `company` do contexto  
✅ **Mantém** `userId`, `email`, `memberships` (autenticação global preservada)  
✅ Dispara evento `force-access-pending` para App.tsx

---

### Mudança 3: Listener no App.tsx

**Arquivo:** `client/src/App.tsx`

**Alteração:**

```typescript
// 🔒 Escutar evento de forçar AccessPending (erro 403 do backend)
const handleForceAccessPending = () => {
  console.log('[APP] Evento force-access-pending recebido (erro backend). Forçando AccessPending...');
  setForceAccessPending(true);
  // Invalidar queries para limpar dados da empresa antiga
  import('./lib/queryClient').then(({ queryClient }) => {
    queryClient.clear();
  });
};

window.addEventListener('force-access-pending', handleForceAccessPending as EventListener);
```

**Comportamento:**

✅ Seta flag `forceAccessPending = true`  
✅ Limpa cache de queries (remove dados da empresa antiga)  
✅ Força renderização de `<AccessPending />` no interceptador de rotas

---

## 3. Como ficou o fluxo final quando a empresa atual perde validade

### Fluxo A: Backend detecta membership inativa (erro 403 imediato)

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Usuário faz request (ex: GET /api/clients)              │
│    JWT válido mas membership.isActive = false               │
└──────────────────┬──────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Backend: validateActiveMembership middleware             │
│    → Consulta banco                                         │
│    → Membership inativa detectada                           │
│    → Retorna 403 { error: "MEMBERSHIP_INACTIVE", ... }      │
└──────────────────┬──────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Frontend: queryClient intercepta erro                    │
│    → Detecta errorCode === "MEMBERSHIP_INACTIVE"            │
│    → Dispara evento "membership-invalidated"                │
└──────────────────┬──────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. AuthProvider: escuta evento                              │
│    → Toast: "Acesso à empresa removido"                     │
│    → Limpa companyId do contexto (mantém autenticação)      │
│    → Dispara evento "force-access-pending"                  │
└──────────────────┬──────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. App.tsx: escuta evento                                   │
│    → setForceAccessPending(true)                            │
│    → queryClient.clear()                                    │
└──────────────────┬──────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. Interceptador de rotas renderiza <AccessPending />       │
│    → Usuário vê Hall                                        │
│    → Lista de empresas ativas disponíveis OU                │
│    → Mensagem "sem acesso a nenhuma empresa"                │
└─────────────────────────────────────────────────────────────┘
```

**Tempo total:** **< 1 segundo** (bloqueio imediato)

---

### Fluxo B: Frontend detecta via polling (revalidação periódica)

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Polling a cada 30s: checkAuth() chama /api/auth/me      │
└──────────────────┬──────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Backend: /api/auth/me valida membership                 │
│    → Membership inativa detectada                           │
│    → Retorna companyId: null (em vez do valor do JWT)       │
└──────────────────┬──────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. checkAuth() detecta mudança                              │
│    → previousCompanyId: 2 → currentCompanyId: null          │
│    → Toast: "Acesso à empresa removido"                     │
│    → Dispara evento "company-invalidated"                   │
└──────────────────┬──────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. App.tsx: escuta evento "company-invalidated"            │
│    → setForceAccessPending(true)                            │
│    → queryClient.clear()                                    │
│    → Renderiza <AccessPending />                            │
└─────────────────────────────────────────────────────────────┘
```

**Tempo total:** **até 30 segundos** (próxima revalidação)

---

### Diferença entre os dois fluxos

| Aspecto | Fluxo A (Backend 403) | Fluxo B (Polling) |
|---------|----------------------|-------------------|
| **Trigger** | Request com membership inativa | Polling a cada 30s |
| **Latência** | **Imediata (< 1s)** | **Até 30s** |
| **Evento** | `membership-invalidated` | `company-invalidated` |
| **Origem** | Interceptador de erro (403) | checkAuth() detecta mudança |
| **Segurança** | ✅ Bloqueio garantido no backend | ⚠️ Janela de até 30s |

**Resultado combinado:** Dupla proteção garante que usuário **nunca opere** em empresa inválida.

---

## 4. O que foi alterado na tela de UserManagement

### Problema anterior

**Convites pendentes mostravam apenas:**
- Email
- Role
- Badge "Pendente"

**Sem ações administrativas:**
- ❌ Não era possível reenviar convite
- ❌ Não era possível cancelar convite
- ❌ Poucas informações (sem datas, sem displayName)

---

### Mudanças implementadas

**Arquivo:** `client/src/pages/UserManagement.tsx`

#### 1. Novas mutations adicionadas

```typescript
// Mutation para reenviar convite pendente
const resendInviteMutation = useMutation({
  mutationFn: async (invitationId: number) => {
    const response = await fetch(buildApiUrl(`/api/invitations/${invitationId}/resend`), {
      method: "PATCH",
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Erro ao reenviar convite');
    }
    return response.json();
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["/api/company/users"] });
    toast({
      title: "Convite reenviado",
      description: "O convite foi reenviado com sucesso.",
    });
  },
  // ...
});

// Mutation para cancelar convite pendente
const cancelInviteMutation = useMutation({
  mutationFn: async (invitationId: number) => {
    const response = await fetch(buildApiUrl(`/api/invitations/${invitationId}/cancel`), {
      method: "PATCH",
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Erro ao cancelar convite');
    }
    return response.json();
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["/api/company/users"] });
    toast({
      title: "Convite cancelado",
      description: "O convite foi cancelado com sucesso.",
    });
  },
  // ...
});
```

#### 2. Novos handlers adicionados

```typescript
const handleResendInvite = (invitationId: number) => {
  resendInviteMutation.mutate(invitationId);
};

const handleCancelInvite = (invitationId: number) => {
  cancelInviteMutation.mutate(invitationId);
};
```

#### 3. UI dos convites pendentes melhorada

**Agora mostra:**

✅ **Cabeçalho com displayName ou email**  
✅ **Email completo**  
✅ **Badge de role** (Administrador, Operador, etc.)  
✅ **Data de criação** (quando foi enviado)  
✅ **Data de reenvio** (se foi reenviado)  
✅ **Data de expiração** (quando expira o token)  
✅ **Botões de ação:**
- 🔄 **Reenviar** (ícone Send)
- ❌ **Cancelar** (ícone X, cor vermelha)

**Card de convite pendente (novo layout):**

```
╔══════════════════════════════════════════════════════════════╗
║  📧 João Silva                              [Pendente]       ║
╠══════════════════════════════════════════════════════════════╣
║  📧 joao@empresa.com  🛡️ [Operador]                          ║
║  📅 Criado: 10/04/2026  🔄 Reenviado: 11/04/2026             ║
║  ⏰ Expira: 18/04/2026                                       ║
║  ────────────────────────────────────────────────────────    ║
║                              [🔄 Reenviar]  [❌ Cancelar]    ║
╚══════════════════════════════════════════════════════════════╝
```

---

## 5. Como ficaram as ações de reenviar e cancelar convite

### Ação: Reenviar convite

**Botão:**
- Ícone: `<Send />` (papel de carta saindo)
- Label mobile: "Reenviar"
- Desktop: apenas ícone
- Estado loading: ícone com `animate-pulse`

**Comportamento:**

1. Admin clica em "Reenviar"
2. Frontend chama `PATCH /api/invitations/:id/resend`
3. Backend:
   - Gera novo token UUID
   - Atualiza `expires_at` (+7 dias)
   - Atualiza `resent_at` (timestamp atual)
   - Envia novo email (se configurado)
4. Frontend:
   - Invalida cache `/api/company/users`
   - Toast: "Convite reenviado com sucesso"
   - Lista atualiza automaticamente
   - Campo "Reenviado em" aparece no card

**Validações backend:**
- ✅ Convite deve existir
- ✅ Convite deve pertencer à empresa do admin
- ✅ Convite deve estar `status = 'pending'`
- ✅ Convite não pode estar expirado demais

---

### Ação: Cancelar convite

**Botão:**
- Ícone: `<X />` (X simples)
- Label mobile: "Cancelar"
- Desktop: apenas ícone
- Cor: vermelho (`text-red-600 hover:bg-red-50`)

**Comportamento:**

1. Admin clica em "Cancelar"
2. Frontend chama `PATCH /api/invitations/:id/cancel`
3. Backend:
   - Atualiza `status = 'cancelled'`
   - Atualiza `cancelled_at` (timestamp atual)
   - Atualiza `cancelled_by` (userId do admin)
   - **NÃO deleta fisicamente** do banco
4. Frontend:
   - Invalida cache `/api/company/users`
   - Toast: "Convite cancelado com sucesso"
   - Convite **desaparece** da lista de pendentes
   - Filtro backend já não retorna convites cancelados

**Validações backend:**
- ✅ Convite deve existir
- ✅ Convite deve pertencer à empresa do admin
- ✅ Convite deve estar `status = 'pending'`
- ✅ Convite não pode já estar cancelado

**Link do convite cancelado:**
- ❌ Torna-se inválido imediatamente
- Se usuário tentar acessar: mensagem "Este convite foi cancelado"

---

## 6. Arquivos alterados

### Frontend - Tratamento de membership inválida

**1. `client/src/lib/queryClient.ts`**
- Adicionado tratamento específico para erro 403 com `MEMBERSHIP_INACTIVE` ou `MEMBERSHIP_NOT_FOUND`
- Dispara evento `membership-invalidated` (em vez de `unauthorized`)
- Preserva autenticação global

**2. `client/src/lib/auth.tsx`**
- Adicionado listener para evento `membership-invalidated`
- Limpa `companyId`, `companyRole` e `company` do contexto
- Mantém `userId`, `email`, `memberships` (autenticação global)
- Dispara evento `force-access-pending` para App.tsx
- Toast informativo para usuário

**3. `client/src/App.tsx`**
- Adicionado listener para evento `force-access-pending`
- Seta flag `forceAccessPending = true`
- Limpa cache de queries (`queryClient.clear()`)
- Renderiza `<AccessPending />` via interceptador de rotas

---

### Frontend - Gestão de convites pendentes

**4. `client/src/pages/UserManagement.tsx`**

**Mutations adicionadas:**
- `resendInviteMutation` - PATCH `/api/invitations/:id/resend`
- `cancelInviteMutation` - PATCH `/api/invitations/:id/cancel`

**Handlers adicionados:**
- `handleResendInvite(invitationId)` - Reenviar convite
- `handleCancelInvite(invitationId)` - Cancelar convite

**Ícones adicionados:**
- `Send` - Reenviar convite
- `X` - Cancelar convite
- `Clock` - Data de expiração
- `Calendar` - Datas de criação
- `RefreshCw` - Já usado, agora também mostra data de reenvio

**UI dos convites melhorada:**
- Layout expandido com mais informações
- displayName destacado (ou email se não houver nome)
- Badge de role com ícone e cor
- Datas formatadas (criação, reenvio, expiração)
- Botões de ação responsivos (texto em mobile, só ícone em desktop)

---

### Backend - Endpoints já existentes (reutilizados)

**5. `server/routes/company.routes.ts`**

**PATCH `/api/invitations/:id/resend`** (linha 455)
- Gera novo token UUID
- Atualiza `expires_at` (+7 dias)
- Atualiza `resent_at`
- Envia novo email
- Retorna convite atualizado

**PATCH `/api/invitations/:id/cancel`** (linha 519)
- Atualiza `status = 'cancelled'`
- Atualiza `cancelled_at` e `cancelled_by`
- Cancelamento lógico (não deleta)
- Retorna confirmação

---

## 7. Como validar manualmente

### Teste 1: Membership inválida via erro 403 do backend

**Setup:**
1. Login como usuário na Empresa 2
2. Abrir DevTools (Console)

**Ação:**
```sql
-- Desativar membership
UPDATE memberships SET is_active = false 
WHERE user_id = 5 AND company_id = 2;
```

**Validação (fazer qualquer request):**
```bash
# Tentar listar clientes (ou qualquer outra operação)
# Abrir tela de clientes no navegador
```

**Resultado esperado:**

1. **Request bloqueado imediatamente** (backend retorna 403)
2. **Console frontend:**
   ```
   ⚠️ [MEMBERSHIP] Empresa atual inválida detectada pelo backend: MEMBERSHIP_INACTIVE
   ⚠️ [AUTH] Membership invalidada pelo backend: { errorCode: "MEMBERSHIP_INACTIVE", ... }
   [APP] Evento force-access-pending recebido (erro backend). Forçando AccessPending...
   ```
3. **Toast aparece:** "Acesso à empresa removido"
4. **Redirecionamento automático** para Hall (`/acesso-pendente`)
5. **Hall mostra:**
   - Outras empresas ativas disponíveis (se houver)
   - OU mensagem "Você não tem acesso a nenhuma empresa"
6. **Menus da empresa antiga desaparecem**
7. **Cache limpo** (queries invalidadas)

**✅ Validação crítica:**
- Usuário **NÃO faz logout global**
- Token JWT continua válido
- Pode selecionar outra empresa do Hall (se disponível)

---

### Teste 2: Membership inválida via polling (30s)

**Setup:**
1. Login como usuário na Empresa 2
2. Aguardar sistema estabilizar

**Ação:**
```sql
UPDATE memberships SET is_active = false 
WHERE user_id = 5 AND company_id = 2;
```

**Validação:**
```bash
# Aguardar até 30 segundos (próximo polling de checkAuth)
```

**Resultado esperado:**

1. **Após até 30s:**
2. **Console frontend:**
   ```
   [AUTH] Revalidando sessão...
   ⚠️ [AUTH] Empresa atual ficou INVÁLIDA. Redirecionando para Hall...
   [APP] Evento company-invalidated recebido (polling). Forçando AccessPending...
   ```
3. **Toast:** "Acesso à empresa removido"
4. **Redirecionamento para Hall**
5. **Comportamento idêntico ao Teste 1**

---

### Teste 3: Reenviar convite pendente

**Setup:**
1. Login como Admin
2. Criar convite: POST `/api/company/invite`
   ```json
   {
     "email": "novo@teste.com",
     "role": "operador",
     "displayName": "Novo Usuário"
   }
   ```
3. Ir para tela "Gerenciamento de Usuários" → aba "Usuários"

**Ação:**
1. Localizar convite na seção "Convites Pendentes"
2. Clicar no botão **Reenviar** (ícone de papel de carta)

**Resultado esperado:**

1. **Toast:** "Convite reenviado com sucesso"
2. **Banco atualizado:**
   ```sql
   SELECT token, resent_at, expires_at 
   FROM invitations 
   WHERE email = 'novo@teste.com';
   -- token: novo UUID
   -- resent_at: timestamp atual
   -- expires_at: +7 dias da data atual
   ```
3. **Card do convite atualiza:**
   - Campo "Reenviado em: 11/04/2026" aparece
   - Campo "Expira em" atualizado
4. **Email enviado** (se configurado)

**✅ Validação:**
```sql
-- Verificar histórico de reenvios
SELECT resent_at, expires_at FROM invitations WHERE id = X;
```

---

### Teste 4: Cancelar convite pendente

**Setup:**
1. Ter convite pendente na lista

**Ação:**
1. Clicar no botão **Cancelar** (X vermelho)

**Resultado esperado:**

1. **Toast:** "Convite cancelado com sucesso"
2. **Convite desaparece da lista** de pendentes imediatamente
3. **Banco atualizado:**
   ```sql
   SELECT status, cancelled_at, cancelled_by 
   FROM invitations 
   WHERE email = 'novo@teste.com';
   -- status: 'cancelled'
   -- cancelled_at: timestamp atual
   -- cancelled_by: userId do admin
   ```
4. **Link do convite inválido:**
   ```bash
   # Se usuário tentar acessar /convite/{token}
   # Mensagem: "Este convite foi cancelado. Entre em contato com o administrador."
   ```

**✅ Validação crítica:**
- Registro **NÃO é deletado** do banco
- Apenas `status` muda para `'cancelled'`
- Filtro do backend não retorna convites cancelados

---

### Teste 5: Fluxo completo - membership inválida + convite

**Setup:**
1. Usuário tem membership ativa na Empresa A
2. Admin cria convite para Empresa B

**Cenário:**
1. **Aceitar convite** da Empresa B (usuário muda contexto para empresa B)
2. **Admin desativa** membership da empresa A (onde usuário estava antes)
3. **Usuário tenta voltar** para empresa A (via company switcher)

**Resultado esperado:**

1. Aceite do convite: ✅ Funciona, usuário entra na Empresa B
2. Desativação: ✅ Empresa A fica inativa no banco
3. Tentativa de trocar para Empresa A:
   - **Backend retorna 403 MEMBERSHIP_INACTIVE**
   - **Frontend detecta e redireciona para Hall**
   - **Hall não mostra** Empresa A na lista (membership inativa)
   - **Hall mostra** apenas Empresa B (única ativa)

---

## Resumo das garantias finais

### Segurança

✅ **Backend bloqueia imediatamente** qualquer request com membership inativa (0s de janela)  
✅ **Frontend não depende** apenas de polling (dupla proteção)  
✅ **Usuário não opera** em empresa inválida, nem temporariamente  
✅ **Sem logout global** quando apenas empresa fica inválida

### UX

✅ **Toast informativo** aparece quando empresa fica inválida  
✅ **Redirecionamento automático** para Hall  
✅ **Hall mostra empresas ativas** disponíveis  
✅ **Contexto preservado** (autenticação global mantida)  
✅ **Sem refresh manual** necessário

### Gestão administrativa

✅ **Convites pendentes** com informações completas  
✅ **Reenviar convite** renova token e expiração  
✅ **Cancelar convite** invalida link imediatamente  
✅ **Feedback visual claro** em todas as ações  
✅ **Lista atualiza automaticamente** após ações

---

## Documentação relacionada

- **`CORRECAO-AUTORIZACAO-EMPRESA-INATIVA.md`** - Middleware backend de validação
- **`VALIDACAO-SESSAO-INVALIDADA.md`** - Testes de revalidação periódica
- **`Arquitetura de Deploy — RotaFácil (Produção).md`** - Estrutura de containers

---

**Status:** ✅ Implementação completa  
**Validação:** Testes manuais obrigatórios antes de produção
