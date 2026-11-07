---
name: buscar-skill
description: Buscador de skills - encontra a skill certa para um comando ou tarefa (nas skills deste repo, nas já instaladas e no catálogo skills.sh) e instala no Claude Code após confirmação. Use quando o usuário disser /buscar-skill, "buscar skill", "tem skill para...", "instalar skill", "preciso de uma skill que...", ou pedir algo que nenhuma skill instalada cobre.
argument-hint: "<comando ou tarefa> | instalar <owner/repo@skill> [-g] | instaladas"
---

# Buscar skill

O script fica em `scripts/skill-finder.mjs` na raiz deste repositório (`<repo>` abaixo).

1. **Buscar.** Rode `node <repo>/scripts/skill-finder.mjs buscar <o que o usuário pediu> --json`. Termos em PT-BR já são traduzidos para o catálogo. Se vier pouco, tente de novo com 1 ou 2 palavras-chave em inglês.
2. **Responder curto.** Primeiro o que já está disponível (`local`): diga o comando `/nome` e pronto, não instale nada. Depois até 5 do catálogo (`remote`): `owner/repo@skill`, instalações, link. Recomende uma: a mais instalada que bate com o pedido, de autor conhecido quando houver empate.
3. **Confirmar antes de instalar.** Instalar baixa código de terceiros: pergunte qual e se é para este projeto ou global (`-g`). Sem "sim" claro, não instale.
4. **Instalar.** `node <repo>/scripts/skill-finder.mjs instalar <owner/repo@skill> [-g]`. Depois leia o `SKILL.md` instalado (`.claude/skills/<skill>/` ou `~/.claude/skills/<skill>/`), resuma em 2 linhas o que ela faz e avise se ela pede chaves de API ou ferramentas extras. Se não aparecer na lista de skills, peça para reiniciar a sessão.

`instaladas` lista o que já está disponível. Nunca remova skills sem pedido explícito.
