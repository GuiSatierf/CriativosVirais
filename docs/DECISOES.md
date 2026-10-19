# Decisões

Uma entrada por decisão de arquitetura ou de biblioteca: data, o que foi decidido, por quê e o que foi descartado.

## 2026-10-19 — Oxlint no lugar do ESLint, TypeScript 7

**Decisão.** O `npm run lint` passa a rodar o Oxlint (`.oxlintrc.json`) com regras que usam tipos (`typeAware`) e checagem de tipos (`typeCheck`), pelo `oxlint-tsgolint`. ESLint, `eslint-config-next` e `eslint.config.mjs` saem. Depois disso o TypeScript sobe de 6.0.3 para 7.0.2.

**Por quê.** O `typescript-eslint` (até 8.72.0) só aceita TypeScript abaixo de 6.1, porque o TypeScript 7 ainda não tem API JavaScript (prometida para a 7.1; issue 10940 do typescript-eslint). Com o ESLint, o projeto ficaria preso no TypeScript 6. O Oxlint checa tipos pelo typescript-go, o mesmo compilador do TypeScript 7, e roda bem mais rápido. O dono do repositório pediu o Oxlint.

**Equivalência.** A configuração reproduz as 86 regras que o `eslint-config-next` (core-web-vitals + typescript) ligava, com a mesma severidade e as mesmas pastas ignoradas; 80 têm equivalente nativo no Oxlint 1.88. As seis que ficaram de fora:

- `react/jsx-uses-react` e `react/jsx-uses-vars`: só marcavam variáveis como usadas para outra regra do ESLint; o `no-unused-vars` do Oxlint já entende JSX.
- `react/no-deprecated`: avisava de APIs antigas do React. As de função (`ReactDOM.render`, `findDOMNode`...) saíram do React 19 e dos tipos, então o `tsc` acusa o uso; as de componente de classe (`componentWillMount`...) não se aplicam, porque o projeto não tem componente de classe. O substituto do Oxlint, `typescript/no-deprecated`, cobre toda biblioteca e hoje acusa 25 usos de APIs marcadas como obsoletas (zod, ai); ligá-lo é trabalho separado.
- `react-hooks/config` e `react-hooks/gating`: validam opções do React Compiler, que o projeto não configura.
- `@next/next/no-location-assign-relative-destination`: ainda não existe no Oxlint. O código não usa `location.assign` nem `location.href =`.

Os três comentários `eslint-disable-next-line` continuam valendo: o Oxlint lê esse formato, e cada um, removido, faz a regra correspondente acusar. Comentários novos usam `oxlint-disable-next-line`.

**TypeScript 7 sem o arranjo lado a lado.** O Next 16.4 checa tipos no build pelo binário `tsc` (`experimental.useTypeScriptCli` vem ligado por padrão), e nenhuma outra ferramenta do projeto importa a API do `typescript`: Vitest, tsx, esbuild e Playwright transpilam por conta própria, e o drizzle-kit carrega a configuração sem ele. Por isso o pacote `typescript` vai direto para a 7, sem o par `@typescript/typescript6` + `@typescript/native`.

**Descartado.**
- Ficar no ESLint e travar o TypeScript em 6.0.x até a API do TypeScript 7.1 sair.
- Carregar plugins do ESLint pelo `jsPlugins` do Oxlint para cobrir as seis regras: o recurso ainda é alfa e manteria dependências do ESLint.
- Ligar o `typescript/no-deprecated` e outras regras novas nesta troca: mexeria em código de várias áreas que outros PRs estão alterando.
