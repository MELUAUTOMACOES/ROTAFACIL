# Sistema de Disponibilidade e Validação Técnico/Equipe

## 📋 Visão Geral

Este documento descreve o sistema de disponibilidade diária e validação de conflitos entre técnicos e equipes implementado no Rota Fácil.

## 🗄️ Estrutura do Banco de Dados

### Tabela `daily_availability`

Armazena a disponibilidade calculada por dia e responsável (técnico ou equipe) para consultas rápidas.

```sql
CREATE TABLE "daily_availability" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL REFERENCES "users"("id"),
  "date" TIMESTAMP NOT NULL,
  "responsible_type" VARCHAR(16) NOT NULL, -- 'technician' | 'team'
  "responsible_id" INTEGER NOT NULL,
  "total_minutes" INTEGER NOT NULL DEFAULT 0,
  "used_minutes" INTEGER NOT NULL DEFAULT 0,
  "available_minutes" INTEGER NOT NULL DEFAULT 0,
  "appointment_count" INTEGER NOT NULL DEFAULT 0,
  "status" VARCHAR(16) NOT NULL DEFAULT 'available',
  "updated_at" TIMESTAMP DEFAULT NOW() NOT NULL,
  "created_at" TIMESTAMP DEFAULT NOW() NOT NULL
);
```

### Campos

- **user_id**: ID do usuário (multi-tenant)
- **date**: Data do dia (sem hora)
- **responsible_type**: Tipo do responsável (`'technician'` ou `'team'`)
- **responsible_id**: ID do técnico ou equipe
- **total_minutes**: Total de minutos disponíveis no dia (baseado em horário de trabalho)
- **used_minutes**: Minutos já utilizados em agendamentos
- **available_minutes**: Minutos ainda disponíveis
- **appointment_count**: Quantidade de agendamentos no dia
- **status**: Status da disponibilidade
  - `'available'`: Completamente disponível (0% usado)
  - `'partial'`: Parcialmente ocupado (< 100%)
  - `'full'`: Completamente ocupado (100%)
  - `'exceeded'`: Excedeu o horário (> 100%)

### Índices

- `idx_daily_availability_user_date`: Consultas por usuário e data
- `idx_daily_availability_responsible`: Consultas por tipo e ID do responsável
- `idx_daily_availability_date`: Consultas por data
- `idx_daily_availability_unique`: Índice único composto (evita duplicatas)

## 🔧 Funções do Sistema

### 1. `updateDailyAvailability()`

**Arquivo**: `server/availability-helpers.ts`

Calcula e atualiza a disponibilidade para um dia específico e responsável.

**Parâmetros**:
- `userId`: ID do usuário
- `date`: Data do dia
- `responsibleType`: `'technician'` ou `'team'`
- `responsibleId`: ID do técnico ou equipe

**Processo**:
1. Busca regras de negócio (horário de trabalho)
2. Calcula total de minutos disponíveis no dia
3. Busca todos os agendamentos do dia para o responsável
4. Calcula minutos usados (considerando agendamentos "dia inteiro")
5. Determina status (available, partial, full, exceeded)
6. Insere ou atualiza registro na tabela `daily_availability`

### 2. `validateTechnicianTeamConflict()`

**Arquivo**: `server/availability-helpers.ts`

Valida se um técnico ou equipe pode ter agendamento em determinado dia.

**Regra de Negócio**:
> Se um técnico faz parte de uma equipe e a equipe tem agendamento no dia, o técnico NÃO pode ter agendamento individual.
> 
> Se um técnico tem agendamento individual, nenhuma equipe que ele faça parte pode ter agendamentos no mesmo dia.

**Parâmetros**:
- `userId`: ID do usuário
- `date`: Data do agendamento
- `technicianId`: ID do técnico (ou null)
- `teamId`: ID da equipe (ou null)
- `excludeAppointmentId`: ID do agendamento a excluir da validação (para updates)

**Retorno**:
```typescript
{
  valid: boolean;
  message?: string;
}
```

**Casos Validados**:

#### Caso 1: Criando agendamento para TÉCNICO individual
- Verifica se o técnico faz parte de alguma equipe
- Se sim, verifica se essas equipes têm agendamentos no dia
- Se houver conflito, retorna erro com nome da equipe

#### Caso 2: Criando agendamento para EQUIPE
- Busca todos os técnicos da equipe
- Verifica se algum técnico tem agendamento individual no dia
- Se houver conflito, retorna erro com nome do técnico

### 3. `updateAvailabilityForAppointment()`

**Arquivo**: `server/availability-helpers.ts`

Atualiza disponibilidade para todos os responsáveis afetados por um agendamento.

**Parâmetros**:
- `userId`: ID do usuário
- `appointment`: Dados do agendamento

**Processo**:
1. Atualiza disponibilidade do técnico (se houver)
2. Atualiza disponibilidade de todas as equipes que o técnico faz parte
3. Atualiza disponibilidade da equipe (se houver)
4. Atualiza disponibilidade de todos os técnicos da equipe

## 🔗 Integração nas Rotas

### POST `/api/appointments`

1. Valida dados com Zod
2. **Valida conflito técnico/equipe** ⚠️
3. Cria agendamento
4. **Atualiza disponibilidade**
5. Retorna agendamento criado

### POST `/api/appointments/import`

Para cada agendamento:
1. Cria cliente se necessário
2. Valida dados
3. **Valida conflito técnico/equipe** ⚠️
4. Cria agendamento
5. **Atualiza disponibilidade**

### PATCH `/api/appointments/:id`

1. Busca agendamento original
2. Se mudou técnico, equipe ou data: **valida conflito** ⚠️
3. Atualiza agendamento
4. Se mudou data: atualiza disponibilidade da data antiga
5. **Atualiza disponibilidade da nova data/responsável**

### DELETE `/api/appointments/:id`

1. Busca agendamento antes de deletar
2. Deleta agendamento
3. **Atualiza disponibilidade** (marca como disponível novamente)

### GET `/api/daily-availability`

Consulta disponibilidade com filtros opcionais:
- `startDate`: Data inicial
- `endDate`: Data final
- `responsibleType`: Tipo do responsável
- `responsibleId`: ID do responsável

**Exemplo**:
```
GET /api/daily-availability?startDate=2025-01-01&endDate=2025-01-31&responsibleType=technician&responsibleId=5
```

## 📊 Uso no Frontend

### Componente `AvailabilityCalendar`

**Arquivo**: `client/src/components/AvailabilityCalendar.tsx`

Calcula disponibilidade em tempo real baseado em:
- Agendamentos existentes
- Duração dos serviços
- Horário de trabalho (business rules)
- Agendamentos "dia inteiro"

**Não consulta** a tabela `daily_availability` diretamente, mas o cálculo é idêntico ao que é armazenado no banco.

### Futuro: Integração com API

A tabela `daily_availability` está pronta para ser consultada via API:

```typescript
// Exemplo de consulta
const response = await fetch(
  '/api/daily-availability?startDate=2025-01-01&endDate=2025-01-31',
  { headers: getAuthHeaders() }
);
const availability = await response.json();
```

Isso permite:
- Consultas rápidas sem recalcular
- Dashboards de disponibilidade
- Relatórios de utilização
- Análises de produtividade

## ⚙️ Manutenção e Consistência

### Quando a disponibilidade é atualizada?

✅ Ao **criar** um agendamento
✅ Ao **editar** um agendamento (mudou data/responsável)
✅ Ao **deletar** um agendamento
✅ Ao **importar** agendamentos via CSV

### Recalcular disponibilidade manualmente

Se necessário recalcular disponibilidade de um período:

```typescript
import { updateDailyAvailability } from './server/availability-helpers';

// Para cada dia e responsável
await updateDailyAvailability(userId, date, 'technician', technicianId);
```

## 🚨 Mensagens de Erro

### Conflito Técnico → Equipe

```
O técnico faz parte da equipe "Equipe A" que já possui agendamentos neste dia. 
Apenas um pode ter agendamentos no mesmo dia.
```

### Conflito Equipe → Técnico

```
O técnico "João Silva" da equipe já possui agendamentos individuais neste dia. 
Apenas um pode ter agendamentos no mesmo dia.
```

## 🔍 Logs e Debugging

Todos os processos geram logs detalhados:

```
📊 [AVAILABILITY] Atualizando disponibilidade para technician #5 em 2025-01-15
✅ [AVAILABILITY] Atualizado: partial - 240/480 minutos

🔍 [VALIDATION] Validando conflito técnico/equipe para 2025-01-15
✅ [VALIDATION] Sem conflitos técnico/equipe
```

## 📝 Migration

Para aplicar a nova tabela no banco:

```bash
pnpm db:push
```

Ou execute manualmente o arquivo:
```
migrations/0009_create_daily_availability.sql
```

## 🎯 Benefícios

1. **Performance**: Consultas rápidas de disponibilidade sem recalcular
2. **Consistência**: Dados sempre atualizados automaticamente
3. **Validação**: Previne conflitos técnico/equipe
4. **Escalabilidade**: Pronto para dashboards e relatórios
5. **Multi-tenant**: Isolamento por usuário garantido

## ⚠️ Observações Importantes

- A tabela é **atualizada automaticamente** a cada operação de agendamento
- **Não** é necessário chamar manualmente as funções de atualização
- A validação **bloqueia** criação/edição de agendamentos conflitantes
- Agendamentos "dia inteiro" consomem **toda** a disponibilidade do dia
- A regra se aplica ao **dia inteiro**, não por horário específico
