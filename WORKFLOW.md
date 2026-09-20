# WORKFLOW.md

## Flujo de Trabajo con Historias de Usuario

Este documento define cómo trabajar con las Historias de Usuario (US) en el proyecto.

---

## Proceso de Desarrollo por US

### 1. Recepción de US

Cuando se asigne una US, esta debe incluir:
- **Título** de la historia
- **Descripción** (Como usuario quiero...)
- **Criterios de aceptación** (Given/When/Then)
- **Enlace al ticket** (Azure DevOps, Jira, etc.)

### 2. Revisión Previa

Antes de implementar, el agente revisará:

| Archivo | Propósito |
|---------|----------|
| **ANALISYS.md** | Requisitos y reglas del negocio |
| **STACK.md** | Tecnologías y herramientas |
| **CONTEXT.md** | Arquitectura y estado actual |
| **Código existente** | Para no duplicar lógica |

### 3. Desarrollo

```
1. Leer y confirmar comprensión de la US
2. Revisar código existente del proyecto
3. Implementar según criterios de aceptación
4. Crear tests si aplica
5. Verificar (lint/build según VERIFICATION.md)
```

### 4. Entregable

El agente entregará:
- Archivos creados/modificados
- Confirmación de criterios de aceptación cumplidos
- Notas sobre decisiones de diseño
- Advertencias si hay bloqueos o dependencias

---

## Estado de la US

| Estado | Descripción |
|--------|-------------|
| **Pendiente** | US asignada pero no iniciada |
| **En Análisis** | Entendiendo requisitos |
| **En Desarrollo** | Implementando |
| **En Review** | Esperando feedback |
| **Completada** | Aprobada y mergeada |

---

## Formato de US (Referencia)

```markdown
# US-001: [Título]

## Descripción
Como [tipo de usuario], quiero [funcionalidad] para [beneficio].

## Criterios de Aceptación
- [ ] Criterio 1
- [ ] Criterio 2
- [ ] Criterio 3

## Notas Técnicas
[Decisiones de implementación]

## Bloqueos
[Dependencias o issues bloqueantes]
```

---

## Integración con Azure DevOps / Jira

Este documento funciona como **guía offline** de desarrollo. 
Los estados oficiales viven en la herramienta de gestión de proyectos.

Para cada US:
1. Revisar el ticket en Azure DevOps
2. Desarrollo siguiendo este workflow
3. Actualizar estado en Azure DevOps al completar