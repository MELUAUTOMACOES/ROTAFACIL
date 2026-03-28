---
name: crud-flow-review
description: Use quando a tarefa envolver cadastro, edição, listagem, filtros, importação CSV, exportação CSV, autocomplete, vínculo entre entidades ou fluxos de clientes, técnicos, equipes, veículos, serviços e agendamentos. Esta skill deve revisar a consistência funcional do fluxo completo.
---

# Skill: crud-flow-review

## Objetivo
Garantir que o fluxo completo funcione de ponta a ponta, não apenas um campo isolado.

## Entidades foco
- clientes
- técnicos
- equipes
- veículos
- serviços
- agendamentos
- histórico/rotas quando houver vínculo com essas entidades

## Processo obrigatório
1. Revisar o front envolvido.
2. Revisar endpoint e validação do back.
3. Revisar storage/schema se necessário.
4. Verificar obrigatoriedade de campos.
5. Verificar mensagens de erro.
6. Verificar limpeza do formulário ao criar novo registro.
7. Verificar edição, listagem e filtro.
8. Verificar autocomplete e busca.
9. Verificar logs em submits e erros.
10. Verificar impacto em multiempresa.

## Regras do RotaFácil
- Sempre considerar herança de técnicos quando houver equipe.
- Se o fluxo aceitar técnico/equipe, filtros e cards devem funcionar para ambos.
- CSV deve seguir o modelo atualizado do projeto.
- CPF e regras de unicidade devem respeitar o padrão atual por empresa, quando aplicável.
- Não deixar front mostrando uma coisa e back salvando outra.

## Formato da resposta
1. Fluxo analisado
2. Ponto quebrado ou risco encontrado
3. Onde ajustar
4. Impacto no front/back/schema/storage
5. Como validar com teste manual