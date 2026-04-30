# 🅿️ Sistema de Estacionamiento por Eventos

Sistema web completo para gestionar cobros de estacionamiento en eventos del club.

---

## 🚀 Cómo usarlo

### Opción 1 — Abrir directamente (sin servidor)
Simplemente abrí `index.html` en cualquier navegador moderno (Chrome, Firefox, Edge).

### Opción 2 — Red local (celulares)
Si querés que los cobradores accedan desde sus celulares:

1. Instalá Python (ya viene en Mac/Linux):
```bash
cd estacionamiento
python3 -m http.server 8080
```
2. Abrí `http://TU-IP-LOCAL:8080` desde cualquier celular en la misma red WiFi.
   (Tu IP local la encontrás en Configuración de red, suele ser 192.168.x.x)

---

## 🔐 Credenciales por defecto

**Administrador:**
- Usuario: `admin`
- Contraseña: `club2024`

Para cambiarlas, editá la línea en `db.js`:
```javascript
ADMIN: { username: 'admin', password: 'club2024' },
```

---

## 📋 Flujo de uso

### Admin
1. Ingresar → Administrador → usuario + contraseña
2. Crear evento (nombre, fecha, categoría, monto, alias de transferencia, cobradores)
3. El evento queda ACTIVO y disponible para los cobradores
4. Al finalizar: "Terminar evento" → genera resumen automático
5. Desde el resumen: exportar a Excel (archivo .tsv, abre en Excel/Sheets)

### Cobrador
1. Ingresar → Cobrador → nombre y apellido (exacto como lo cargó el admin)
2. Seleccionar evento del dropdown
3. Ingresar número de ticket + método de pago
4. Registrar → se guarda inmediatamente

---

## ⚙️ Datos

Los datos se guardan en el **localStorage** del navegador.

> ⚠️ Si el admin y los cobradores usan **distintos navegadores o dispositivos**, cada uno tiene su propio localStorage.
> Para uso en red (múltiples dispositivos), usá la **Opción 2** con Python.

---

## 🏗️ Archivos

```
estacionamiento/
├── index.html    ← Punto de entrada
├── style.css     ← Estilos (diseño oscuro industrial)
├── db.js         ← Capa de datos (localStorage)
├── app.js        ← Lógica y vistas de la aplicación
└── README.md     ← Este archivo
```

---

## 📊 Exportación Excel

El archivo exportado es `.tsv` (valores separados por tabulación).
Se abre directamente en Microsoft Excel, Google Sheets y LibreOffice Calc.

Contiene 3 secciones:
1. **Resumen general** — totales por método de pago
2. **Detalle de tickets** — todos los números registrados
3. **Autos gratis** — patente, nombre y razón

---

## 💡 Notas importantes

- El sistema **no permite duplicar números de ticket** dentro del mismo evento.
- Si el evento está **FINALIZADO**, no se pueden cargar más tickets (bloqueado).
- Los datos persisten aunque se cierre y reabra el navegador.
- Múltiples eventos pueden estar **activos simultáneamente**.
