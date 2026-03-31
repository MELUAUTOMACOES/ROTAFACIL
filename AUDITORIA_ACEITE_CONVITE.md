# 🔍 AUDITORIA COMPLETA - FLUXO DE ACEITE DE CONVITE

## 📊 EVIDÊNCIA DO PROBLEMA

**Estado do banco após teste real:**
```sql
-- invitations
email: meluautomacoes@gmail.com
company_id: 1
role: OPERADOR
status: pending  ← ❌ DEVERIA SER "accepted"

-- memberships
user_id: 26, company_id: 2, role: ADMINISTRATIVO, is_active: true  ← Empresa existente
-- ❌ FALTA: user_id: 26, company_id: 1, role: OPERADOR, is_active: true
```

**Conclusão objetiva:** O endpoint de aceite **NÃO está executando** ou **está falhando silenciosamente**.

---

## ✅ RESPOSTAS ÀS 10 PERGUNTAS

### 1. Qual página do frontend recebe o link do convite?

**Componente**: `client/src/pages/AcceptInvite.tsx`

**Rota configurada**: 
- `@/client/src/App.tsx:62` - `/convite/:token` (pública)
- `@/client/src/App.tsx:116` - `/convite/:token` (autenticada)

**URL esperada em produção**:
```
https://rotafacil.meluautomacao.com/convite/<TOKEN_DO_CONVITE>
```

**Formato do token**: 64 caracteres hexadecimais (gerado por `crypto.randomBytes(32).toString('hex')`)

---

### 2. Qual componente processa esse token?

**Arquivo**: `client/src/pages/AcceptInvite.tsx`

**Processamento**:

1. **Captura o token da URL** (linha 20):
   ```tsx
   const { token } = useParams<{ token: string }>();
   ```

2. **Valida o convite** ao montar (linhas 49-85):
   ```tsx
   useEffect(() => {
     const validateInvite = async () => {
       const response = await fetch(buildApiUrl(`/api/invitations/${token}`));
       // GET /api/invitations/:token (público)
       // Retorna: { invitation: {...}, hasAccount: true/false }
     }
   }, [token]);
   ```

3. **Exibe interface apropriada**:
   - Se `user` está logado + email corresponde → Botão "Aceitar Convite"
   - Se `user` está logado + email não corresponde → Aviso de incompatibilidade
   - Se `user` não está logado + `hasAccount: true` → Redireciona para login
   - Se `user` não está logado + `hasAccount: false` → Formulário de cadastro

---

### 3. Qual endpoint o frontend chama ao clicar em aceitar?

**Para usuário EXISTENTE e LOGADO** (seu caso):

**Função**: `acceptWithExistingAccount()` (linha 88)

**Endpoint**: 
```
POST /api/invitations/:token/accept-existing
```

**Implementação backend**: `server/routes/company.routes.ts:544`

**Requer autenticação**: ✅ SIM (`authenticateToken` middleware)

---

### 4. Método HTTP exato, URL exata e payload exato enviados

**Método**: `POST`

**URL completa em produção**:
```
https://api.meluautomacao.com/api/invitations/<TOKEN_DE_64_CHARS>/accept-existing
```

**Headers**:
```javascript
{
  "Authorization": "Bearer <JWT_TOKEN>",
  "Content-Type": "application/json"
}
```

**Body (payload)**:
```json
{
  "token": "<TOKEN_DE_64_CHARS>"
}
```

**Exemplo concreto** (com logs implementados):
```javascript
📤 [ACCEPT EXISTING] Request details:
   - Method: POST
   - URL: https://api.meluautomacao.com/api/invitations/abc123.../accept-existing
   - Headers: {Authorization: "Bearer eyJhbGc...", Content-Type: "application/json"}
   - Body: {"token":"abc123..."}
```

**⚠️ ATENÇÃO**: O token é enviado **DUAS VEZES**:
1. No path da URL (`:token` param)
2. No body do request

---

### 5. O backend realmente recebe essa chamada?

**RESPOSTA**: Com os logs implementados, agora é possível verificar.

**Se backend receber**, você verá:
```bash
========================================
🎫 [ACCEPT EXISTING] REQUEST RECEBIDO
========================================
📍 IP: <IP_DO_CLIENT>
📍 User-Agent: Mozilla/5.0...
📍 Token do params: <TOKEN>
📍 Body recebido: { token: '<TOKEN>' }
📍 User autenticado: { userId: 26, email: 'meluautomacoes@gmail.com', ... }
```

**Se backend NÃO receber**, possíveis causas:

1. **Rota não registrada**:
   - Arquivo: `server/routes.ts:5598`
   - Linha: `registerCompanyRoutes(app, authenticateToken);`
   - ✅ Confirmado: rota ESTÁ registrada

2. **URL incorreta** (VITE_API_URL):
   - Dev: usa proxy Vite → `/api/...` → `localhost:5000/api/...`
   - Prod: deve usar `VITE_API_URL` → `https://api.meluautomacao.com/api/...`
   - **Verifique**: variável de ambiente `VITE_API_URL` em produção

3. **CORS bloqueando**:
   - Se domínios diferentes: `rotafacil.meluautomacao.com` → `api.meluautomacao.com`
   - Backend deve permitir origin do frontend

4. **Token JWT inválido**:
   - Middleware `authenticateToken` rejeita antes de chegar no handler
   - Retorna 401 ou 403

---

### 6. Se recebe, em que validação ela falha?

**Ordem das validações no backend**:

1. **Autenticação** (`authenticateToken` middleware):
   - Verifica JWT no header `Authorization`
   - Se falhar: retorna 401

2. **Schema Zod** (linha 562):
   - Valida formato do body: `{ token: string }`
   - Se falhar: retorna 400 com "Dados inválidos"

3. **Busca convite no banco** (linha 572):
   - `storage.getInvitationByToken(data.token)`
   - Se não encontrar: retorna 400 "Convite não encontrado"

4. **Status do convite** (linha 590):
   - Verifica se `invitation.status === 'pending'`
   - Se já for 'accepted': retorna 400 "Este convite já foi utilizado"

5. **Data de expiração** (linha 596):
   - Verifica se `invitation.expiresAt < new Date()`
   - Se expirado: retorna 400 "Este convite expirou"

6. **Email corresponde** (linha 609):
   - Verifica se `invitation.email === req.user.email`
   - Se não: retorna 403 "Este convite não foi enviado para você"

7. **Membership existente** (linha 625):
   - Busca `storage.getMembership(userId, companyId)`
   - Se já existe: retorna 400 "Você já faz parte desta empresa"

8. **Criação da membership** (linha 647):
   - `storage.createMembership({ userId, companyId, role, isActive: true })`
   - Se falhar: erro 500

9. **Atualização do convite** (linha 667):
   - `storage.updateInvitationStatus(invitationId, 'accepted')`
   - Se falhar: erro 500

**Com logs implementados**, cada validação mostra se passou ou falhou.

---

### 7. Se não recebe, onde o frontend está quebrando?

**Possíveis pontos de falha no frontend**:

1. **buildApiUrl() incorreto**:
   - Arquivo: `client/src/lib/api-config.ts`
   - Se `VITE_API_URL` não está configurado em prod → retorna URL relativa `/api/...`
   - Isso funcionaria em dev (proxy), mas **FALHA em prod** se não houver proxy

2. **getAuthHeaders() sem token**:
   - Arquivo: `client/src/lib/auth.tsx`
   - Se `localStorage.getItem('token')` retornar null → request sem Authorization
   - Backend rejeita com 401

3. **Usuário não está realmente logado**:
   - Hook `useAuth()` retorna `user: null`
   - Componente não deveria mostrar botão "Aceitar Convite"
   - Mas se mostrar e clicar → request sem autenticação

4. **Network error**:
   - Fetch falha (CORS, DNS, timeout)
   - Cai no `catch` mas não exibe erro ao usuário

**Com logs implementados**, o console do navegador mostra:
- ✅ Se request foi montado
- ✅ Se foi enviado
- ✅ Qual status recebeu
- ❌ Se teve erro

---

### 8. Se há erro no request, por que a interface permite parecer que aceitou?

**RESPOSTA**: Não deveria.

**Código implementado no frontend** (`AcceptInvite.tsx:122-150`):

```tsx
if (!response.ok) {
  console.error('❌ [ACCEPT EXISTING] Erro no aceite:', data.message);
  throw new Error(data.message || "Erro ao aceitar convite");
}

// Se chegou aqui, sucesso confirmado
console.log('✅ [ACCEPT EXISTING] Convite aceito com sucesso!');

toast({
  title: "✅ Convite aceito!",
  description: `Você agora faz parte de ${inviteData.invitation.company.name}`,
});

// Redireciona após 1 segundo
setTimeout(() => {
  setLocation("/");
}, 1000);
```

**Se mostrar "sucesso" mas banco não mudou**:
- Backend retornou 200 OK
- Mas `createMembership()` ou `updateInvitationStatus()` **falharam silenciosamente**
- Possível rollback de transaction sem exception

**Com logs implementados**, o backend mostra:
```bash
✅ [ACCEPT EXISTING] MEMBERSHIP CRIADA COM SUCESSO!
✅ [ACCEPT EXISTING] CONVITE ATUALIZADO COM SUCESSO!
✅ [ACCEPT EXISTING] PROCESSO CONCLUÍDO COM SUCESSO!
```

Se esses logs aparecem mas banco não muda → problema no ORM/banco.

---

### 9. Se existe redirecionamento automático mascarando falha

**RESPOSTA**: Sim, existe redirecionamento, mas **APENAS após sucesso confirmado**.

**Fluxo implementado**:

1. Usuário clica "Aceitar Convite"
2. Frontend envia request
3. Aguarda response
4. **SE response.ok**:
   - Mostra toast de sucesso
   - Aguarda 1 segundo
   - Redireciona para `/`
5. **SE !response.ok**:
   - Mostra toast de erro
   - NÃO redireciona

**Problema possível**:
- Se backend retornar 200 OK **antes** de salvar no banco
- Response é considerado sucesso
- Redirecionamento acontece
- Mas banco não foi atualizado

**Com logs implementados**, é possível ver:
```bash
✅ [ACCEPT EXISTING] MEMBERSHIP CRIADA COM SUCESSO!
   - Membership ID: <ID_CRIADO>
✅ [ACCEPT EXISTING] CONVITE ATUALIZADO COM SUCESSO!
   - Novo status: accepted
📤 [ACCEPT EXISTING] Enviando resposta para o frontend...
```

Se esses logs aparecem → banco DEVERIA estar atualizado.

---

### 10. Se o fluxo de produção está diferente do dev por causa da URL/link

**RESPOSTA**: Provavelmente SIM.

**Diferenças Dev vs Prod**:

| Item | Dev (localhost) | Prod (servidor) |
|------|-----------------|-----------------|
| Frontend URL | `http://localhost:5173` | `https://rotafacil.meluautomacao.com` |
| Backend URL | `http://localhost:5000` | `https://api.meluautomacao.com` |
| API calls | `/api/...` (proxy Vite) | `https://api.meluautomacao.com/api/...` |
| VITE_API_URL | ❌ Não definido (usa proxy) | ✅ DEVE estar definido |
| Link do convite | `http://localhost:5173/convite/...` | `https://rotafacil.meluautomacao.com/convite/...` |

**⚠️ PONTO CRÍTICO: VITE_API_URL**

**Arquivo**: `client/src/lib/api-config.ts`

```typescript
export function getApiBaseUrl(): string {
    const envUrl = import.meta.env.VITE_API_URL;

    if (envUrl && typeof envUrl === 'string' && envUrl.trim() !== '') {
        return envUrl.trim().replace(/\/+$/, '');
    }

    // Em dev, retornar vazio para usar proxy do Vite
    return '';  // ← Em prod SEM VITE_API_URL, isso QUEBRA
}
```

**Se `VITE_API_URL` não está definido em produção**:
- `getApiBaseUrl()` retorna `''`
- `buildApiUrl('/api/invitations/...')` retorna `/api/invitations/...`
- Browser tenta: `https://rotafacil.meluautomacao.com/api/invitations/...`
- **MAS backend está em**: `https://api.meluautomacao.com/api/invitations/...`
- Request vai para lugar errado → 404

**Como verificar**:
1. Abra console do navegador em produção
2. Digite: `console.log(import.meta.env.VITE_API_URL)`
3. Deve retornar: `"https://api.meluautomacao.com"`
4. Se retornar `undefined` → **PROBLEMA ENCONTRADO**

---

## 🎯 CAUSA RAIZ MAIS PROVÁVEL

Baseado nas evidências:

**HIPÓTESE PRINCIPAL**: URL da API incorreta em produção

1. `VITE_API_URL` não está configurado no build de produção
2. Frontend tenta chamar: `https://rotafacil.meluautomacao.com/api/invitations/...`
3. Não existe backend nessa URL
4. Request falha com 404
5. Usuário vê erro (ou interface congela)
6. Banco nunca é atualizado

**Como confirmar**:
- Abrir DevTools → Network
- Clicar "Aceitar Convite"
- Ver URL exata do request
- Ver status code (se 404 = URL errada)

**Solução**:
```bash
# No build de produção, definir:
VITE_API_URL=https://api.meluautomacao.com
```

---

## 📋 CHECKLIST DE VERIFICAÇÃO IMEDIATA

Execute em produção:

### 1. Variável de ambiente
```bash
# No servidor frontend
echo $VITE_API_URL
# Deve retornar: https://api.meluautomacao.com
```

### 2. Console do navegador
```javascript
// Em https://rotafacil.meluautomacao.com
console.log(import.meta.env.VITE_API_URL);
// Deve retornar: "https://api.meluautomacao.com"
```

### 3. Network tab
```
1. Abrir DevTools → Network
2. Clicar "Aceitar Convite"
3. Verificar request POST
4. URL deve ser: https://api.meluautomacao.com/api/invitations/.../accept-existing
5. Status deve ser: 200 (não 404, não 401)
```

### 4. Console do servidor
```bash
# Logs do backend em tempo real
# Deve aparecer:
========================================
🎫 [ACCEPT EXISTING] REQUEST RECEBIDO
========================================
```

---

## 🔧 PRÓXIMOS PASSOS

1. **Deploy do código com logs** ✅ (já implementado)

2. **Verificar VITE_API_URL** ⚠️
   - Se não está configurado → **CONFIGURAR AGORA**
   - Rebuild do frontend
   - Redeploy

3. **Criar novo convite**
   - Deletar convite antigo
   - Criar novo via interface
   - Anotar token gerado

4. **Executar teste conforme `INSTRUCOES_DEBUG_CONVITE.md`**
   - Abrir DevTools **ANTES** de clicar
   - Registrar TODOS os logs
   - Copiar evidências

5. **Analisar logs**
   - Se backend não recebeu → problema de URL/CORS
   - Se backend recebeu mas falhou → analisar validação específica
   - Se backend sucedeu mas banco não mudou → problema no ORM

---

## 📊 FORMATO DE RESPOSTA ESPERADO

Após executar o teste, responda:

```markdown
**VITE_API_URL em produção**: <valor ou undefined>

**Request enviado pelo frontend**:
- URL: <URL_EXATA>
- Status: <CODE>
- Headers: <HEADERS>

**Backend recebeu?**: Sim / Não

**Se recebeu, última linha de log**: <LOG>

**Banco após teste**:
- invitations.status: <STATUS>
- memberships criada: Sim / Não
```

Com essas informações, será possível identificar o problema com 100% de certeza.
