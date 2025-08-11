# Aplicativo de Gerenciamento de Agendamentos

## Overview
Este projeto é um aplicativo de gerenciamento de agendamentos desenvolvido com React e `react-big-calendar`, focado em agendamento de eventos e visualização. A aplicação visa otimizar rotas de atendimento, fornecer uma interface de usuário intuitiva e gerenciar eficientemente as operações de campo. As funcionalidades incluem otimização de rotas com OR-Tools (Google), geocodificação robusta, e um sistema abrangente para gerenciamento de técnicos, equipes e agendamentos, incluindo a definição de endereços de início para roteirização e cálculo preciso de tempos e distâncias.

## User Preferences
- Comunicação em português
- Foco apenas no que foi solicitado, sem alterações adicionais
- Implementação direta sem complicações desnecessárias

## System Architecture
O aplicativo é construído com uma arquitetura moderna e escalável, utilizando as seguintes tecnologias e padrões:

-   **Frontend**: React com TypeScript, utilizando Wouter para roteamento. A estilização é feita com Tailwind CSS e os componentes UI são baseados em shadcn/ui. Para gerenciamento de formulários, usa-se react-hook-form com validação Zod. O estado do servidor é gerenciado por TanStack Query.
-   **Backend**: Express.js com autenticação JWT.
-   **Banco de dados**: PostgreSQL com Drizzle ORM.
-   **Otimização de Rotas**: Integração com OR-Tools (Google) para resolução do Problema do Caixeiro Viajante (TSP) e OSRM para matrizes de distância e duração.
-   **Estrutura de Dados**:
    -   **`routes`**: Tabela para armazenar rotas otimizadas, incluindo título, data, veículo, responsável, distância/duração total, número de paradas, status (draft, optimized, running, done, canceled) e o GeoJSON da polilinha.
    -   **`routeStops`**: Tabela para armazenar as paradas ordenadas de uma rota, com referência ao agendamento, ordem da parada, coordenadas e endereço formatado.
-   **Design de UI/UX**:
    -   Interface de calendário responsiva e interativa.
    -   Utilização de Shadcn/UI para componentes, garantindo um visual limpo e moderno.
    -   Layout flexível e responsivo para cards, especialmente na tela de otimização de rotas, com alturas simétricas e scroll interno para listas extensas.
    -   Indicadores visuais claros para estados de carregamento (spinners) e avisos.
    -   Consistência visual nas cores (azul para distância, verde para tempo) e formatação (km/min).
    -   Inclusão de funcionalidades de UX como checkbox "Terminar no ponto inicial" para controle de rotas circulares vs. abertas, com descrições contextuais.
-   **Geocodificação e Endereços**:
    -   Sistema robusto de geocodificação para validação e preenchimento automático de endereços (CEP, logradouro, bairro, cidade, estado).
    -   Definição de endereços de início para roteirização (priorizando técnico/equipe sobre o endereço da empresa) com fallback automático.
    -   Campos de endereço padronizados e validados para técnicos e dados da empresa.
-   **Logging**: Sistema de logs detalhados para depuração do backend, com formatação padronizada e informações específicas por endpoint.

## External Dependencies
-   **react-big-calendar**: Para exibição e gerenciamento de calendários e eventos.
-   **Tailwind CSS**: Framework de CSS para estilização.
-   **shadcn/ui**: Biblioteca de componentes de interface de usuário.
-   **Wouter**: Biblioteca de roteamento para React.
-   **react-hook-form**: Para gerenciamento de formulários.
-   **Zod**: Para validação de esquemas de dados.
-   **TanStack Query**: Para gerenciamento de estado do servidor.
-   **Express.js**: Framework de backend para Node.js.
-   **PostgreSQL**: Sistema de gerenciamento de banco de dados relacional.
-   **Drizzle ORM**: ORM para interagir com o banco de dados.
-   **OR-Tools (Google)**: Biblioteca para otimização, usada para resolver o Problema do Caixeiro Viajante (TSP) na otimização de rotas.
-   **OSRM (Open Source Routing Machine)**: Utilizado para calcular matrizes de distância e duração entre pontos para a otimização de rotas.
-   **JWT (JSON Web Tokens)**: Para autenticação de usuários.

## Recent Changes

### 11 de agosto de 2025 - Endpoints de Otimização e Histórico de Rotas

**Funcionalidade implementada**: Sistema completo de endpoints backend para otimização automática e gerenciamento de histórico de rotas

**Endpoints criados**:

1. **POST /api/routes/optimize** - Otimização automática de rotas:
   - Recebe: `appointmentIds[]`, `endAtStart`, `responsibleType`, `responsibleId`, `vehicleId`, `title`
   - Busca agendamentos com coordenadas do banco
   - Calcula matriz de distâncias/tempos via OSRM
   - Resolve TSP com algoritmo Nearest Neighbor + 2-opt
   - Gera polyline GeoJSON para visualização
   - Salva rota e paradas no banco automaticamente
   - Retorna rota completa com paradas ordenadas

2. **GET /api/routes** - Listagem com filtros avançados:
   - Filtros: `from`, `to`, `status`, `responsibleType`, `responsibleId`, `vehicleId`, `search`
   - Ordenação por data de criação (mais recente primeiro)
   - Retorna lista paginada para tabela de histórico

3. **GET /api/routes/:id** - Detalhes de rota específica:
   - Retorna cabeçalho completo da rota + paradas ordenadas
   - Inclui polylineGeoJson para exibição no mapa
   - Compatível com drawer de visualização do frontend

**Algoritmos implementados**:
- **TSP Solver nativo**: Nearest Neighbor + 2-opt em JavaScript puro
- **Integração OSRM**: Reutiliza helpers existentes (`getOsrmUrl()`)
- **Matriz de distâncias**: `/table/v1/driving` com annotations
- **Polyline generation**: `/route/v1/driving` com geometries GeoJSON

**Arquivos criados**:
- **server/routes/routes.api.ts**: Endpoints isolados com logs detalhados
- **Middleware de autenticação**: Compatível com modo DEV
- **Validação Zod**: Schemas robustos para entrada de dados

**Integração com sistema existente**:
- Registrado em `server/routes.ts` via import dinâmico
- Reutiliza funções OSRM existentes (`getOsrmUrl`, matriz, route)
- Compatível com formato de resposta do frontend atual
- Logs padronizados seguindo padrão existente

**Resultado**: Sistema completo de otimização backend pronto para integração com interface de histórico e automação

### 11 de agosto de 2025 - Criação das Tabelas de Rotas com Drizzle

**Funcionalidade implementada**: Criação das tabelas `routes` e `routeStops` para salvar rotas otimizadas

**Tabelas criadas**:

1. **Tabela `routes`** (rotas principais):
   - `id`: UUID primário com geração automática
   - `title`: Título da rota (varchar 120 chars)
   - `date`: Data da rota (timestamp sem timezone)
   - `vehicleId`: ID do veículo (varchar 64 chars, opcional)
   - `responsibleType`: Tipo do responsável - 'technician' ou 'team' (varchar 16 chars)
   - `responsibleId`: ID do responsável (varchar 64 chars)
   - `endAtStart`: Terminar no ponto inicial (boolean, padrão false)
   - `distanceTotal`: Distância total em metros (integer, padrão 0)
   - `durationTotal`: Duração total em segundos (integer, padrão 0)
   - `stopsCount`: Número de paradas (integer, padrão 0)
   - `status`: Status da rota - draft|optimized|running|done|canceled (varchar 24, padrão 'optimized')
   - `polylineGeoJson`: GeoJSON LineString para visualização (jsonb)
   - `createdAt`, `updatedAt`: Timestamps automáticos

2. **Tabela `routeStops`** (paradas ordenadas):
   - `id`: UUID primário com geração automática
   - `routeId`: Referência para routes.id (UUID, obrigatório)
   - `appointmentId`: ID do agendamento (UUID, obrigatório)
   - `order`: Ordem da parada na rota (integer, obrigatório)
   - `lat`, `lng`: Coordenadas latitude/longitude (doublePrecision)
   - `address`: Endereço formatado (text)

**Arquivos modificados**:
- **shared/schema.ts**: 
  - Adicionadas importações: `uuid`, `jsonb`, `doublePrecision`, `varchar`, `relations`
  - Criadas tabelas `routes` e `routeStops` com relacionamento
  - Adicionados schemas de inserção `insertRouteSchema` e `insertRouteStopSchema`
  - Adicionados tipos TypeScript `Route`, `InsertRoute`, `RouteStop`, `InsertRouteStop`

**Migração aplicada**:
- Executado `npx drizzle-kit push` com sucesso
- Tabelas criadas no banco PostgreSQL/Supabase

**Resultado**: Base de dados preparada para salvar e gerenciar rotas otimizadas com suporte a CSV/GeoJSON futuro