# Ajuste de Timezone - São Paulo (UTC-3)

## Problema Identificado

Ao criar um romaneio com data de 26-02-2026 às 23:01 (horário de São Paulo), o romaneio não aparecia na tela de prestadores. Ao alterar para 27-02-2026, o romaneio aparecia normalmente.

**Causa raiz:** O sistema estava usando UTC para comparações de data. Às 23:01 em São Paulo (UTC-3), já são 02:01 do dia seguinte em UTC, causando a discrepância.

## Solução Implementada

### 1. Novo Helper de Timezone (`server/timezone-helper.ts`)

Criado arquivo com funções utilitárias para trabalhar com timezone de São Paulo (UTC-3):

- `toSaoPauloTime(date)` - Converte UTC para São Paulo
- `nowInSaoPaulo()` - Retorna data/hora atual em São Paulo
- `getDateInSaoPaulo(date)` - Retorna string YYYY-MM-DD em São Paulo
- `formatDateForSQLComparison(date)` - Formata data para comparação SQL
- `getDayBoundsInSaoPaulo(date)` - Retorna início e fim do dia em São Paulo

### 2. Endpoints Ajustados

#### 2.1 GET `/api/provider/route` (`server/routes.ts`)
- Alterado para usar `nowInSaoPaulo()` ao buscar rota do dia
- Afeta: Tela de prestadores ao carregar romaneio do dia

#### 2.2 GET `/api/provider/active-today` (`server/routes.ts`)
- Ajustada query SQL para considerar timezone de São Paulo
- Usa: `DATE(routes.date AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo')`
- Afeta: Dropdown de seleção de rotas na tela de prestadores (admin)

#### 2.3 Método `getProviderActiveRoute` (`server/storage.ts`)
- Ajustada comparação de data para usar timezone de São Paulo
- Usa: `formatDateForSQLComparison(date)` + conversão de timezone no SQL
- Afeta: Busca de rota ativa do prestador logado

#### 2.4 GET `/api/dashboard/critical-alerts` (`server/routes/dashboard.routes.ts`)
- Ajustado cálculo de "hoje" para usar `nowInSaoPaulo()`
- Ajustada comparação de data de rotas para usar timezone de São Paulo
- Afeta: Alertas de rotas não iniciadas no dashboard

## Queries SQL Utilizadas

Para comparar datas considerando o timezone de São Paulo, utilizamos:

```sql
DATE(routes.date AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') = '2026-02-26'
```

Isso garante que:
- O timestamp armazenado em UTC seja convertido para São Paulo
- A comparação seja feita com base no dia em São Paulo, não em UTC

## Comportamento Esperado

### Antes do Ajuste
- Às 23:01 em São Paulo (26/02): Sistema considerava 27/02 (UTC)
- Romaneio de 26/02 não aparecia

### Depois do Ajuste
- Às 23:01 em São Paulo (26/02): Sistema considera 26/02 (São Paulo)
- Romaneio de 26/02 aparece normalmente até 23:59:59 de São Paulo

## Como Testar

1. **Criar um romaneio** (rota) para hoje
2. **Acessar a tela de prestadores** após 21:00 (horário de São Paulo)
3. **Verificar se o romaneio aparece** mesmo próximo à meia-noite
4. **Testar alertas do dashboard** para rotas confirmadas não iniciadas

## Nota Importante

⚠️ **Horário de Verão**: A solução atual usa UTC-3 fixo. O Brasil não tem mais horário de verão desde 2019, mas caso seja necessário no futuro, seria preciso usar uma biblioteca como `date-fns-tz` ou `luxon` com timezone `America/Sao_Paulo` que lida automaticamente com DST.

## Arquivos Modificados

1. ✅ `server/timezone-helper.ts` (novo)
2. ✅ `server/routes.ts`
3. ✅ `server/storage.ts`
4. ✅ `server/routes/dashboard.routes.ts`

## Impacto

- ✅ Tela de prestadores agora mostra romaneios corretamente no horário de São Paulo
- ✅ Dashboard de alertas considera horário de São Paulo
- ✅ Busca de rotas ativas considera horário de São Paulo
- ✅ Sem impacto em agendamentos (continuam usando timestamps completos)
