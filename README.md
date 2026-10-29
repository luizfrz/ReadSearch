# ReadSearch

App em React Native (Expo) para **buscar e ler HQs, livros e artigos**. Lê PDF e CBZ, converte páginas web em PDF, guarda uma biblioteca local e mostra a memória do aparelho.

<p align="center">
  <img alt="Expo" src="https://img.shields.io/badge/Expo-SDK%2054-000020?style=for-the-badge&logo=expo&logoColor=white" />
  <img alt="React Native" src="https://img.shields.io/badge/React%20Native-0.81-20232a?style=for-the-badge&logo=react&logoColor=white" />
  <img alt="React" src="https://img.shields.io/badge/React-19-20232a?style=for-the-badge&logo=react&logoColor=white" />
  <img alt="JavaScript" src="https://img.shields.io/badge/JavaScript-ES2022-F7DF1E?style=for-the-badge&logo=javascript&logoColor=white" />
  <img alt="React Navigation" src="https://img.shields.io/badge/React%20Navigation-7-6b52ae?style=for-the-badge&logo=react&logoColor=white" />
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-proxy%20CORS-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" />
  <img alt="pdf.js" src="https://img.shields.io/badge/pdf.js-3.11-FF6600?style=for-the-badge" />
  <img alt="JSZip" src="https://img.shields.io/badge/JSZip-CBZ%20e%20EPUB-4B5563?style=for-the-badge" />
  <img alt="AsyncStorage" src="https://img.shields.io/badge/AsyncStorage-localStorage-0ea5e9?style=for-the-badge" />
  <img alt="Metro" src="https://img.shields.io/badge/Metro-bundler-8B5CF6?style=for-the-badge" />
  <img alt="Internet Archive" src="https://img.shields.io/badge/Internet%20Archive-API-428bca?style=for-the-badge&logo=internetarchive&logoColor=white" />
  <img alt="Project Gutenberg" src="https://img.shields.io/badge/Project%20Gutenberg-API-8B4513?style=for-the-badge" />
  <img alt="OpenAlex" src="https://img.shields.io/badge/OpenAlex-API-E8590C?style=for-the-badge" />
</p>

Para testar sem emulador, instale o **Expo Go** no celular (mesma rede Wi-Fi do computador) e escaneie o QR code do `npm start`.


```bash
npm install
npm start          # abre o Expo; escaneie o QR code com o app Expo Go
npm run web        # versão no navegador
npm run proxy      # proxy CORS próprio (web); defina EXPO_PUBLIC_PROXY_URL (veja .env.example)
npm run android    # exige Android SDK/emulador ou aparelho com USB debugging

```

| Camada | Tecnologia | Uso |
|---|---|---|
| Framework | Expo SDK 54, React Native 0.81, React 19, react-native-web | App Android/iOS + web |
| Linguagem | JavaScript (ES2022) | Todo o app |
| Navegação | React Navigation (bottom-tabs + native-stack) | Abas e tela do leitor |
| UI | `expo-linear-gradient`, `@expo/vector-icons`, `react-native-safe-area-context`, `react-native-screens` | Gradientes, ícones, áreas seguras |
| Persistência | `@react-native-async-storage/async-storage` | Biblioteca, progresso, cache e buscas recentes (localStorage na web) |
| Arquivos | `expo-file-system` (API `legacy`) | Downloads, leitura em pedaços, espaço em disco |
| Leitor de PDF | `react-native-webview` + `pdfjs-dist` 3.11 (embutido, offline) | Renderização preguiçosa de páginas |
| Leitor de HQ | `jszip` | CBZ (e CBR que seja ZIP) |
| Leitor de EPUB | `jszip` + WebView/iframe | Capítulos com imagens e CSS embutidos |
| Web → PDF | `expo-print` | Gerar PDF de HTML e de texto OCR |
| Importar | `expo-document-picker` | PDF, CBZ, CBR e EPUB do aparelho |
| Dispositivo | `expo-device` | RAM total e modelo |
| Proxy CORS | Node.js puro (`server/proxy.js`, sem dependências) | Leitura de HTML na versão web, com proteção contra SSRF |
| Build/Tooling | Metro, `babel-preset-expo`, `scripts/build-pdfjs.js` | Empacota o pdf.js no app (`postinstall`) |

### Fontes de dados (gratuitas, sem chave de API)

| Tipo | Fonte |
|---|---|
| HQ | Internet Archive (`advancedsearch`) |
| Livros | Project Gutenberg (Gutendex) + Internet Archive |
| Artigos | OpenAlex (somente acesso aberto) |

## Estrutura

```
App.js                      Navegação, tema e splash
index.js                    Registro do app
src/
  api.js                    Busca nas fontes, resolução de arquivos do Internet Archive
  cache.js                  Cache de buscas + buscas recentes
  storage.js                Biblioteca (salvar/listar/remover)
  files.js                  Download, web → PDF, leitura base64
  device.js                 Memória/armazenamento do aparelho
  theme.js                  Cores
  components/
    Splash.js               Tela de abertura animada
    BookCard.js, Cover.js   Cartão e capa (com fallback em gradiente)
    Skeleton.js             Placeholder animado de carregamento
    PdfView.js              Leitor de PDF (WebView + pdf.js)
    PdfView.web.js          Leitor de PDF na web (iframe)
    CbzView.js              Leitor de HQ em CBZ
  screens/
    SearchScreen.js         Busca
    LibraryScreen.js        Biblioteca + importar arquivo
    ReaderScreen.js         Orquestra a abertura do conteúdo
    DeviceScreen.js         Memória do aparelho
```

## Fluxo do app

### 1. Abertura
`App.js` renderiza a navegação e, por cima, o componente `Splash` ("ReadSearch"). A animação (logo com mola, nome, frase e fade-out) dura cerca de 2 s; ao terminar, `onDone` remove a splash.

### 2. Busca (`SearchScreen` + `api.js`)
1. O usuário digita e escolhe o filtro: **HQ**, **Livros** ou **Artigos**.
2. Com 2 ou mais caracteres, a busca dispara sozinha **250 ms após a última tecla** (debounce). Uma nova digitação cancela a requisição anterior via `AbortController`.
3. `search(query, kind)` consulta primeiro o **cache** (`cache.js`): memória e, depois, AsyncStorage, com validade de 6 h. Se achar, devolve na hora.
4. Sem cache, busca nas fontes **em paralelo**:
   - HQ → Internet Archive filtrado por assunto "comics", pesquisando só em título/autor (mais rápido que texto completo);
   - Livros → Gutenberg + Internet Archive;
   - Artigos → OpenAlex com `open_access.is_oa:true`.
5. Cada fonte entrega seus resultados assim que responde (`onResults`), então a grade vai se preenchendo sem esperar a mais lenta. Enquanto carrega, aparecem esqueletos animados.
6. O resultado final é guardado no cache e o termo entra nas **buscas recentes** (máx. 8).
7. Sem texto digitado, a tela mostra buscas recentes e sugestões por categoria.

Cada resultado vira um item padronizado: `{ id, title, author, cover, kind, source, resolve }`. O campo `resolve` diz como obter o arquivo: `ia` (item do Internet Archive), `pdf` (URL direta) ou `web` (página HTML).

### 3. Abrir um item (`ReaderScreen`)
Ao tocar num cartão, a tela do leitor decide o caminho conforme `resolve.type`:

```
ia   → resolveArchive(): consulta /metadata/{id}, escolhe o arquivo .cbz (preferência)
       ou .pdf, e segue como "cbz" ou "pdf"
pdf  → download() para o armazenamento do app (reaproveita se já baixado)
cbz  → download() idem
web  → webToPdf(): converte a página em PDF (ver abaixo)
```

Depois de pronto, o item é salvo na **biblioteca** e exibido no leitor adequado. Erros (sem arquivo legível, falha de rede) aparecem numa tela com botão de voltar.

### 4. Conversão de página web em PDF (`files.js → webToPdf`)
Usado quando o conteúdo é HTML (livros do Gutenberg, artigos sem PDF direto).
1. Baixa o HTML da página (na web, se o navegador bloquear por CORS, tenta um proxy público).
2. Limpa o HTML: remove `<script>`/`<noscript>`, injeta `<base href>` (para imagens e links relativos funcionarem) e um CSS de leitura.
3. **Mobile:** `Print.printToFileAsync` gera o PDF, que é movido para a pasta do app e aberto no leitor de PDF.
4. **Web:** `Print.printAsync` abre o diálogo de impressão do navegador; o usuário escolhe "Salvar como PDF".

### 5. Leitores
- **PDF (mobile):** o arquivo é lido em base64 e injetado num HTML com **pdf.js** dentro de um `WebView`, que desenha cada página em `<canvas>`. No iOS/Android o mesmo caminho serve para arquivos baixados ou importados.
- **PDF (web):** `<iframe>` apontando para o arquivo.
- **CBZ (HQ):** `JSZip` abre o arquivo, lista as imagens (jpg/png/webp/gif) em ordem numérica e as mostra **uma por tela**, com paginação horizontal e contador `n / total`. Cada página só é extraída do zip quando fica visível, para poupar memória.

### 6. Biblioteca (`LibraryScreen` + `storage.js`)
- Toda vez que um item abre, é salvo (ou movido para o topo) no AsyncStorage com título, capa, caminho local e tipo.
- Mostra uma grade com o que você já abriu; reabrir usa o arquivo local, **sem novo download**.
- **Importar PDF / CBZ:** `expo-document-picker` escolhe o arquivo, que é copiado para a pasta do app e aberto no leitor.
- Toque e segure num item para removê-lo.

### 7. Memória do aparelho (`DeviceScreen` + `device.js`)
Mostra armazenamento livre/total (com barra de uso), RAM total e espaço usado pelo ReadSearch. Na web, usa `navigator.storage.estimate()` e `navigator.deviceMemory` (valores aproximados). O botão **Limpar cache e downloads** apaga o cache de buscas e os arquivos baixados.

## Persistência (chaves no AsyncStorage / localStorage)

| Chave | Conteúdo |
|---|---|
| `readgreat:library` | Itens da biblioteca |
| `rs:cache:<tipo>:<termo>` | Resultados de busca em cache (6 h) |
| `rs:recent` | Buscas recentes |

## Melhorias recentes
- **Proxy próprio:** `npm run proxy` sobe `server/proxy.js` (bloqueia IPs internos e protocolos não-http). Configure `EXPO_PUBLIC_PROXY_URL`; sem ele a web usa um proxy público.
- **PDF grande:** o arquivo é enviado ao visor em pedaços de 768 KB, e só as páginas perto da tela são renderizadas (as distantes são liberadas).
- **Offline:** o pdf.js vem embutido no app (`src/pdfjsBundle.js`, gerado no `postinstall`).
- **Progresso:** página/capítulo é salvo na biblioteca e retomado ao reabrir; os cartões mostram uma barra de progresso.
- **EPUB** suportado; **CBR** suportado quando o arquivo é ZIP renomeado.
- **Sem PDF/CBZ no Internet Archive:** o app tenta EPUB, depois o texto OCR (convertido em PDF) e, por fim, o leitor online incorporado.

## Limitações conhecidas
- CBR com compactação RAR real não abre (o app avisa para converter para CBZ).
- CBZ e EPUB ainda são lidos inteiros na memória; só a extração das páginas é preguiçosa.
- Na web, o PDF usa o visor do navegador e o progresso não é rastreado.
- O leitor online incorporado do Internet Archive não salva progresso.
