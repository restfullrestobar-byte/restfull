# Panel del menú

**Enlace:** https://restfullrestobar-byte.github.io/restfull/admin.html

El dueño entra con una **contraseña** y edita el menú. No necesita cuenta de GitHub
ni ver nada técnico.

```
Panel (navegador)  ──contraseña──>  Apps Script  ──token──>  GitHub  ──>  menu.json
                                    (servidor)
```

El token de GitHub vive **solo en el servidor de Apps Script**. Nunca llega al
navegador, así que no se puede sacar del código fuente.

---

# Instalación (una sola vez)

## 1. Crear el token de GitHub
Tiene que ser **classic** — los *fine-grained* no sirven para repos de otra cuenta
donde solo sos colaborador.

1. **github.com/settings/tokens/new**
2. Note: `Panel menú Restful`
3. Expiration: **No expiration** (el corte mensual no lo hace el token, ver abajo)
4. Scopes: marcar **`repo`**
5. Generar y copiar

## 2. Instalar el código
1. Abrir el Apps Script del proyecto
2. Copiar todo `apps-script-panel.gs` y pegarlo **al final** de `Code.gs`
3. Buscar la función `routeAction_` y agregarle estas 2 líneas junto a los otros `case`:

```javascript
    case 'menuEstado':   return menuEstado_(params);
    case 'publicarMenu': return publicarMenu_(params);
```

4. Guardar 💾

## 3. Guardar el token
1. En `Code.gs`, buscar `guardarTokenGitHub`
2. Pegar el token en la variable `TOKEN`
3. Ejecutar la función ▶️
4. **Borrar el token de la variable** y guardar (ya quedó guardado aparte)

## 4. Poner contraseña y fecha de corte
En la hoja **Configuracion**, agregar dos filas:

| parametro | valor | descripcion |
|---|---|---|
| `menu_password` | `loquesea2026` | Contraseña del mes |
| `menu_pagado_hasta` | `2026-11-30` | Último día con edición habilitada |

## 5. Volver a desplegar ⚠️
El código nuevo no entra en vigor hasta redesplegar:

**Implementar → Administrar implementaciones → ✏️ (editar) → Versión: Nueva versión → Implementar**

> Usá **editar la implementación existente**, no "Nueva implementación".
> Así la URL no cambia y el panel sigue funcionando.

## 6. Probar
Ejecutar `probarPanel` ▶️. Tiene que decir `✅ GitHub OK — 99 platos leídos.`

---

# El cobro mensual

Todo pasa por una celda de la hoja **Configuracion**:

| Situación | Qué hacés |
|---|---|
| **Pagó** | `menu_pagado_hasta` → último día del mes nuevo |
| **No pagó** | Nada. Llega la fecha y la edición se corta sola |
| **Querés cortar ya** | `menu_pagado_hasta` → una fecha pasada |
| **Cambiar contraseña** | `menu_password` → valor nuevo |

Los cambios tardan hasta 30 segundos en aplicarse (hay un cache corto).

La validación corre **en el servidor**: no se saltea con F12.
Cuando está vencido, el panel muestra el aviso y deshabilita publicar.

**El menú que ven los clientes nunca se bloquea.** Es un archivo estático que se
sigue sirviendo igual, se pague o no.

---

# Protecciones incluidas

- **Fuerza bruta**: a los 8 intentos fallidos se bloquea 15 minutos.
- **Borrado accidental**: si un bug mandara menos de 20 platos, el servidor
  rechaza la publicación en vez de dejarte la carta vacía.
- **Edición simultánea**: si alguien más tocó el menú, avisa en vez de pisarlo.
- **Caída del JSON**: `index.html` trae la carta escrita adentro como respaldo.
  Si `menu.json` no carga, el cliente ve igual la última versión buena.

# Volver atrás un cambio
Cada publicación es un commit. En GitHub: historial de `menu.json` → la versión
buena → copiar contenido → o directamente `git revert` del commit.
