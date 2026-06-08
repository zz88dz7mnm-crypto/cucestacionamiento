// ============================================================
//  db.js - Acceso seguro via Supabase RPC
//  Requiere ejecutar supabase_seguridad_cuc.sql antes de usarlo.
// ============================================================

const _supabase = supabase.createClient(
  'https://mxwecjqdauranxsbgcft.supabase.co',
  'sb_publishable_eP4-rzUCjd6Ligwm7HO4Mg_yfS-qaMN'
);

const DB = {
  _adminToken: null,
  _sessionTokens: {},
  _eventSessionTokens: {},

  VISITANTES: [
    'Alta Gracia Rugby',
    'Athletic',
    'Bajo Palermo',
    'Carlos Paz',
    'Cordoba Rugby',
    'Jockey',
    'Jockey Villa Maria',
    'San Martin Villa Maria',
    'Tablada',
    'Tala',
    'Uru Cure',
  ],

  CATEGORIAS: {
    infantiles:       'Infantiles',
    juveniles:        'Juveniles',
    plantel_superior: 'Plantel Superior',
    femenino:         'Femenino',
  },

  MOTIVOS_LIBRE: {
    presidente:         'Presidente',
    comision_directiva: 'Comision Directiva',
    proveedor:          'Proveedor',
    arbitro:            'Arbitro',
    jugador:            'Jugador',
    entrenador:         'Entrenador',
    otro:               'Otro',
  },

  _cleanText(value, max = 80) {
    return String(value ?? '')
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, max);
  },

  _cleanDigits(value, max = 10) {
    return String(value ?? '').replace(/\D/g, '').slice(0, max);
  },

  _assert(cond, msg) {
    if (!cond) throw new Error(msg);
  },

  _check(data, error) {
    if (error) throw new Error(error.message || 'Error de base de datos.');
    return data;
  },

  _requireAdmin() {
    this._assert(this._adminToken, 'No tenés permisos de administrador.');
    return this._adminToken;
  },

  _rememberSession(data, eventoId = null) {
    const sesion = data?.sesion;
    const token = data?.session_token;
    if (sesion?.id && token) {
      this._sessionTokens[sesion.id] = token;
      if (eventoId || sesion.evento_id) {
        this._eventSessionTokens[eventoId || sesion.evento_id] = {
          sesionId: sesion.id,
          token,
        };
      }
    }
    return data;
  },

  _tokenForSession(sesionId) {
    return this._sessionTokens[sesionId] || null;
  },

  _sessionForEvent(eventoId) {
    return this._eventSessionTokens[eventoId] || null;
  },

  async _rpc(fn, args = {}) {
    const { data, error } = await _supabase.rpc(fn, args);
    return this._check(data, error);
  },

  // ── Auth ──────────────────────────────────────────────────
  async loginAdmin(usuario, password) {
    const u = this._cleanText(usuario, 120).toLowerCase();
    const p = String(password || '').trim();
    this._assert(u && p, 'Completá usuario y contraseña.');

    const admin = await this._rpc('cuc_login_admin', {
      p_usuario: u,
      p_password: p,
    });

    this._adminToken = admin?.admin_token || null;
    this._assert(this._adminToken, 'No tenés permisos de administrador.');
    return {
      id: admin.id || 'admin',
      nombre: admin.nombre || 'Administrador',
      role: admin.role || 'admin',
    };
  },

  // ── Eventos ───────────────────────────────────────────────
  async eventosActivos() {
    return await this._rpc('cuc_eventos_activos');
  },

  async todosEventos() {
    return await this._rpc('cuc_todos_eventos', {
      p_admin_token: this._requireAdmin(),
    });
  },

  async crearEvento(payload) {
    const visitante = this._cleanText(payload?.visitante, 80);
    const categoria = this._cleanText(payload?.categoria, 40);
    const fecha     = this._cleanText(payload?.fecha, 20);
    const hora      = payload?.hora ? this._cleanText(payload.hora, 8) : null;
    const precio    = Number(payload?.precio_entrada);
    const alias     = this._cleanText(payload?.alias, 80);

    this._assert(visitante.length >= 2, 'Ingresá un visitante válido.');
    this._assert(Boolean(this.CATEGORIAS[categoria]), 'Seleccioná una categoría válida.');
    this._assert(/^\d{4}-\d{2}-\d{2}$/.test(fecha), 'Seleccioná una fecha válida.');
    this._assert(!hora || /^\d{2}:\d{2}$/.test(hora), 'Ingresá una hora válida.');
    this._assert(Number.isFinite(precio) && precio > 0, 'Ingresá un precio válido.');

    return await this._rpc('cuc_crear_evento', {
      p_admin_token: this._requireAdmin(),
      p_payload: { visitante, categoria, fecha, hora, precio_entrada: precio, alias },
    });
  },

  async cerrarEvento(id) {
    return await this._rpc('cuc_cerrar_evento', {
      p_admin_token: this._requireAdmin(),
      p_evento_id: id,
    });
  },

  async eliminarEvento(id) {
    return await this._rpc('cuc_eliminar_evento', {
      p_admin_token: this._requireAdmin(),
      p_evento_id: id,
    });
  },

  async detalleEvento(id) {
    return await this._rpc('cuc_detalle_evento', {
      p_admin_token: this._requireAdmin(),
      p_evento_id: id,
    });
  },

  async resumenEvento(id) {
    const detalle = await this.detalleEvento(id);
    return detalle?.evento?.resumen || {
      cantidad_total: 0,
      cantidad_efectivo: 0,
      cantidad_transferencia: 0,
      cantidad_libres: 0,
      total_efectivo: 0,
      total_transferencia: 0,
      total_recaudado: 0,
    };
  },

  async resumenSesion(id) {
    const token = this._tokenForSession(id);
    this._assert(token, 'La sesión no está habilitada.');
    const data = await this._rpc('cuc_resumen_sesion', {
      p_sesion_id: id,
      p_session_token: token,
    });
    this._rememberSession({
      sesion: data?.sesion,
      session_token: token,
    });
    return data;
  },

  // ── Sesiones ──────────────────────────────────────────────
  async crearSesion(eventoId, nombre, apellido, dni, accessCode) {
    const cleanNombre   = this._cleanText(nombre, 60);
    const cleanApellido = this._cleanText(apellido, 60);
    const cleanDni      = this._cleanDigits(dni, 10);
    const code          = this._cleanText(accessCode, 12).toUpperCase();

    this._assert(cleanNombre.length >= 2,  'Ingresá un nombre válido.');
    this._assert(cleanApellido.length >= 2,'Ingresá un apellido válido.');
    this._assert(/^\d{6,10}$/.test(cleanDni), 'Ingresá un DNI válido.');

    const data = await this._rpc('cuc_crear_sesion', {
      p_evento_id: eventoId,
      p_nombre: cleanNombre,
      p_apellido: cleanApellido,
      p_dni: cleanDni,
      p_access_code: code,
    });

    return this._rememberSession(data, eventoId);
  },

  // ── Tickets ───────────────────────────────────────────────
  async registrarTicket(payload) {
    const token = this._tokenForSession(payload?.sesion_id);
    this._assert(token && token === payload?.session_token, 'La sesión no está habilitada.');

    const metodo = this._cleanText(payload?.metodo_pago, 30);
    this._assert(['efectivo', 'transferencia', 'libre'].includes(metodo), 'Seleccioná un método de pago válido.');

    const numero = payload?.numero_ticket == null ? null : this._cleanDigits(payload.numero_ticket, 8);
    if (metodo !== 'libre') {
      this._assert(/^\d{1,8}$/.test(numero), 'Ingresá un número de ticket válido.');
    }

    return await this._rpc('cuc_registrar_ticket', {
      p_payload: {
        ...payload,
        session_token: token,
        metodo_pago: metodo,
        numero_ticket: metodo === 'libre' ? null : numero,
      },
    });
  },

  async cerrarSesion(sesionId, sessionToken) {
    const token = this._tokenForSession(sesionId);
    this._assert(token && token === sessionToken, 'La sesión no está habilitada.');
    return await this._rpc('cuc_cerrar_sesion', {
      p_sesion_id: sesionId,
      p_session_token: token,
    });
  },

  async borrarUltimoTicketSesion(sesionId, sessionToken) {
    const token = this._tokenForSession(sesionId);
    this._assert(token && token === sessionToken, 'La sesión no está habilitada.');
    return await this._rpc('cuc_borrar_ultimo_ticket_sesion', {
      p_sesion_id: sesionId,
      p_session_token: token,
    });
  },

  async borrarUltimoTicket(eventoId) {
    return await this._rpc('cuc_borrar_ultimo_ticket', {
      p_admin_token: this._requireAdmin(),
      p_evento_id: eventoId,
    });
  },

  async checkDuplicado(eventoId, numero) {
    const cleanNumero = this._cleanDigits(numero, 8);
    if (!cleanNumero) return null;

    const current = this._sessionForEvent(eventoId);
    this._assert(current?.sesionId && current?.token, 'La sesión no está habilitada.');

    return await this._rpc('cuc_check_duplicado', {
      p_evento_id: eventoId,
      p_numero: cleanNumero,
      p_sesion_id: current.sesionId,
      p_session_token: current.token,
    });
  },

  // ── Estadísticas ──────────────────────────────────────────
  async estadisticasGlobales() {
    const eventos = await this.todosEventos();
    if (!eventos.length) return null;
    const items    = eventos.map(e => ({ evento: e, ...e.resumen }));
    const cerrados = items.filter(i => i.evento.estado === 'cerrado');
    const totalCerrados = cerrados.reduce((s, i) => s + i.total_recaudado, 0);
    const totalGeneral  = items.reduce((s, i) => s + i.total_recaudado, 0);
    const ordenados = cerrados.slice().sort((a, b) => b.total_recaudado - a.total_recaudado);
    return {
      total_eventos:    eventos.length,
      eventos_cerrados: cerrados.length,
      total_recaudado:  totalGeneral,
      promedio:  cerrados.length ? Math.round(totalCerrados / cerrados.length) : 0,
      maximo:    ordenados[0] || null,
      minimo:    ordenados.length ? ordenados[ordenados.length - 1] : null,
      items,
    };
  },

  async getEvento(id) {
    return (await this.detalleEvento(id)).evento;
  },

  async getTicketsBySesion(sesionId) {
    const token = this._tokenForSession(sesionId);
    this._assert(token, 'La sesión no está habilitada.');
    const { sesion } = await this.resumenSesion(sesionId);
    if (!sesion?.evento_id) return [];
    const detalle = await this.detalleEvento(sesion.evento_id);
    return (detalle?.tickets || []).filter(t => t.sesion_id === sesionId);
  },
};
