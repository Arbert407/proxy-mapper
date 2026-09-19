# Configurar un Custom Provider para MiniMax en OpenCode

Este documento describe cómo configurar OpenCode para usar MiniMax como provider a través de un custom provider OpenAI-compatible.

## Requisitos

- OpenCode instalado ([https://opencode.ai](https://opencode.ai))
- API key de MiniMax ([obtener aquí](https://platform.minimaxi.com))
- Node.js (si usas el proxy de ejemplo)

## Endpoints de MiniMax

| Recurso | URL |
|---------|-----|
| Base URL | `https://api.minimax.io` |
| Chat Completions | `/v1/chat/completions` |
| Models | No documentado publicly |

Modelo disponible: `MiniMax-M2.7`

## Configuración de OpenCode

Edita tu archivo `opencode.json` en la raíz del proyecto:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "minimax": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "MiniMax",
      "options": {
        "baseURL": "https://api.minimax.io/v1",
        "apiKey": "{env:MINIMAX_API_KEY}"
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

### Usar el provider

En tu configuración de model, especifica:

```json
{
  "model": "minimax/MiniMax-M2.7"
}
```

## Configuración de Variables de Entorno

```bash
export MINIMAX_API_KEY="tu_api_key_de_minimax"
```

## Alternativa: Usar un Proxy Intermedio

Si necesitas transformar requests/responses o agregar lógica custom antes de conectarte a MiniMax, puedes usar un proxy.

### Requisitos del Proxy

- Implementar el endpoint `/v1/chat/completions` (POST, streaming SSE)
- Implementar el endpoint `/v1/models` (GET)
- Compatible con el formato OpenAI Chat Completions

### Ejemplo Mínimo con Express

```javascript
import express from 'express';

const app = express();
app.use(express.json());

app.post('/v1/chat/completions', async (req, res) => {
  const apiKey = req.headers['authorization']?.replace('Bearer ', '');
  
  const response = await fetch('https://api.minimax.io/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      ...req.body,
      model: req.body.model || 'MiniMax-M2.7'
    })
  });

  res.setHeader('Content-Type', 'text/event-stream');
  response.body.pipe(res);
});

app.get('/v1/models', (_req, res) => {
  res.json({
    object: 'list',
    data: [{ id: 'MiniMax-M2.7', object: 'model', owned_by: 'minimax' }]
  });
});

app.listen(3000);
```

### Configurar OpenCode para usar el Proxy

```json
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "minimax-local": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "MiniMax (Local Proxy)",
      "options": {
        "baseURL": "http://localhost:3000/v1",
        "apiKey": "dummy-key"
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

## Limitaciones Conocidas

1. **Mappings personalizados**: El `index.js` actual aplica transformaciones `XXWW -> SSVV` que son específicas del caso de uso. OpenCode no soporta este tipo de transformaciones out-of-the-box; sería necesario un proxy intermedio.

2. **Auth header**: MiniMax usa `Authorization: Bearer` estándar, no `X-API-Key`.

3. **Streaming**: OpenCode soporta streaming SSE para chat completions.

## Referencias

- [OpenCode Providers Documentation](https://github.com/anomalyco/opencode/blob/dev/packages/web/src/content/docs/providers.mdx)
- [OpenCode Configuration Schema](https://github.com/anomalyco/opencode/blob/dev/packages/core/src/plugin/skill/customize-opencode.md)
- [AI SDK OpenAI-Compatible Package](https://www.npmjs.com/package/@ai-sdk/openai-compatible)
- [MiniMax Platform](https://platform.minimaxi.com)
- [agentgateway OpenAI-Compatible Providers](https://agentgateway.dev/docs/kubernetes/main/llm/providers/openai-compatible/)
