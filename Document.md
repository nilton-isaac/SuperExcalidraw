# Synth - Documentação Técnica Completa

## 🎯 Visão do Projeto

Aplicação web que combina:
- **Esquerda:** Documentação estilo Notion
- **Direita:** Whiteboard infinito estilo Excalidraw
- **Dentro do Whiteboard:** Blocos de código HTML/CSS/JS executáveis

---

## 📁 Estrutura do Projeto

```
figmadoc/
├── apps/
│   ├── web/              # Frontend React
│   └── api/              # Backend Node.js
├── packages/
│   └── shared/           # Tipos compartilhados
└── docker-compose.yml
```

---

## 🛠 Stack Tecnológica

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Whiteboard | @excalidraw/excalidraw |
| Editor | @tiptap/react |
| Estado | Zustand |
| Backend | Node.js + Express |
| Banco | PostgreSQL + Prisma |
| Real-time | Socket.io |
| Styling | TailwindCSS |

---

## 📊 Modelos de Dados

```typescript
// Tipos principais

interface Document {
  id: string;
  title: string;
  ownerId: string;
  pages: Page[];
  createdAt: Date;
  updatedAt: Date;
}

interface Page {
  id: string;
  documentId: string;
  title: string;
  content: string;           // HTML do editor
  whiteboardState: object;   // Elementos do canvas
  position: number;
}

interface WhiteboardElement {
  id: string;
  type: 'shape' | 'sticky' | 'code' | 'arrow';
  x: number;
  y: number;
  width: number;
  height: number;
  properties: {
    text?: string;
    html?: string;
    css?: string;
    js?: string;
  };
}
```

---

## 🧩 Componentes Principais

### 1. Layout Principal

```tsx
// App.tsx
<div className="flex h-screen">
  {/* Sidebar - Documentação */}
  <aside className="w-96 border-r bg-white">
    <Sidebar />
  </aside>
  
  {/* Whiteboard - Canvas */}
  <main className="flex-1 flex flex-col">
    <Toolbar />
    <Whiteboard />
    <StatusBar />
  </main>
</div>
```

### 2. Whiteboard com Excalidraw

```tsx
// components/Whiteboard.tsx
import { Excalidraw } from '@excalidraw/excalidraw';

export function Whiteboard() {
  return (
    <div className="flex-1 relative">
      <Excalidraw
        onChange={(elements) => {
          // Salvar elementos
        }}
      />
      {/* Overlay para Code Blocks */}
      <CodeBlockOverlay />
    </div>
  );
}
```

### 3. Code Block Executável

```tsx
// components/CodeBlock.tsx
export function CodeBlock({ elementId, html, css, js }) {
  const [output, setOutput] = useState('');

  const runCode = () => {
    // Cria iframe sandbox
    const iframe = document.createElement('iframe');
    iframe.sandbox = 'allow-scripts';
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    // Injeta código
    iframe.contentDocument.write(`
      <html>
        <style>${css}</style>
        <body>${html}</body>
        <script>${js}</script>
      </html>
    `);

    // Captura output via postMessage
    window.addEventListener('message', (e) => {
      setOutput(e.data);
    });
  };

  return (
    <div className="code-block bg-gray-900 rounded-lg">
      <div className="tabs">HTML | CSS | JS</div>
      <textarea defaultValue={html} />
      <button onClick={runCode}>▶ Run</button>
      <div className="output">{output}</div>
    </div>
  );
}
```

### 4. Sandbox Seguro

```typescript
// lib/sandbox.ts
export function createSandbox(html: string, css: string, js: string) {
  const iframe = document.createElement('iframe');
  
  // Segurança crítica
  iframe.sandbox = 'allow-scripts';
  iframe.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0';
  
  document.body.appendChild(iframe);
  
  const doc = iframe.contentDocument;
  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
    <head><style>${css}</style></head>
    <body>${html}</body>
    <script>
      try {
        ${js}
      } catch(e) {
        parent.postMessage({error: e.message}, '*');
      }
    </script>
    </html>
  `);
  doc.close();
  
  return iframe;
}
```

---

## 🗄 Schema do Banco (Prisma)

```prisma
// schema.prisma

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  documents Document[]
}

model Document {
  id        String   @id @default(cuid())
  title     String
  ownerId   String
  owner     User     @relation(fields: [ownerId], references: [id])
  pages     Page[]
  createdAt DateTime @default(now())
}

model Page {
  id              String   @id @default(cuid())
  documentId      String
  title           String
  content         Json
  whiteboardState Json
  document        Document @relation(fields: [documentId], references: [id])
}
```

---

## 🔌 API Endpoints

```
GET    /api/documents          # Listar documentos
POST   /api/documents          # Criar documento
GET    /api/documents/:id      # Obter documento
PUT    /api/documents/:id      # Atualizar documento
DELETE /api/documents/:id      # Deletar documento

WS     /ws/:documentId         # WebSocket para sync em tempo real
```

---

## 📝 Prompts para AI Coding

### Prompt 1: Setup
```
Crie um projeto React + Vite + TypeScript com TailwindCSS.
Adicione @excalidraw/excalidraw e @tiptap/react.
Estrutura: Sidebar esquerda, Whiteboard direita.
```

### Prompt 2: Code Block
```
Crie componente CodeBlock com 3 tabs (HTML, CSS, JS).
Cada tab tem um textarea.
Botão "Run" executa código em iframe sandbox.
Mostra output ou erro abaixo.
```

### Prompt 3: Sandbox
```
Função createSandbox(html, css, js):
- Cria iframe com sandbox="allow-scripts"
- Injeta código via srcdoc
- Captura console.log e erros
- Envia resultado via postMessage
- Timeout de 5 segundos
```

### Prompt 4: Database
```
Schema Prisma com:
- User (id, email)
- Document (id, title, ownerId)
- Page (id, documentId, content, whiteboardState)
Relações apropriadas entre modelos.
```

### Prompt 5: WebSocket
```
Hook useCollaboration(documentId):
- Conecta ao WebSocket
- Envia mudanças de elementos
- Recebe mudanças de outros usuários
- Atualiza estado local
```

---

## ⚠️ Segurança (CRÍTICO)

| Risco | Solução |
|-------|---------|
| XSS no Code Block | Iframe sandbox + domínio separado |
| Execução infinita | Timeout 5 segundos |
| Acesso não autorizado | JWT + validação de proprietário |
| Data leakage | HTTPS + encryption at rest |

---

## 📅 Roadmap de Implementação

| Fase | Duração | Entregáveis |
|------|---------|-------------|
| 1. Setup | 2 dias | Projeto + deps básicas |
| 2. UI | 5 dias | Layout + componentes |
| 3. Code Blocks | 7 dias | Sandbox + execução |
| 4. Backend | 7 dias | API + banco |
| 5. Real-time | 10 dias | WebSocket + sync |
| 6. Polish | 5 dias | Export + tests |

**Total: ~36 dias para MVP**

---

## ✅ Checklist MVP

```
□ Layout sidebar + whiteboard
□ Excalidraw integrado
□ Editor de texto (TipTap)
□ Code Block com 3 tabs
□ Execução em iframe sandbox
□ Captura de output/erros
□ Save/Load de documentos
□ Auth básico
□ Share por link
```

---

## 🔗 Referências

- Excalidraw: https://excalidraw.com/
- TipTap: https://tiptap.dev/
- Prisma: https://prisma.io/
- Sandbox iframe: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe#attr-sandbox

---

## 🚀 Começando Agora

```bash
# 1. Criar projeto
npm create vite@latest figmadoc -- --template react-ts
cd figmadoc

# 2. Instalar deps
npm install @excalidraw/excalidraw @tiptap/react @tiptap/starter-kit
npm install zustand uuid
npm install -D tailwindcss postcss autoprefixer

# 3. Iniciar
npm run dev
```

---
