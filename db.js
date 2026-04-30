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

  crearEvento({ equipoLocal, equipoVisitante, fecha, categoria, monto, alias }) {
    const eventos = this.getEventos();
    const id = Date.now().toString();
    const nombre = `${equipoLocal} vs ${equipoVisitante}`;
    const nuevo = {
      id, nombre, equipoLocal, equipoVisitante, fecha, categoria,
      monto: parseFloat(monto),
      alias: alias || '',
      cobradores: [],
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

  _normalizarCobrador(nombre, documento) {
    return {
      nombre: String(nombre || '').trim(),
      documento: String(documento || '').trim()
    };
  },

  _mismoCobrador(ticket, nombre, documento) {
    const cob = this._normalizarCobrador(nombre, documento);
    const docTicket = String(ticket.cobradorDocumento || '').trim();
    if (cob.documento && docTicket) return docTicket === cob.documento;
    return String(ticket.cobradorNombre || '').trim().toLowerCase() === cob.nombre.toLowerCase();
  },

  getTicketsCobrador(eventoId, nombre, documento) {
    return this.getTickets(eventoId).filter(t => this._mismoCobrador(t, nombre, documento));
  },

  getUltimoTicket(eventoId) {
    const tickets = this.getTickets(eventoId);
    if (!tickets.length) return null;
    return tickets.sort((a, b) => b.creadoEn.localeCompare(a.creadoEn))[0];
  },

  getUltimoTicketCobrador(eventoId, nombre, documento) {
    const tickets = this.getTicketsCobrador(eventoId, nombre, documento);
    if (!tickets.length) return null;
    return tickets.sort((a, b) => b.creadoEn.localeCompare(a.creadoEn))[0];
  },

  iniciarCobranza(eventoId, cobradorNombre, cobradorDocumento) {
    const evento = this.getEventoById(eventoId);
    if (!evento || evento.estado !== 'ACTIVO') return null;
    const cob = this._normalizarCobrador(cobradorNombre, cobradorDocumento);
    const sesiones = this._get('cobranzas');
    const abierta = sesiones.find(s =>
      s.eventoId === eventoId &&
      !s.finalizadoEn &&
      String(s.cobradorDocumento || '').trim() === cob.documento
    );
    if (abierta) return abierta;

    const nueva = {
      id: Date.now().toString(),
      eventoId,
      cobradorNombre: cob.nombre,
      cobradorDocumento: cob.documento,
      iniciadoEn: new Date().toISOString(),
      finalizadoEn: null
    };
    sesiones.push(nueva);
    this._set('cobranzas', sesiones);
    return nueva;
  },

  getSesionCobranza(eventoId, cobradorNombre, cobradorDocumento) {
    const cob = this._normalizarCobrador(cobradorNombre, cobradorDocumento);
    return this._get('cobranzas')
      .filter(s =>
        s.eventoId === eventoId &&
        String(s.cobradorDocumento || '').trim() === cob.documento &&
        String(s.cobradorNombre || '').trim().toLowerCase() === cob.nombre.toLowerCase()
      )
      .sort((a, b) => String(b.iniciadoEn || '').localeCompare(String(a.iniciadoEn || '')))[0] || null;
  },

  finalizarCobranza(eventoId, cobradorNombre, cobradorDocumento) {
    const cob = this._normalizarCobrador(cobradorNombre, cobradorDocumento);
    const sesiones = this._get('cobranzas');
    const idx = sesiones.findIndex(s =>
      s.eventoId === eventoId &&
      !s.finalizadoEn &&
      String(s.cobradorDocumento || '').trim() === cob.documento
    );
    if (idx === -1) return null;
    sesiones[idx].finalizadoEn = new Date().toISOString();
    this._set('cobranzas', sesiones);
    return sesiones[idx];
  },

  registrarTicket({ eventoId, numeroTicket, metodoPago, patente, nombreGratis, razonGratis, cobradorNombre, cobradorDocumento, sesionCobranzaId }) {
    // 1. verificar evento activo
    const evento = this.getEventoById(eventoId);
    if (!evento) return { ok: false, error: 'Evento no encontrado.' };
    if (evento.estado !== 'ACTIVO') return { ok: false, error: 'El evento ya fue finalizado. No se pueden registrar más tickets.' };

    // 2. verificar ticket único
    const tickets = this._get('tickets');
    const numIngresado = String(numeroTicket).trim();
    const existe = metodoPago !== 'GRATIS' && tickets.find(t => t.eventoId === eventoId && t.numeroTicket === numIngresado);
    if (existe) return { ok: false, error: `El ticket #${numeroTicket} ya existe en este evento.` };

    // 3. validar datos
    if (metodoPago !== 'GRATIS' && (!numeroTicket || !String(numeroTicket).trim())) return { ok: false, error: 'El número de ticket es obligatorio.' };
    if (!metodoPago) return { ok: false, error: 'Seleccioná un método de pago.' };
    if (metodoPago === 'GRATIS') {
      if (!patente?.trim()) return { ok: false, error: 'Ingresá la patente.' };
      if (!nombreGratis?.trim()) return { ok: false, error: 'Ingresá el nombre.' };
      if (!razonGratis?.trim()) return { ok: false, error: 'Ingresá la razón.' };
    }

    // Número de ticket: para GRATIS puede ser vacío y se muestra de forma legible.
    const numFinal = (metodoPago === 'GRATIS' && !String(numeroTicket).trim())
      ? 'Gratis'
      : numIngresado;

    // 4. insertar
    const nuevo = {
      id: Date.now().toString(),
      eventoId,
      numeroTicket: numFinal,
      metodoPago,
      cobradorNombre: cobradorNombre?.trim() || null,
      cobradorDocumento: cobradorDocumento?.trim() || null,
      sesionCobranzaId: sesionCobranzaId || null,
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
  getResumenCobrador(eventoId, cobradorNombre, cobradorDocumento) {
    const evento = this.getEventoById(eventoId);
    if (!evento) return null;
    const tickets = this.getTicketsCobrador(eventoId, cobradorNombre, cobradorDocumento);
    return this._armarResumenTickets(evento, tickets);
  },

  _armarResumenTickets(evento, tickets) {
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
      gratis: { cantidad: gratis.length, monto: 0, lista: gratis },
      totalTickets: tickets.length,
      tickets
    };
  },

  getResumen(eventoId) {
    const evento = this.getEventoById(eventoId);
    if (!evento) return null;
    const tickets = this.getTickets(eventoId);
    const resumen = this._armarResumenTickets(evento, tickets);
    const cobradores = this.getResumenCobradores(eventoId);

    return {
      ...resumen,
      cobradores
    };
  },

  getResumenCobradores(eventoId) {
    const evento = this.getEventoById(eventoId);
    if (!evento) return [];
    const tickets = this.getTickets(eventoId);
    const sesiones = this._get('cobranzas').filter(s => s.eventoId === eventoId);
    const grupos = new Map();
    const keyFor = (nombre, documento) => {
      const doc = String(documento || '').trim();
      if (doc) return `doc:${doc}`;
      return `nom:${String(nombre || '').trim().toLowerCase()}`;
    };

    sesiones.forEach(s => {
      const key = keyFor(s.cobradorNombre, s.cobradorDocumento);
      if (!grupos.has(key)) {
        grupos.set(key, {
          cobradorNombre: s.cobradorNombre || 'Sin nombre',
          cobradorDocumento: s.cobradorDocumento || '',
          sesiones: [],
          tickets: []
        });
      }
      grupos.get(key).sesiones.push(s);
    });

    tickets.forEach(t => {
      const key = keyFor(t.cobradorNombre, t.cobradorDocumento);
      if (!grupos.has(key)) {
        grupos.set(key, {
          cobradorNombre: t.cobradorNombre || 'Sin nombre',
          cobradorDocumento: t.cobradorDocumento || '',
          sesiones: [],
          tickets: []
        });
      }
      grupos.get(key).tickets.push(t);
    });

    return Array.from(grupos.values()).map(g => {
      const resumen = this._armarResumenTickets(evento, g.tickets);
      const finalizo = g.sesiones.length > 0 && g.sesiones.every(s => !!s.finalizadoEn);
      const tieneSesionAbierta = g.sesiones.some(s => !s.finalizadoEn);
      const ultimaSesion = [...g.sesiones].sort((a, b) => String(b.iniciadoEn || '').localeCompare(String(a.iniciadoEn || '')))[0] || null;
      return {
        ...g,
        ...resumen,
        finalizo,
        tieneSesionAbierta,
        estadoCobranza: finalizo ? 'FINALIZADA' : (tieneSesionAbierta ? 'PENDIENTE' : 'SIN CIERRE'),
        iniciadoEn: ultimaSesion?.iniciadoEn || null,
        finalizadoEn: ultimaSesion?.finalizadoEn || null
      };
    }).sort((a, b) => a.cobradorNombre.localeCompare(b.cobradorNombre, 'es'));
  },

  borrarEvento(id) {
    const eventos = this.getEventos().filter(e => e.id !== id);
    this._set('eventos', eventos);
    const tickets = this._get('tickets').filter(t => t.eventoId !== id);
    this._set('tickets', tickets);
    const cobranzas = this._get('cobranzas').filter(s => s.eventoId !== id);
    this._set('cobranzas', cobranzas);
  },
  getEventosCobrador() {
    return this.getEventosActivos();
  }
};
