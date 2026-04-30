// ============================================================
//  db.js - capa de datos con Supabase
// ============================================================

const SUPABASE_URL = 'https://yyuuwlzjzspsqwaxdzjnm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5dXdsemp6c3BzcXdheGR6am5tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1MTM4NzksImV4cCI6MjA5MzA4OTg3OX0.zKetqP6moo0HVpDpfR19Lb8bZfwu8BZRiFcDxdSPrdg';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const DB = {
  // -- admin por defecto --------------------------------------
  ADMIN: { username: 'Admin', password: 'Universitario1907' },

  // -- admins -------------------------------------------------
  loginAdmin(user, pass) {
    return user.toLowerCase() === this.ADMIN.username.toLowerCase() && pass.toLowerCase() === this.ADMIN.password.toLowerCase();
  },

  // -- eventos ------------------------------------------------
  async getEventos() {
    const { data, error } = await supabaseClient
      .from('eventos')
      .select('*')
      .order('creadoEn', { ascending: false });

    if (error) {
      console.error('Error cargando eventos:', error);
      return [];
    }

    return data || [];
  },

  async getEventosActivos() {
    const eventos = await this.getEventos();
    return eventos.filter(e => e.estado === 'ACTIVO');
  },

  async getEventoById(id) {
    const { data, error } = await supabaseClient
      .from('eventos')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Error cargando evento:', error);
      return null;
    }

    return data;
  },

  async crearEvento({ equipoLocal, equipoVisitante, fecha, categoria, monto, alias }) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const nombre = `${equipoLocal} vs ${equipoVisitante}`;
    const nuevo = {
      id,
      nombre,
      equipoLocal,
      equipoVisitante,
      fecha,
      categoria,
      monto: parseFloat(monto),
      alias: alias || '',
      cobradores: [],
      estado: 'ACTIVO',
      creadoEn: new Date().toISOString()
    };

    const { data, error } = await supabaseClient
      .from('eventos')
      .insert(nuevo)
      .select()
      .single();

    if (error) {
      console.error('Error creando evento:', error);
      return null;
    }

    return data;
  },

  async finalizarEvento(id) {
    const { error } = await supabaseClient
      .from('eventos')
      .update({ estado: 'FINALIZADO', finalizadoEn: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Error finalizando evento:', error);
      return false;
    }

    return true;
  },

  // -- tickets ------------------------------------------------
  async getTickets(eventoId) {
    const { data, error } = await supabaseClient
      .from('tickets')
      .select('*')
      .eq('eventoId', eventoId)
      .order('creadoEn', { ascending: true });

    if (error) {
      console.error('Error cargando tickets:', error);
      return [];
    }

    return data || [];
  },

  async getUltimoTicket(eventoId) {
    const { data, error } = await supabaseClient
      .from('tickets')
      .select('*')
      .eq('eventoId', eventoId)
      .order('creadoEn', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error cargando ultimo ticket:', error);
      return null;
    }

    return data;
  },

  async registrarTicket({ eventoId, numeroTicket, metodoPago, patente, nombreGratis, razonGratis, cobradorNombre, cobradorDocumento }) {
    const evento = await this.getEventoById(eventoId);
    if (!evento) return { ok: false, error: 'Evento no encontrado.' };
    if (evento.estado !== 'ACTIVO') return { ok: false, error: 'El evento ya fue finalizado. No se pueden registrar mas tickets.' };

    if (metodoPago !== 'GRATIS' && (!numeroTicket || !String(numeroTicket).trim())) return { ok: false, error: 'El numero de ticket es obligatorio.' };
    if (!metodoPago) return { ok: false, error: 'Selecciona un metodo de pago.' };
    if (metodoPago === 'GRATIS') {
      if (!patente?.trim()) return { ok: false, error: 'Ingresa la patente.' };
      if (!nombreGratis?.trim()) return { ok: false, error: 'Ingresa el nombre.' };
      if (!razonGratis?.trim()) return { ok: false, error: 'Ingresa la razon.' };
    }

    const numFinal = (metodoPago === 'GRATIS' && !String(numeroTicket).trim())
      ? `G-${Date.now()}`
      : String(numeroTicket).trim();

    const nuevo = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      eventoId,
      numeroTicket: numFinal,
      metodoPago,
      cobradorNombre: cobradorNombre?.trim() || null,
      cobradorDocumento: cobradorDocumento?.trim() || null,
      patente: patente?.trim().toUpperCase() || null,
      nombreGratis: nombreGratis?.trim() || null,
      razonGratis: razonGratis?.trim() || null,
      creadoEn: new Date().toISOString()
    };

    const { data, error } = await supabaseClient
      .from('tickets')
      .insert(nuevo)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') return { ok: false, error: `El ticket #${numFinal} ya existe en este evento.` };
      console.error('Error registrando ticket:', error);
      return { ok: false, error: 'No se pudo registrar el ticket. Revisa la conexion y las politicas de Supabase.' };
    }

    return { ok: true, ticket: data };
  },

  // -- resumen ------------------------------------------------
  async getResumen(eventoId) {
    const evento = await this.getEventoById(eventoId);
    if (!evento) return null;
    const tickets = await this.getTickets(eventoId);

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

  async borrarEvento(id) {
    const { error } = await supabaseClient
      .from('eventos')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error borrando evento:', error);
      return false;
    }

    return true;
  },

  async getEventosCobrador() {
    return this.getEventosActivos();
  }
};
