---
name: surgical-implementation
description: Use quando o pedido for criar ou ajustar uma funcionalidade, corrigir um comportamento localizado, melhorar UI sem refatoração ampla, alterar uma tela específica, endpoint específico, componente específico ou regra de negócio específica. Esta skill deve implementar apenas o necessário, preservando a arquitetura existente.
---

# Skill: surgical-implementation

## Objetivo
Fazer mudanças cirúrgicas, sem espalhar alterações desnecessárias pelo projeto.

## Processo obrigatório
1. Entender exatamente o que foi pedido.
2. Identificar o menor conjunto de arquivos necessário.
3. Reaproveitar componentes, hooks, helpers, patterns e estruturas já existentes.
4. Alterar somente o que estiver no escopo.
5. Explicar claramente onde foi mexido e por quê.
6. Sugerir validação final.

## Regras
- Não reestruturar projeto sem pedido explícito.
- Não trocar biblioteca, padrão ou arquitetura central.
- Não criar componente novo se já existir um compatível.
- Sempre usar o componente mais novo/oficial quando houver substituto aprovado.
- Em UI, manter o padrão do sistema: limpo, objetivo, funcional e consistente.
- Em lógica de negócio, preservar regras existentes do RotaFácil.

## Atenções específicas do RotaFácil
- Sempre considerar herança de técnicos quando houver equipe.
- Se a entidade aceitar técnico ou equipe, revisar os dois cenários.
- Não deixar estado vazando entre criação, edição e troca de tela.
- Manter logs em fluxos críticos quando aplicável.

## Formato da resposta
1. Resumo do pedido
2. Arquivos tocados
3. Alteração proposta
4. Antes e depois do trecho, quando útil
5. Como testar