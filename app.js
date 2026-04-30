// ============================================================
//  app.js — lógica y vistas de la aplicación
// ============================================================

const App = {
  state: {
    vista: 'inicio',      // inicio | admin-login | admin-panel | admin-evento | cobrador-login | cobrador-evento | resumen
    adminLogueado: false,
    cobradorNombre: null,
    cobradorDocumento: null,
    eventoSeleccionado: null,
    mensaje: null,
    error: null,
  },

  equipos: [
    'Universitario',
    'Tala',
    'Tablada',
    'Bajo',
    'Jockey',
    'Uru Cure',
    'Jockey Villa Maria',
    'San Martín Villa Maria',
    'Carlos Paz',
    'Cordoba Rugby',
    'Alta Gracia Rugby'
  ],

  // ── RENDER PRINCIPAL ─────────────────────────────────────
  async render() {
    const app = document.getElementById('app');
    const { vista } = this.state;
    app.innerHTML = '<div class="pantalla-form"><div class="form-card"><p class="vacio">Cargando...</p></div></div>';
    if (vista === 'inicio')          app.innerHTML = this.vistaInicio();
    else if (vista === 'admin-login') app.innerHTML = this.vistaAdminLogin();
    else if (vista === 'admin-panel') app.innerHTML = await this.vistaAdminPanel();
    else if (vista === 'admin-evento') app.innerHTML = await this.vistaAdminEvento();
    else if (vista === 'cobrador-login') app.innerHTML = await this.vistaCobradorLogin();
    else if (vista === 'cobrador-evento') app.innerHTML = await this.vistaCobradorEvento();
    else if (vista === 'resumen')    app.innerHTML = await this.vistaResumen();
    this.bindEvents();
  },

  async ir(vista, extra = {}) {
    this.state = { ...this.state, ...extra, vista, mensaje: null, error: null };
    await this.render();
  },

  // ── VISTA INICIO ─────────────────────────────────────────
  vistaInicio() {
    return `
      <div class="pantalla-inicio">
        <div class="logo-bloque">
          <img class="logo-img logo-img-xl" src="logo.png" alt="Logo del club">
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
            <img class="logo-img logo-img-sm" src="logo.png" alt="Logo del club">
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
  async vistaAdminPanel() {
    const eventos = await DB.getEventos();
    const activos = eventos.filter(e => e.estado === 'ACTIVO');
    const finalizados = eventos.filter(e => e.estado === 'FINALIZADO');

    const filaEvento = async (e) => {
      const tickets = await DB.getTickets(e.id);
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
            <img class="logo-img logo-img-header" src="logo.png" alt="Logo del club">
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
        ${activos.length ? (await Promise.all(activos.map(filaEvento))).join('') : '<p class="vacio">No hay eventos activos.</p>'}

        ${finalizados.length ? `
          <h3 class="seccion-titulo mt">Eventos finalizados</h3>
          ${(await Promise.all(finalizados.map(filaEvento))).join('')}
        ` : ''}
      </div>`;
  },

  // ── ADMIN CREAR / VER EVENTO ─────────────────────────────
  async vistaAdminEvento() {
    const evento = this.state.eventoSeleccionado;
    const esCrear = !evento;
    const opcionesEquipos = this.equipos.map(eq => `<option value="${eq}">${eq}</option>`).join('');
    const opcionAgregarEquipo = '<option value="__OTRO__">Agregar equipo...</option>';

    if (esCrear) {
      return `
        <div class="pantalla-form">
          <div class="form-card form-card-wide">
            <div class="form-header">
              <img class="logo-img logo-img-sm" src="logo.png" alt="Logo del club">
              <button class="btn-volver" data-accion="ir-admin-panel">← Volver</button>
              <h2>Crear nuevo evento</h2>
            </div>
            ${this.state.error ? `<div class="alerta-error">${this.state.error}</div>` : ''}
            <div class="grid-2">
              <div class="campo">
                <label>Equipo local *</label>
                <select id="ev-local">
                  <option value="">Seleccionar...</option>
                  ${opcionesEquipos}
                  ${opcionAgregarEquipo}
                </select>
                <input class="equipo-manual" type="text" id="ev-local-otro" placeholder="Nombre del equipo local" autocomplete="off" style="display:none;">
              </div>
              <div class="campo">
                <label>Equipo visitante *</label>
                <select id="ev-visitante">
                  <option value="">Seleccionar...</option>
                  ${opcionesEquipos}
                  ${opcionAgregarEquipo}
                </select>
                <input class="equipo-manual" type="text" id="ev-visitante-otro" placeholder="Nombre del equipo visitante" autocomplete="off" style="display:none;">
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
            <button class="btn-primario" data-accion="crear-evento">Crear evento</button>
          </div>
        </div>`;
    }

    // Vista de evento existente
    const resumen = await DB.getResumen(evento.id);
    return `
      <div class="pantalla-admin">
        <div class="admin-header">
          <div>
            <button class="btn-volver" data-accion="ir-admin-panel">← Volver al panel</button>
            <img class="logo-img logo-img-header" src="logo.png" alt="Logo del club">
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
  async vistaCobradorLogin() {
    const eventos = await DB.getEventosActivos();
    return `
      <div class="pantalla-form">
        <div class="form-card">
          <div class="form-header">
            <img class="logo-img logo-img-sm" src="logo.png" alt="Logo del club">
            <button class="btn-volver" data-accion="ir-inicio">← Volver</button>
            <h2>Acceso Cobrador</h2>
          </div>
          ${this.state.error ? `<div class="alerta-error">${this.state.error}</div>` : ''}
          <div class="campo">
            <label>Nombre y Apellido</label>
            <input type="text" id="cob-nombre" placeholder="Ej: Juan Pérez" autocomplete="off">
          </div>
          <div class="campo">
            <label>Documento</label>
            <input type="text" id="cob-documento" placeholder="Ej: 30123456" autocomplete="off" inputmode="numeric">
          </div>
          <div class="campo">
            <label>Evento</label>
            <select id="cob-evento-login">
              <option value="">Seleccionar evento activo...</option>
              ${eventos.map(e => `<option value="${e.id}">${e.nombre} · ${e.fecha} · $${e.monto}</option>`).join('')}
            </select>
            <p class="campo-ayuda">Completá tus datos para ingresar a cobrar.</p>
          </div>
          <button class="btn-primario" data-accion="cobrador-login">Ingresar</button>
        </div>
      </div>`;
  },

  // ── COBRADOR EVENTO (pantalla de cobro) ───────────────────
  async vistaCobradorEvento() {
    const { cobradorNombre, cobradorDocumento } = this.state;
    const eventos = await DB.getEventosCobrador(cobradorNombre);
    const eventoId = this.state.eventoSeleccionado?.id;
    const eventoActual = eventoId ? await DB.getEventoById(eventoId) : null;
    const ultimo = eventoActual ? await DB.getUltimoTicket(eventoActual.id) : null;
    const totalTickets = eventoActual ? (await DB.getTickets(eventoActual.id)).length : 0;

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
              <img class="logo-img logo-img-sm" src="logo.png" alt="Logo del club">
              <button class="btn-volver" data-accion="ir-inicio">← Salir</button>
              <h2>Seleccionar evento</h2>
            </div>
            <p class="cobrador-saludo">Hola, <strong>${this._capitalizar(cobradorNombre)}</strong></p>
            <p class="cobrador-doc">Documento: ${cobradorDocumento}</p>
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
          <img class="logo-img logo-img-header" src="logo.png" alt="Logo del club">
          <div class="cobro-evento-nombre">${eventoActual.nombre}</div>
          <div class="cobro-monto">$${eventoActual.monto.toLocaleString('es-AR')}</div>
          <div class="cobrador-identidad">${this._capitalizar(cobradorNombre)} · DNI ${cobradorDocumento}</div>
          <button class="btn-volver-sm" data-accion="cambiar-evento">Cambiar evento</button>
        </div>

        ${eventoActual.alias ? `
          <div class="alias-destacado">
            <span>Alias de transferencia</span>
            <strong>${eventoActual.alias}</strong>
          </div>
        ` : ''}

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
  async vistaResumen() {
    const evento = this.state.eventoSeleccionado;
    const resumen = await DB.getResumen(evento.id);
    const textoCopiable = await this.generarTextoResumen(evento.id);

    return `
      <div class="pantalla-admin">
        <div class="admin-header">
          <div>
            <button class="btn-volver" data-accion="ir-admin-evento-ver" data-id="${evento.id}">← Volver</button>
            <img class="logo-img logo-img-header" src="logo.png" alt="Logo del club">
            <h2>Resumen: ${evento.nombre}</h2>
            <div class="evento-meta">${evento.fecha} · ${evento.categoria}</div>
          </div>
          <button class="btn-primario" data-accion="exportar-excel">Descargar Excel</button>
        </div>

        ${this.state.mensaje ? `<div class="alerta-ok">${this.state.mensaje}</div>` : ''}
        ${this.state.error ? `<div class="alerta-error">${this.state.error}</div>` : ''}

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
            <thead><tr><th>#Ticket</th><th>Hora</th><th>Patente</th><th>Nombre</th><th>Razón</th></tr></thead>
            <tbody>${resumen.gratis.lista.map(t => `
              <tr><td>${t.numeroTicket}</td><td>${this._formatearHora(t.creadoEn)}</td><td>${t.patente}</td><td>${t.nombreGratis}</td><td>${t.razonGratis}</td></tr>
            `).join('')}</tbody>
          </table>
        ` : ''}

        <h3 class="seccion-titulo">Texto listo para copiar</h3>
        <div class="copiar-box">
          <textarea id="texto-resumen" readonly rows="10">${this._escapeHtml(textoCopiable)}</textarea>
          <button class="btn-secundario" data-accion="copiar-resumen">Copiar texto</button>
        </div>

        <h3 class="seccion-titulo">Todos los tickets</h3>
        <table class="tabla">
          <thead><tr><th>#Ticket</th><th>Hora</th><th>Método de pago</th><th>Cobrador</th><th>Monto</th></tr></thead>
          <tbody>${this._ordenarTickets(resumen.tickets).map(t => `
            <tr>
              <td>${t.numeroTicket}</td>
              <td>${this._formatearHora(t.creadoEn)}</td>
              <td><span class="badge badge-metodo badge-${t.metodoPago.toLowerCase()}">${t.metodoPago}</span></td>
              <td>${t.cobradorNombre || '-'}</td>
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

    const prepararEquipoManual = (selectId, inputId) => {
      const select = document.getElementById(selectId);
      const input = document.getElementById(inputId);
      if (!select || !input) return;
      const actualizar = () => {
        const esManual = select.value === '__OTRO__';
        input.style.display = esManual ? 'block' : 'none';
        if (esManual) setTimeout(() => input.focus(), 50);
        else input.value = '';
      };
      select.addEventListener('change', actualizar);
      actualizar();
    };
    prepararEquipoManual('ev-local', 'ev-local-otro');
    prepararEquipoManual('ev-visitante', 'ev-visitante-otro');

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
  async manejarAccion(accion, id, e) {
    switch (accion) {
      case 'ir-inicio':         await this.ir('inicio'); break;
      case 'ir-admin-login':    await this.ir('admin-login'); break;
      case 'ir-cobrador-login': await this.ir('cobrador-login'); break;
      case 'ir-admin-panel':    await this.ir('admin-panel'); break;
      case 'ir-crear-evento':   await this.ir('admin-evento'); break;
      case 'cerrar-admin':
        this.state.adminLogueado = false;
        await this.ir('inicio');
        break;

      case 'admin-login': {
        const user = document.getElementById('admin-user').value.trim();
        const pass = document.getElementById('admin-pass').value.trim();
        if (DB.loginAdmin(user, pass)) {
          this.state.adminLogueado = true;
          await this.ir('admin-panel');
        } else {
          this.state.error = 'Usuario o contraseña incorrectos.';
          await this.render();
        }
        break;
      }

      case 'crear-evento': {
        const equipoLocal = this._valorEquipo('ev-local', 'ev-local-otro');
        const equipoVisitante = this._valorEquipo('ev-visitante', 'ev-visitante-otro');
        const fecha = document.getElementById('ev-fecha').value;
        const categoria = document.getElementById('ev-categoria').value;
        const monto = document.getElementById('ev-monto').value;
        const alias = document.getElementById('ev-alias').value.trim();
        const nombre = `${equipoLocal} vs ${equipoVisitante}`;

        if (!equipoLocal || !equipoVisitante || !fecha || !categoria || !monto) {
          this.state.error = 'Completá todos los campos obligatorios.';
          await this.render(); return;
        }
        if (equipoLocal === equipoVisitante) {
          this.state.error = 'Elegí dos equipos distintos.';
          await this.render(); return;
        }

        const creado = await DB.crearEvento({ equipoLocal, equipoVisitante, fecha, categoria, monto, alias });
        if (!creado) {
          this.state.error = 'No se pudo crear el evento. Revisá Supabase y la conexión.';
          await this.render(); return;
        }
        await this.ir('admin-panel', { mensaje: `Evento "${nombre}" creado exitosamente.` });
        break;
      }

      case 'ver-evento': {
        const evento = await DB.getEventoById(id);
        await this.ir('admin-evento', { eventoSeleccionado: evento });
        break;
      }

      case 'ir-admin-evento-ver': {
        const evento = await DB.getEventoById(id);
        await this.ir('admin-evento', { eventoSeleccionado: evento });
        break;
      }

      case 'terminar-evento': {
        const evento = await DB.getEventoById(id);
        const conf = confirm(`¿Estás seguro que querés finalizar "${evento.nombre}"?\n\nEsta acción NO se puede deshacer.`);
        if (conf) {
          await DB.finalizarEvento(id);
          await this.ir('admin-panel', { mensaje: `Evento "${evento.nombre}" finalizado correctamente.` });
        }
        break;
      }

      case 'borrar-evento': {
        const evento = await DB.getEventoById(id);
        const conf = confirm(`¿Borrar el evento "${evento.nombre}" y todos sus tickets?\n\nEsta acción NO se puede deshacer.`);
        if (conf) {
          await DB.borrarEvento(id);
          await this.ir('admin-panel', { mensaje: `Evento "${evento.nombre}" borrado.` });
        }
        break;
      }

      case 'cobrador-login': {
        const nombre = document.getElementById('cob-nombre').value.trim();
        const documento = document.getElementById('cob-documento').value.trim();
        const eventoId = document.getElementById('cob-evento-login').value;
        if (!nombre) { this.state.error = 'Ingresá tu nombre y apellido.'; await this.render(); return; }
        if (!documento) { this.state.error = 'Ingresá tu documento.'; await this.render(); return; }
        if (!eventoId) { this.state.error = 'Seleccioná el evento.'; await this.render(); return; }
        const evento = await DB.getEventoById(eventoId);
        await this.ir('cobrador-evento', { cobradorNombre: nombre, cobradorDocumento: documento, eventoSeleccionado: evento });
        break;
      }

      case 'seleccionar-evento': {
        const sel = document.getElementById('cob-evento-sel').value;
        if (!sel) { this.state.error = 'Seleccioná un evento.'; await this.render(); return; }
        const evento = await DB.getEventoById(sel);
        await this.ir('cobrador-evento', { eventoSeleccionado: evento });
        break;
      }

      case 'cambiar-evento': {
        await this.ir('cobrador-evento', { eventoSeleccionado: null });
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
          await this.render(); return;
        }

        // Número de ticket obligatorio SOLO si no es gratis
        if (metodoPago !== 'GRATIS' && !String(numeroTicket).trim()) {
          this.state.error = 'El número de ticket es obligatorio para pagos en efectivo o transferencia.';
          this.state.mensaje = null;
          await this.render(); return;
        }

        const result = await DB.registrarTicket({
          eventoId: evento.id,
          numeroTicket,
          metodoPago,
          patente,
          nombreGratis,
          razonGratis,
          cobradorNombre: this.state.cobradorNombre,
          cobradorDocumento: this.state.cobradorDocumento
        });
        if (result.ok) {
          this.state.mensaje = `✓ Ticket${result.ticket.numeroTicket ? ' #' + result.ticket.numeroTicket : ''} registrado (${metodoPago}).`;
          this.state.error = null;
          await this.render();
        } else {
          this.state.error = result.error;
          this.state.mensaje = null;
          await this.render();
        }
        break;
      }

      case 'ver-resumen': {
        const evento = await DB.getEventoById(id);
        await this.ir('resumen', { eventoSeleccionado: evento });
        break;
      }

      case 'exportar-excel': {
        await this.exportarExcel(this.state.eventoSeleccionado.id);
        break;
      }

      case 'copiar-resumen': {
        const texto = document.getElementById('texto-resumen')?.value || '';
        navigator.clipboard.writeText(texto).then(() => {
          this.state.mensaje = 'Texto copiado al portapapeles.';
          this.state.error = null;
          this.render();
        }).catch(() => {
          const campo = document.getElementById('texto-resumen');
          campo?.select();
          this.state.error = 'No se pudo copiar automáticamente. El texto quedó seleccionado para copiarlo manualmente.';
          this.render();
        });
        break;
      }
    }
  },

  // ── EXPORTAR EXCEL ────────────────────────────────────────
  async exportarExcel(eventoId) {
    const resumen = await DB.getResumen(eventoId);
    const { evento, efectivo, transferencia, gratis, tickets } = resumen;
    const esc = (v) => this._escapeXml(v ?? '');
    const cell = (v, type = 'String') => `<Cell><Data ss:Type="${type}">${esc(v)}</Data></Cell>`;
    const row = (vals) => `<Row>${vals.map(v => cell(v)).join('')}</Row>`;
    const money = (v) => cell(v, 'Number');

    const resumenRows = [
      row(['RESUMEN GENERAL']),
      row(['Evento', evento.nombre]),
      row(['Fecha', evento.fecha]),
      row(['Categoría', evento.categoria]),
      row(['Monto por ticket', evento.monto]),
      row(['Total recaudado', resumen.totalRecaudado]),
      row(['Efectivo', efectivo.cantidad, efectivo.monto]),
      row(['Transferencia', transferencia.cantidad, transferencia.monto]),
      row(['Gratis', gratis.cantidad])
    ].join('');

    const ticketsRows = [
      row(['#Ticket', 'Fecha', 'Hora', 'Método de pago', 'Monto', 'Cobrador', 'Documento', 'Patente', 'Nombre gratis', 'Razón gratis']),
      ...this._ordenarTickets(tickets).map(t => `<Row>
        ${cell(t.numeroTicket)}
        ${cell(this._formatearFecha(t.creadoEn))}
        ${cell(this._formatearHora(t.creadoEn))}
        ${cell(t.metodoPago)}
        ${money(t.metodoPago === 'GRATIS' ? 0 : evento.monto)}
        ${cell(t.cobradorNombre || '')}
        ${cell(t.cobradorDocumento || '')}
        ${cell(t.patente || '')}
        ${cell(t.nombreGratis || '')}
        ${cell(t.razonGratis || '')}
      </Row>`)
    ].join('');

    const gratisRows = [
      row(['#Ticket', 'Fecha', 'Hora', 'Patente', 'Nombre', 'Razón', 'Cobrador', 'Documento']),
      ...gratis.lista.map(t => row([
        t.numeroTicket,
        this._formatearFecha(t.creadoEn),
        this._formatearHora(t.creadoEn),
        t.patente || '',
        t.nombreGratis || '',
        t.razonGratis || '',
        t.cobradorNombre || '',
        t.cobradorDocumento || ''
      ]))
    ].join('');

    const contenido = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="Arial" ss:Size="11"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Resumen"><Table>${resumenRows}</Table></Worksheet>
 <Worksheet ss:Name="Tickets"><Table>${ticketsRows}</Table></Worksheet>
 <Worksheet ss:Name="Gratis"><Table>${gratisRows}</Table></Worksheet>
</Workbook>`;

    const blob = new Blob(['\uFEFF' + contenido], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Estacionamiento_${evento.nombre.replace(/\s+/g, '_')}_${evento.fecha}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  },

  async generarTextoResumen(eventoId) {
    const resumen = await DB.getResumen(eventoId);
    const { evento, efectivo, transferencia, gratis } = resumen;
    const lineas = [
      `RESUMEN ESTACIONAMIENTO - ${evento.nombre}`,
      `Fecha: ${evento.fecha}`,
      `Categoría: ${evento.categoria}`,
      `Monto por ticket: $${evento.monto.toLocaleString('es-AR')}`,
      `Total recaudado: $${resumen.totalRecaudado.toLocaleString('es-AR')}`,
      `Efectivo: ${efectivo.cantidad} tickets - $${efectivo.monto.toLocaleString('es-AR')}`,
      `Transferencia: ${transferencia.cantidad} tickets - $${transferencia.monto.toLocaleString('es-AR')}`,
      `Gratis: ${gratis.cantidad} vehículos`,
      '',
      'Detalle de tickets:',
      '#Ticket | Hora | Método | Monto | Cobrador | Documento'
    ];

    this._ordenarTickets(resumen.tickets).forEach(t => {
      const monto = t.metodoPago === 'GRATIS' ? '$0' : `$${evento.monto.toLocaleString('es-AR')}`;
      lineas.push(`${t.numeroTicket} | ${this._formatearHora(t.creadoEn)} | ${t.metodoPago} | ${monto} | ${t.cobradorNombre || '-'} | ${t.cobradorDocumento || '-'}`);
    });

    if (gratis.cantidad) {
      lineas.push('', 'Autos gratis:', '#Ticket | Hora | Patente | Nombre | Razón');
      gratis.lista.forEach(t => {
        lineas.push(`${t.numeroTicket} | ${this._formatearHora(t.creadoEn)} | ${t.patente || '-'} | ${t.nombreGratis || '-'} | ${t.razonGratis || '-'}`);
      });
    }

    return lineas.join('\n');
  },

  // ── UTILS ─────────────────────────────────────────────────
  _valorEquipo(selectId, inputId) {
    const select = document.getElementById(selectId);
    if (!select) return '';
    if (select.value === '__OTRO__') {
      return document.getElementById(inputId)?.value.trim() || '';
    }
    return select.value.trim();
  },

  _capitalizar(str) {
    return String(str || '').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  },

  _ordenarTickets(tickets) {
    return [...tickets].sort((a, b) => {
      const na = parseInt(a.numeroTicket, 10);
      const nb = parseInt(b.numeroTicket, 10);
      if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
      return String(a.creadoEn || '').localeCompare(String(b.creadoEn || ''));
    });
  },

  _formatearHora(iso) {
    if (!iso) return '-';
    return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  },

  _formatearFecha(iso) {
    if (!iso) return '-';
    return new Date(iso).toLocaleDateString('es-AR');
  },

  _escapeHtml(valor) {
    return String(valor ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  },

  _escapeXml(valor) {
    return String(valor ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&apos;');
  },

  // ── INIT ─────────────────────────────────────────────────
  async init() {
    await this.render();
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
