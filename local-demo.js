// Modo de demostración local. No usa ni modifica la base de datos remota.
window.CUC_LOCAL_DEMO = true;

(() => {
  const evento = {
    id: 'local-visita-papal', visitante: 'Visita Papal', categoria: 'plantel_superior',
    fecha: '2026-11-08', hora: '08:00', precio_entrada: 80000, estado: 'activo', alias: '',
  };
  const tickets = [];
  let sesion = null;
  const resumen = () => {
    const activos = tickets.filter(t => !t.eliminado);
    const porMetodo = metodo => activos.filter(t => t.metodo_pago === metodo);
    const efectivo = porMetodo('efectivo');
    const transferencia = porMetodo('transferencia');
    const libres = porMetodo('libre');
    const suma = xs => xs.reduce((total, ticket) => total + Number(ticket.monto || 0), 0);
    return {
      cantidad_total: activos.length, cantidad_efectivo: efectivo.length,
      cantidad_transferencia: transferencia.length, cantidad_libres: libres.length,
      total_efectivo: suma(efectivo), total_transferencia: suma(transferencia),
      total_recaudado: suma(efectivo) + suma(transferencia),
    };
  };

  DB.eventosActivos = async () => [evento];
  DB.crearSesion = async (_eventoId, nombre, apellido, dni) => {
    sesion = { id: 'local-sesion-1', evento_id: evento.id, nombre, apellido, dni, estado: 'activa', numero_sesion: 1 };
    return { sesion, session_token: 'local-token' };
  };
  DB.resumenSesion = async () => ({ sesion, resumen: resumen() });
  DB.checkDuplicado = async (_eventoId, numero) => {
    const ticket = tickets.find(t => !t.eliminado && t.numero_ticket === String(numero));
    return ticket ? { ticket, sesion } : null;
  };
  DB.registrarTicket = async payload => {
    tickets.push({ ...payload, numero_ticket: payload.numero_ticket == null ? null : String(payload.numero_ticket), timestamp: new Date().toISOString(), eliminado: false });
    return { ok: true };
  };
  DB.borrarUltimoTicketSesion = async () => {
    const ticket = [...tickets].reverse().find(t => !t.eliminado);
    if (!ticket) throw new Error('No tenés tickets registrados para borrar.');
    ticket.eliminado = true;
  };
  DB.cerrarSesion = async () => { if (sesion) sesion.estado = 'finalizada'; };
})();
