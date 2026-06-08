// ============================================================
//  app.js — SPA cobrador
// ============================================================

const App = {
  state: {
    vista: 'home',
    eventos: [],
    eventoSeleccionado: null,
    sesion: null,
    sessionToken: null,
    resumen: null,
    pollingTimer: null,
  },

  // ── Toast ─────────────────────────────────────────────────
  toast(msg, tipo = 'ok') {
    const c = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = `toast toast-${tipo}`;
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => t.remove(), 2800);
  },

  // ── Confirm modal ─────────────────────────────────────────
  confirm(titulo, texto, labelOk = 'Confirmar', clsOk = 'btn-negro') {
    return new Promise(resolve => {
      const ov  = document.getElementById('confirm-overlay');
      const btn = document.getElementById('confirm-ok');
      document.getElementById('confirm-title').textContent = titulo;
      document.getElementById('confirm-text').textContent  = texto;
      btn.textContent = labelOk;
      btn.className   = `btn ${clsOk} btn-md`;
      ov.classList.add('open');
      const done = val => {
        ov.classList.remove('open');
        btn.onclick = null;
        document.getElementById('confirm-cancel').onclick = null;
        resolve(val);
      };
      btn.onclick = () => done(true);
      document.getElementById('confirm-cancel').onclick = () => done(false);
    });
  },

  // ── Render ────────────────────────────────────────────────
  render() {
    const app = document.getElementById('app');
    switch (this.state.vista) {
      case 'home':    app.innerHTML = this.vistaHome();    break;
      case 'ingreso': app.innerHTML = this.vistaIngreso(); break;
      case 'cobro':   app.innerHTML = this.vistaCobro();   break;
      case 'cierre':  app.innerHTML = this.vistaCierre();  break;
    }
    this.bindEvents();
    window.scrollTo(0, 0);
  },

  ir(vista, extra = {}) {
    this.state = { ...this.state, ...extra, vista };
    this.render();
  },

  // ── HOME ──────────────────────────────────────────────────
  vistaHome() {
    const { eventos } = this.state;
    const tarjetas = eventos.length
      ? eventos.map(e => `
          <div class="evento-card" data-id="${e.id}" role="button" tabindex="0">
            <div class="evento-card-vs">Universitario vs ${this._esc(e.visitante)}</div>
            <div class="evento-card-meta">
              <span>${this._catLabel(e.categoria)}</span>
              <span>·</span>
              <span>${this._fmtFecha(e.fecha)}</span>
              ${e.hora ? `<span>·</span><span>${e.hora.slice(0,5)} hs</span>` : ''}
            </div>
            <div class="evento-card-precio">$${Number(e.precio_entrada).toLocaleString('es-AR')} por auto</div>
          </div>`).join('')
      : `<div class="empty-state">
           <div class="empty-title">Sin partidos activos</div>
           <div class="empty-text">Consultá con el administrador del club.</div>
         </div>`;

    return `
      <div class="home-hero">
        <div class="home-hero-body">
          <img src="logo.png" class="home-hero-logo" alt="CUC">
          <div class="home-hero-info">
            <div class="home-hero-titulo">Sistema de Estacionamiento</div>
            <div class="home-hero-sub">Club Universitario Rugby</div>
          </div>
        </div>
        <img src="monolito.png" class="home-hero-monolito" alt="">
      </div>
      <div class="app-main app-main-home" style="padding:1.25rem;display:flex;flex-direction:column;gap:.9rem;">
        <div class="sec-title">Elegí tu partido</div>
        ${tarjetas}
        <div style="margin-top:.5rem;padding-top:1rem;border-top:1px solid var(--border);">
          <a href="admin.html" class="btn btn-outline btn-md btn-full" style="text-decoration:none;">
            Panel Administrador
          </a>
        </div>
      </div>`;
  },

  // ── INGRESO ───────────────────────────────────────────────
  vistaIngreso() {
    const e = this.state.eventoSeleccionado;
    return `
      <div>
        <div class="rojo-stripe"></div>
        <div class="app-header">
          <img src="logo.png" class="logo-xs" alt="CUC">
          <div class="app-header-info">
            <div style="font-size:.72rem;color:var(--text2);">Universitario vs ${this._esc(e.visitante)}</div>
            <div style="font-size:.9rem;font-weight:800;color:var(--text);">${this._catLabel(e.categoria)} · ${this._fmtFecha(e.fecha)}</div>
          </div>
        </div>
      </div>
      <div class="app-main app-main-form" style="padding:1.25rem;display:flex;flex-direction:column;gap:.9rem;">
        <button class="btn-volver" id="btn-back-home">← Cambiar partido</button>
        <div class="form-card">
          <div class="form-card-header">
            <h2>¿Quién cobra?</h2>
            <p>Ingresá tus datos para empezar a cobrar.</p>
          </div>
          <div id="alerta-ingreso"></div>
          <div class="campo">
            <label>Nombre *</label>
            <input type="text" id="ing-nombre" placeholder="Ej: Juan" autocomplete="given-name" maxlength="60">
            <span class="campo-error" id="err-nombre">Ingresá tu nombre</span>
          </div>
          <div class="campo">
            <label>Apellido *</label>
            <input type="text" id="ing-apellido" placeholder="Ej: Pérez" autocomplete="family-name" maxlength="60">
            <span class="campo-error" id="err-apellido">Ingresá tu apellido</span>
          </div>
          <div class="campo">
            <label>DNI *</label>
            <input type="text" id="ing-dni" placeholder="Ej: 32456789" inputmode="numeric" autocomplete="off" maxlength="10" pattern="[0-9]{6,10}">
            <span class="campo-error" id="err-dni">Ingresá un DNI válido (solo números)</span>
          </div>
          <div class="campo">
            <label>Contraseña del partido *</label>
            <input type="text" id="ing-pass" placeholder="Ej: I472" autocomplete="off" maxlength="12"
                   style="text-transform:uppercase;letter-spacing:.1em;font-weight:700;">
            <span class="campo-error" id="err-pass">Contraseña incorrecta</span>
          </div>
          <button class="btn btn-verde btn-lg btn-full" id="btn-ingresar">Empezar a cobrar</button>
        </div>
      </div>`;
  },

  // ── COBRO ─────────────────────────────────────────────────
  vistaCobro() {
    const { sesion, eventoSeleccionado: e, resumen: r } = this.state;
    const precio = Number(e.precio_entrada).toLocaleString('es-AR');
    const tk  = r?.cantidad_total         ?? 0;
    const ef  = r?.cantidad_efectivo      ?? 0;
    const tr  = r?.cantidad_transferencia ?? 0;
    const li  = r?.cantidad_libres        ?? 0;
    const rec = r ? `$${Number(r.total_recaudado).toLocaleString('es-AR')}` : '$0';

    return `
      <div class="rojo-stripe"></div>
      <div class="cobro-header">
        <img src="logo.png" class="logo-xs" alt="CUC" style="flex-shrink:0;">
        <div class="cobro-header-info">
          <div class="cobro-header-cobrador">${this._esc(sesion.nombre)} ${this._esc(sesion.apellido)}</div>
          <div class="cobro-header-partido">Universitario vs ${this._esc(e.visitante)}</div>
        </div>
        <div class="cobro-header-precio">$${precio}</div>
      </div>

      <div class="cobro-stats-bar">
        <div class="cobro-stat">
          <div class="cobro-stat-num" id="stat-rec">${rec}</div>
          <div class="cobro-stat-lbl">Recaudado</div>
        </div>
        <div class="cobro-stat">
          <div class="cobro-stat-num" id="stat-tk">${tk}</div>
          <div class="cobro-stat-lbl">Tickets</div>
        </div>
        <div class="cobro-stat">
          <div class="cobro-stat-num" id="stat-ef">${ef}</div>
          <div class="cobro-stat-lbl">Efectivo</div>
        </div>
        <div class="cobro-stat">
          <div class="cobro-stat-num" id="stat-tr">${tr}</div>
          <div class="cobro-stat-lbl">Transfer.</div>
        </div>
        <div class="cobro-stat">
          <div class="cobro-stat-num" id="stat-li">${li}</div>
          <div class="cobro-stat-lbl">Libres</div>
        </div>
      </div>

      <div class="app-main app-main-cobro" style="padding:1rem;display:flex;flex-direction:column;gap:.85rem;">
        <div id="cobro-alerta"></div>

        <div class="ticket-input-wrap">
          <label>Número de ticket</label>
          <input type="text" id="ticket-num" class="ticket-input"
            placeholder="000" inputmode="numeric" autocomplete="off" enterkeyhint="done" maxlength="8" pattern="[0-9]{1,8}">
        </div>

        <div class="cobro-metodos-panel">
          <div class="sec-title" style="margin-bottom:.5rem;">Método de pago</div>
          <div class="cobro-metodos">
            <button class="btn-metodo btn-metodo-ef" id="btn-ef" data-metodo="efectivo">
              <span class="btn-metodo-icon">💵</span>
              <div class="btn-metodo-texto">
                <span class="btn-metodo-titulo">Efectivo</span>
                <span class="btn-metodo-sub">$${precio}</span>
              </div>
            </button>
            <button class="btn-metodo btn-metodo-tr" id="btn-tr" data-metodo="transferencia">
              <span class="btn-metodo-icon">📲</span>
              <div class="btn-metodo-texto">
                <span class="btn-metodo-titulo">Transferencia</span>
                <span class="btn-metodo-sub">$${precio}</span>
              </div>
            </button>
            <button class="btn-metodo btn-metodo-libre" id="btn-li" data-metodo="libre">
              <span class="btn-metodo-icon">🎟</span>
              <div class="btn-metodo-texto">
                <span class="btn-metodo-titulo">Pase libre</span>
                <span class="btn-metodo-sub">Sin costo · abre formulario</span>
              </div>
            </button>
          </div>
        </div>

        ${e.alias ? `
          <div class="alias-banner" id="alias-banner" style="display:none;">
            <div class="alias-banner-label">Alias de transferencia</div>
            <div class="alias-banner-valor">${this._esc(e.alias)}</div>
          </div>` : ''}

        <button class="btn btn-verde btn-lg btn-full" id="btn-registrar" style="display:none;">
          ✓ Registrar ticket
        </button>

        <div class="cobro-actions">
          <button class="btn-cobro-secundario" id="btn-borrar-ultimo">
            ✕ Borrar último
          </button>
          <button class="btn-terminar-cobranza" id="btn-cerrar-turno">Terminar cobranza</button>
        </div>
      </div>`;
  },

  // ── CIERRE ────────────────────────────────────────────────
  vistaCierre() {
    const { sesion, eventoSeleccionado: e, resumen: r } = this.state;
    if (!r) return '';
    const total = Number(r.total_recaudado).toLocaleString('es-AR');
    const texto = this._generarTextoCierre();

    return `
      <div class="rojo-stripe"></div>
      <div class="app-header">
        <img src="logo.png" class="logo-xs" alt="CUC">
        <div class="app-header-info">
          <div style="font-size:.72rem;color:var(--text2);">Cobranza finalizada</div>
          <div style="font-size:.9rem;font-weight:800;color:var(--text);">${this._esc(sesion.nombre)} ${this._esc(sesion.apellido)}</div>
        </div>
      </div>

      <div class="app-main app-main-cierre" style="padding:1.25rem;display:flex;flex-direction:column;gap:1rem;">
        <div class="res-card res-card-destac" style="padding:1.25rem;">
          <div class="res-label">Total recaudado</div>
          <div class="res-valor grande">$${total}</div>
          <div class="res-sub" style="color:rgba(255,255,255,.85);">Universitario vs ${this._esc(e.visitante)} · ${this._catLabel(e.categoria)}</div>
        </div>

        <div class="card">
          <div class="cierre-fila">
            <div>
              <div class="cierre-fila-titulo">Efectivo</div>
              <div class="cierre-fila-sub">${r.cantidad_efectivo} ticket${r.cantidad_efectivo !== 1 ? 's' : ''}</div>
            </div>
            <div class="cierre-fila-monto">$${Number(r.total_efectivo).toLocaleString('es-AR')}</div>
          </div>
          <div class="cierre-fila">
            <div>
              <div class="cierre-fila-titulo">Transferencia</div>
              <div class="cierre-fila-sub">${r.cantidad_transferencia} ticket${r.cantidad_transferencia !== 1 ? 's' : ''}</div>
            </div>
            <div class="cierre-fila-monto">$${Number(r.total_transferencia).toLocaleString('es-AR')}</div>
          </div>
          <div class="cierre-fila" style="border-bottom:none;">
            <div class="cierre-fila-titulo">Pases libres</div>
            <div class="cierre-fila-monto" style="color:var(--text2);font-size:.95rem;">${r.cantidad_libres}</div>
          </div>
        </div>

        <div>
          <div class="sec-title" style="margin-bottom:.5rem;">Mensaje para compartir</div>
          <div class="copiar-box">
            <textarea id="texto-cierre" readonly rows="10">${this._escHtml(texto)}</textarea>
            <div class="grid-2">
              <button class="btn btn-negro btn-md btn-full" id="btn-copiar">Copiar</button>
              <button class="btn btn-outline btn-md btn-full" id="btn-compartir">Compartir</button>
            </div>
          </div>
        </div>

        <button class="btn btn-outline btn-md btn-full" id="btn-nueva-sesion">← Volver al inicio</button>
      </div>`;
  },

  // ── Bind Events (solo para elementos dentro de #app) ──────
  bindEvents() {
    const v = this.state.vista;

    if (v === 'home') {
      document.querySelectorAll('.evento-card').forEach(card => {
        const go = () => {
          const e = this.state.eventos.find(ev => ev.id === card.dataset.id);
          if (e) this.ir('ingreso', { eventoSeleccionado: e });
        };
        card.addEventListener('click', go);
        card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') go(); });
      });
    }

    if (v === 'ingreso') {
      document.getElementById('btn-back-home')?.addEventListener('click', () => this.ir('home'));
      document.getElementById('btn-ingresar')?.addEventListener('click', () => this.crearSesion());
      ['ing-nombre', 'ing-apellido', 'ing-dni', 'ing-pass'].forEach(id => {
        document.getElementById(id)?.addEventListener('keydown', e => {
          if (e.key === 'Enter') this.crearSesion();
        });
      });
      setTimeout(() => document.getElementById('ing-nombre')?.focus(), 150);
    }

    if (v === 'cobro') {
      // Selección de método (no registra, solo selecciona visualmente)
      document.querySelectorAll('.btn-metodo').forEach(btn => {
        btn.addEventListener('click', () => {
          const metodo = btn.dataset.metodo;
          document.getElementById('ticket-num')?.blur();
          if (metodo === 'libre') {
            this.abrirModalLibre();
            return;
          }
          // Deseleccionar todos y seleccionar el clickeado
          document.querySelectorAll('.btn-metodo').forEach(b => b.classList.remove('seleccionado'));
          btn.classList.add('seleccionado');
          // Mostrar/ocultar alias
          const alias = document.getElementById('alias-banner');
          if (alias) alias.style.display = metodo === 'transferencia' ? 'block' : 'none';
          // Mostrar botón registrar
          const btnReg = document.getElementById('btn-registrar');
          if (btnReg) btnReg.style.display = 'block';
        });
      });

      document.getElementById('btn-registrar')?.addEventListener('click', () => {
        const metodoBtn = document.querySelector('.btn-metodo.seleccionado');
        if (metodoBtn) this.registrarTicket(metodoBtn.dataset.metodo);
      });

      // Enter en ticket-num también registra si hay método seleccionado
      document.getElementById('ticket-num')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          e.currentTarget.blur();
          const metodoBtn = document.querySelector('.btn-metodo.seleccionado');
          if (metodoBtn) this.registrarTicket(metodoBtn.dataset.metodo);
        }
      });
      document.getElementById('ticket-num')?.addEventListener('change', e => {
        e.currentTarget.blur();
      });

      document.getElementById('btn-cerrar-turno')?.addEventListener('click', () => this.cerrarTurno());
      document.getElementById('btn-borrar-ultimo')?.addEventListener('click', () => this.borrarUltimoTicket());
      setTimeout(() => document.getElementById('ticket-num')?.focus(), 150);
    }

    if (v === 'cierre') {
      document.getElementById('btn-copiar')?.addEventListener('click',    () => this.copiarTexto());
      document.getElementById('btn-compartir')?.addEventListener('click', () => this.compartirTexto());
      document.getElementById('btn-nueva-sesion')?.addEventListener('click', () => {
        this.detenerPolling();
        this.ir('home', { sesion: null, eventoSeleccionado: null, resumen: null });
        this.cargarEventos();
      });
    }
  },

  // ── Cargar eventos ────────────────────────────────────────
  async cargarEventos() {
    try {
      this.state.eventos = await DB.eventosActivos();
      if (this.state.vista === 'home') this.render();
    } catch {
      this.toast('No se pudieron cargar los partidos', 'error');
    }
  },

  // ── Crear sesión ──────────────────────────────────────────
  async crearSesion() {
    const nombre   = (document.getElementById('ing-nombre')?.value   || '').trim();
    const apellido = (document.getElementById('ing-apellido')?.value || '').trim();
    const dni      = (document.getElementById('ing-dni')?.value      || '').trim();
    const pass     = (document.getElementById('ing-pass')?.value     || '').trim();

    const marcar = (errId, inputId, show) => {
      document.getElementById(errId)?.classList.toggle('visible', show);
      document.getElementById(inputId)?.classList.toggle('input-error', show);
    };
    let ok = true;
    if (!nombre || nombre.length < 2 || nombre.length > 60) { marcar('err-nombre',   'ing-nombre',   true); ok = false; }
    else                      marcar('err-nombre',   'ing-nombre',   false);
    if (!apellido || apellido.length < 2 || apellido.length > 60) { marcar('err-apellido', 'ing-apellido', true); ok = false; }
    else                      marcar('err-apellido', 'ing-apellido', false);
    if (!/^\d{6,10}$/.test(dni)) { marcar('err-dni',      'ing-dni',      true); ok = false; }
    else                      marcar('err-dni',      'ing-dni',      false);
    if (!pass)              { marcar('err-pass',     'ing-pass',     true); ok = false; }
    else                      marcar('err-pass',     'ing-pass',     false);
    if (!ok) return;

    const btn = document.getElementById('btn-ingresar');
    btn.disabled = true; btn.textContent = 'Ingresando...';
    try {
      const evento = this.state.eventoSeleccionado;
      if (!evento || evento.estado !== 'activo') throw new Error('Este partido ya no está activo.');
      const data = await DB.crearSesion(evento.id, nombre, apellido, dni, pass);
      const sesion = data.sesion;
      const { resumen } = await DB.resumenSesion(sesion.id);
      this.state.sesion             = sesion;
      this.state.sessionToken       = data.session_token;
      this.state.eventoSeleccionado = evento;
      this.state.resumen            = resumen;
      this.ir('cobro');
      this.iniciarPolling();
    } catch (err) {
      if (this._safeError(err) === 'Contraseña incorrecta.' || String(err.message || '').includes('sesion')) {
        document.getElementById('err-pass')?.classList.add('visible');
        document.getElementById('ing-pass')?.classList.add('input-error');
      } else {
        document.getElementById('alerta-ingreso').innerHTML =
          `<div class="alerta-error">${this._escHtml(this._safeError(err))}</div>`;
      }
      btn.disabled = false; btn.textContent = 'Empezar a cobrar';
    }
  },

  // ── Registrar ticket ──────────────────────────────────────
  async registrarTicket(metodo) {
    const numInput = document.getElementById('ticket-num');
    const numero   = (numInput?.value || '').trim();
    const alertaEl = document.getElementById('cobro-alerta');

    if (!/^\d{1,8}$/.test(numero)) {
      alertaEl.innerHTML = '<div class="alerta-error">Ingresá un número de ticket válido.</div>';
      numInput?.focus();
      return;
    }
    alertaEl.innerHTML = '';

    // Detectar duplicado
    const dup = await DB.checkDuplicado(this.state.eventoSeleccionado.id, numero);
    if (dup) {
      const cobNombre = dup.sesion ? `${dup.sesion.nombre} ${dup.sesion.apellido}` : 'otro cobrador';
      const hora = dup.ticket.timestamp
        ? new Date(dup.ticket.timestamp).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
        : '';
      await this.confirm(
        'Ticket duplicado',
        `El ticket N° ${numero} ya fue registrado por ${cobNombre}${hora ? ' a las ' + hora : ''}. No se puede registrar duplicado.`,
        'Entendido',
        'btn-amber'
      );
      numInput?.focus();
      return;
    }

    try {
      await DB.registrarTicket({
        evento_id:     this.state.eventoSeleccionado.id,
        sesion_id:     this.state.sesion.id,
        session_token: this.state.sessionToken,
        metodo_pago:   metodo,
        numero_ticket: numero,
        monto:         this.state.eventoSeleccionado.precio_entrada,
      });
      if (numInput) numInput.value = '';
      // Deseleccionar método y ocultar botón registrar
      document.querySelectorAll('.btn-metodo').forEach(b => b.classList.remove('seleccionado'));
      const btnReg = document.getElementById('btn-registrar');
      if (btnReg) btnReg.style.display = 'none';
      const alias = document.getElementById('alias-banner');
      if (alias) alias.style.display = 'none';

      const label = metodo === 'efectivo' ? 'Efectivo' : 'Transferencia';
      this.toast(`Ticket #${numero} registrado — ${label}`);
      numInput?.focus();
      const { resumen } = await DB.resumenSesion(this.state.sesion.id);
      this.state.resumen = resumen;
      this._actualizarStats();
    } catch (err) {
      alertaEl.innerHTML = `<div class="alerta-error">${this._escHtml(this._safeError(err))}</div>`;
    }
  },

  // ── Pase libre ────────────────────────────────────────────
  abrirModalLibre() {
    ['libre-nombre', 'libre-patente', 'libre-motivo'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    document.querySelectorAll('#modal-libre .campo-error').forEach(e => e.classList.remove('visible'));
    document.getElementById('modal-libre').classList.add('open');
    setTimeout(() => document.getElementById('libre-nombre')?.focus(), 200);
  },

  cerrarModalLibre() {
    document.getElementById('modal-libre').classList.remove('open');
  },

  async confirmarLibre() {
    const nombre  = (document.getElementById('libre-nombre')?.value       || '').trim();
    const patente = (document.getElementById('libre-patente')?.value      || '').trim().toUpperCase();
    const motivo  = (document.getElementById('libre-motivo')?.value       || '').trim();

    const marcar = (id, show) => document.getElementById(id)?.classList.toggle('visible', show);
    let ok = true;
    marcar('err-libre-nombre',  nombre.length < 2 || nombre.length > 80);  if (nombre.length < 2 || nombre.length > 80)  ok = false;
    marcar('err-libre-patente', !/^[A-Z0-9 -]{3,12}$/.test(patente)); if (!/^[A-Z0-9 -]{3,12}$/.test(patente)) ok = false;
    marcar('err-libre-motivo',  motivo.length < 2 || motivo.length > 80);  if (motivo.length < 2 || motivo.length > 80)  ok = false;
    if (!ok) return;

    const btn = document.getElementById('btn-confirmar-libre');
    btn.disabled = true; btn.textContent = 'Registrando...';
    try {
      await DB.registrarTicket({
        evento_id:         this.state.eventoSeleccionado.id,
        sesion_id:         this.state.sesion.id,
        session_token:     this.state.sessionToken,
        metodo_pago:       'libre',
        numero_ticket:     null,
        monto:             0,
        libre_nombre:      nombre,
        libre_patente:     patente,
        libre_motivo:      motivo,
        libre_descripcion: null,
      });
      this.cerrarModalLibre();
      this.toast(`Pase libre registrado — ${patente}`);
      const { resumen } = await DB.resumenSesion(this.state.sesion.id);
      this.state.resumen = resumen;
      this._actualizarStats();
    } catch (err) {
      this.toast(this._safeError(err), 'error');
    } finally {
      btn.disabled = false; btn.textContent = 'Registrar';
    }
  },

  // ── Cerrar turno ──────────────────────────────────────────
  async cerrarTurno() {
    const ok = await this.confirm(
      '¿Cerrar tu turno?',
      'Una vez cerrado no podés registrar más tickets en esta sesión.',
      'Sí, cerrar turno',
      'btn-verde'
    );
    if (!ok) return;
    try {
      await DB.cerrarSesion(this.state.sesion.id, this.state.sessionToken);
      this.detenerPolling();
      const { resumen } = await DB.resumenSesion(this.state.sesion.id);
      this.state.resumen = resumen;
      this.ir('cierre');
    } catch (err) {
      this.toast(this._safeError(err), 'error');
    }
  },

  // ── Borrar último ticket (propio) ─────────────────────────
  async borrarUltimoTicket() {
    const { resumen } = await DB.resumenSesion(this.state.sesion.id);
    if (!resumen.cantidad_total) {
      this.toast('No tenés tickets registrados', 'warn');
      return;
    }
    const ok = await this.confirm(
      'Borrar último ticket',
      'Se va a borrar el último ticket registrado en tu sesión. Esta acción no se puede deshacer.',
      'Borrar',
      'btn-danger'
    );
    if (!ok) return;
    try {
      await DB.borrarUltimoTicketSesion(this.state.sesion.id, this.state.sessionToken);
      this.toast('Último ticket borrado');
      const { resumen: r } = await DB.resumenSesion(this.state.sesion.id);
      this.state.resumen = r;
      this._actualizarStats();
    } catch (err) {
      this.toast(this._safeError(err), 'error');
    }
  },

  // ── Polling ───────────────────────────────────────────────
  iniciarPolling() {
    this.detenerPolling();
    this.state.pollingTimer = setInterval(() => this._pollSesion(), 4000);
  },

  detenerPolling() {
    if (this.state.pollingTimer) {
      clearInterval(this.state.pollingTimer);
      this.state.pollingTimer = null;
    }
  },

  async _pollSesion() {
    if (!this.state.sesion || this.state.vista !== 'cobro') return;
    try {
      const { sesion, resumen } = await DB.resumenSesion(this.state.sesion.id);
      this.state.resumen = resumen;
      if (sesion?.cerrada_por_admin && sesion?.estado === 'finalizada') {
        this.detenerPolling();
        this._mostrarEventoCerrado();
        return;
      }
      this._actualizarStats();
    } catch { /* silencioso */ }
  },

  _actualizarStats() {
    const r = this.state.resumen;
    if (!r) return;
    const mapa = {
      'stat-rec': `$${Number(r.total_recaudado).toLocaleString('es-AR')}`,
      'stat-tk':  r.cantidad_total,
      'stat-ef':  r.cantidad_efectivo,
      'stat-tr':  r.cantidad_transferencia,
      'stat-li':  r.cantidad_libres,
    };
    for (const [id, val] of Object.entries(mapa)) {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    }
  },

  _mostrarEventoCerrado() {
    const r  = this.state.resumen;
    const ov = document.getElementById('overlay-cerrado');
    if (r) {
      document.getElementById('cerrado-resumen').innerHTML =
        `<div style="background:var(--bg);border-radius:var(--radius-sm);padding:.75rem;font-size:.88rem;">
           <strong>$${Number(r.total_recaudado).toLocaleString('es-AR')}</strong> recaudado · ${r.cantidad_total} tickets
         </div>`;
    }
    ov.classList.add('open');
  },

  // ── Copiar / compartir ────────────────────────────────────
  async copiarTexto() {
    const texto = document.getElementById('texto-cierre')?.value || '';
    try {
      await navigator.clipboard.writeText(texto);
      this.toast('Texto copiado');
    } catch {
      document.getElementById('texto-cierre')?.select();
      this.toast('Seleccioná y copiá manualmente', 'warn');
    }
  },

  compartirTexto() {
    const texto = document.getElementById('texto-cierre')?.value || '';
    if (navigator.share) {
      navigator.share({ text: texto }).catch(() => {});
    } else {
      this.copiarTexto();
    }
  },

  // ── Texto de cierre (cobrador) ────────────────────────────
  _generarTextoCierre() {
    const { sesion, eventoSeleccionado: e, resumen: r } = this.state;
    if (!r) return '';
    const hora = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    const lineas = [
      'RESUMEN DE COBRANZA',
      '',
      `Cobrador: ${sesion.nombre} ${sesion.apellido}`,
      `Partido: Universitario vs ${e.visitante}`,
      `Categoría: ${this._catLabel(e.categoria)}`,
      `Fecha: ${this._fmtFecha(e.fecha)}`,
      `Hora de cierre: ${hora}`,
      '',
      `Efectivo: ${r.cantidad_efectivo} - $${Number(r.total_efectivo).toLocaleString('es-AR')}`,
      `Transferencia: ${r.cantidad_transferencia} - $${Number(r.total_transferencia).toLocaleString('es-AR')}`,
      `Pase libre: ${r.cantidad_libres}`,
      '',
      `Total: $${Number(r.total_recaudado).toLocaleString('es-AR')}`,
    ];
    return lineas.join('\n');
  },

  // ── Helpers ───────────────────────────────────────────────
  _catLabel(cat) { return DB.CATEGORIAS[cat] || cat || ''; },

  _fmtFecha(f) {
    if (!f) return '';
    const [y, m, d] = f.split('-');
    return `${d}/${m}/${y}`;
  },

  _esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  },

  _escHtml(s) { return this._esc(s); },
  _safeError(e, fallback = 'No se pudo completar la acción.') {
    const permitidos = [
      'Ingresá un nombre válido.',
      'Ingresá un apellido válido.',
      'Ingresá un DNI válido.',
      'Contraseña incorrecta.',
      'Este partido ya no está activo.',
      'El partido ya fue cerrado.',
      'La sesión no está habilitada.',
      'Seleccioná un método de pago válido.',
      'Ingresá un número de ticket válido.',
      'Ese ticket ya fue registrado.',
      'Ingresá el nombre del pase libre.',
      'Ingresá una patente válida.',
      'Ingresá el motivo del pase libre.',
      'No tenés tickets registrados para borrar.',
      'Sesión no encontrada.',
      'No se pudo iniciar la sesion. Verificá los datos e intentá nuevamente.',
      'Demasiados intentos. Esperá unos minutos y volvé a probar.',
      'Ese ticket ya fue registrado.',
      'No se pudo registrar el ticket.',
    ];
    const msg = String(e?.message || '');
    return permitidos.includes(msg) ? msg : fallback;
  },

  // ── Init — listeners estáticos (modal, overlay) ───────────
  init() {
    // Estos listeners se agregan UNA SOLA VEZ sobre elementos del HTML estático
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
    document.getElementById('btn-confirmar-libre').addEventListener('click', () => this.confirmarLibre());
    document.getElementById('btn-cancelar-libre').addEventListener('click',  () => this.cerrarModalLibre());
    document.getElementById('btn-cerrado-ok').addEventListener('click', async () => {
      document.getElementById('overlay-cerrado').classList.remove('open');
      try {
        const { resumen } = await DB.resumenSesion(this.state.sesion.id);
        this.state.resumen = resumen;
      } catch { /* ya tiene resumen */ }
      this.ir('cierre');
    });

    this.render();
    this.cargarEventos();
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());
