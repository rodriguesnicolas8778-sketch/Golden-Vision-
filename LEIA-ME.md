# Golden Vision · App de Administração de Imóveis

Mesmo esquema da CONDCRED: o app fica hospedado como site, os dados ficam numa planilha Google sua, e a equipe entra com PIN.

## Arquivos

| Arquivo | Para que serve |
|---|---|
| `index.html` | O app |
| `manifest.webmanifest`, `sw.js`, ícones `.png` | Fazem ele instalar na tela inicial e abrir sem internet |
| `Codigo.gs` | O servidor (vai no Apps Script da planilha, **não** vai para o site) |

## 1. Criar o servidor (planilha)

1. No Google Drive, crie uma planilha nova chamada **Golden Vision - Dados**.
2. Menu **Extensões > Apps Script**. Apague o que tiver lá e cole todo o conteúdo de `Codigo.gs`. Salve.
3. Na função `definirPin`, troque `'0000'` pelo PIN da equipe. No topo, escolha **definirPin** e clique em **Executar** (autorize quando pedir).
4. Volte na função, apague o PIN que você digitou (deixe `'0000'`) e salve. O PIN já ficou guardado de forma protegida.
5. **Implantar > Nova implantação > Tipo: App da Web**
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**
6. Copie o endereço que termina em **/exec**.

> Para trocar o PIN depois: repita os passos 3 e 4. Todo mundo que estava conectado vai precisar entrar de novo.
> Se mudar o `Codigo.gs`, use **Implantar > Gerenciar implantações > Editar > Nova versão** para o endereço continuar o mesmo.

## 2. Publicar o app

Suba `index.html`, `manifest.webmanifest`, `sw.js` e os 4 ícones `.png` (sem o `Codigo.gs`) no mesmo tipo de hospedagem que você usou para a CONDCRED, por exemplo um repositório novo no GitHub com o GitHub Pages ligado. Precisa ser um endereço **https**.

## 3. Instalar no celular / iPad

1. Abra o endereço do app no **Safari** (iPhone/iPad) ou **Chrome** (Android).
2. Na primeira vez, cole o endereço **/exec** do servidor e digite o PIN.
3. **Compartilhar > Adicionar à Tela de Início** (iPhone/iPad) ou **⋮ > Instalar app** (Android).

Cada pessoa da equipe faz o passo 3 no próprio aparelho, com o mesmo endereço do servidor e o mesmo PIN.

## 4. Levar os dados que já estão no Claude

1. Na plataforma dentro do Claude, vá em **Ajustes > Baixar backup**.
2. No app, entre com o PIN e vá em **Ajustes > Restaurar backup** e escolha o arquivo.

## Segurança

- Depois de 5 PINs errados seguidos, o servidor bloqueia novas tentativas por 15 minutos.
- "Manter conectado" deixa o aparelho logado por 30 dias; desmarcado, a sessão dura 12 horas.
- **Sair** (no menu lateral) desconecta o aparelho.
- A planilha é o seu backup principal. Mesmo assim, baixe um backup pelo app de vez em quando.
