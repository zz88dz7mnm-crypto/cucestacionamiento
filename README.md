# Sistema de Estacionamiento con Supabase

Esta version guarda eventos y tickets en Supabase para que administrador y cobradores compartan la misma informacion desde distintos dispositivos.

## Cargar la base

1. Entra a tu proyecto de Supabase.
2. Abre SQL Editor.
3. Copia y pega el contenido de `supabase.sql`.
4. Ejecuta el script completo.

El script es seguro para correrlo mas de una vez: usa `create table if not exists` y recrea las politicas.

## Usar la app

Abre `index.html` en el navegador o servila en red local:

```bash
cd estacionamiento-supabase
python3 -m http.server 8080
```

Despues entra desde la compu o celulares a:

```txt
http://TU-IP-LOCAL:8080
```

## Credenciales

Administrador:

- Usuario: `Admin`
- Contrasena: `Universitario1907`

Para cambiarlas, edita esta linea en `db.js`:

```javascript
ADMIN: { username: 'Admin', password: 'Universitario1907' },
```

## Archivos importantes

```txt
index.html     - carga la app y la libreria de Supabase
db.js          - conexion y operaciones contra Supabase
app.js         - pantallas y logica de la aplicacion
supabase.sql   - tablas y politicas para pegar en SQL Editor
style.css      - estilos
```
