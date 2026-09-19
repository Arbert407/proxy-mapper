# LLM Proxy Mapper

> **Un proxy HTTP bidireccional que oculta datos confidenciales al LLM, manteniendo la experiencia completa de OpenCode (tools, streaming, multi-turn).**

---

## 📋 Tabla de Contenidos

1. [¿Qué es?](#-qué-es)
2. [El Problema que Resuelve](#-el-problema-que-resuelve)
3. [¿Cómo Funciona?](#-cómo-funciona)
4. [Inicio Rápido](#-inicio-rápido)
5. [Configuración](#-configuración)
6. [Generación de Mappings: Buenas Prácticas](#-generación-de-mappings-buenas-prácticas)
7. [Uso Avanzado](#-uso-avanzado)
8. [Arquitectura Técnica](#-arquitectura-técnica)
9. [Troubleshooting](#-troubleshooting)
10. [Roadmap](#-roadmap)
11. [Referencias](#-referencias)

---

## 🎯 ¿Qué es?

**LLM Proxy Mapper** es un proxy HTTP escrito en Node.js que se interpone entre [OpenCode](https://opencode.ai) (o cualquier cliente OpenAI-compatible) y un proveedor LLM (como MiniMax). Su función principal es **mapear bidireccionalmente datos confidenciales** para que:

- ✅ **Tú** ves los nombres reales de tus proyectos, empresas, clientes
- 🤖 **El LLM** solo ve aliases opacos que no revelan información confidencial
- 🔄 La respuesta del LLM se **desmapea automáticamente** antes de llegar a ti

### Caso de Uso Real

```
Tú escribes en OpenCode:  "Crea la clase SECOJB en QWER.cs"
                                          ↓
Proxy mapea a:             "Crea la clase SJBDR en OPDF.cs"
                                          ↓
LLM procesa y responde:    "class SJBDR { ... }"
                                          ↓
Proxy desmapea a:          "class SECOJB { ... }"
                                          ↓
Tú ves en OpenCode:        "class SECOJB { ... }"
```

**El LLM nunca supo que `SECOJB` es el nombre real del proyecto.**

---

## 🔐 El Problema que Resuelve

Cuando usas herramientas de IA como OpenCode, el texto que envías (nombres de empresas, proyectos, clientes, código interno) viaja a servidores de terceros. Esto plantea riesgos:

| Riesgo | Impacto |
|--------|---------|
| **Filtración de datos** | Nombres de proyectos no públicos quedan en logs del proveedor |
| **Entrenamiento no deseado** | Algunos proveedores pueden usar tus prompts para entrenar modelos |
| **Cumplimiento normativo** | Regulaciones como GDPR/HIPAA pueden exigir protección de datos |
| **Ventaja competitiva** | Nombres de productos/clientes son ventaja que no quieres regalar |

### La Solución

Un proxy que aplica **mapeo de strings bidireccional** antes y después de cada llamada al LLM:

```
┌──────────┐    mapeo    ┌────────┐    clean     ┌────────┐
│ OpenCode │ ──────────► │ Proxy  │ ───────────► │  LLM   │
│ (confid) │ ◄────────── │ Mapper │ ◄─────────── │ (alias)│
└──────────┘  desmapeo   └────────┘    raw       └────────┘
```

---

## ⚙️ ¿Cómo Funciona?

### Pipeline de Request (Usuario → LLM)

```
1. OpenCode envía request con nombres confidenciales
   ↓
2. Proxy extrae API key del header (NO la almacena)
   ↓
3. Proxy parsea el body JSON
   ↓
4. Proxy aplica toLLM() a TODOS los campos de texto:
   - messages[].content (string y multimodal)
   - messages[].tool_calls[].function.{name,arguments}
   - tools[].function.{name,description}
   - Y muchos más...
   ↓
5. Proxy verifica que NO haya LEAKS (defensa en profundidad)
   ↓
6. Proxy reenvía el body transformado a MiniMax
```

### Pipeline de Response (LLM → Usuario)

```
1. LLM responde con aliases (no conoce los nombres reales)
   ↓
2. Proxy recibe la respuesta (streaming SSE)
   ↓
3. Proxy aplica fromLLM() a cada chunk del stream
   ↓
4. Proxy acumula tool_calls fragmentados y los emite completos
   ↓
5. OpenCode recibe el stream final con nombres confidenciales restaurados
```

### Características Clave

- 🔄 **Streaming real SSE**: Sin buffering, latencia mínima
- 🧩 **Acumulación de tool_calls**: Los LLMs fragmentan tool_calls en múltiples chunks; el proxy los reensambla
- 🔍 **Detección de leaks**: Verifica que ningún nombre confidencial llegue al LLM
- 🚫 **Sin almacenamiento de credenciales**: API key siempre viene del request
- 📦 **Sin dependencias externas** (en `index.js`): Solo módulos nativos de Node.js
- 🛡️ **Headers saneados**: Whitelist de headers seguros a reenviar

---

## 🚀 Inicio Rápido

### Prerrequisitos

- **Node.js 18+** (probado con v22)
- Una API key del proveedor LLM (ej. MiniMax)
- OpenCode o cualquier cliente OpenAI-compatible

### Instalación

```bash
# Clonar el repositorio
git clone <repo-url>
cd proxy-mapper

# No requiere npm install para index.js (sin dependencias)
# Pero puedes instalar nodemon para desarrollo
npm install
```

### Configuración Inicial

#### 1. Crear/editar `mapping.tsv`

El archivo de mapeos es un **TSV** plano (sin header, sin comentarios) con dos columnas separadas por un **tabulador literal**:

```
<real_value>	<masked_value>
```

- **Columna 1 (`real_value`)**: identificador confidencial que solo tú ves (ej. `CASTROL`).
- **Columna 2 (`masked_value`)**: alias opaco que verá el LLM (ej. `USRBOO`).
- La tabla inversa (`llm2user`) se **deriva automáticamente** al cargar: no la escribas a mano.
- Si quieres documentar el archivo, hazlo en el README, no en el TSV.

Ejemplo de `mapping.tsv`:

```tsv
MiEmpresa	EMPR123
ProyectoSecreto	PROJ456
cliente_vip	CLIENT789
```

##### Reglas del formato

- El archivo **no tiene cabecera**: las líneas son positionales (primera columna = real, segunda = masked).
- El separador **debe ser el carácter TAB** (`\t`), no espacios. Si tu editor muestra `→` o `·····` entre los valores, sigue siendo un tabulador válido.
- Cada `real_value` debe ser **único** y cada `masked_value` también, para que la inversa sea biyectiva.
- Líneas vacías y líneas que empiezan con `#` se toleran como comentarios.
- Al arrancar, el proxy **rechaza** el archivo si encuentra: TAB ausente, columna vacía, `real == masked`, o duplicados.

> 💡 **Tip**: para verificar visualmente que el separador es un TAB, abrí el archivo en un editor que muestre whitespace (VS Code → *View → Render Whitespace*). Verás una flecha `→` donde está el tabulador.

#### 2. Verificar `config.json`

```json
{
  "apiKeys": {
    "minimax": ""
  },
  "port": 45823
}
```

> 💡 **Nota**: El campo `apiKeys` puede estar vacío. La API key viene del header de cada request.

#### 3. Iniciar el proxy

```bash
# Producción
node index.js

# Desarrollo (con auto-reload)
npm run dev2

# Con logging a archivo
node index.js 2>&1 | Tee-Object -FilePath proxy.log
```

Deberías ver:

```
[2026-08-07T19:48:06.731Z] === Proxy Started ===
[2026-08-07T19:48:06.731Z] Listening on: http://localhost:45823
[2026-08-07T19:48:06.731Z] Target: https://api.minimax.io/v1/chat/completions
[2026-08-07T19:48:06.731Z] Mapping source: <ruta>/mapping.tsv
[2026-08-07T19:48:06.731Z] Mappings: 3 user2llm, 3 llm2user
[2026-08-07T19:48:06.731Z] Loaded mapping entries (real -> masked):
[2026-08-07T19:48:06.731Z]    MiEmpresa       →  EMPR123
[2026-08-07T19:48:06.731Z]    ProyectoSecreto →  PROJ456
[2026-08-07T19:48:06.731Z]    cliente_vip     →  CLIENT789
[2026-08-07T19:48:06.731Z] Auth: from request headers (Authorization or x-api-key)
```

#### 4. Configurar OpenCode

Edita tu `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "minimax-proxy": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "MiniMax via Proxy",
      "options": {
        "baseURL": "http://localhost:45823/v1",
        "apiKey": "your-actual-minimax-api-key"
      },
      "models": {
        "MiniMax-M2.7": {
          "name": "MiniMax-M2.7"
        }
      }
    }
  }
}
```

#### 5. Usar en OpenCode

En tu config de modelo:
```json
{ "model": "minimax-proxy/MiniMax-M2.7" }
```

¡Listo! Ahora todos tus prompts pasarán por el proxy.

---

## 🧪 Probar que Funciona

### Test rápido con curl

```bash
curl -X POST http://localhost:45823/v1/chat/completions \
  -H "Authorization: Bearer tu-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "MiniMax-M2.7",
    "messages": [
      {"role": "user", "content": "Di hola usando el alias SECOJB"}
    ],
    "stream": false
  }'
```

### Verificar el log

```bash
# En otra terminal, observa el log:
Get-Content proxy.log -Wait
```

Deberías ver:

```
[1/4] REQUEST RAW
   model: MiniMax-M2.7
   messages: 1
[2/4] REQUEST TRANSFORMED
   mappings applied: SECOJB, ...
[3/4] RESPONSE RAW from MiniMax
   status: 200
[4/4] RESPONSE TRANSFORMED total chunks: ...
```

---

## 🎨 Generación de Mappings: Buenas Prácticas

Esta es la sección **más importante** del README. Una buena estrategia de mappings es la diferencia entre un proxy que funciona al 99% y uno que es 100% confiable.

### ✅ Reglas de Oro

#### 1. **Usa aliases pronounceables y cortos (5-7 caracteres)**

```tsv
# ✅ CORRECTO - Parece un identificador real
SECOJB	SJBDR
CASTROL	USRBOO
QWER	OPDF

# ❌ INCORRECTO - El LLM detecta que es hash/UUID y puede alterarlo
SECOJB	a8f3e9b2c1d4...
CASTROL	550e8400-e29b-41d4-a716-446655440000
```

**¿Por qué?** El LLM razona sobre los identificadores. Si ve algo como `34p9foicvwqkjqp12390wrgjlkfd321` puede:
- Agregar prefijos (ej. `_` para C#)
- Truncarlo pensando que es un hash
- "Corregir" caracteres que parecen typos

Con `OPDF`, el LLM lo trata como un identificador válido y no lo toca.

#### 2. **Evita patrones repetitivos**

```tsv
# ❌ MUY PELIGROSO - El LLM puede "extender" el patrón
CASTROL	r2r2r2r2r2r2r2r2r2r2r2r2r2r2r2

# ✅ SEGURO - Sin patrón reconocible
CASTROL	USRBOO
```

Si el LLM ve `r2r2r2...` puede alucinar que debe añadir más `r2`s. El proxy usa regex exacto, así que cualquier variación causa LEAKS.

#### 3. **Mantén consistencia de mayúsculas/minúsculas**

```tsv
# ✅ BIEN - El mapping es case-sensitive por defecto
MiProyecto	MyProj

# ⚠️ Si necesitas case-insensitive, configura el regex con flag 'i'
# (requiere modificación del código)
```

#### 4. **Valida la inversibilidad**

La inversa se genera automáticamente al cargar `mapping.tsv`. El proxy **rechaza al arrancar** líneas que:
- tengan el mismo `real` o el mismo `masked` repetido (no sería biyectiva), o
- tengan columnas vacías / falta de TAB.

```tsv
# Equivalente a {user2llm: {A:B, C:D}, llm2user: {B:A, D:C}}
A	B
C	D
```

#### 5. **Evita colisiones con palabras comunes**

```tsv
# ❌ MALO - "client" puede aparecer en código legítimo
cliente	client

# ✅ MEJOR - Usa algo único
cliente_vip	vipClient42
```

#### 6. **Prueba con frases completas si es necesario**

El proxy soporta mappings de frases (una sola línea, una sola sustitución):

```tsv
Corporativa de Personas Unidas	CorpUniDas
```

### 📋 Checklist de Validación

Antes de desplegar un mapping nuevo, verifica:

- [ ] No tiene patrones repetitivos (`r2r2r2`, `xxxx`, `123123`)
- [ ] Es pronounceable o parece identificador real
- [ ] Tiene 5-7 caracteres (ni muy corto ni muy largo)
- [ ] El proxy arrancó sin error (la inversa se valida automáticamente)
- [ ] Probé con un prompt que use el mapping
- [ ] El log NO muestra `!!! LEAK DETECTED !!!`
- [ ] El LLM no agregó prefijos/sufijos al alias
- [ ] El archivo en disco tiene el contenido esperado

### 🧪 Script de Validación

Ejecuta esto para validar tus mappings:

```bash
node test_transform.js
```

Este script simula un request complejo y verifica que NO haya leaks.

---

## 🔧 Configuración Avanzada

### Cambiar Proveedor LLM

Edita `index.js`:

```javascript
const TARGET_HOST = 'api.openai.com';  // o el que necesites
const TARGET_PATH = '/v1/chat/completions';
```

### Agregar Headers Forwarded

Edita `FORWARDED_HEADERS` en `index.js`:

```javascript
const FORWARDED_HEADERS = [
  // ... existentes ...
  'x-custom-header',  // tu nuevo header
];
```

### Timeout

Cambia en `proxyOptions`:

```javascript
timeout: 300000  // 5 minutos (default: 120s)
```

---

## 🏗️ Arquitectura Técnica

### Stack

- **Runtime**: Node.js 18+ (ES Modules)
- **HTTP**: Módulos nativos `http` y `https`
- **Sin dependencias externas** en `index.js` (cero npm packages requeridos)

### Estructura de Archivos

```
proxy-mapper/
├── index.js              # Proxy principal (recomendado)
├── index.js               # Proxy alternativo (con Express, no mantenido)
├── mapping.tsv            # Tabla de mapeos TSV (real\tmasked; inversa auto-derivada)
├── config.json            # Configuración (puerto, etc.)
├── package.json           # Dependencias de desarrollo
├── test_transform.js      # Test de validación de mappings
├── test_minimax_output.js # Test de output crudo de MiniMax
├── problema.md            # Documentación del problema original
└── CUSTOM_PROVIDER_MINIMAX.md # Guía de config para OpenCode
```

### Funciones Principales (en `index.js`)

| Función | Propósito |
|---------|-----------|
| `toLLM(text)` | Mapea texto user-side → LLM-side |
| `fromLLM(text)` | Mapea texto LLM-side → user-side |
| `parseJSONSafe(str)` | JSON.parse con fallback null |
| `transformRequestBody(body)` | Transforma TODO el request antes de enviar |
| `transformValueDeep(value)` | Transformación recursiva para tool_call args |
| `transformChunk(chunk)` | Transforma chunks de respuesta |
| `cleanChunk(chunk)` | Limpia campos innecesarios |
| `handleChatCompletions(req, res)` | Manejador principal del endpoint |

### Flujo de Datos Detallado

Ver `index.js` líneas 590-925 para el flujo completo de `handleChatCompletions`.

---

## 🐛 Troubleshooting

### ❌ "API key required"

El request no incluye header de autorización:

```bash
# Verifica que tu cliente envíe el header:
-H "Authorization: Bearer sk-..."

# O alternativamente:
-H "x-api-key: sk-..."
```

### ❌ "Invalid JSON body"

El body del request no es JSON válido. Verifica:
- Content-Type: application/json
- El body es JSON bien formado (usa `jq .` para validar)

### ❌ "!!! LEAK DETECTED in REQUEST !!!"

Tu mapping tiene un bug. Posibles causas:

1. **Campo nuevo no transformado**: OpenAI puede agregar campos que no están en `transformRequestBody`
2. **Mapping case-sensitive**: Si envías `secojb` pero mapeas `SECOJB`, no se transformará
3. **Encoding diferente**: El cliente envía caracteres Unicode que no coinciden

**Solución**: Revisa el log para ver DÓNDE está el leak:

```
!!! LEAK DETECTED in REQUEST !!! Still contains: SECOJB
   message[3] (user) contains "SECOJB"
```

Luego agrega ese campo a `transformRequestBody`.

### ❌ El LLM "alucina" y genera strings raros

El LLM está extendiendo o modificando tus aliases. Soluciones:

1. **Usa aliases más pronounceables** (ver Buenas Prácticas)
2. **Reduce la longitud** del alias (5-7 caracteres ideal)
3. **Evita patrones repetitivos**

### ❌ El proxy no transforma nada

Verifica:

```bash
# 1. El proxy está corriendo
Get-Process -Name node

# 2. El puerto está abierto
Test-NetConnection -ComputerName localhost -Port 45823

# 3. El mapping.tsv tiene la sintaxis correcta
Get-Content mapping.tsv
# Cada linea no-comentada debe tener UN tabulador separando real y masked.

# 4. Los valores están exactamente como los usas
# (case-sensitive!)
# 5. Re-empezá el proxy tras editarlo (no hay hot-reload todavía)
```

### ❌ Logs demasiado verbosos

El proxy loguea cada chunk. Para reducir:

```bash
# Comentar líneas de log en index.js
# O redirigir a archivo:
node index.js 2>>proxy.log
```

---

## 🚦 Health Check

```bash
curl http://localhost:45823/health
# => {"status":"ok"}
```

---

## 📊 Métricas y Monitoreo (Roadmap)

Próximamente:
- [ ] Endpoint `/metrics` con Prometheus format
- [ ] Conteos de mappings aplicados por request
- [ ] Latencia promedio
- [ ] Tokens consumidos
- [ ] Detección de loops del LLM

---

## 🛣️ Roadmap

### v1.1 (Próximo)
- [ ] Hot-reload de `mapping.tsv` sin reiniciar
- [ ] API admin para gestionar mappings remotamente
- [x] Validación automática de mappings al cargar (TSV: duplicados, columnas vacías, biyección)

### v1.2
- [ ] Soporte multi-proveedor (OpenAI, Anthropic, etc.)
- [ ] Métricas Prometheus
- [ ] Modo dry-run para testing

### v2.0
- [ ] Cifrado de logs
- [ ] Integración con secrets managers (Vault, AWS Secrets Manager)
- [ ] UI web para gestión visual de mappings

---

## 📞 Referencias

- [OpenCode Providers Documentation](https://github.com/anomalyco/opencode/blob/dev/packages/web/src/content/docs/providers.mdx)
- [OpenAI Chat Completions API](https://platform.openai.com/docs/api-reference/chat)
- [Server-Sent Events (SSE) Spec](https://html.spec.whatwg.org/multipage/server-sent-events.html)
- [AI SDK OpenAI-Compatible](https://www.npmjs.com/package/@ai-sdk/openai-compatible)
- [MiniMax Platform](https://platform.minimaxi.com)

---

## 📝 Changelog

### v1.0.0 (Actual)
- ✅ Mapeo bidireccional completo
- ✅ Streaming SSE sin buffering
- ✅ Acumulación de tool_calls fragmentados
- ✅ Detección de leaks
- ✅ Sin dependencias externas
- ✅ Documentación exhaustiva en código

### v0.x (Histórico)
- Versiones iniciales con Express (`index.js`)
- Iteraciones para resolver bugs de streaming y tools

---

<div align="center">

**¿Encontraste útil este proyecto? ⭐ Dale una estrella en GitHub**

</div>
