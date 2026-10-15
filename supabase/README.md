# Dashboard del menú — Instalación

## 1. Crear el proyecto
1. Entrar a **supabase.com** → New project (gratis).
2. Guardar la contraseña de la base que te pide (no se usa acá, pero no la pierdas).

## 2. Crear las tablas
Supabase → **SQL Editor** → New query → pegar y correr, **en este orden**:
1. `01_schema.sql` — tablas, permisos y reglas de bloqueo
2. `02_datos.sql` — los 99 platos migrados del menú actual

## 3. Conectar el sitio
Supabase → **Project Settings → Data API**, copiar:
- **Project URL**
- **anon public key**

Pegarlos en `sb-config.js` (en la raíz del repo). La anon key es pública por diseño: no da
acceso de escritura, eso lo controlan las reglas de la base.

## 4. Crear los usuarios
Supabase → **Authentication → Users → Add user** (marcar *Auto Confirm User*):
- El del dueño (rol `dueno`, se asigna solo)
- El tuyo

Después, en SQL Editor, convertirte en admin:
```sql
update perfiles set rol = 'admin' where email = 'TU-CORREO@gmail.com';
```

## 5. Listo
Entrar a `https://restfullrestobar-byte.github.io/restfull/admin.html`

---

## Cómo funciona el bloqueo

| Situación | Menú público | Edición |
|---|---|---|
| Mes pagado | ✅ funciona | ✅ habilitada |
| Mes pendiente, día 1–5 | ✅ funciona | ✅ habilitada (gracia) |
| Mes pendiente, día 6+ | ✅ **funciona igual** | 🔒 bloqueada |
| Sos admin | ✅ funciona | ✅ siempre habilitada |

El bloqueo se aplica en **Postgres**, no en el navegador — no se puede saltar con F12.
El menú que ven los clientes **nunca** se bloquea.

## Ajustes
```sql
-- Cambiar días de gracia
update config set valor = '7' where clave = 'dias_gracia';
-- Cambiar el monto
update config set valor = '30' where clave = 'monto_mensual';
```
