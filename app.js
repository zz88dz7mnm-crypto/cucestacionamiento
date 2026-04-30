// ============================================================
//  app.js — lógica y vistas de la aplicación
// ============================================================

const App = {
  state: {
    vista: 'inicio',      // inicio | admin-login | admin-panel | admin-evento | cobrador-login | cobrador-evento | resumen
    adminLogueado: false,
    cobradorNombre: null,
    eventoSeleccionado: null,
    mensaje: null,
    error: null,
  },

  // ── RENDER PRINCIPAL ─────────────────────────────────────
  render() {
    const app = document.getElementById('app');
    const { vista } = this.state;
    if (vista === 'inicio')          app.innerHTML = this.vistaInicio();
    else if (vista === 'admin-login') app.innerHTML = this.vistaAdminLogin();
    else if (vista === 'admin-panel') app.innerHTML = this.vistaAdminPanel();
    else if (vista === 'admin-evento') app.innerHTML = this.vistaAdminEvento();
    else if (vista === 'cobrador-login') app.innerHTML = this.vistaCobradorLogin();
    else if (vista === 'cobrador-evento') app.innerHTML = this.vistaCobradorEvento();
    else if (vista === 'resumen')    app.innerHTML = this.vistaResumen();
    this.bindEvents();
  },

  ir(vista, extra = {}) {
    this.state = { ...this.state, ...extra, vista, mensaje: null, error: null };
    this.render();
  },

  // ── VISTA INICIO ─────────────────────────────────────────
  vistaInicio() {
    return `
      <div class="pantalla-inicio">
        <div class="logo-bloque">
          <div class="logo-icon">P</div>
          <h1>Estacionamiento</h1>
          <p class="subtitulo">Sistema de gestión por eventos</p>
        </div>
        <div class="opciones-inicio">
          <button class="btn-grande btn-admin" data-accion="ir-admin-login">
            <span class="btn-icon">⚙</span>
            <span class="btn-label">Administrador</span>
          </button>
          <button class="btn-grande btn-cobrador" data-accion="ir-cobrador-login">
            <span class="btn-icon">🎫</span>
            <span class="btn-label">Cobrador</span>
          </button>
        </div>
      </div>`;
  },

  // ── ADMIN LOGIN ──────────────────────────────────────────
  vistaAdminLogin() {
    return `
      <div class="pantalla-form">
        <div class="form-card">
          <div class="form-header">
            <button class="btn-volver" data-accion="ir-inicio">← Volver</button>
            <h2>Acceso Administrador</h2>
          </div>
          ${this.state.error ? `<div class="alerta-error">${this.state.error}</div>` : ''}
          <div class="campo">
            <label>Usuario</label>
            <input type="text" id="admin-user" placeholder="Admin" autocomplete="off">
          </div>
          <div class="campo">
            <label>Contraseña</label>
            <input type="password" id="admin-pass" placeholder="contraseña">
          </div>
          <button class="btn-primario" data-accion="admin-login">Ingresar</button>
        </div>
      </div>`;
  },

  // ── ADMIN PANEL ──────────────────────────────────────────
  vistaAdminPanel() {
    const eventos = DB.getEventos();
    const activos = eventos.filter(e => e.estado === 'ACTIVO');
    const finalizados = eventos.filter(e => e.estado === 'FINALIZADO');

    const filaEvento = (e) => {
      const tickets = DB.getTickets(e.id);
      const pagados = tickets.filter(t => t.metodoPago !== 'GRATIS').length;
      const recaudado = pagados * e.monto;
      return `
        <div class="evento-fila ${e.estado === 'ACTIVO' ? 'evento-activo' : 'evento-finalizado'}">
          <div class="evento-info">
            <div class="evento-nombre">${e.nombre}</div>
            <div class="evento-meta">${e.fecha} · ${e.categoria} · $${e.monto}</div>
            <div class="evento-stats">
              <span class="badge ${e.estado === 'ACTIVO' ? 'badge-activo' : 'badge-fin'}">${e.estado}</span>
              <span class="stat-item">${tickets.length} tickets · $${recaudado.toLocaleString('es-AR')} recaudado</span>
            </div>
          </div>
          <div class="evento-acciones">
            <button class="btn-sm btn-ver" data-accion="ver-evento" data-id="${e.id}">Ver</button>
            ${e.estado === 'ACTIVO' ? `<button class="btn-sm btn-terminar" data-accion="terminar-evento" data-id="${e.id}">Terminar</button>` : `<button class="btn-sm btn-borrar" data-accion="borrar-evento" data-id="${e.id}" data-nombre="${e.nombre}">Borrar</button>`}
          </div>
        </div>`;
    };

    return `
      <div class="pantalla-admin">
        <div class="admin-header">
          <div>
            <h2>Panel de Administración</h2>
            <p class="subtitulo-sm">${activos.length} evento(s) activo(s)</p>
          </div>
          <div class="header-acciones">
            <button class="btn-primario btn-sm-h" data-accion="ir-crear-evento">+ Nuevo evento</button>
            <button class="btn-secundario btn-sm-h" data-accion="cerrar-admin">Salir</button>
          </div>
        </div>

        ${this.state.mensaje ? `<div class="alerta-ok">${this.state.mensaje}</div>` : ''}
        ${this.state.error ? `<div class="alerta-error">${this.state.error}</div>` : ''}

        <h3 class="seccion-titulo">Eventos activos</h3>
        ${activos.length ? activos.map(filaEvento).join('') : '<p class="vacio">No hay eventos activos.</p>'}

        ${finalizados.length ? `
          <h3 class="seccion-titulo mt">Eventos finalizados</h3>
          ${finalizados.map(filaEvento).join('')}
        ` : ''}
      </div>`;
  },

  // ── ADMIN CREAR / VER EVENTO ─────────────────────────────
  vistaAdminEvento() {
    const evento = this.state.eventoSeleccionado;
    const esCrear = !evento;

    if (esCrear) {
      return `
        <div class="pantalla-form">
          <div class="form-card form-card-wide">
            <div class="form-header">
              <button class="btn-volver" data-accion="ir-admin-panel">← Volver</button>
              <h2>Crear nuevo evento</h2>
            </div>
            ${this.state.error ? `<div class="alerta-error">${this.state.error}</div>` : ''}
            <div class="grid-2">
              <div class="campo">
                <label>Nombre del evento *</label>
                <input type="text" id="ev-nombre" placeholder="Ej: Partido Uni vs Tala">
              </div>
              <div class="campo">
                <label>Fecha *</label>
                <input type="date" id="ev-fecha">
              </div>
              <div class="campo">
                <label>Categoría *</label>
                <select id="ev-categoria">
                  <option value="">Seleccionar...</option>
                  <option>Infantiles</option>
                  <option>Juveniles</option>
                  <option>Plantel superior</option>
                  <option>Femenino</option>
                  <option>Otro</option>
                </select>
              </div>
              <div class="campo">
                <label>Monto ($) *</label>
                <input type="number" id="ev-monto" placeholder="Ej: 1000" min="0">
              </div>
            </div>
            <div class="campo">
              <label>Alias de transferencia (opcional)</label>
              <input type="text" id="ev-alias" placeholder="Ej: club.deportivo">
            </div>
            <div class="campo">
              <label>Cobradores *</label>
              <p class="campo-ayuda">Un cobrador por línea: <strong>Nombre Apellido</strong></p>
              <textarea id="ev-cobradores" rows="4" placeholder="Juan Pérez&#10;María López&#10;Carlos García"></textarea>
            </div>
            <button class="btn-primario" data-accion="crear-evento">Crear evento</button>
          </div>
        </div>`;
    }

    // Vista de evento existente
    const resumen = DB.getResumen(evento.id);
    return `
      <div class="pantalla-admin">
        <div class="admin-header">
          <div>
            <button class="btn-volver" data-accion="ir-admin-panel">← Volver al panel</button>
            <h2>${evento.nombre}</h2>
            <div class="evento-meta">${evento.fecha} · ${evento.categoria} · $${evento.monto}</div>
          </div>
          <span class="badge ${evento.estado === 'ACTIVO' ? 'badge-activo' : 'badge-fin'} badge-lg">${evento.estado}</span>
        </div>

        ${this.state.mensaje ? `<div class="alerta-ok">${this.state.mensaje}</div>` : ''}
        ${this.state.error ? `<div class="alerta-error">${this.state.error}</div>` : ''}

        <div class="resumen-cards">
          <div class="res-card">
            <div class="res-label">Total recaudado</div>
            <div class="res-valor verde">$${resumen.totalRecaudado.toLocaleString('es-AR')}</div>
          </div>
          <div class="res-card">
            <div class="res-label">Efectivo</div>
            <div class="res-valor">$${resumen.efectivo.monto.toLocaleString('es-AR')}</div>
            <div class="res-sub">${resumen.efectivo.cantidad} ticket(s)</div>
          </div>
          <div class="res-card">
            <div class="res-label">Transferencia</div>
            <div class="res-valor">$${resumen.transferencia.monto.toLocaleString('es-AR')}</div>
            <div class="res-sub">${resumen.transferencia.cantidad} ticket(s)</div>
          </div>
          <div class="res-card">
            <div class="res-label">Gratis</div>
            <div class="res-valor">${resumen.gratis.cantidad}</div>
            <div class="res-sub">vehículo(s)</div>
          </div>
        </div>

        <div class="acciones-evento">
          <button class="btn-secundario" data-accion="ver-resumen" data-id="${evento.id}">Ver resumen completo / Exportar Excel</button>
          ${evento.estado === 'ACTIVO' ? `<button class="btn-danger" data-accion="terminar-evento" data-id="${evento.id}">🔒 Terminar evento</button>` : ''}
        </div>

        <h3 class="seccion-titulo">Cobradores habilitados</h3>
        <div class="lista-cobradores">
          ${evento.cobradores.map(c => `<span class="chip">${this._capitalizar(c)}</span>`).join('')}
        </div>

        ${resumen.gratis.cantidad > 0 ? `
          <h3 class="seccion-titulo mt">Autos gratis</h3>
          <table class="tabla">
            <thead><tr><th>Patente</th><th>Nombre</th><th>Razón</th></tr></thead>
            <tbody>${resumen.gratis.lista.map(t => `
              <tr><td>${t.patente}</td><td>${t.nombreGratis}</td><td>${t.razonGratis}</td></tr>
            `).join('')}</tbody>
          </table>
        ` : ''}
      </div>`;
  },

  // ── COBRADOR LOGIN ────────────────────────────────────────
  vistaCobradorLogin() {
    return `
      <div class="pantalla-form">
        <div class="form-card">
          <div class="form-header">
            <button class="btn-volver" data-accion="ir-inicio">← Volver</button>
            <h2>Acceso Cobrador</h2>
          </div>
          ${this.state.error ? `<div class="alerta-error">${this.state.error}</div>` : ''}
          <div class="campo">
            <label>Nombre y Apellido</label>
            <input type="text" id="cob-nombre" placeholder="Ej: Juan Pérez" autocomplete="off">
            <p class="campo-ayuda">Tal como fue registrado por el admin</p>
          </div>
          <button class="btn-primario" data-accion="cobrador-login">Ingresar</button>
        </div>
      </div>`;
  },

  // ── COBRADOR EVENTO (pantalla de cobro) ───────────────────
  vistaCobradorEvento() {
    const { cobradorNombre } = this.state;
    const eventos = DB.getEventosCobrador(cobradorNombre);
    const eventoId = this.state.eventoSeleccionado?.id;
    const eventoActual = eventoId ? DB.getEventoById(eventoId) : null;
    const ultimo = eventoActual ? DB.getUltimoTicket(eventoActual.id) : null;
    const totalTickets = eventoActual ? DB.getTickets(eventoActual.id).length : 0;

    const selectEventos = `
      <select id="cob-evento-sel">
        <option value="">— Seleccionar evento —</option>
        ${eventos.map(e => `<option value="${e.id}" ${eventoActual?.id === e.id ? 'selected' : ''}>${e.nombre} · $${e.monto}</option>`).join('')}
      </select>`;

    if (!eventoActual) {
      return `
        <div class="pantalla-form">
          <div class="form-card">
            <div class="form-header">
              <button class="btn-volver" data-accion="ir-inicio">← Salir</button>
              <h2>Seleccionar evento</h2>
            </div>
            <p class="cobrador-saludo">Hola, <strong>${this._capitalizar(cobradorNombre)}</strong></p>
            ${this.state.error ? `<div class="alerta-error">${this.state.error}</div>` : ''}
            <div class="campo">
              <label>Evento</label>
              ${selectEventos}
            </div>
            <button class="btn-primario" data-accion="seleccionar-evento">Continuar</button>
          </div>
        </div>`;
    }

    // Pantalla de cobro activa
    const alias = eventoActual.alias ? `<div class="alias-info">Alias: <strong>${eventoActual.alias}</strong></div>` : '';

    return `
      <div class="pantalla-cobro">
        <div class="cobro-header">
          <div class="cobro-evento-nombre">${eventoActual.nombre}</div>
          <div class="cobro-monto">$${eventoActual.monto.toLocaleString('es-AR')}</div>
          <button class="btn-volver-sm" data-accion="cambiar-evento">Cambiar evento</button>
        </div>

        <div class="cobro-stats">
          <div class="stat-cobro">
            <span class="stat-cobro-num">${totalTickets}</span>
            <span class="stat-cobro-lbl">Tickets cargados</span>
          </div>
          ${ultimo ? `
            <div class="stat-cobro">
              <span class="stat-cobro-num">#${ultimo.numeroTicket}</span>
              <span class="stat-cobro-lbl">Último ticket</span>
            </div>` : ''}
        </div>

        ${this.state.error ? `<div class="alerta-error">${this.state.error}</div>` : ''}
        ${this.state.mensaje ? `<div class="alerta-ok">${this.state.mensaje}</div>` : ''}

        <div class="cobro-form">
          <div class="campo">
            <label>Número de ticket *</label>
            <input type="number" id="ticket-num" placeholder="Ej: 42" min="1" autocomplete="off" inputmode="numeric">
          </div>

          <div class="campo">
            <label>Método de pago *</label>
            <div class="metodo-btns">
              <button class="btn-metodo" id="metodo-efectivo" data-metodo="EFECTIVO">
                <span class="metodo-icon">💵</span>Efectivo
              </button>
              <button class="btn-metodo" id="metodo-transf" data-metodo="TRANSFERENCIA">
                <span class="metodo-icon">📱</span>Transferencia
                ${alias}
              </button>
              <button class="btn-metodo" id="metodo-gratis" data-metodo="GRATIS">
                <span class="metodo-icon">🎟</span>Gratis
              </button>
            </div>
            <input type="hidden" id="metodo-seleccionado" value="">
          </div>

          <div id="gratis-campos" class="gratis-form" style="display:none;">
            <div class="campo">
              <label>Patente *</label>
              <input type="text" id="gratis-patente" placeholder="Ej: ABC123" style="text-transform:uppercase">
            </div>
            <div class="campo">
              <label>Nombre *</label>
              <input type="text" id="gratis-nombre" placeholder="Nombre completo">
            </div>
            <div class="campo">
              <label>Razón *</label>
              <input type="text" id="gratis-razon" placeholder="Ej: Directivo, Prensa, etc.">
            </div>
          </div>

          <button class="btn-registrar" data-accion="registrar-ticket">Registrar ticket</button>
        </div>
      </div>`;
  },

  // ── VISTA RESUMEN COMPLETO ────────────────────────────────
  vistaResumen() {
    const evento = this.state.eventoSeleccionado;
    const resumen = DB.getResumen(evento.id);

    return `
      <div class="pantalla-admin">
        <div class="admin-header">
          <div>
            <button class="btn-volver" data-accion="ir-admin-evento-ver" data-id="${evento.id}">← Volver</button>
            <h2>Resumen: ${evento.nombre}</h2>
            <div class="evento-meta">${evento.fecha} · ${evento.categoria}</div>
          </div>
          <button class="btn-primario" data-accion="exportar-excel">⬇ Exportar Excel</button>
        </div>

        <div class="resumen-cards">
          <div class="res-card res-card-destac">
            <div class="res-label">Total recaudado</div>
            <div class="res-valor verde grande">$${resumen.totalRecaudado.toLocaleString('es-AR')}</div>
          </div>
          <div class="res-card">
            <div class="res-label">Efectivo</div>
            <div class="res-valor">$${resumen.efectivo.monto.toLocaleString('es-AR')}</div>
            <div class="res-sub">${resumen.efectivo.cantidad} ticket(s)</div>
          </div>
          <div class="res-card">
            <div class="res-label">Transferencia</div>
            <div class="res-valor">$${resumen.transferencia.monto.toLocaleString('es-AR')}</div>
            <div class="res-sub">${resumen.transferencia.cantidad} ticket(s)</div>
          </div>
          <div class="res-card">
            <div class="res-label">Gratis</div>
            <div class="res-valor">${resumen.gratis.cantidad}</div>
            <div class="res-sub">vehículo(s)</div>
          </div>
        </div>

        ${resumen.gratis.cantidad > 0 ? `
          <h3 class="seccion-titulo">Detalle autos gratis</h3>
          <table class="tabla">
            <thead><tr><th>#Ticket</th><th>Patente</th><th>Nombre</th><th>Razón</th></tr></thead>
            <tbody>${resumen.gratis.lista.map(t => `
              <tr><td>${t.numeroTicket}</td><td>${t.patente}</td><td>${t.nombreGratis}</td><td>${t.razonGratis}</td></tr>
            `).join('')}</tbody>
          </table>
        ` : ''}

        <h3 class="seccion-titulo">Todos los tickets</h3>
        <table class="tabla">
          <thead><tr><th>#Ticket</th><th>Método de pago</th><th>Monto</th></tr></thead>
          <tbody>${resumen.tickets.sort((a,b)=>parseInt(a.numeroTicket)-parseInt(b.numeroTicket)).map(t => `
            <tr>
              <td>${t.numeroTicket}</td>
              <td><span class="badge badge-metodo badge-${t.metodoPago.toLowerCase()}">${t.metodoPago}</span></td>
              <td>${t.metodoPago === 'GRATIS' ? '$0' : '$' + evento.monto.toLocaleString('es-AR')}</td>
            </tr>
          `).join('')}</tbody>
        </table>
      </div>`;
  },

  // ── BIND EVENTS ──────────────────────────────────────────
  bindEvents() {
    // Delegación de eventos en botones
    document.querySelectorAll('[data-accion]').forEach(el => {
      el.addEventListener('click', (e) => {
        const accion = el.dataset.accion;
        const id = el.dataset.id;
        this.manejarAccion(accion, id, e);
      });
    });

    // Selector de evento cobrador
    const selEvento = document.getElementById('cob-evento-sel');
    if (selEvento) {
      selEvento.addEventListener('change', () => {}); // handled on button
    }

    // Botones de método de pago
    document.querySelectorAll('.btn-metodo').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-metodo').forEach(b => b.classList.remove('seleccionado'));
        btn.classList.add('seleccionado');
        const metodo = btn.dataset.metodo;
        document.getElementById('metodo-seleccionado').value = metodo;
        const gratisDiv = document.getElementById('gratis-campos');
        if (gratisDiv) gratisDiv.style.display = metodo === 'GRATIS' ? 'block' : 'none';
      });
    });

    // Enter en login admin
    const adminPass = document.getElementById('admin-pass');
    if (adminPass) adminPass.addEventListener('keydown', e => { if (e.key === 'Enter') this.manejarAccion('admin-login'); });
    const cobradorInput = document.getElementById('cob-nombre');
    if (cobradorInput) cobradorInput.addEventListener('keydown', e => { if (e.key === 'Enter') this.manejarAccion('cobrador-login'); });

    // Focus automático en número de ticket
    const ticketInput = document.getElementById('ticket-num');
    if (ticketInput) setTimeout(() => ticketInput.focus(), 100);
  },

  // ── ACCIONES ─────────────────────────────────────────────
  manejarAccion(accion, id, e) {
    switch (accion) {
      case 'ir-inicio':         this.ir('inicio'); break;
      case 'ir-admin-login':    this.ir('admin-login'); break;
      case 'ir-cobrador-login': this.ir('cobrador-login'); break;
      case 'ir-admin-panel':    this.ir('admin-panel'); break;
      case 'ir-crear-evento':   this.ir('admin-evento'); break;
      case 'cerrar-admin':
        this.state.adminLogueado = false;
        this.ir('inicio');
        break;

      case 'admin-login': {
        const user = document.getElementById('admin-user').value.trim();
        const pass = document.getElementById('admin-pass').value.trim();
        if (DB.loginAdmin(user, pass)) {
          this.state.adminLogueado = true;
          this.ir('admin-panel');
        } else {
          this.state.error = 'Usuario o contraseña incorrectos.';
          this.render();
        }
        break;
      }

      case 'crear-evento': {
        const nombre = document.getElementById('ev-nombre').value.trim();
        const fecha = document.getElementById('ev-fecha').value;
        const categoria = document.getElementById('ev-categoria').value;
        const monto = document.getElementById('ev-monto').value;
        const alias = document.getElementById('ev-alias').value.trim();
        const cobradoresRaw = document.getElementById('ev-cobradores').value;
        const cobradores = cobradoresRaw.split('\n').map(c => c.trim()).filter(Boolean);

        if (!nombre || !fecha || !categoria || !monto) {
          this.state.error = 'Completá todos los campos obligatorios.';
          this.render(); return;
        }
        if (cobradores.length === 0) {
          this.state.error = 'Agregá al menos un cobrador.';
          this.render(); return;
        }

        DB.crearEvento({ nombre, fecha, categoria, monto, alias, cobradores });
        this.ir('admin-panel', { mensaje: `Evento "${nombre}" creado exitosamente.` });
        break;
      }

      case 'ver-evento': {
        const evento = DB.getEventoById(id);
        this.ir('admin-evento', { eventoSeleccionado: evento });
        break;
      }

      case 'ir-admin-evento-ver': {
        const evento = DB.getEventoById(id);
        this.ir('admin-evento', { eventoSeleccionado: evento });
        break;
      }

      case 'terminar-evento': {
        const evento = DB.getEventoById(id);
        const conf = confirm(`¿Estás seguro que querés finalizar "${evento.nombre}"?\n\nEsta acción NO se puede deshacer.`);
        if (conf) {
          DB.finalizarEvento(id);
          this.ir('admin-panel', { mensaje: `Evento "${evento.nombre}" finalizado correctamente.` });
        }
        break;
      }

      case 'borrar-evento': {
        const evento = DB.getEventoById(id);
        const conf = confirm(`¿Borrar el evento "${evento.nombre}" y todos sus tickets?\n\nEsta acción NO se puede deshacer.`);
        if (conf) {
          DB.borrarEvento(id);
          this.ir('admin-panel', { mensaje: `Evento "${evento.nombre}" borrado.` });
        }
        break;
      }
        const nombre = document.getElementById('cob-nombre').value.trim();
        if (!nombre) { this.state.error = 'Ingresá tu nombre y apellido.'; this.render(); return; }
        if (DB.validarCobrador(nombre)) {
          this.ir('cobrador-evento', { cobradorNombre: nombre, eventoSeleccionado: null });
        } else {
          this.state.error = 'No estás habilitado en ningún evento activo. Consultá con el administrador.';
          this.render();
        }
        break;
      }

      case 'seleccionar-evento': {
        const sel = document.getElementById('cob-evento-sel').value;
        if (!sel) { this.state.error = 'Seleccioná un evento.'; this.render(); return; }
        const evento = DB.getEventoById(sel);
        this.ir('cobrador-evento', { eventoSeleccionado: evento });
        break;
      }

      case 'cambiar-evento': {
        this.ir('cobrador-evento', { eventoSeleccionado: null });
        break;
      }

      case 'registrar-ticket': {
        const evento = this.state.eventoSeleccionado;
        const numeroTicket = document.getElementById('ticket-num').value;
        const metodoPago = document.getElementById('metodo-seleccionado').value;
        const patente = document.getElementById('gratis-patente')?.value || '';
        const nombreGratis = document.getElementById('gratis-nombre')?.value || '';
        const razonGratis = document.getElementById('gratis-razon')?.value || '';

        // Validar método de pago primero
        if (!metodoPago) {
          this.state.error = 'Seleccioná un método de pago.';
          this.state.mensaje = null;
          this.render(); return;
        }

        // Número de ticket obligatorio SOLO si no es gratis
        if (metodoPago !== 'GRATIS' && !String(numeroTicket).trim()) {
          this.state.error = 'El número de ticket es obligatorio para pagos en efectivo o transferencia.';
          this.state.mensaje = null;
          this.render(); return;
        }

        const result = DB.registrarTicket({ eventoId: evento.id, numeroTicket, metodoPago, patente, nombreGratis, razonGratis });
        if (result.ok) {
          this.state.mensaje = `✓ Ticket${result.ticket.numeroTicket ? ' #' + result.ticket.numeroTicket : ''} registrado (${metodoPago}).`;
          this.state.error = null;
          this.render();
        } else {
          this.state.error = result.error;
          this.state.mensaje = null;
          this.render();
        }
        break;
      }

      case 'ver-resumen': {
        const evento = DB.getEventoById(id);
        this.ir('resumen', { eventoSeleccionado: evento });
        break;
      }

      case 'exportar-excel': {
        this.exportarExcel(this.state.eventoSeleccionado.id);
        break;
      }
    }
  },

  // ── EXPORTAR EXCEL ────────────────────────────────────────
  exportarExcel(eventoId) {
    const resumen = DB.getResumen(eventoId);
    const { evento, efectivo, transferencia, gratis, tickets } = resumen;

    // CSV simple con múltiples hojas simuladas
    const sep = '\t';
    const nl = '\n';

    let contenido = '';

    // Hoja 1: Resumen
    contenido += 'RESUMEN GENERAL' + nl;
    contenido += `Evento${sep}${evento.nombre}${nl}`;
    contenido += `Fecha${sep}${evento.fecha}${nl}`;
    contenido += `Categoría${sep}${evento.categoria}${nl}`;
    contenido += `Monto por ticket${sep}$${evento.monto}${nl}`;
    contenido += `Total recaudado${sep}$${resumen.totalRecaudado}${nl}`;
    contenido += `Efectivo${sep}$${efectivo.monto}${sep}(${efectivo.cantidad} tickets)${nl}`;
    contenido += `Transferencia${sep}$${transferencia.monto}${sep}(${transferencia.cantidad} tickets)${nl}`;
    contenido += `Gratis${sep}${gratis.cantidad} vehículos${nl}`;
    contenido += nl;

    // Hoja 2: Tickets
    contenido += 'DETALLE DE TICKETS' + nl;
    contenido += `#Ticket${sep}Método de Pago${sep}Monto${nl}`;
    tickets.sort((a,b)=>parseInt(a.numeroTicket)-parseInt(b.numeroTicket)).forEach(t => {
      const monto = t.metodoPago === 'GRATIS' ? '$0' : `$${evento.monto}`;
      contenido += `${t.numeroTicket}${sep}${t.metodoPago}${sep}${monto}${nl}`;
    });
    contenido += nl;

    // Hoja 3: Gratis
    if (gratis.cantidad > 0) {
      contenido += 'AUTOS GRATIS' + nl;
      contenido += `#Ticket${sep}Patente${sep}Nombre${sep}Razón${nl}`;
      gratis.lista.forEach(t => {
        contenido += `${t.numeroTicket}${sep}${t.patente}${sep}${t.nombreGratis}${sep}${t.razonGratis}${nl}`;
      });
    }

    const blob = new Blob(['\uFEFF' + contenido], { type: 'text/tab-separated-values;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Estacionamiento_${evento.nombre.replace(/\s+/g, '_')}_${evento.fecha}.tsv`;
    a.click();
    URL.revokeObjectURL(url);
  },

  // ── UTILS ─────────────────────────────────────────────────
  _capitalizar(str) {
    return str.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  },

  // ── INIT ─────────────────────────────────────────────────
  init() {
    this.render();
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
