// ============================================================
//  admin.js — Panel de administración CUC Estacionamiento
// ============================================================

const Admin = {
  admin:           null,
  pollingTimer:    null,
  eventoDetalleId: null,
  accessCodes:     {},

  // ── Estado auditoría ──────────────────────────────────────
  audit: {
    fechaDesde:   '',
    fechaHasta:   '',
    categoria:    'todas',
    visitante:    '',
    seleccionados: [], // array de evento IDs
  },

  // ── Toast ─────────────────────────────────────────────────
  toast(msg, tipo = 'ok') {
    const c = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className   = `toast toast-${tipo}`;
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

  // ── Navegación de screens ─────────────────────────────────
  showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id)?.classList.add('active');
    document.querySelectorAll('.admin-nav-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.screen === id);
    });
    window.scrollTo(0, 0);
    if (id === 'screen-stats')     this.renderStats();
    if (id === 'screen-auditoria') this.renderAuditoria();
    if (id === 'screen-dashboard') this.cargarEventos();
  },

  // ── Helpers de formato ────────────────────────────────────
  catLabel(cat)  { return DB.CATEGORIAS[cat]    || cat || '—'; },
  motivoLabel(m) { return DB.MOTIVOS_LIBRE[m]   || m   || '—'; },

  fmtFecha(f) {
    if (!f) return '—';
    const [y, m, d] = f.split('-');
    return `${d}/${m}/${y}`;
  },
  fmtHora(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  },
  fmtDateTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('es-AR') + ' ' +
      d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  },
  esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  },
  safeError(e, fallback = 'No se pudo completar la acción.') {
    const permitidos = [
      'Completá usuario y contraseña.',
      'Usuario o contraseña incorrectos.',
      'No tenés permisos de administrador.',
      'No tenes permisos de administrador.',
      'Ingresá un visitante válido.',
      'Seleccioná una categoría válida.',
      'Seleccioná una fecha válida.',
      'Ingresá una hora válida.',
      'Ingresá un precio válido.',
      'Evento no encontrado.',
      'El evento ya está cerrado.',
    ];
    const msg = String(e?.message || '');
    return permitidos.includes(msg) ? msg : fallback;
  },

  // ── LOGIN ─────────────────────────────────────────────────
  async login() {
    const usuario  = (document.getElementById('login-user')?.value || '').trim();
    const password = (document.getElementById('login-pass')?.value || '').trim();
    const alerta   = document.getElementById('login-alerta');
    const btn      = document.getElementById('btn-login');
    if (!usuario || !password) {
      alerta.innerHTML = '<div class="alerta-error">Completá usuario y contraseña.</div>';
      return;
    }
    btn.disabled = true; btn.textContent = 'Ingresando...';
    try {
      const admin = await DB.loginAdmin(usuario, password);
      if (!admin) throw new Error('Usuario o contraseña incorrectos.');
      this.admin = admin;
      document.getElementById('admin-topbar').style.display = 'block';
      document.getElementById('topbar-nombre').textContent  = admin.nombre;
      alerta.innerHTML = '';
      this.showScreen('screen-dashboard');
    } catch (e) {
      alerta.innerHTML = `<div class="alerta-error">${this.esc(this.safeError(e, 'No se pudo iniciar sesión.'))}</div>`;
    } finally {
      btn.disabled = false; btn.textContent = 'Ingresar';
    }
  },

  logout() {
    this.admin = null;
    this.detenerPolling();
    document.getElementById('admin-topbar').style.display = 'none';
    document.getElementById('login-user').value  = '';
    document.getElementById('login-pass').value  = '';
    document.getElementById('login-alerta').innerHTML = '';
    this.showScreen('screen-login');
    document.querySelectorAll('.admin-nav-btn').forEach(b => b.classList.remove('active'));
    setTimeout(() => document.getElementById('login-user')?.focus(), 200);
  },

  // ── DASHBOARD ─────────────────────────────────────────────
  async cargarEventos() {
    try {
      const eventos  = await DB.todosEventos();
      const activos  = eventos.filter(e => e.estado === 'activo');
      const cerrados = eventos.filter(e => e.estado === 'cerrado');

      const fila = e => {
        const r = e.resumen || {
          cantidad_total: 0,
          total_recaudado: 0,
        };
        if (e.estado === 'activo' && e.password_evento && !this.accessCodes[e.id]) {
          this.accessCodes[e.id] = e.password_evento;
        }
        const accessCode = this.accessCodes[e.id];
        return `
          <div class="evento-fila ${e.estado === 'activo' ? 'evento-activo' : 'evento-cerrado'}">
            <div class="evento-info">
              <div class="evento-nombre">Universitario vs ${this.esc(e.visitante)}</div>
              <div class="evento-meta">${this.catLabel(e.categoria)} · ${this.fmtFecha(e.fecha)}${e.hora ? ' · ' + e.hora.slice(0,5) + ' hs' : ''} · $${Number(e.precio_entrada).toLocaleString('es-AR')}</div>
              <div class="evento-stats">
                <span class="badge ${e.estado === 'activo' ? 'badge-activo' : 'badge-cerrado'}">
                  ${e.estado === 'activo' ? 'Activo' : 'Cerrado'}
                </span>
                <span class="evento-stat-txt">${r.cantidad_total} tickets · $${Number(r.total_recaudado).toLocaleString('es-AR')}</span>
                ${e.estado === 'activo' && accessCode ? `<span class="evento-stat-txt" style="font-weight:800;color:var(--rojo);">🔑 ${this.esc(accessCode)}</span>` : ''}
              </div>
            </div>
            <div class="evento-acciones">
              <button class="btn btn-outline btn-sm" data-accion="ver" data-id="${e.id}">Ver</button>
              ${e.estado === 'activo'
                ? `<button class="btn btn-verde btn-sm" data-accion="compartir" data-id="${e.id}">📤 Compartir</button>
                   <button class="btn btn-amber btn-sm" data-accion="cerrar" data-id="${e.id}">Cerrar</button>`
                : `<button class="btn btn-danger btn-sm" data-accion="eliminar" data-id="${e.id}">Eliminar</button>`
              }
            </div>
          </div>`;
      };

      const listaA = document.getElementById('lista-activos');
      const listaC = document.getElementById('lista-cerrados');
      listaA.innerHTML = activos.length
        ? activos.map(fila).join('')
        : '<div class="empty-state"><div class="empty-icon">🏉</div><div class="empty-title">Sin partidos activos</div></div>';
      listaC.innerHTML = cerrados.length
        ? cerrados.map(fila).join('')
        : '<p style="font-size:.83rem;color:var(--text3);padding:.5rem 0;">Sin partidos cerrados aún.</p>';

      document.querySelectorAll('[data-accion="ver"]').forEach(b =>
        b.addEventListener('click', () => this.verDetalle(b.dataset.id)));
      document.querySelectorAll('[data-accion="compartir"]').forEach(b =>
        b.addEventListener('click', () => this.compartirEvento(b.dataset.id)));
      document.querySelectorAll('[data-accion="cerrar"]').forEach(b =>
        b.addEventListener('click', () => this.cerrarEvento(b.dataset.id)));
      document.querySelectorAll('[data-accion="eliminar"]').forEach(b =>
        b.addEventListener('click', () => this.eliminarEvento(b.dataset.id)));
    } catch (e) {
      document.getElementById('dash-alerta').innerHTML =
        `<div class="alerta-error">${this.esc(this.safeError(e))}</div>`;
    }
  },

  // ── COMPARTIR EVENTO ──────────────────────────────────────
  async compartirEvento(id) {
    const e = (await DB.todosEventos()).find(ev => ev.id === id);
    if (!e) return;
    const accessCode = this.accessCodes[id];
    if (!accessCode) {
      this.toast('La clave solo se muestra al crear el partido. Generá y compartí el mensaje en ese momento.', 'warn');
      return;
    }
    const indexUrl = window.location.origin;
    const hora = e.hora ? ` · ${e.hora.slice(0,5)} hs` : '';
    const texto =
`🏉 *Estacionamiento CUC — ${this.catLabel(e.categoria)}*

Universitario vs ${e.visitante}
📅 ${this.fmtFecha(e.fecha)}${hora}
💰 Precio por auto: $${Number(e.precio_entrada).toLocaleString('es-AR')}

Te invito a participar como cobrador en este evento.

🔑 Clave de acceso: *${accessCode}*

📲 Ingresá desde: ${indexUrl}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: 'Estacionamiento CUC', text: texto });
        return;
      } catch { /* cancelado */ }
    }
    // Fallback: copiar al portapapeles
    try {
      await navigator.clipboard.writeText(texto);
      this.toast('Mensaje copiado al portapapeles', 'ok');
    } catch {
      this.toast('No se pudo compartir', 'error');
    }
  },

  // ── CREAR EVENTO ──────────────────────────────────────────
  async crearEvento() {
    const selVisitante = document.getElementById('ev-visitante').value;
    const visitante = selVisitante === '__otro__'
      ? (document.getElementById('ev-visitante-otro')?.value || '').trim()
      : selVisitante;
    const categoria = document.getElementById('ev-categoria').value;
    const fecha     = document.getElementById('ev-fecha').value;
    const hora      = document.getElementById('ev-hora').value || null;
    const precio    = parseInt(document.getElementById('ev-precio').value, 10);
    const alias     = (document.getElementById('ev-alias')?.value || '').trim();

    const marcar = (id, show) => document.getElementById(id)?.classList.toggle('visible', show);
    let ok = true;
    marcar('err-visitante', !visitante); if (!visitante)           ok = false;
    marcar('err-categoria', !categoria); if (!categoria)           ok = false;
    marcar('err-fecha',     !fecha);     if (!fecha)               ok = false;
    marcar('err-precio', !precio || precio <= 0); if (!precio || precio <= 0) ok = false;
    if (!ok) return;

    const btn = document.getElementById('btn-crear-evento');
    btn.disabled = true; btn.textContent = 'Creando...';
    try {
      const data = await DB.crearEvento({ visitante, categoria, fecha, hora, precio_entrada: precio, alias });
      if (data?.evento?.id && data?.access_code) this.accessCodes[data.evento.id] = data.access_code;
      this.toast('Partido creado correctamente');
      this.showScreen('screen-dashboard');
    } catch (err) {
      document.getElementById('crear-alerta').innerHTML =
        `<div class="alerta-error">${this.esc(this.safeError(err))}</div>`;
    } finally {
      btn.disabled = false; btn.textContent = 'Crear partido';
    }
  },

  // ── DETALLE EVENTO ────────────────────────────────────────
  async verDetalle(id) {
    this.eventoDetalleId = id;
    this.detenerPolling();
    this.showScreen('screen-detalle');
    document.getElementById('detalle-alerta').innerHTML = '';
    this.switchTab('cobradores');
    try {
      const data = await DB.detalleEvento(id);
      this.renderDetalle(data);
      if (data.evento?.estado === 'activo') this.iniciarPolling(id);
    } catch (e) {
      document.getElementById('detalle-alerta').innerHTML =
        `<div class="alerta-error">${this.esc(this.safeError(e))}</div>`;
    }
  },

  renderDetalle({ evento, sesiones, tickets }) {
    document.getElementById('detalle-titulo').textContent =
      `Universitario vs ${evento.visitante}`;
    document.getElementById('detalle-meta').textContent =
      `${this.catLabel(evento.categoria)} · ${this.fmtFecha(evento.fecha)}${evento.hora ? ' · ' + evento.hora.slice(0,5) + ' hs' : ''} · $${Number(evento.precio_entrada).toLocaleString('es-AR')}`;
    document.getElementById('detalle-badge').innerHTML =
      `<div style="display:flex;align-items:center;gap:.75rem;flex-wrap:wrap;margin-top:.25rem;">
         <span class="badge ${evento.estado === 'activo' ? 'badge-activo' : 'badge-cerrado'}">
           ${evento.estado === 'activo' ? 'Activo' : 'Cerrado'}
         </span>
       </div>`;

    // Clave de acceso — solo se muestra mientras el partido está activo.
    const claveWrap = document.getElementById('detalle-clave-wrap');
    if (claveWrap) {
      if (evento.estado === 'activo' && evento.password_evento) {
        claveWrap.style.display = 'block';
        document.getElementById('detalle-clave-valor').textContent = this.accessCodes[evento.id] || '';
      } else {
        claveWrap.style.display = 'none';
        document.getElementById('detalle-clave-valor').textContent = '';
      }
    }

    const activos = tickets.filter(t => !t.eliminado);
    const ef  = activos.filter(t => t.metodo_pago === 'efectivo');
    const tr  = activos.filter(t => t.metodo_pago === 'transferencia');
    const li  = activos.filter(t => t.metodo_pago === 'libre');
    const tot = ef.reduce((s,t)=>s+(t.monto||0),0) + tr.reduce((s,t)=>s+(t.monto||0),0);

    document.getElementById('detalle-resumen').innerHTML = `
      <div class="res-card res-card-destac">
        <div class="res-label">Total recaudado</div>
        <div class="res-valor grande">$${tot.toLocaleString('es-AR')}</div>
      </div>
      <div class="res-card">
        <div class="res-label">Efectivo</div>
        <div class="res-valor">$${ef.reduce((s,t)=>s+(t.monto||0),0).toLocaleString('es-AR')}</div>
        <div class="res-sub">${ef.length} ticket${ef.length !== 1 ? 's' : ''}</div>
      </div>
      <div class="res-card">
        <div class="res-label">Transferencia</div>
        <div class="res-valor">$${tr.reduce((s,t)=>s+(t.monto||0),0).toLocaleString('es-AR')}</div>
        <div class="res-sub">${tr.length} ticket${tr.length !== 1 ? 's' : ''}</div>
      </div>
      <div class="res-card">
        <div class="res-label">Pases libres</div>
        <div class="res-valor">${li.length}</div>
        <div class="res-sub">${activos.length} total</div>
      </div>`;

    // Acciones
    const acc = document.getElementById('detalle-acciones');
    acc.innerHTML = '';
    if (evento.estado === 'activo') {
      const btnCerrar = document.createElement('button');
      btnCerrar.className   = 'btn btn-amber btn-lg';
      btnCerrar.textContent = '🔒 Cerrar partido';
      btnCerrar.addEventListener('click', () => this.cerrarEvento(evento.id, true));
      acc.appendChild(btnCerrar);
    }
    const btnEliminar = document.createElement('button');
    btnEliminar.className   = 'btn btn-danger btn-lg';
    btnEliminar.textContent = 'Eliminar partido';
    btnEliminar.addEventListener('click', () => this.eliminarEvento(evento.id, true));
    acc.appendChild(btnEliminar);

    // Texto resumen + exportar
    document.getElementById('detalle-texto-wrap').style.display = 'block';
    document.getElementById('texto-resumen-admin').value =
      this._generarTextoResumen(evento, sesiones, activos, ef, tr, li, tot);
    document.getElementById('btn-copiar-resumen').onclick = () => this.copiarResumen();
    document.getElementById('btn-exportar-excel').onclick = () => this.exportarExcel(evento.id);

    // ── Tab: cobradores ────────────────────────────────────
    const tbody = document.getElementById('tbody-cobradores');
    tbody.innerHTML = '';
    if (!sesiones.length) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:var(--text3);padding:1.5rem;font-style:italic;">Sin cobradores todavía.</td></tr>`;
    } else {
      sesiones.forEach(s => {
        const st  = activos.filter(t => t.sesion_id === s.id);
        const sef = st.filter(t => t.metodo_pago === 'efectivo');
        const str = st.filter(t => t.metodo_pago === 'transferencia');
        const sli = st.filter(t => t.metodo_pago === 'libre');
        const stot = sef.reduce((a,t)=>a+(t.monto||0),0) + str.reduce((a,t)=>a+(t.monto||0),0);
        const abierta = s.estado === 'activa';
        const tr2 = document.createElement('tr');
        if (abierta) tr2.classList.add('cobrador-activo');
        tr2.innerHTML = `
          <td>
            <strong class="${abierta ? 'text-rojo' : ''}">${this.esc(s.nombre)} ${this.esc(s.apellido)}</strong>
            <span class="td-sub">DNI ${this.esc(s.dni)}</span>
          </td>
          <td>${s.numero_sesion}</td>
          <td>${this.fmtHora(s.hora_inicio)}</td>
          <td>${s.hora_cierre
            ? this.fmtHora(s.hora_cierre)
            : '<span class="badge badge-sin-cerrar" style="font-size:.62rem;">sin cerrar</span>'}</td>
          <td>${st.length}</td>
          <td>${sef.length}<span class="td-sub">$${sef.reduce((a,t)=>a+(t.monto||0),0).toLocaleString('es-AR')}</span></td>
          <td>${str.length}<span class="td-sub">$${str.reduce((a,t)=>a+(t.monto||0),0).toLocaleString('es-AR')}</span></td>
          <td>${sli.length}</td>
          <td><strong>$${stot.toLocaleString('es-AR')}</strong></td>`;
        tbody.appendChild(tr2);
      });
    }

    // ── Tab: tickets (excluye pases libres) ────────────────
    const tbodyT = document.getElementById('tbody-tickets');
    tbodyT.innerHTML = '';
    const ticketsOrdenados = [...tickets]
      .filter(t => t.metodo_pago !== 'libre')
      .sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
    if (!ticketsOrdenados.length) {
      tbodyT.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:1.5rem;font-style:italic;">Sin tickets todavía.</td></tr>`;
    } else {
      ticketsOrdenados.forEach(t => {
        const ses  = sesiones.find(s => s.id === t.sesion_id);
        const fila = document.createElement('tr');
        if (t.eliminado) fila.classList.add('fila-eliminada');
        const badge = { efectivo: 'badge-ef', transferencia: 'badge-tr' }[t.metodo_pago] || '';
        fila.innerHTML = `
          <td>${this.fmtHora(t.timestamp)}</td>
          <td>${t.numero_ticket ? `<strong>${this.esc(t.numero_ticket)}</strong>` : '—'}</td>
          <td>${ses ? `${this.esc(ses.nombre)} ${this.esc(ses.apellido)}` : '—'}</td>
          <td><span class="badge ${badge}">${t.metodo_pago}</span></td>
          <td>$${(t.monto||0).toLocaleString('es-AR')}</td>
          <td>${t.eliminado ? '<span style="color:var(--text3);font-size:.75rem;">Eliminado</span>' : '—'}</td>`;
        tbodyT.appendChild(fila);
      });
    }

    // ── Tab: pases libres ──────────────────────────────────
    const tbodyL = document.getElementById('tbody-libres');
    const libres  = tickets.filter(t => t.metodo_pago === 'libre' && !t.eliminado);
    tbodyL.innerHTML = '';
    if (!libres.length) {
      tbodyL.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:1.5rem;font-style:italic;">Sin pases libres.</td></tr>`;
    } else {
      libres.forEach(t => {
        const ses  = sesiones.find(s => s.id === t.sesion_id);
        const fila = document.createElement('tr');
        fila.innerHTML = `
          <td>${this.fmtHora(t.timestamp)}</td>
          <td>${ses ? `${this.esc(ses.nombre)} ${this.esc(ses.apellido)}` : '—'}</td>
          <td>${this.esc(t.libre_nombre || '—')}</td>
          <td><strong>${this.esc(t.libre_patente || '—')}</strong></td>
          <td>${this.motivoLabel(t.libre_motivo)}</td>
          <td>${this.esc(t.libre_descripcion || '—')}</td>`;
        tbodyL.appendChild(fila);
      });
    }
  },

  // ── Tabs ──────────────────────────────────────────────────
  switchTab(name) {
    document.querySelectorAll('#detalle-tabs .tab').forEach(t =>
      t.classList.toggle('active', t.dataset.tab === name));
    ['cobradores', 'tickets', 'libres'].forEach(n => {
      const el = document.getElementById(`tab-${n}`);
      if (el) el.style.display = n === name ? 'block' : 'none';
    });
  },

  // ── Cerrar evento ─────────────────────────────────────────
  async cerrarEvento(id, enDetalle = false) {
    const ok = await this.confirm(
      'Cerrar partido',
      'Se cerrarán las sesiones activas de todos los cobradores. ¿Confirmás?',
      'Cerrar partido',
      'btn-amber'
    );
    if (!ok) return;
    try {
      await DB.cerrarEvento(id);
      this.toast('Partido cerrado correctamente');
      this.detenerPolling();
      if (enDetalle) this.verDetalle(id);
      else           this.cargarEventos();
    } catch (e) { this.toast(this.safeError(e), 'error'); }
  },

  // ── Eliminar evento ───────────────────────────────────────
  async eliminarEvento(id, enDetalle = false) {
    const ok = await this.confirm(
      'Eliminar partido',
      'Se eliminará el partido y todos sus datos. Esta acción no se puede deshacer.',
      'Eliminar',
      'btn-danger'
    );
    if (!ok) return;
    try {
      await DB.eliminarEvento(id);
      this.toast('Partido eliminado');
      this.detenerPolling();
      this.showScreen('screen-dashboard');
    } catch (e) { this.toast(this.safeError(e), 'error'); }
  },

  // ── Borrar último ticket ──────────────────────────────────
  async borrarUltimoTicket(id) {
    const ok = await this.confirm(
      'Borrar último ticket',
      'Se eliminará el ticket más reciente. Queda registrado en el log de auditoría.',
      'Borrar ticket',
      'btn-danger'
    );
    if (!ok) return;
    try {
      await DB.borrarUltimoTicket(id);
      this.toast('Último ticket eliminado');
      this.verDetalle(id);
    } catch (e) { this.toast(this.safeError(e), 'error'); }
  },

  // ── Copiar resumen ────────────────────────────────────────
  async copiarResumen() {
    const texto = document.getElementById('texto-resumen-admin')?.value || '';
    try {
      await navigator.clipboard.writeText(texto);
      this.toast('Resumen copiado');
    } catch {
      document.getElementById('texto-resumen-admin')?.select();
      this.toast('Seleccioná y copiá manualmente', 'warn');
    }
  },

  // ── Texto resumen admin (simplificado) ───────────────────
  _generarTextoResumen(evento, sesiones, tickets, ef, tr, li, tot) {
    const lineas = [
      'RESUMEN DE ESTACIONAMIENTO',
      '',
      `Partido: Universitario vs ${evento.visitante}`,
      `Categoría: ${this.catLabel(evento.categoria)}`,
      `Fecha: ${this.fmtFecha(evento.fecha)}`,
      `Precio: $${Number(evento.precio_entrada).toLocaleString('es-AR')}`,
      evento.alias ? `Alias: ${evento.alias}` : null,
      '',
      'TOTALES',
      `Total recaudado: $${tot.toLocaleString('es-AR')}`,
      `Efectivo: ${ef.length} - $${ef.reduce((s,t)=>s+(t.monto||0),0).toLocaleString('es-AR')}`,
      `Transferencia: ${tr.length} - $${tr.reduce((s,t)=>s+(t.monto||0),0).toLocaleString('es-AR')}`,
      `Pases libres: ${li.length}`,
    ];

    if (sesiones.length) {
      lineas.push('', 'RECAUDADO POR COBRADOR');
      sesiones.forEach(s => {
        const st  = tickets.filter(t => t.sesion_id === s.id);
        const sef = st.filter(t => t.metodo_pago === 'efectivo');
        const str = st.filter(t => t.metodo_pago === 'transferencia');
        const sli = st.filter(t => t.metodo_pago === 'libre');
        const stot = sef.reduce((a,t)=>a+(t.monto||0),0) + str.reduce((a,t)=>a+(t.monto||0),0);
        lineas.push(
          '',
          `${s.nombre} ${s.apellido}`,
          `  Efectivo: ${sef.length} - $${sef.reduce((a,t)=>a+(t.monto||0),0).toLocaleString('es-AR')}`,
          `  Transferencia: ${str.length} - $${str.reduce((a,t)=>a+(t.monto||0),0).toLocaleString('es-AR')}`,
          `  Libres: ${sli.length}`,
          `  Total: $${stot.toLocaleString('es-AR')}`,
        );
      });
    }

    return lineas.filter(l => l !== null).join('\n');
  },

  // ── Exportar Excel ────────────────────────────────────────
  _xlsxStyles() {
    const border = { style: 'thin', color: { rgb: 'E5E7EB' } };
    const allBorders = { top: border, right: border, bottom: border, left: border };
    const font = { name: 'Arial', sz: 11 };
    return {
      title: {
        font: { name: 'Arial', sz: 14, bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: 'B91C1C' } },
        alignment: { horizontal: 'center', vertical: 'center' },
      },
      label: {
        font: { ...font, bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: 'B91C1C' } },
        alignment: { vertical: 'center' },
        border: allBorders,
      },
      header: {
        font: { ...font, bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: 'B91C1C' } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: allBorders,
      },
      cell: {
        font,
        fill: { fgColor: { rgb: 'FFFFFF' } },
        alignment: { vertical: 'center', wrapText: true },
        border: allBorders,
      },
      centered: {
        font,
        fill: { fgColor: { rgb: 'FFFFFF' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: allBorders,
      },
      money: {
        font,
        fill: { fgColor: { rgb: 'FFFFFF' } },
        alignment: { vertical: 'center' },
        border: allBorders,
        numFmt: '$ #,##0',
      },
      count: {
        font,
        fill: { fgColor: { rgb: 'FFFFFF' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: allBorders,
        numFmt: '0',
      },
      totalLabel: {
        font: { ...font, bold: true, color: { rgb: 'B91C1C' } },
        fill: { fgColor: { rgb: 'FFFFFF' } },
        alignment: { vertical: 'center' },
        border: allBorders,
      },
      totalMoney: {
        font: { ...font, bold: true, color: { rgb: 'B91C1C' } },
        fill: { fgColor: { rgb: 'FFFFFF' } },
        alignment: { vertical: 'center' },
        border: allBorders,
        numFmt: '$ #,##0',
      },
      note: {
        font: { ...font, italic: true, color: { rgb: '6B7280' } },
        fill: { fgColor: { rgb: 'F9FAFB' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: allBorders,
      },
    };
  },

  _xlsxSafeSheetName(nombre) {
    return String(nombre || 'Hoja')
      .replace(/[\\/*?:[\]]/g, '')
      .slice(0, 31) || 'Hoja';
  },

  _xlsxQuoteSheetName(nombre) {
    return `'${String(nombre).replace(/'/g, "''")}'`;
  },

  _xlsxMetodo(metodo) {
    if (metodo === 'efectivo') return 'Efectivo';
    if (metodo === 'transferencia') return 'Transferencia';
    if (metodo === 'libre') return 'Pase libre';
    return metodo || '';
  },

  _xlsxTicketOrden(t) {
    const n = parseInt(String(t.numero_ticket || '').replace(/\D/g, ''), 10);
    return Number.isNaN(n) ? Number.MAX_SAFE_INTEGER : n;
  },

  _xlsxCell(v, s, t) {
    const cell = { v: v ?? '', s };
    if (t) cell.t = t;
    else if (typeof v === 'number') cell.t = 'n';
    else cell.t = 's';
    return cell;
  },

  _xlsxFormula(f, v, s) {
    return { f, v: v ?? 0, t: 'n', s };
  },

  _xlsxSheetResumen(evento, ticketsSheetName, totales) {
    const st = this._xlsxStyles();
    const q = this._xlsxQuoteSheetName(ticketsSheetName);
    const hora = evento.hora ? `${evento.hora.slice(0, 5)} hs` : '';
    const rows = [
      [this._xlsxCell('ESTACIONAMIENTO CUC - RESUMEN GENERAL', st.title), null, null, null, null, null],
      [],
      [this._xlsxCell('Partido', st.label), this._xlsxCell(`Universitario vs ${evento.visitante}`, st.cell)],
      [this._xlsxCell('Categoria', st.label), this._xlsxCell(this.catLabel(evento.categoria), st.cell)],
      [this._xlsxCell('Fecha', st.label), this._xlsxCell(this.fmtFecha(evento.fecha), st.cell)],
      [this._xlsxCell('Hora', st.label), this._xlsxCell(hora, st.cell)],
      [this._xlsxCell('Precio por auto', st.label), this._xlsxCell(evento.precio_entrada || 0, st.money)],
      [this._xlsxCell('Alias transferencia', st.label), this._xlsxCell(evento.alias || '', st.cell)],
      [],
      [
        this._xlsxCell('Concepto', st.header),
        this._xlsxCell('Cantidad', st.header),
        this._xlsxCell('Total $', st.header),
        this._xlsxCell('Observaciones', st.header),
      ],
      [
        this._xlsxCell('Efectivo', st.cell),
        this._xlsxFormula(`COUNTIFS(${q}!C:C,"Efectivo",${q}!G:G,"Activo")`, totales.cantidad_efectivo, st.count),
        this._xlsxFormula(`SUMIFS(${q}!D:D,${q}!C:C,"Efectivo",${q}!G:G,"Activo")`, totales.total_efectivo, st.money),
        this._xlsxCell('', st.cell),
      ],
      [
        this._xlsxCell('Transferencia', st.cell),
        this._xlsxFormula(`COUNTIFS(${q}!C:C,"Transferencia",${q}!G:G,"Activo")`, totales.cantidad_transferencia, st.count),
        this._xlsxFormula(`SUMIFS(${q}!D:D,${q}!C:C,"Transferencia",${q}!G:G,"Activo")`, totales.total_transferencia, st.money),
        this._xlsxCell('', st.cell),
      ],
      [
        this._xlsxCell('Pases libres', st.cell),
        this._xlsxFormula(`COUNTIFS(${q}!C:C,"Pase libre",${q}!G:G,"Activo")`, totales.cantidad_libres, st.count),
        this._xlsxFormula(`SUMIFS(${q}!D:D,${q}!C:C,"Pase libre",${q}!G:G,"Activo")`, 0, st.money),
        this._xlsxCell('', st.cell),
      ],
      [
        this._xlsxCell('Total tickets', st.cell),
        this._xlsxFormula('SUM(B11:B13)', totales.cantidad_total, st.count),
        this._xlsxCell('', st.money),
        this._xlsxCell('Efectivo + transferencia + pases libres', st.cell),
      ],
      [
        this._xlsxCell('Total recaudado', st.totalLabel),
        this._xlsxCell('', st.totalLabel),
        this._xlsxFormula('SUM(C11:C12)', totales.total_recaudado, st.totalMoney),
        this._xlsxCell('Solo efectivo + transferencia', st.totalLabel),
      ],
      [],
      [this._xlsxCell('Completar cada ingreso en la hoja Tickets. El resumen se actualiza automaticamente.', st.note), null, null, null, null, null],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
      { s: { r: 16, c: 0 }, e: { r: 16, c: 5 } },
    ];
    ws['!cols'] = [
      { wch: 17.22 }, { wch: 17.22 }, { wch: 17.22 },
      { wch: 28.89 }, { wch: 17.22 }, { wch: 17.22 },
    ];
    ws['!rows'] = [{ hpt: 25.5 }];
    ws['!view'] = { showGridLines: false };
    return ws;
  },

  _xlsxSheetTickets(nombreHoja, sesiones, tickets) {
    const st = this._xlsxStyles();
    const headers = ['N ticket', 'Hora', 'Metodo de pago', 'Monto', 'Cobrador', 'DNI cobrador', 'Estado', 'Persona libre', 'Patente', 'Motivo', 'Descripcion'];
    const rows = [
      [this._xlsxCell(nombreHoja === 'Tickets' ? 'TICKETS VENDIDOS' : nombreHoja.toUpperCase(), st.title), null, null, null, null, null, null, null, null, null, null],
      [],
      headers.map(h => this._xlsxCell(h, st.header)),
    ];
    [...tickets]
      .sort((a, b) => this._xlsxTicketOrden(a) - this._xlsxTicketOrden(b) || new Date(a.timestamp) - new Date(b.timestamp))
      .forEach(t => {
        const ses = sesiones.find(s => s.id === t.sesion_id);
        rows.push([
          this._xlsxCell(t.numero_ticket || '', st.centered),
          this._xlsxCell(this.fmtHora(t.timestamp), st.centered),
          this._xlsxCell(this._xlsxMetodo(t.metodo_pago), st.cell),
          this._xlsxCell(t.monto || 0, st.money),
          this._xlsxCell(ses ? `${ses.nombre} ${ses.apellido}` : '', st.cell),
          this._xlsxCell(ses?.dni || '', st.cell),
          this._xlsxCell(t.eliminado ? 'Eliminado' : 'Activo', st.cell),
          this._xlsxCell(t.libre_nombre || '', st.cell),
          this._xlsxCell(t.libre_patente || '', st.cell),
          this._xlsxCell(t.metodo_pago === 'libre' ? this.motivoLabel(t.libre_motivo) : '', st.cell),
          this._xlsxCell(t.libre_descripcion || '', st.cell),
        ]);
      });

    const minRows = Math.max(rows.length, 60);
    while (rows.length < minRows) {
      rows.push([
        this._xlsxCell('', st.centered), this._xlsxCell('', st.centered),
        this._xlsxCell('', st.cell), this._xlsxCell('', st.money),
        this._xlsxCell('', st.cell), this._xlsxCell('', st.cell),
        this._xlsxCell('', st.cell), this._xlsxCell('', st.cell),
        this._xlsxCell('', st.cell), this._xlsxCell('', st.cell),
        this._xlsxCell('', st.cell),
      ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 10 } }];
    ws['!cols'] = [
      { wch: 10 }, { wch: 9.44 }, { wch: 16.11 }, { wch: 11.67 },
      { wch: 18.89 }, { wch: 12.78 }, { wch: 10.56 }, { wch: 18.89 },
      { wch: 11.67 }, { wch: 16.11 }, { wch: 24.44 },
    ];
    ws['!rows'] = [{ hpt: 25.5 }];
    ws['!view'] = { showGridLines: false };
    return ws;
  },

  _xlsxDescargar(wb, nombreArchivo) {
    if (typeof XLSX === 'undefined') throw new Error('No se pudo cargar el generador de Excel.');
    XLSX.writeFile(wb, nombreArchivo, { bookType: 'xlsx', cellStyles: true });
  },

  async exportarExcel(eventoId) {
    try {
      if (typeof XLSX === 'undefined') throw new Error('No se pudo cargar el generador de Excel.');
      const { evento, sesiones, tickets } = await DB.detalleEvento(eventoId);
      const wb = XLSX.utils.book_new();
      const totales = evento.resumen;
      XLSX.utils.book_append_sheet(wb, this._xlsxSheetResumen(evento, 'Tickets', totales), 'Resumen general');
      XLSX.utils.book_append_sheet(wb, this._xlsxSheetTickets('Tickets', sesiones, tickets), 'Tickets');
      const visitante = evento.visitante.replace(/[^\w\d]+/g, '_').replace(/^_+|_+$/g, '');
      this._xlsxDescargar(wb, `CUC_Estacionamiento_${visitante}_${evento.fecha}.xlsx`);
      this.toast('Excel generado');
    } catch (e) { this.toast(this.safeError(e), 'error'); }
  },

  // ── ESTADÍSTICAS ──────────────────────────────────────────
  async renderStats() {
    const contenido = document.getElementById('stats-contenido');
    const stats = await DB.estadisticasGlobales();

    if (!stats || !stats.total_eventos) {
      contenido.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📊</div>
          <div class="empty-title">Sin datos aún</div>
          <div class="empty-text">Las estadísticas aparecen después del primer partido.</div>
        </div>`;
      return;
    }

    const { total_eventos, eventos_cerrados, total_recaudado, promedio, maximo, minimo, items } = stats;

    contenido.innerHTML = `
      <div class="res-cards" style="margin-bottom:1rem;">
        <div class="res-card res-card-destac">
          <div class="res-label">Total histórico recaudado</div>
          <div class="res-valor grande">$${Number(total_recaudado).toLocaleString('es-AR')}</div>
        </div>
        <div class="res-card">
          <div class="res-label">Partidos</div>
          <div class="res-valor">${total_eventos}</div>
          <div class="res-sub">${eventos_cerrados} cerrado${eventos_cerrados !== 1 ? 's' : ''}</div>
        </div>
        <div class="res-card">
          <div class="res-label">Promedio por partido</div>
          <div class="res-valor">$${Number(promedio).toLocaleString('es-AR')}</div>
          <div class="res-sub">solo cerrados</div>
        </div>
      </div>

      ${maximo ? `
        <div class="card" style="margin-bottom:.75rem;border-left:4px solid var(--verde);">
          <div class="sec-title" style="color:var(--verde);">Partido más rentable</div>
          <div style="font-weight:800;margin-top:.3rem;">vs ${this.esc(maximo.evento.visitante)}</div>
          <div style="font-size:.8rem;color:var(--text2);">${this.catLabel(maximo.evento.categoria)} · ${this.fmtFecha(maximo.evento.fecha)}</div>
          <div style="font-size:1.2rem;font-weight:900;color:var(--verde);margin-top:.3rem;">$${Number(maximo.total_recaudado).toLocaleString('es-AR')}</div>
        </div>` : ''}

      ${minimo && minimo.evento.id !== maximo?.evento.id ? `
        <div class="card" style="margin-bottom:.75rem;border-left:4px solid var(--border);">
          <div class="sec-title">Partido menos rentable</div>
          <div style="font-weight:800;margin-top:.3rem;">vs ${this.esc(minimo.evento.visitante)}</div>
          <div style="font-size:.8rem;color:var(--text2);">${this.catLabel(minimo.evento.categoria)} · ${this.fmtFecha(minimo.evento.fecha)}</div>
          <div style="font-size:1.2rem;font-weight:900;margin-top:.3rem;">$${Number(minimo.total_recaudado).toLocaleString('es-AR')}</div>
        </div>` : ''}

      <div class="sec-title" style="margin-top:.5rem;">Todos los partidos</div>
      <div class="tabla-wrap" style="margin-top:.5rem;">
        <table>
          <thead><tr><th>Partido</th><th>Fecha</th><th>Estado</th><th>Tickets</th><th>Recaudado</th></tr></thead>
          <tbody id="stats-tbody"></tbody>
        </table>
      </div>`;

    // Filas con click para ir al detalle
    const tbody = document.getElementById('stats-tbody');
    items.forEach(i => {
      const fila = document.createElement('tr');
      fila.style.cursor = 'pointer';
      fila.title = 'Ver detalle';
      fila.innerHTML = `
        <td>
          <strong>vs ${this.esc(i.evento.visitante)}</strong>
          <span class="td-sub">${this.catLabel(i.evento.categoria)}</span>
        </td>
        <td>${this.fmtFecha(i.evento.fecha)}</td>
        <td><span class="badge ${i.evento.estado === 'activo' ? 'badge-activo' : 'badge-cerrado'}">${i.evento.estado === 'activo' ? 'Activo' : 'Cerrado'}</span></td>
        <td>${i.cantidad_total}</td>
        <td><strong>$${Number(i.total_recaudado).toLocaleString('es-AR')}</strong></td>`;
      fila.addEventListener('click', () => this.verDetalle(i.evento.id));
      tbody.appendChild(fila);
    });
  },

  // ── AUDITORÍA ─────────────────────────────────────────────
  async renderAuditoria() {
    const contenido = document.getElementById('auditoria-contenido');
    const eventos   = await DB.todosEventos();

    // Aplicar filtros. "Hasta" es opcional: si queda vacío, no limita el rango superior.
    const fechaDesde = this.audit.fechaDesde || null;
    const fechaHasta = this.audit.fechaHasta || null;
    const filtrados = eventos.filter(e => {
      const okFecha1 = !fechaDesde || e.fecha >= fechaDesde;
      const okFecha2 = !fechaHasta || e.fecha <= fechaHasta;
      const okCat    = this.audit.categoria === 'todas' || e.categoria === this.audit.categoria;
      const okVis    = !this.audit.visitante || e.visitante === this.audit.visitante;
      return okFecha1 && okFecha2 && okCat && okVis;
    });

    // Resumen de seleccionados
    const seleccionados = filtrados.filter(e => this.audit.seleccionados.includes(e.id));
    let resumenSel = null;
    if (seleccionados.length) {
      let totRec = 0, totEf = 0, cntEf = 0, totTr = 0, cntTr = 0, cntLi = 0;
      seleccionados.forEach(e => {
        const r = e.resumen || {};
        totRec += r.total_recaudado      || 0;
        totEf  += r.total_efectivo       || 0; cntEf += r.cantidad_efectivo      || 0;
        totTr  += r.total_transferencia  || 0; cntTr += r.cantidad_transferencia || 0;
        cntLi  += r.cantidad_libres      || 0;
      });
      resumenSel = { totRec, totEf, cntEf, totTr, cntTr, cntLi };
    }

    contenido.innerHTML = `
      <!-- Filtros -->
      <div class="form-card" style="margin-bottom:.9rem;">
        <div class="sec-title" style="margin-bottom:.75rem;">Filtros</div>
        <div class="grid-2" style="margin-bottom:.75rem;">
          <div class="campo" style="margin-bottom:0;">
            <label>Desde</label>
            <input type="date" id="audit-desde" value="${this.audit.fechaDesde}">
          </div>
          <div class="campo" style="margin-bottom:0;">
            <label>Hasta <span style="font-weight:600;color:var(--text3);">(opcional)</span></label>
            <input type="date" id="audit-hasta" value="${this.audit.fechaHasta}">
          </div>
        </div>
        <div class="grid-2">
          <div class="campo" style="margin-bottom:0;">
            <label>Categoría</label>
            <select id="audit-cat">
              <option value="todas" ${this.audit.categoria==='todas'?'selected':''}>Todas</option>
              <option value="infantiles"       ${this.audit.categoria==='infantiles'?'selected':''}>Infantiles</option>
              <option value="juveniles"        ${this.audit.categoria==='juveniles'?'selected':''}>Juveniles</option>
              <option value="plantel_superior" ${this.audit.categoria==='plantel_superior'?'selected':''}>Plantel Superior</option>
              <option value="femenino"         ${this.audit.categoria==='femenino'?'selected':''}>Femenino</option>
            </select>
          </div>
          <div class="campo" style="margin-bottom:0;">
            <label>Visitante</label>
            <select id="audit-vis">
              <option value="">Todos</option>
              ${DB.VISITANTES.map(v => `<option value="${v}" ${this.audit.visitante===v?'selected':''}>${v}</option>`).join('')}
            </select>
          </div>
        </div>
        <div style="display:flex;gap:.5rem;margin-top:.75rem;">
          <button class="btn btn-verde btn-md" id="btn-audit-filtrar" style="flex:1;">Aplicar filtros</button>
          <button class="btn btn-outline btn-md" id="btn-audit-limpiar">Limpiar</button>
        </div>
      </div>

      <!-- Lista de partidos filtrados -->
      <div class="card" style="margin-bottom:.9rem;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem;">
          <div class="sec-title" style="margin-bottom:0;">${filtrados.length} partido${filtrados.length !== 1 ? 's' : ''}</div>
          <div style="display:flex;gap:.5rem;">
            <button class="btn btn-outline btn-sm" id="btn-audit-sel-todos">Seleccionar todos</button>
            <button class="btn btn-outline btn-sm" id="btn-audit-limpiar-sel">Limpiar</button>
          </div>
        </div>

        ${filtrados.length === 0
          ? '<p style="font-size:.83rem;color:var(--text3);">No hay partidos con esos filtros.</p>'
          : filtrados.map(e => {
              const r = e.resumen || {};
              const sel = this.audit.seleccionados.includes(e.id);
              return `
                <label class="audit-evento-row ${sel ? 'audit-sel' : ''}">
                  <input type="checkbox" class="audit-check" data-id="${e.id}" ${sel ? 'checked' : ''} style="width:18px;height:18px;flex-shrink:0;">
                  <div style="flex:1;min-width:0;">
                    <div style="font-weight:800;font-size:.9rem;">vs ${this.esc(e.visitante)}</div>
                    <div style="font-size:.75rem;color:var(--text2);">${this.catLabel(e.categoria)} · ${this.fmtFecha(e.fecha)}</div>
                    <div style="font-size:.78rem;color:var(--verde);font-weight:700;">$${Number(r.total_recaudado).toLocaleString('es-AR')}</div>
                  </div>
                </label>`;
            }).join('')
        }
      </div>

      <!-- Resumen de seleccionados -->
      ${resumenSel ? `
        <div style="margin-bottom:.9rem;">
          <div class="sec-title" style="margin-bottom:.5rem;">${seleccionados.length} partido${seleccionados.length!==1?'s':''} seleccionado${seleccionados.length!==1?'s':''}</div>
          <div class="res-cards">
            <div class="res-card res-card-destac">
              <div class="res-label">Total recaudado</div>
              <div class="res-valor grande">$${Number(resumenSel.totRec).toLocaleString('es-AR')}</div>
            </div>
            <div class="res-card">
              <div class="res-label">Efectivo</div>
              <div class="res-valor" style="font-size:1.1rem;">$${Number(resumenSel.totEf).toLocaleString('es-AR')}</div>
              <div class="res-sub">${resumenSel.cntEf} tickets</div>
            </div>
            <div class="res-card">
              <div class="res-label">Transferencia</div>
              <div class="res-valor" style="font-size:1.1rem;">$${Number(resumenSel.totTr).toLocaleString('es-AR')}</div>
              <div class="res-sub">${resumenSel.cntTr} tickets</div>
            </div>
            <div class="res-card">
              <div class="res-label">Pases libres</div>
              <div class="res-valor">${resumenSel.cntLi}</div>
            </div>
          </div>
        </div>` : ''}

      <!-- Exportar -->
      <button class="btn btn-verde btn-lg btn-full" id="btn-audit-exportar"
        ${seleccionados.length === 0 ? 'disabled style="opacity:.4;"' : ''}>
        Exportar Excel${seleccionados.length ? ` (${seleccionados.length})` : ''}
      </button>`;

    // Bind filtros
    document.getElementById('btn-audit-filtrar')?.addEventListener('click', () => {
      this.audit.fechaDesde = document.getElementById('audit-desde').value;
      this.audit.fechaHasta = document.getElementById('audit-hasta').value;
      this.audit.categoria  = document.getElementById('audit-cat').value;
      this.audit.visitante  = document.getElementById('audit-vis').value;
      this.renderAuditoria();
    });
    document.getElementById('btn-audit-limpiar')?.addEventListener('click', () => {
      this.audit = { fechaDesde:'', fechaHasta:'', categoria:'todas', visitante:'', seleccionados:[] };
      this.renderAuditoria();
    });
    document.getElementById('btn-audit-sel-todos')?.addEventListener('click', () => {
      this.audit.seleccionados = filtrados.map(e => e.id);
      this.renderAuditoria();
    });
    document.getElementById('btn-audit-limpiar-sel')?.addEventListener('click', () => {
      this.audit.seleccionados = [];
      this.renderAuditoria();
    });

    // Checkboxes
    document.querySelectorAll('.audit-check').forEach(cb => {
      cb.addEventListener('change', () => {
        const id = cb.dataset.id;
        if (cb.checked) {
          if (!this.audit.seleccionados.includes(id)) this.audit.seleccionados.push(id);
        } else {
          this.audit.seleccionados = this.audit.seleccionados.filter(x => x !== id);
        }
        this.renderAuditoria();
      });
    });

    // Exportar Excel de seleccionados
    document.getElementById('btn-audit-exportar')?.addEventListener('click', () => {
      if (!seleccionados.length) return;
      this._exportarAuditoria(seleccionados);
    });
  },

  async _exportarAuditoria(eventos) {
    try {
      if (typeof XLSX === 'undefined') throw new Error('No se pudo cargar el generador de Excel.');
      const st = this._xlsxStyles();
      const wb = XLSX.utils.book_new();
      const totalGeneral = eventos.reduce((acc, e) => {
        const r = e.resumen || {};
        acc.total_recaudado        += r.total_recaudado        || 0;
        acc.total_efectivo         += r.total_efectivo         || 0;
        acc.total_transferencia    += r.total_transferencia    || 0;
        acc.cantidad_efectivo      += r.cantidad_efectivo      || 0;
        acc.cantidad_transferencia += r.cantidad_transferencia || 0;
        acc.cantidad_libres        += r.cantidad_libres        || 0;
        acc.cantidad_total         += r.cantidad_total         || 0;
        return acc;
      }, {
        total_recaudado: 0, total_efectivo: 0, total_transferencia: 0,
        cantidad_efectivo: 0, cantidad_transferencia: 0, cantidad_libres: 0, cantidad_total: 0,
      });

      const resumenRows = [
        [this._xlsxCell('ESTACIONAMIENTO CUC - RESUMEN GENERAL', st.title), null, null, null, null, null, null, null, null, null],
        [],
        [
          this._xlsxCell('Partido', st.header),
          this._xlsxCell('Categoria', st.header),
          this._xlsxCell('Fecha', st.header),
          this._xlsxCell('Precio', st.header),
          this._xlsxCell('Total $', st.header),
          this._xlsxCell('Ef. cant.', st.header),
          this._xlsxCell('Ef. $', st.header),
          this._xlsxCell('Tr. cant.', st.header),
          this._xlsxCell('Tr. $', st.header),
          this._xlsxCell('Libres', st.header),
        ],
        ...eventos.map(e => {
          const r = e.resumen || {};
          return [
            this._xlsxCell(`Universitario vs ${e.visitante}`, st.cell),
            this._xlsxCell(this.catLabel(e.categoria), st.cell),
            this._xlsxCell(this.fmtFecha(e.fecha), st.centered),
            this._xlsxCell(e.precio_entrada || 0, st.money),
            this._xlsxCell(r.total_recaudado        || 0, st.money),
            this._xlsxCell(r.cantidad_efectivo      || 0, st.count),
            this._xlsxCell(r.total_efectivo         || 0, st.money),
            this._xlsxCell(r.cantidad_transferencia || 0, st.count),
            this._xlsxCell(r.total_transferencia    || 0, st.money),
            this._xlsxCell(r.cantidad_libres        || 0, st.count),
          ];
        }),
        [],
        [
          this._xlsxCell('Totales seleccionados', st.totalLabel),
          this._xlsxCell('', st.totalLabel),
          this._xlsxCell('', st.totalLabel),
          this._xlsxCell('', st.totalLabel),
          this._xlsxCell(totalGeneral.total_recaudado, st.totalMoney),
          this._xlsxCell(totalGeneral.cantidad_efectivo, st.count),
          this._xlsxCell(totalGeneral.total_efectivo, st.totalMoney),
          this._xlsxCell(totalGeneral.cantidad_transferencia, st.count),
          this._xlsxCell(totalGeneral.total_transferencia, st.totalMoney),
          this._xlsxCell(totalGeneral.cantidad_libres, st.count),
        ],
      ];
      const resumenWs = XLSX.utils.aoa_to_sheet(resumenRows);
      resumenWs['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 9 } }];
      resumenWs['!cols'] = [
        { wch: 28 }, { wch: 17 }, { wch: 12 }, { wch: 12 }, { wch: 14 },
        { wch: 10 }, { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 10 },
      ];
      resumenWs['!rows'] = [{ hpt: 25.5 }];
      resumenWs['!view'] = { showGridLines: false };
      XLSX.utils.book_append_sheet(wb, resumenWs, 'Resumen');

      for (const e of eventos) {
        const { sesiones, tickets } = await DB.detalleEvento(e.id);
        const nombre = this._xlsxSafeSheetName(`vs ${e.visitante} ${e.fecha}`);
        XLSX.utils.book_append_sheet(wb, this._xlsxSheetTickets(nombre, sesiones, tickets), nombre);
      }

      this._xlsxDescargar(wb, `CUC_Auditoria_${new Date().toISOString().slice(0,10)}.xlsx`);
      this.toast('Reporte exportado correctamente');
    } catch (e) { this.toast(this.safeError(e), 'error'); }
  },

  // ── Polling ───────────────────────────────────────────────
  iniciarPolling(id) {
    this.detenerPolling();
    this.pollingTimer = setInterval(async () => {
      if (!document.getElementById('screen-detalle')?.classList.contains('active')) return;
      try { this.renderDetalle(await DB.detalleEvento(id)); } catch { /* silencioso */ }
    }, 5000);
  },

  detenerPolling() {
    if (this.pollingTimer) { clearInterval(this.pollingTimer); this.pollingTimer = null; }
  },

  // ── Init ──────────────────────────────────────────────────
  init() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
    document.getElementById('btn-login').addEventListener('click', () => this.login());
    document.getElementById('login-pass').addEventListener('keydown', e => {
      if (e.key === 'Enter') this.login();
    });
    document.getElementById('login-user').addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('login-pass')?.focus();
    });
    document.getElementById('btn-logout').addEventListener('click', () => this.logout());

    // Nav inferior
    document.addEventListener('click', e => {
      const btn = e.target.closest('[data-screen]');
      if (!btn || !this.admin) return;
      const screen = btn.dataset.screen;
      if (screen === 'screen-detalle') return;
      if (screen === 'screen-crear') this._resetFormCrear();
      this.detenerPolling();
      this.showScreen(screen);
    });

    document.getElementById('btn-back-crear').addEventListener('click', () =>
      this.showScreen('screen-dashboard'));
    document.getElementById('btn-crear-evento').addEventListener('click', () => this.crearEvento());

    document.getElementById('ev-visitante').addEventListener('change', function() {
      document.getElementById('visitante-otro-wrap').style.display =
        this.value === '__otro__' ? 'block' : 'none';
    });

    document.getElementById('btn-back-detalle').addEventListener('click', () => {
      this.detenerPolling();
      this.showScreen('screen-dashboard');
    });

    document.querySelectorAll('#detalle-tabs .tab').forEach(tab => {
      tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
    });

    setTimeout(() => document.getElementById('login-user')?.focus(), 150);
  },

  _resetFormCrear() {
    document.getElementById('crear-alerta').innerHTML = '';
    document.getElementById('ev-visitante').value = '';
    document.getElementById('ev-visitante-otro').value = '';
    document.getElementById('visitante-otro-wrap').style.display = 'none';
    document.getElementById('ev-categoria').value = '';
    document.getElementById('ev-fecha').valueAsDate = new Date();
    document.getElementById('ev-hora').value = '';
    document.getElementById('ev-precio').value = '';
    document.getElementById('ev-alias').value = '';
    document.querySelectorAll('#screen-crear .campo-error').forEach(e => e.classList.remove('visible'));
  },
};

document.addEventListener('DOMContentLoaded', () => Admin.init());
