# Panel del menú

**Enlace:** https://restfullrestobar-byte.github.io/restfull/admin.html

El dueño entra con **una contraseña** y edita el menú desde el celular.
No necesita cuenta de GitHub ni ver nada técnico.

```
Panel (celular)  ──contraseña──>  Apps Script  ──>  hoja "Menu"
Menú (clientes)  ──────────────>  Apps Script  ──>  hoja "Menu"
```

El menú vive en **tu Google Sheet**, al lado de Clientes y Configuracion.
GitHub no participa: solo guarda las dos páginas HTML.

---

# Instalación — 3 pasos, una sola vez

## 1. Pegar el código
1. Abrir el editor de Apps Script del proyecto
2. Copiar todo **`apps-script-panel.gs`** y pegarlo **al final** de `Code.gs`
3. Buscar la función `routeAction_` y agregarle estas 2 líneas junto a los otros `case`:

```javascript
    case 'getMenu':     return getMenu_(params);
    case 'guardarMenu': return guardarMenu_(params);
```

4. Guardar 💾

## 2. Crear la hoja con los platos
Ejecutar **`seedMenuDesdeGitHub`** ▶️ una sola vez.

Crea la hoja **Menu** con los 99 platos actuales. En el registro tiene que decir
`✅ Hoja "Menu" creada con 99 platos.`

## 3. Contraseña y fecha de corte
En la hoja **Configuracion**, agregar dos filas:

| parametro | valor | descripcion |
|---|---|---|
| `menu_password` | `loquesea2026` | Contraseña del dueño |
| `menu_pagado_hasta` | `2026-11-30` | Último día con edición habilitada |

## 4. Volver a desplegar ⚠️
El código nuevo recién entra en vigor al redesplegar:

**Implementar → Administrar implementaciones → ✏️ editar → Versión: Nueva versión → Implementar**

> Usá **editar la implementación existente**, no "Nueva implementación".
> Si la URL cambia, las páginas dejan de encontrar el servidor.

## 5. Probar
Ejecutar **`probarPanel`** ▶️. Tiene que decir:
```
menu_password: configurada
menu_pagado_hasta: 2026-11-30
✅ Hoja Menu OK — 99 platos en 10 secciones.
```

---

# El cobro mensual

Una celda de la hoja **Configuracion**:

| Situación | Qué hacés |
|---|---|
| **Pagó** | `menu_pagado_hasta` → último día del mes nuevo |
| **No pagó** | Nada. Llega la fecha y la edición se corta sola |
| **Cortar ya** | `menu_pagado_hasta` → una fecha pasada |
| **Cambiar contraseña** | `menu_password` → valor nuevo |

Tarda hasta 30 segundos en aplicarse (hay un cache corto).

Se valida **en el servidor**: no se saltea con F12.

**El menú de los clientes nunca se bloquea.** Pague o no, la carta se sigue viendo.

---

# Protecciones

- **Fuerza bruta**: 8 intentos fallidos → bloqueo de 15 minutos
- **Borrado accidental**: si llegaran menos de 20 platos, rechaza guardar
- **Respaldo**: cada guardado deja la versión anterior en la hoja `Menu_Backup`
- **Guardado simultáneo**: usa un lock, no se pisan dos ediciones
- **Si el servidor no responde**: el menú usa lo guardado en el navegador;
  si tampoco hay, la carta escrita en `index.html`. Nunca una pantalla vacía

# Deshacer un cambio
La hoja **Menu_Backup** tiene la versión anterior. Copiar y pegar sobre **Menu**.

# Editar sin el panel
También podés editar la hoja **Menu** a mano. Los cambios se ven al instante,
sin contraseña ni fecha de corte (vos tenés acceso directo al Sheet).
