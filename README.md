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
- Usuario: `Admin`
- Contraseña: `Universitario1907`

Para cambiarlas, editá la línea en `db.js`:
```javascript
ADMIN: { username: 'Admin', password: 'Universitario1907' },
```

---

## 📋 Flujo de uso

### Admin
1. Ingresar → Administrador → usuario + contraseña
2. Crear evento eligiendo equipo local vs visitante, fecha, categoría, monto y alias de transferencia
3. El evento queda ACTIVO y disponible para los cobradores
4. Al finalizar: "Terminar evento" → genera resumen automático
5. Desde el resumen: descargar Excel `.xls` o copiar el resumen en texto

### Cobrador
1. Ingresar → Cobrador → nombre, documento y evento activo
2. Confirmar el ingreso al evento elegido
3. Ingresar número de ticket + método de pago
4. Registrar → se guarda inmediatamente

---

## ⚙️ Datos

Los datos se guardan en el **localStorage** del navegador.

> ⚠️ Si el admin y los cobradores usan **distintos navegadores o dispositivos**, cada uno tiene su propio localStorage.
> Para uso real en red con la misma información en simultáneo hace falta una base de datos compartida y un backend/API. Servir el HTML con Python solo comparte los archivos de la app, no comparte los datos.

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

El archivo exportado es `.xls` con formato XML compatible con Microsoft Excel, Google Sheets y LibreOffice Calc.

Contiene 3 secciones:
1. **Resumen general** — totales por método de pago
2. **Detalle de tickets** — todos los números registrados, hora, cobrador y documento
3. **Autos gratis** — patente, nombre, razón y hora

---

## 💡 Notas importantes

- El sistema **no permite duplicar números de ticket** dentro del mismo evento.
- Si el evento está **FINALIZADO**, no se pueden cargar más tickets (bloqueado).
- Los datos persisten aunque se cierre y reabra el navegador.
- Múltiples eventos pueden estar **activos simultáneamente**.
