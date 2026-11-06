# Panel del menú

**Enlace:** https://restfullrestobar-byte.github.io/restfull/admin.html

El menú vive en `menu.json`. El panel lo edita y lo publica como un commit;
GitHub Pages lo republica en menos de un minuto.

---

## Dar acceso a alguien (lo hace Bryan)

1. Entrar a **github.com/settings/personal-access-tokens/new**
2. Completar:

   | Campo | Valor |
   |---|---|
   | Token name | `Menu Restful — <mes>` |
   | Expiration | **último día del mes pagado** |
   | Repository access | Only select repositories → `restfullrestobar-byte/restfull` |
   | Permissions → Repository → **Contents** | **Read and write** |

3. Generar y pasarle la clave por WhatsApp. Se pega una sola vez en el panel.

## El cobro

La **fecha de vencimiento del token es la suscripción**. Se vence a fin de mes:
el panel deja de publicar solo, sin que nadie tenga que hacer nada.

- **Pagó** → generás un token nuevo con vencimiento a fin del mes siguiente.
- **No pagó** → no hacés nada. El token muere solo.

Lo aplica GitHub, no el navegador: no se puede saltar con F12.

**El menú que ven los clientes nunca se bloquea** — es un archivo estático que
sigue sirviéndose igual, se publique o no.

## Cortar el acceso antes de tiempo
github.com/settings/personal-access-tokens → el token → **Revoke**.

---

## Si algo sale mal

El `index.html` trae el menú escrito adentro como respaldo. Si `menu.json`
no carga (sin red, archivo roto), el cliente ve igual la última carta buena.
Nunca una pantalla vacía.

Para volver atrás un cambio: `git revert` del commit, o editar `menu.json`
directo en GitHub.
