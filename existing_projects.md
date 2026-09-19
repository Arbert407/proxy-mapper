# Investigación de proyectos existentes — Proxy LLM con enmascaramiento de datos

> **Pregunta de investigación:** ¿Existen proyectos open-source probados y bien mantenidos que ya resuelvan el problema que ataca `proxy_mapper` (proxy HTTP OpenAI-compatible que reemplaza datos confidenciales antes de enviar al LLM y los restaura en la respuesta)? Si existen,，我们应该 usarlos; si no, debemos seguir desarrollando `proxy_mapper`.
>
> **Fecha:** Agosto 2026
> **Alcance:** Proyectos open-source preferentemente, pero también se incluyen opciones comerciales/empresariales para tener el panorama completo. Se da prioridad a proyectos con **alta mantenibilidad** (commits frecuentes, múltiples contribuidores, releases activos, comunidad amplia) por encima de proyectos de una sola persona.

---

## 📑 Tabla de contenidos

1. [Resumen ejecutivo](#-resumen-ejecutivo)
2. [Metodología de investigación](#-metodología-de-investigación)
3. [Hallazgo clave](#-hallazgo-clave)
4. [Matriz de mantenibilidad](#-matriz-de-mantenibilidad)
5. [Análisis de los candidatos viables](#-análisis-de-los-candidatos-viables)
   - [BerriAI/litellm ⭐ Recomendado](#1-litellm--berriailitellm)
   - [Portkey-AI/gateway](#2-portkey-aigateway)
   - [Kong AI Gateway PII Sanitizer](#3-kong-kong--ai-pii-sanitizer-plugin)
   - [Microsoft Presidio (data-privacy-stack/presidio)](#4-microsoftpresidio--data-privacy-stackpresidio)
   - [Helicone AI Gateway](#5-helico̵nehelicone)
   - [AegisGate (ax128/AegisGate)](#6-aeggisgate)
   - [ThinkWatchProject/ThinkWatch](#7-thinkwatchprojectthinkwatch)
   - [Censgate/redact](#8-censgateredact)
   - [Soluciones eliminadas / archivos / descontinuadas](#9-candidatos-eliminados-o-descontinuados)
   - [Soluciones comerciales (no OSS)](#-soluciones-comerciales-o-saas-referenciadas)
6. [Tabla comparativa: `proxy_mapper` vs candidatos](#-tabla-comparativa-proxy_mapper-vs-candidatos)
7. [Conclusión y recomendación](#-conclusión-y-recomendación)

---

## 🎯 Resumen ejecutivo

**Sí existe al menos un proyecto probado, activo y bien mantenido que ya implementa la funcionalidad core de `proxy_mapper`:** [`BerriAI/litellm`](https://github.com/BerriAI/litellm).

- **56.5k estrellas, 100+ contribuidores, MIT, releases diarias.**
- Posee un **PII Masking Guardrail con Presidio** que soporta el ciclo completo: **enmascarar antes de enviar al LLM + restaurar en la respuesta** (banderín `output_parse_pii=True`).
- El código revisado muestra que maneja correctamente: `messages[].content` (string y multimodal), `tool_calls[].function.arguments`, streaming SSE (ensamblado de chunks).
- **Limitación importante:** LiteLLM es una solución **multipropósito** (routing + caching + logging + guardrails). No es 100% drop-in para el caso de uso de `proxy_mapper` con OpenCode + MiniMax; requería configurarlo como proxy y agregar MiniMax como proveedor (lo cual es trivial vía `litellm --config`).

Recomendación directa:
- Si la prioridad es **estabilidad, comunidad y features empresariales** → **migrar a LiteLLM como proxy**.
- Si se quiere mantener el proyecto propio, **`proxy_mapper` puede especializarse en lo que LiteLLM no hace bien** (diccionario curado por el usuario, zero falsos positivos sobre identificadores arbitrarios como `CASTROL`→`USRBOO`). Lo importante es **dejar de reinventar infraestructura general** (auth, OpenAI-compatible routing, fallbacks, etc.) que ya está resuelta.

El resto del documento es el análisis que respalda esta conclusión.

---

## 🔬 Metodología de investigación

Se realizaron las siguientes búsquedas y verificaciones:

1. **Búsqueda inicial exhaustiva** (10 queries en GitHub Search):
   - `LLM proxy masking confidential data`
   - `openai proxy redact PII`
   - `llm gateway anonymization proxy`
   - `openai proxy data masking stream`
   - `bidirectional string substitution llm openai`
   - `llm proxy sanitize stream tools`
   - `llm firewall`, `llm secrets scanner`, `ai security proxy self hosted`
2. **Búsqueda de proyectos bien establecidos** que podrían tener masking (no aparecieron en búsquedas previas):
   - `BerriAI/litellm`, `Portkey-AI/gateway`, `Helicone/helicone`, `Kong/kong`
3. **Investigación de soluciones empresariales** (Azure AI Content Safety, AWS Bedrock Guardrails, Google Cloud DLP, etc.) para tener el panorama completo.
4. **Verificación de métricas de mantenimiento** (commits, contributors, releases) de los 15 candidatos más prometedores para descartar proyectos abandonados.
5. **Lectura del código fuente** de los 3 finalistas:
   - `litellm/proxy/guardrails/guardrail_hooks/presidio.py` (LiteLLM)
   - `docs.konghq.com/hub/kong-inc/ai-sanitizer/` (Kong)
   - Repos de nicho (AegisGate, etc.)

**Criterio de filtrado "bien mantenido":**
- ✅ Más de 1 contribuidor activo en los últimos 6 meses.
- ✅ Commits en el branch principal en los últimos 30 días (al momento de la consulta, Ago 2026).
- ✅ Al menos 1 release etiquetado en los últimos 12 meses.
- ✅ Issue tracker con respuesta reciente de los mantenedores (no abandono silencioso).
- ❌ Archivado / read-only explícito.

Aplicado este criterio, sobreviven: **LiteLLM, Presidio, Portkey, Helicone, Kong, AegisGate, ThinkWatch (con asterisco por licencia), Censgate (con asterisco por escala).**

---

## 💡 Hallazgo clave

En el primer barrido de búsqueda **pasaron desapercibidos** dos proyectos críticos que luego aparecieron al investigar candidatos "bien establecidos" del ecosistema:

1. **`BerriAI/litellm`** — 56.5k estrellas, MIT, releases diarios, **tiene PII masking bidireccional built-in con Presidio** (no es solo routing/caching).
2. **`Kong/kong` AI Gateway** — 44k estrellas, Apache 2.0, **plugin `ai-sanitizer` con restauración explícita**.

Ambos ofrecen **out of the box** lo que `proxy_mapper` implementa manualmente. Esto invalida parcialmente la hipótesis inicial de que habría que construir todo desde cero.

---

## 📊 Matriz de mantenibilidad

> Métricas obtenidas directamente de GitHub (repos públicos). "N/A" = dato no disponible vía webfetch; "~" = estimado. Última verificación: **17 de agosto de 2026**.

| Proyecto | ⭐ | Contribuidores | Último commit | Commits últimos 6m | Issues abiertos | Último release | Mantenido | Licencia |
|---|---:|---:|---|---:|---:|---|---|---|
| **BerriAI/litellm** | 56.5k | ~100+ | Ago 16, 2026 | 1000+ | 1.7k | v1.97.0 — Ago 16, 2026 | ✅ **Muy activo** | MIT |
| **data-privacy-stack/presidio** (ex microsoft/presidio) | 10.5k | ~50+ | Ago 9, 2026 | ~80 | 54 | 2.2.364 — Jul 22, 2026 | ✅ **Activo** | MIT |
| **Portkey-AI/gateway** | 12.7k | ~30+ | May 25, 2026 | ~30 | 103 | v1.15.2 — Ene 12, 2026 | ⚠️ **Ralentizado** (anunciado "Gateway 2.0" hacia versión paid) | MIT |
| **Helicone/helicone** | 6.1k | ~10–15 | Jul 21, 2026 | ~30 | 53 | v2025.08.21-1 | ✅ Activo | Apache-2.0 |
| **Kong/kong** (plugin ai-sanitizer) | 44k | muchos | Continuo | continuo | continuo | continuo (versionado por Kong Gateway) | ✅ **Muy activo (vendor-backed)** | Apache-2.0 (gateway), enterprise tier para ai-sanitizer |
| **ax128/AegisGate** | 58 | ~2–3 | Reciente | 330 total | 2 | n/a (sin releases etiquetados) | ⚠️ **Semi-activo, equipo pequeño** | MIT |
| **ThinkWatchProject/ThinkWatch** | 814 | varios | Reciente | 851 total | n/a | n/a | ⚠️ **Activo pero licencia restrictiva (BSL 1.1)** | Business Source License 1.1 |
| **censgate/redact** | 16 | 1 | Reciente | Bajo | 0 | n/a | ❌ **Escala muy baja** | MIT |
| **openobserve/openobserve** | 21.2k | ~50+ | Ago 17, 2026 | 500+ | 546 | v0.92.2 — Ago 17, 2026 | ✅ Muy activo (PII redaction enterprise-gated) | AGPL-3.0 |
| occludra/gateway | 31 | 1 | Ago 16, 2026 | ~20 | 0 | AISG v1.1.0 — May 8, 2026 | ❌ **Solo, sin releases** | Apache-2.0 |
| 0M3REXE/eidolon | 9 | 1 | Ago 1, 2026 | ~20 | 0 | — | ❌ **Solo, sin releases** | Apache-2.0 |
| sphragis-oss/sphragis | 4 | 1 | Ago 1, 2026 | ~25 | 6 | v0.8.0 — Jul 3, 2026 | ❌ **Solo, sin releases formales** | Apache-2.0 |
| davidnery88/llm-anon-gateway | 2 | 1 | Jul 25, 2026 | ~50 | 0 | — | ❌ **Solo** | PolyForm NC |
| Hari-Oggy/PII_Redactor | 1 | 1 | Jun 14, 2026 | ~9 | 0 | — | ❌ **Estancado** | MIT |
| MM-sheng/zeroleak-llm-proxy | 1 | 1 | Jun 25, 2026 | 4 | 0 | — | ❌ **Solo, sin tracción** | MIT |
| dousheng34/pii-anonymization-gateway | 0 | 1 | May 27, 2026 | 3 | 0 | — | ❌ **Sin tracción** | MIT |
| Lexus2016/LocalGuard | 5 | 1 | Jun 23, 2026 | ~21 | 0 | — | ❌ **Producto comercial; repo delgado** | MIT (thin) |
| ~~protectai/llm-guard~~ | 3.2k | ~6 | Jul 8, 2026 (commit de archivo) | 1 | 12 | — | ❌ **ARCHIVADO el 9 de julio de 2026** | MIT |

> **Conclusión de mantenibilidad:** Solo **LiteLLM, Presidio y Kong** (con asterisco enterprise) califican como "probado y bien mantenido" en el sentido estricto. Helicone se acerca pero no tiene PII masking built-in.

---

## 🔎 Análisis de los candidatos viables

### 1. litellm (`BerriAI/litellm`)

**Categoría:** LLM gateway / proxy multipropósito con PII masking opcional.
**Stars / mantenimiento:** 56.5k, 100+ contribuidores, MIT, release diario — el proyecto open-source de LLM gateway más activo del ecosistema.

**¿Qué hace relevante para `proxy_mapper`?**
LiteLLM se promociona como "proxy unificado para 100+ LLMs", pero la **killer feature para este caso de uso** es el **PII Masking Guardrail** construido sobre Microsoft Presidio, con la capacidad de **restaurar (de-anonimizar) en la respuesta**.

**Funcionamiento del PII masking (revisado en código fuente):**

- **Pre-call hook** (`async_pre_call_hook` en `presidio.py`):
  - Itera sobre `data["messages"]` y, para cada contenido (string o lista de partes tipo OpenAI multimodal), llama a `check_pii(text, output_parse_pii=True, ...)`.
  - Por cada entidad detectada por Presidio, genera tokens numerados `<PERSON_1>`, `<EMAIL_2>`, etc.
  - **Almacena el mapping** `pii_tokens: { "<PERSON_1>": "Juan Pérez", ... }` en `request_data["metadata"]["pii_tokens"]` — esto es el equivalente al `user2llm` de `proxy_mapper`.

- **Post-call hook** (`async_post_call_success_hook`):
  - Si `output_parse_pii=True`, después de recibir la respuesta del LLM, recorre `response.choices[].message.content` y reemplaza los tokens `<PERSON_1>` por sus valores originales.
  - **También procesa `tool_calls[].function.arguments` y `function_call.arguments`** — crítico para el caso de OpenCode que usa tools intensivamente.
  - Para respuestas con streaming (`apply_to_output`), LiteLLM **ensambla el stream completo** y luego enmascara/redacta — no es tan elegante como el procesamiento chunk-por-chunk de `proxy_mapper`.

- **Modos de acción por entidad:** `MASK` (reemplaza con token numerado) o `BLOCK` (lanza `BlockedPiiEntityError` con HTTP 400).
- **Custom recognizers:** Soporta definir entidades custom vía archivo JSON (`presidio_ad_hoc_recognizers`) — esto podría simular el `mapping.tsv` de `proxy_mapper` si la entidad es un patrón regex, pero **no soporta sustitución literal** (solo regex + análisis NER).
- **Idiomas:** Configurable via `presidio_language` (en, es, de, etc.).
- **Manejo de tokens truncados:** Implementa un fallback ingenioso: si la respuesta del LLM truncó un token (por `max_tokens`), busca el final del texto y compara prefijos largos (overlap `min(20, len(token)//2)`).

**Limitaciones para el caso de uso de `proxy_mapper`:**

| Aspecto | `proxy_mapper` | LiteLLM |
|---|---|---|
| Diccionario de secretos curado por el usuario | ✅ TSV (`CASTROL` → `USRBOO`) | ❌ Solo regex + NER (no literal mapping) |
| Cero falsos positivos sobre identificadores arbitrarios | ✅ | ❌ Presidio puede fallar con NER; regex no captura `CASTROL` |
| Bidireccional reversible | ✅ | ✅ (`output_parse_pii=True`) |
| Streaming SSE con restauración incremental | ✅ Chunk por chunk | ⚠️ Ensambla el stream completo antes de restaurar |
| Tool_calls support | ✅ `transformValueDeep` recursivo | ✅ Sí (lo confirmé leyendo el código) |
| MiniMax / OpenAI-compatible providers | ✅ (es el caso de uso explícito) | ✅ (cualquier OpenAI-compatible vía config) |
| Complejidad operativa | Ligero (Node.js, 1 archivo, 0 deps de runtime) | Pesado (Python + Presidio + opcional PostgreSQL/Redis) |

**Veredicto:** Es **la mejor alternativa para reemplazarlo** si se está dispuesto a (a) aceptar PII auto-detectada en vez de diccionario curado, y (b) desplegar Presidio. Para el caso de identificadores arbitrarios como `CASTROL`, Presidio **no los va a detectar**; habría que enseñárselos como custom regex patterns, lo cual es frágil.

---

### 2. Portkey-AI/gateway

**Categoría:** LLM gateway empresarial.
**Stars / mantenimiento:** 12.7k, MIT. ⚠️ **Ralentizado** en los últimos meses (último commit de código mid-2026, con anuncio de "Gateway 2.0" hacia modelo comercial).

**¿Qué hace relevante?**
Es un gateway maduro con **5 proveedores de PII integrados** (Portkey Pro PII, Patronus AI, Pangea, AWS Bedrock Guardrails, Promptfoo) más un **Regex Match guardrail** para patrones custom.

**Funcionamiento del PII masking:**

- Hooks `before_request_hooks` (input) y `after_request_hooks` (output).
- **Limitación importante documentada:** *"Transformation is one-way (non-reversible)"*. Los tokens redactados **no se restauran automáticamente en la respuesta**. Para hacerlo bidireccional hay que implementar un webhook custom con gestión de estado.

**Veredicto:** Útil como gateway, pero **no resuelve el caso bidireccional out-of-the-box** sin trabajo adicional.

---

### 3. Kong AI Gateway (plugin `ai-sanitizer`)

**Categoría:** API gateway empresarial con plugin de AI.
**Stars / mantenimiento:** 44k en el repo principal, vendor-backed (Kong Inc.). Plugin mantenido dentro del ciclo de releases de Kong Gateway.

**¿Qué hace relevante?**
El plugin oficial **`ai-sanitizer`** (tier: `ai_gateway_enterprise` — requiere licencia) ofrece **enmascaramiento bidireccional explícito**:

- Anonimiza la request antes de enviarla al LLM (placeholder como `LOCATION` o sintético como `John` → `Amir`).
- En la respuesta, anonimiza el output (PII que el LLM haya podido generar).
- **"Restoration feature"** documentada explícitamente: *"allows the original request data to be reinstated in responses when needed"*.

**Limitaciones:**
- Requiere Kong Gateway Enterprise (licencia pagada).
- El anonimizador corre como contenedor Docker (mínimo 600 MB RAM).
- Es genérico (no específico para OpenAI/Anthropic); se enchufa como plugin al AI Proxy.

**Veredicto:** Solución robusta y bien soportada, pero **comercial con licencia enterprise**. No apropiado para un proyecto open-source salvo que se pague.

---

### 4. Microsoft Presidio (`data-privacy-stack/presidio`)

**Categoría:** Librería de detección + anonimización de PII (no es proxy).
**Stars / mantenimiento:** 10.5k, MIT, ~50 contribuidores, **proyecto migrado de `microsoft/presidio` a `data-privacy-stack/presidio`** (la URL de Microsoft ahora redirige). Activo.

**¿Por qué importa aquí?**
Es **la librería que usan internamente** LiteLLM, Kong AI Sanitizer, occludra/gateway, y muchos otros. Si ninguno de los proxies anteriores sirve, **siempre se puede usar Presidio como motor y armar un proxy encima** (que es exactamente lo que hacen esos proyectos).

Módulos:
- `presidio-analyzer` (detección: NLP + regex + reglas + checksums tipo Luhn).
- `presidio-anonymizer` (operadores: `replace`, `mask`, `redact`, `hash`, `encrypt`).
- `presidio-image-redactor`, `presidio-structured`, `presidio-cli`.

**Veredicto:** No es un reemplazo directo (es toolkit, no proxy). Pero es el **componente común** sobre el que se construyen casi todas las soluciones serias.

---

### 5. Helicone (`Helicone/helicone`)

**Categoría:** LLM observability + AI Gateway (Rust, subproyecto `bifrost`).
**Stars / mantenimiento:** 6.1k, Apache-2.0, Activo.

**¿Por qué importa?**
Es una alternativa **enfocada en observability** (logging, costs, traces, caching) que también funciona como gateway para 100+ proveedores. **No tiene PII masking built-in en OSS** — su propuesta de "LLM Security" es de su servicio cloud empresarial (SOC 2 / GDPR), no del repo abierto.

**Veredicto:** Útil como observability layer, pero **no resuelve el problema de masking**.

---

### 6. AegisGate (`ax128/AegisGate`)

**Categoría:** Security gateway para LLM APIs (todos los features: PII, prompt injection, sanitización de responses peligrosos).
**Stars / mantenimiento:** 58⭐, MIT, 330 commits, **equipo pequeño pero activo**.

**¿Qué hace relevante?**
Es el proyecto open-source con el conjunto de features **más cercano conceptual y técnicamente a un "proxy_mapper++ empresarial"**:

- PII redaction con **50+ categorías** (API keys, JWT, credit cards, crypto wallets, medical records, etc.).
- **Exact-value redaction** configurable (similar a mapping de `proxy_mapper`, pero vía config).
- Restoration de valores exactos en respuestas.
- Prompt injection detection (regex + semántico opcional).
- Output sanitization (shell commands peligrosos, SQL injection, etc.).
- OpenAI-compatible + Anthropic Messages API con conversión de protocolo.
- MCP y Agent SKILL integration (Claude Code, Cursor, Codex soportados oficialmente).
- Web admin UI.
- 9 forks (uso en producción visible).

**Limitaciones:**
- Comunidad mucho más chica que LiteLLM (58⭐ vs 56.5k⭐).
- Sin releases etiquetados (todo `main` directo).
- Dependencia de redes Docker externas en el docker-compose stock (mala UX para greenfield).

**Veredicto:** **El competidor open-source más directo a un "proxy_mapper empresarial"**. Si LiteLLM es demasiado genérico, AegisGate es el que mejor implementa la filosofía completa de "security gateway para AI agents". Pero su mantenibilidad a largo plazo es incierta (bus factor bajo).

---

### 7. ThinkWatchProject/ThinkWatch

**Categoría:** Enterprise AI bastion + MCP gateway (Rust).
**Stars:** 814, **851 commits**, 20 forks.

**Lo bueno:** Documentado soporte para PII redaction en streaming con placeholders `{{EMAIL_xxx_1}}` y restauración en respuestas no-streaming.

**⚠️ Limitación crítica de licencia:** **Business Source License 1.1** (no es OSI open source). Es gratis bajo el umbral de "10M tokens Y 10K MCP calls/mes UTC"; arriba de eso requiere licencia comercial. Para el uso de `proxy_mapper` con OpenCode probablemente se quede por debajo del umbral, pero **cambia la licencia de derivados** — si se quiere hacer fork, hay que leer la BSL con cuidado.

**Veredicto:** Interesante técnicamente pero la licencia restrictiva lo descarta para nuestro caso (queremos algo open source "probado").

---

### 8. Censgate/redact

**Categoría:** PII/secrets detection + gateway OpenAI-compatible + scanner Postgres (Rust).
**Stars:** 16. Demasiado chico para considerarlo "probado".

**Veredicto:** Anotado por completitud, descartado por escala.

---

### 9. Candidatos eliminados o descontinuados

- **~~protectai/llm-guard~~ (3.2k⭐, MIT)** — Era el toolkit más conocido de input/output scanning. **Archivado el 9 de julio de 2026**. README ahora dice explícitamente *"no longer under active development"*. Hay forks comunitarios pero el proyecto oficial está muerto. Si se considera, tomar un fork vivo.
- **occludra/gateway, 0M3REXE/eidolon, sphragis-oss/sphragis** — Analizados en profundidad en la sesión anterior. Bien diseñados técnicamente pero **mantenidos por una sola persona** cada uno. No califican como "probado" en el sentido estricto del usuario (que pidió evitar proyectos de una sola persona). Se mantienen en la tabla para referencia pero no son alternativas viables a largo plazo.
- **MM-sheng/zeroleak-llm-proxy, dousheng34/pii-anonymization-gateway, Ciprian-LocalPulse/ai-privacy-gateway** — Proyectos sin tracción (0-1⭐, <10 commits). Descartados.

---

### 💼 Soluciones comerciales o SaaS (referenciadas)

| Solución | Tipo | PII masking bidireccional | Notas |
|---|---|---|---|
| **AWS Bedrock Guardrails** | Capa de Bedrock (no proxy HTTP genérico) | ✅ Input + output (Bedrock-only) | Solo sirve para modelos en Bedrock. No aplica a OpenAI/Anthropic/MiniMax externos. |
| **Google Cloud DLP API** | API, no proxy | ✅ (vos armás el proxy encima) | 100+ infoTypes, excelente calidad. Es el motor que muchos usan. |
| **Azure AI Language (PII)** | API, no proxy | ✅ (vos armás el proxy encima) | Servicio separado del Azure AI Content Safety. |
| **Cloudflare AI Gateway** | Proxy HTTP transparente | ❌ No PII built-in (analytics/cache/rate-limit solo) | Excelente proxy; sin masking. |
| **Prisma AIRS (ex Protect AI)** | AI Gateway empresarial | ✅ Runtime inline masking | Comercial Palo Alto Networks; puesto a puerta de VPC. |
| **Lasso Security** | Sidecar sobre gateways (Kong/Portkey/LiteLLM/Envoy) | ✅ Runtime policy | Comercial; se monta sobre **otros** gateways — no es independiente. |
| **Private AI → Limina** | API/SDK/contenedor | ✅ Self-hosted; calidad muy alta | 50+ entidades, 52 idiomas, context-aware. Mejor calidad de mercado, pero hay que armar el proxy. |
| **Skyflow** | Vault + Kong partner | ✅ Tokenize/detokenize con governance | Datos tokenizados siguen siendo útiles para el LLM (preserva formato). |

---

## 📐 Tabla comparativa: `proxy_mapper` vs candidatos

Comparación **funcional** (no de métricas). Las celdas marcadas con ✅ significan que la feature está soportada out-of-the-box sin código custom.

| Característica | `proxy_mapper` | **litellm** | Portkey | Kong ai-sanitizer | AegisGate | Presidio (lib) |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Tipo** | Proxy dedicado | Proxy multipropósito | Gateway | Plugin de gateway | Gateway | Librería |
| **Proxy HTTP OpenAI-compatible** | ✅ | ✅ | ✅ | ✅ (vía AI Proxy) | ✅ | ❌ (vos armás) |
| **Definir secretos por el usuario** | ✅ TSV literal | ⚠️ Solo regex custom | ⚠️ Solo regex custom | ⚠️ Solo regex custom | ⚠️ Config exact-value | ❌ (vos armás) |
| **Cero falsos positivos sobre IDs arbitrarios** | ✅ (solo lo que está en TSV) | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Auto-detección de PII estándar (email, SSN, tarjeta)** | ❌ | ✅ Presidio | ✅ 5 providers | ✅ | ✅ 50+ categorías | ✅ |
| **Mapeo bidireccional reversible** | ✅ | ✅ `output_parse_pii=True` | ⚠️ Webhook custom | ✅ Restoration | ✅ Restoration | ✅ `deanonymize()` |
| **Streaming SSE con enmascaramiento incremental** | ✅ Chunk por chunk | ⚠️ Ensambla stream completo | ⚠️ No claro | ⚠️ No claro | ✅ (mencionado) | N/A (vos armás) |
| **`tool_calls[].function.arguments` procesado** | ✅ `transformValueDeep` | ✅ (verificado en código) | ⚠️ Depende del provider | ⚠️ Limitado a OpenAI | ✅ | N/A |
| **Manejo de `tool_calls` fragmentados en stream** | ✅ Re-acumula | ⚠️ Ensambla stream | ❌ | ❌ | ⚠️ No claro | N/A |
| **Detección de leaks (defensa en profundidad)** | ✅ LEAK DETECTED | ✅ `BlockedPiiEntityError` | ⚠️ Hooks custom | ✅ | ✅ | ❌ |
| **Multi-proveedor (OpenAI, Anthropic, Gemini, etc.)** | ❌ (solo configurado para MiniMax) | ✅ 100+ | ✅ 1500+ | ✅ (vía AI Proxy) | ✅ OpenAI + Anthropic + custom | N/A |
| **Configuración declarativa del diccionario** | ✅ `mapping.tsv` | ❌ (vos armás reconocimiento custom) | ❌ | ❌ | ⚠️ Config JSON | ❌ |
| **Log de mappings aplicados por request** | ✅ (verbose) | ✅ Langfuse/Datadog/etc | ✅ Vendor | ✅ | ✅ | ❌ (vos armás) |
| **Rate limiting / auth API key** | ❌ | ✅ Built-in | ✅ Built-in | ✅ Built-in | ✅ Built-in | N/A |
| **Caché de respuestas** | ❌ | ✅ Built-in | ✅ Built-in | ✅ Built-in | ❌ | N/A |
| **Costo de despliegue** | Bajo (1 archivo, 0 deps runtime) | Alto (Python + Presidio + opcional DB) | Medio (Node) | Alto (Kong Enterprise) | Bajo (Docker Compose) | N/A (lib) |

---

## 🧭 Conclusión y recomendación

### 1. ¿Existe algo probado que resuelva esto?

**Sí:** `BerriAI/litellm` (con el guardrail PII de Presidio + `output_parse_pii=True`) es **equivalente en funcionalidad core** y está en producción masiva (56.5k⭐, usado por miles de empresas). Cumple:
- ✅ Proxy OpenAI-compatible.
- ✅ Detección de PII estándar (con Presidio).
- ✅ Restauración bidireccional (`<PERSON_1>` → `Juan Pérez`).
- ✅ Procesa `tool_calls[].function.arguments`.
- ✅ Maneja multi-proveedor (100+ LLMs).

**No cumple:**
- ❌ **Diccionario curado por el usuario** con literales arbitrarios (`CASTROL` → `USRBOO`).
- ❌ **Cero falsos positivos** sobre identificadores que no son PII estándar.
- ⚠️ Ensambla el stream antes de restaurar (no incremental como `proxy_mapper`).

### 2. ¿Qué decisión tomar?

Depende de qué valor diferencial tiene `proxy_mapper` para vos:

#### Escenario A — Querés un proxy PII estándar, no te importa el diccionario curado
→ **Migrá a LiteLLM**. Es más sólido, mantenido por una comunidad grande, y todo lo que hace `proxy_mapper` lo hace LiteLLM excepto el caso del diccionario curado. El esfuerzo de migración es bajo (configurar `litellm/config.yaml` con guardrail PII + `output_parse_pii: True` + agregar MiniMax como provider).

#### Escenario B — El diccionario curado es tu diferenciador clave (`CASTROL` → `USRBOO`)
→ **Seguí con `proxy_mapper`**, pero **re-arquitectalo sobre infraestructura probada**. Esto significa:
  - Mantener el TSV curado (el diferenciador único).
  - Reusar **LiteLLM** o **AegisGate** como **gestor de proxy/routing/auth/observability** debajo.
  - Enriquecer el TSV con regex custom + integración opcional con Presidio para PII estándar (modo "TSV + capa opcional NER").
  - Publicar el proyecto como un **plugin de LiteLLM** o como un **complemento** sobre `presidio-anonymizer`.

#### Escenario C — Querés construir un "security gateway para AI agents" tipo AegisGate
→ Revisá AegisGate primero. Si su roadmap te sirve, contribuí ahí en vez de competir. Si pensás que podés superarlo, **forkealo** y sumale LiteLLM por debajo (no reinventar routing).

### 3. Recomendación concreta para el repo

Sugerimos **no seguir manteniendo `proxy_mapper` como proxy genérico**. La capa de "proxy OpenAI-compatible" está resuelta masivamente por LiteLLM y AegisGate, y mantener una versión propia compite en inferioridad de condiciones (bus factor bajo, sin observabilidad, sin auth, sin fallback de proveedor).

**El valor único de `proxy_mapper` — el `mapping.tsv` bidireccional con cero falsos positivos — debería sobrevivir en una de estas formas:**

1. **Como plugin de LiteLLM** (más impacto, llega a 56.5k⭐ de usuarios).
2. **Como adaptador sobre `presidio-anonymizer`** (más portable; cualquier proxy que use Presidio puede adoptarlo).
3. **Conservado como proyecto independiente**, pero solo si vas a sumarle features que LiteLLM no tiene (ej: compilation TSV → regex automática + UI web de gestión).

Si la decisión es seguir con `proxy_mapper`, el roadmap inmediato debería ser:
- Hot-reload del `mapping.tsv`.
- API admin para gestionar mappings remotamente.
- Reescribir el streaming sobre `aho-corasick` (como hace eidolon) en vez de regex lineal, por performance con diccionarios grandes.
- Sumar métricas y autenticación.
- Publicar como **Custom Provider OpenAI-compatible** para que **cualquier** IDE/SDK (no solo OpenCode) pueda usarlo.

---

## 📎 Apéndice — URLs de referencia

- LiteLLM PII guardrail: https://docs.litellm.ai/docs/proxy/guardrails
- LiteLLM source: https://github.com/BerriAI/litellm/blob/main/litellm/proxy/guardrails/guardrail_hooks/presidio.py
- Presidio docs: https://microsoft.github.io/presidio/
- Presidio moved: https://github.com/data-privacy-stack/presidio
- Portkey: https://github.com/Portkey-AI/gateway
- Kong plugin: https://docs.konghq.com/hub/kong-inc/ai-sanitizer/
- AegisGate: https://github.com/ax128/AegisGate
- ThinkWatch: https://github.com/ThinkWatchProject/ThinkWatch
- Helicone: https://github.com/Helicone/helicone
- Cloudflare AI Gateway: https://developers.cloudflare.com/ai-gateway/
- llm-guard (archivo): https://github.com/protectai/llm-guard
