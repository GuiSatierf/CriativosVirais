# Dependências e segurança — 2026-10-13

Os nove alertas altos de desenvolvimento vinham de uma única falha transitiva:
[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm),
esgotamento da pilha em padrões profundamente aninhados de braces <= 3.0.3.
O advisory e o registry não oferecem uma versão corrigida nesta data. As sugestões
de npm audit fix envolviam downgrades de ESLint/Next e shadcn, incompatíveis com a
stack solicitada.

## Correção aplicada

`vendor/braces` contém o código MIT de braces 3.0.3 com uma correção local explícita,
identificada como `@criativosvirais/braces@3.0.3-patch.1`, sem publicação no registry.
O pacote original foi conferido contra a integridade do registry:

```
sha512-yQbXgO/OSZVD2IsiLlro+7Hf6Q18EJrKSEsdoMzKePKXct3gvD8oLcOQdIzGupr5Fj+EDe8gO/lxc1BzfMpxvA==
```

O parser rejeita mais de 64 blocos aninhados (chaves ou parênteses). compile, expand
e stringify validam também ASTs diretamente com uma travessia iterativa antes da
recursão. Referências repetidas/ciclos em nodes são rejeitados; parent/prev são
backlinks legítimos e não são percorridos. A falha é um SyntaxError controlado com
código ERR_BRACES_DEPTH. Nenhuma opção desativa esse limite.

O tarball versionado e seu hash no lockfile garantem instalação reproduzível.
A dependência de desenvolvimento `braces` aponta para esse arquivo e o override
`$braces` força as dependências transitivas a usar o mesmo pacote. O Dockerfile
copia o tarball antes de npm ci nos dois estágios de dependências. As versões das
ferramentas e da aplicação foram preservadas; npm 10 normalizou metadados do
lockfile e completou dependências opcionais da plataforma WASM do Tailwind.

## Validação

- Instalação limpa com npm ci em Node 22; auditorias completa e --omit=dev zeradas.
- Exploit de 4.000 blocos dentro do limite de caracteres: a versão upstream lança
  RangeError de call stack; o fork lança ERR_BRACES_DEPTH antes da recursão.
- Regressão automatizada: chaves/parênteses/mistos/desbalanceados, limite 64/65,
  tentativa de desativar o limite, ASTs de 20.000 níveis e ciclos, Node com stack
  reduzida, alternativas/ranges/escapes/literais e opções normais.
- Código instalado comparado byte a byte com o fonte versionado, inclusive licença.
  Os consumidores fast-glob de Next e shadcn, micromatch e ts-morph exercitam
  padrões reais de arquivos; o CLI shadcn continua carregando.
- ESLint, typecheck, 12 testes Vitest existentes, build de aplicação/worker/tools,
  build Docker Node 22, Drizzle sem alterações e diagnóstico de banco/S3.

O CI executa `npm run check:security` e `npm audit --audit-level=low`, além das
validações existentes. A execução remota depende dos limites de cobrança da
conta GitHub; uma configuração de CI não comprova que um run remoto foi executado.

## Manutenção e limites

A mudança corrige esgotamento recursivo da pilha; não torna expansões ilimitadas
seguras. Preserve rangeLimit e use padrões glob como configuração. Padrões com
mais de 64 blocos e ASTs com referências compartilhadas são rejeitados, incluindo
casos antes aceitos pelo pacote original.

npm audit não associa automaticamente novos advisories de braces ao nome privado
do fork. A equipe deve acompanhar o advisory/upstream e substituir a correção
local por uma versão oficial verificada quando disponível. A identidade privada
serve para distinguir a implementação corrigida, não é prova de segurança; os
testes de exploit e a revisão do patch fornecem essa evidência.

Para alterar o fork, atualize fonte/PATCH.md e a versão privada, gere o tarball com
`npm pack ./vendor/braces --pack-destination ./vendor`, ajuste package.json e gere
package-lock.json com npm 10/Node 22. Execute a instalação limpa e todas as
validações acima antes de publicar a alteração. Não edite apenas o tarball.
