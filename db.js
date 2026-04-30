// ============================================================
//  db.js — capa de datos (localStorage como "base de datos")
// ============================================================

const DB = {
  // ── admin por defecto ──────────────────────────────────────
  ADMIN: { username: 'Admin', password: 'Universitario1907' },

  // ── helpers clave ─────────────────────────────────────────
  _get(key) {
    try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; }
  },
  _set(key, val) { localStorage.setItem(key, JSON.stringify(val)); },

  // ── admins ────────────────────────────────────────────────
  loginAdmin(user, pass) {
    return user.toLowerCase() === this.ADMIN.username.toLowerCase() && pass.toLowerCase() === this.ADMIN.password.toLowerCase();
  },

  // ── eventos ───────────────────────────────────────────────
  getEventos() { return this._get('eventos'); },
  getEventosActivos() { return this.getEventos().filter(e => e.estado === 'ACTIVO'); },
  getEventoById(id) { return this.getEventos().find(e => e.id === id); },

  crearEvento({ nombre, fecha, categoria, monto, alias, cobradores }) {
    const eventos = this.getEventos();
    const id = Date.now().toString();
    const nuevo = {
      id, nombre, fecha, categoria,
      monto: parseFloat(monto),
      alias: alias || '',
      cobradores: cobradores.map(c => c.trim().toLowerCase()).filter(Boolean),
      estado: 'ACTIVO',
      creadoEn: new Date().toISOString()
    };
    eventos.push(nuevo);
    this._set('eventos', eventos);
    return nuevo;
  },

  finalizarEvento(id) {
    const eventos = this.getEventos();
    const idx = eventos.findIndex(e => e.id === id);
    if (idx === -1) return false;
    eventos[idx].estado = 'FINALIZADO';
    eventos[idx].finalizadoEn = new Date().toISOString();
    this._set('eventos', eventos);
    return true;
  },

  // ── tickets ───────────────────────────────────────────────
  getTickets(eventoId) {
    return this._get('tickets').filter(t => t.eventoId === eventoId);
  },

  getUltimoTicket(eventoId) {
    const tickets = this.getTickets(eventoId);
    if (!tickets.length) return null;
    return tickets.sort((a, b) => b.creadoEn.localeCompare(a.creadoEn))[0];
  },

  registrarTicket({ eventoId, numeroTicket, metodoPago, patente, nombreGratis, razonGratis }) {
    // 1. verificar evento activo
    const evento = this.getEventoById(eventoId);
    if (!evento) return { ok: false, error: 'Evento no encontrado.' };
    if (evento.estado !== 'ACTIVO') return { ok: false, error: 'El evento ya fue finalizado. No se pueden registrar más tickets.' };

    // 2. verificar ticket único
    const tickets = this._get('tickets');
    const existe = tickets.find(t => t.eventoId === eventoId && t.numeroTicket === String(numeroTicket).trim());
    if (existe) return { ok: false, error: `El ticket #${numeroTicket} ya existe en este evento.` };

    // 3. validar datos
    if (metodoPago !== 'GRATIS' && (!numeroTicket || !String(numeroTicket).trim())) return { ok: false, error: 'El número de ticket es obligatorio.' };
    if (!metodoPago) return { ok: false, error: 'Seleccioná un método de pago.' };
    if (metodoPago === 'GRATIS') {
      if (!patente?.trim()) return { ok: false, error: 'Ingresá la patente.' };
      if (!nombreGratis?.trim()) return { ok: false, error: 'Ingresá el nombre.' };
      if (!razonGratis?.trim()) return { ok: false, error: 'Ingresá la razón.' };
    }

    // Número de ticket: para GRATIS puede ser vacío (se guarda como 'G-timestamp')
    const numFinal = (metodoPago === 'GRATIS' && !String(numeroTicket).trim())
      ? 'G-' + Date.now()
      : String(numeroTicket).trim();

    // 4. insertar
    const nuevo = {
      id: Date.now().toString(),
      eventoId,
      numeroTicket: numFinal,
      metodoPago,
      patente: patente?.trim() || null,
      nombreGratis: nombreGratis?.trim() || null,
      razonGratis: razonGratis?.trim() || null,
      creadoEn: new Date().toISOString()
    };
    tickets.push(nuevo);
    this._set('tickets', tickets);
    return { ok: true, ticket: nuevo };
  },

  // ── resumen ───────────────────────────────────────────────
  getResumen(eventoId) {
    const evento = this.getEventoById(eventoId);
    if (!evento) return null;
    const tickets = this.getTickets(eventoId);

    const efectivo = tickets.filter(t => t.metodoPago === 'EFECTIVO');
    const transferencia = tickets.filter(t => t.metodoPago === 'TRANSFERENCIA');
    const gratis = tickets.filter(t => t.metodoPago === 'GRATIS');
    const totalPagados = efectivo.length + transferencia.length;
    const totalRecaudado = totalPagados * evento.monto;

    return {
      evento,
      totalRecaudado,
      efectivo: { cantidad: efectivo.length, monto: efectivo.length * evento.monto },
      transferencia: { cantidad: transferencia.length, monto: transferencia.length * evento.monto },
      gratis: { cantidad: gratis.length, lista: gratis },
      totalTickets: tickets.length,
      tickets
    };
  },

  // ── cobrador helper ───────────────────────────────────────
  getEventosCobrador(nombreCompleto) {
    const key = nombreCompleto.trim().toLowerCase();
    return this.getEventosActivos().filter(e => e.cobradores.includes(key));
  },

  validarCobrador(nombreCompleto) {
    return this.getEventosCobrador(nombreCompleto).length > 0;
  }
};
