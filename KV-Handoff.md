# Synth KV Handoff

Interpretei "KV" como um handoff visual para voce reproduzir a identidade do produto em outra ferramenta.

Arquivos entregues:

- `KV-Handoff.html`: visual lado a lado da versao branca e da versao preta.
- `kv-tokens.json`: tokens de marca e tokens de UI para light/dark.

## Essencia visual

O produto mistura tres coisas ao mesmo tempo:

- documentacao estruturada
- whiteboard com grid pontilhado
- marca com glow ciano + violeta

A interface nao usa glow em tudo. O brilho fica no background e nos estados ativos. O restante deve parecer vidro, leve, limpo e premium.

## Versao branca

Leitura visual:

- base clara com fundo `#EEF3FB`
- superficies em vidro branco translucidado
- texto principal em `#0F172A`
- glow muito leve com azul claro e lilas
- contraste suave, mais editorial do que futurista

Quando portar para outra ferramenta:

- use gradientes atmosfericos, nao blocos chapados
- deixe o painel de documentacao levemente rotacionado
- deixe o painel do whiteboard sobreposto e com grid pontilhado
- preserve bastante area vazia ao redor da composicao

## Versao preta

Leitura visual:

- base grafite profunda com fundo `#030712`
- superficies em vidro escuro
- texto principal em `#F8FAFC`
- glow mais presente em ciano e violeta
- contraste alto, mais nitido e tecnologico

Quando portar para outra ferramenta:

- mantenha o mesmo layout da versao branca
- aumente a separacao entre borda, glow e painel
- evite cinza puro; use azul-noite e grafite
- use o brilho da marca para dar profundidade, nao para poluir a tela

## Cores de marca

Vindas do `figmadoc/public/favicon.svg`:

- ciano: `#47BFFF`
- violeta: `#7E14FF`
- violeta suave: `#863BFF`
- lilas de glow: `#EDE6FF`

## Estrutura recomendada do KV

Use proporcao `16:9` com esta hierarquia:

1. bloco textual com nome da marca e frase curta
2. faixa ou dock superior em vidro
3. card de documentacao
4. card de whiteboard
5. glow no fundo e grid no canvas

## Prompts prontos

Versao branca:

```text
Create a 16:9 key visual for Synth, a documentation plus whiteboard product. Use a calm white interface with pale blue and lilac atmospheric gradients, frosted glass panels, subtle dotted grid, dark slate typography, and a cyan-violet glow inspired by the logo. Show a split composition with a documentation card on the left and a whiteboard card on the right, including a sticky note, a chart card, and one selected object. Premium, modern, clean, luminous, high-end SaaS brand aesthetic.
```

Versao preta:

```text
Create a 16:9 key visual for Synth, a documentation plus whiteboard product. Use a deep graphite black interface with cyan and electric violet glow, dark glass panels, high contrast typography, subtle dotted grid, and soft neon bloom around the brand mark. Show a split composition with a documentation card on the left and a whiteboard card on the right, including a sticky note, a chart card, and one selected object. Premium, modern, sharp, futuristic SaaS brand aesthetic.
```

## Base usada

Os tokens vieram principalmente daqui:

- `figmadoc/src/index.css`
- `figmadoc/src/components/Header.tsx`
- `figmadoc/src/components/Sidebar.tsx`
- `figmadoc/src/components/Whiteboard.tsx`
- `figmadoc/public/favicon.svg`

Se quiser, no proximo passo eu posso transformar isso em:

- um SVG final exportavel
- um PNG 1920x1080 de cada versao
- ou um pack de tokens para Figma / Framer / Webflow
