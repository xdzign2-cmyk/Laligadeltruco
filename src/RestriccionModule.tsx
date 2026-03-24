
import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import {
    ShieldAlert, Search, UserCheck, Clock,
    Trash2, Edit3, Plus, X,
    Ban, History, Shield, CheckCircle2, XCircle, AlertCircle
} from 'lucide-react';

interface RestriccionProp {
    user: { email: string; role: string; name: string };
    onBack?: () => void;
}

interface ClienteRestriccion {
    id: string;
    nombre: string;
    whatsapp: string;
    advertencias: number;
    estado: 'observacion' | 'suspendido' | 'baneado';
    motivo: string;
    bloqueo_hasta: string | null;
    created_at: string;
}

const RestriccionModule: React.FC<RestriccionProp> = ({ user, onBack }) => {
    const [clientes, setClientes] = useState<ClienteRestriccion[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCliente, setEditingCliente] = useState<Partial<ClienteRestriccion> | null>(null);
    const [showAudit, setShowAudit] = useState(false);
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [requests, setRequests] = useState<any[]>([]);
    const [showRequests, setShowRequests] = useState(false);

    const normalizedRole = user.role?.toLowerCase();
    const isAdmin = normalizedRole === 'admin' || normalizedRole === 'vicepresident';

    const fetchClientes = async () => {
        const { data, error } = await supabase
            .from('clientes_restricciones')
            .select('*')
            .order('created_at', { ascending: false });

        if (!error && data) setClientes(data);
    };

    const fetchAudit = async () => {
        const { data } = await supabase
            .from('clientes_restricciones_audit')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(30);
        if (data) setAuditLogs(data);
    };

    const fetchRequests = async () => {
        const { data } = await supabase
            .from('restricciones_solicitudes')
            .select('*, cliente:clientes_restricciones(nombre, whatsapp)')
            .eq('estado', 'pendiente')
            .order('created_at', { ascending: false });
        if (data) setRequests(data);
    };

    useEffect(() => {
        fetchClientes();
        fetchAudit();
        fetchRequests();

        const channel = supabase
            .channel('restricciones_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'clientes_restricciones' }, () => fetchClientes())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'clientes_restricciones_audit' }, () => fetchAudit())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'restricciones_solicitudes' }, () => fetchRequests())
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    const handleUpdateWarnings = async (cliente: ClienteRestriccion, newVal: number) => {
        // Si el usuario no es admin y está tratando de reducir advertencias, crear una solicitud
        if (!isAdmin && newVal < cliente.advertencias) {
            const { error } = await supabase.from('restricciones_solicitudes').insert({
                tipo: 'REDUCE_WARNINGS',
                cliente_id: cliente.id,
                usuario: user.name,
                detalles: { previos: cliente.advertencias, nuevos: newVal }
            });
            if (!error) alert('Solicitud de reducción de advertencia enviada al Administrador.');
            return;
        }

        let nuevoEstado: 'observacion' | 'suspendido' | 'baneado' = 'observacion';
        let bloqueoHasta = null;

        if (newVal === 3) {
            nuevoEstado = 'baneado';
            bloqueoHasta = null;
        } else if (newVal === 2) {
            nuevoEstado = 'suspendido';
            const date = new Date();
            date.setHours(date.getHours() + 3);
            bloqueoHasta = date.toISOString();
        } else if (newVal === 1) {
            nuevoEstado = 'observacion';
            bloqueoHasta = null;
        }

        // OPTIMISTIC UPDATE: Cambiamos el estado local de inmediato para que sea instantáneo
        const oldClientes = [...clientes];
        setClientes(prev => prev.map(c => c.id === cliente.id ? { ...c, advertencias: newVal, estado: nuevoEstado, bloqueo_hasta: bloqueoHasta } : c));

        const { error } = await supabase
            .from('clientes_restricciones')
            .update({
                advertencias: newVal,
                estado: nuevoEstado,
                bloqueo_hasta: bloqueoHasta
            })
            .eq('id', cliente.id);

        if (error) {
            setClientes(oldClientes); // Revertimos si hay error
            console.error('Error updating warnings:', error);
            alert(`Error de base de datos: ${error.message}`);
            return;
        }

        if (!error) {
            await supabase.from('clientes_restricciones_audit').insert({
                restriccion_id: cliente.id,
                accion: 'UPDATE_CHECK',
                usuario: user.name,
                detalles: { previos: cliente.advertencias, nuevos: newVal, estado: nuevoEstado, bloqueo_hasta: bloqueoHasta }
            });
        }
    };

    const handleSaveCliente = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingCliente?.nombre || !editingCliente?.whatsapp) return;

        // VALIDACIÓN DE DUPLICADOS (SISTEMA 4X4)
        const normalizedWhatsapp = editingCliente.whatsapp.trim();
        const duplicate = clientes.find(c =>
            c.whatsapp.trim() === normalizedWhatsapp &&
            c.id !== editingCliente.id // Ignorar si es el mismo que estamos editando
        );

        if (duplicate) {
            alert(`⚠️ ERROR: El número ${normalizedWhatsapp} ya está registrado en el sistema bajo el nombre: ${duplicate.nombre}`);
            return;
        }

        if (editingCliente.id) {
            // SEGURIDAD: Si no es admin y está bajando el nivel de restricción, pedir permiso
            const original = clientes.find(c => c.id === editingCliente.id);
            const statusOrder = { 'observacion': 1, 'suspendido': 2, 'baneado': 3 };

            if (!isAdmin && original) {
                const orderPrev = statusOrder[original.estado as keyof typeof statusOrder] || 0;
                const orderNew = statusOrder[editingCliente.estado as keyof typeof statusOrder] || 0;

                if (orderNew < orderPrev) {
                    const { error } = await supabase.from('restricciones_solicitudes').insert({
                        tipo: 'CHANGE_STATUS',
                        cliente_id: editingCliente.id,
                        usuario: user.name,
                        detalles: { previos: original.estado, nuevos: editingCliente.estado, motivo: editingCliente.motivo }
                    });
                    if (!error) alert('Solicitud de cambio de estado a uno menos restrictivo enviada al Administrador.');
                    setIsModalOpen(false);
                    return;
                }
            }

            // Update
            const { error } = await supabase
                .from('clientes_restricciones')
                .update({
                    nombre: editingCliente.nombre,
                    whatsapp: editingCliente.whatsapp,
                    motivo: editingCliente.motivo,
                    estado: editingCliente.estado,
                    bloqueo_hasta: editingCliente.bloqueo_hasta
                })
                .eq('id', editingCliente.id);

            if (error) {
                console.error('Error updating client:', error);
                alert(`Error al actualizar cliente: ${error.message}`);
            } else {
                await supabase.from('clientes_restricciones_audit').insert({
                    restriccion_id: editingCliente.id,
                    accion: 'UPDATE',
                    usuario: user.name,
                    detalles: { data: editingCliente }
                });
                setIsModalOpen(false);
            }
        } else {
            // Insert
            const { data, error } = await supabase
                .from('clientes_restricciones')
                .insert({
                    nombre: editingCliente.nombre,
                    whatsapp: editingCliente.whatsapp,
                    motivo: editingCliente.motivo,
                    estado: editingCliente.estado || 'observacion',
                    creado_por: user.name
                })
                .select()
                .single();

            if (error) {
                console.error('Error inserting client:', error);
                alert(`Error al crear cliente: ${error.message}`);
            } else if (data) {
                await supabase.from('clientes_restricciones_audit').insert({
                    restriccion_id: data.id,
                    accion: 'INSERT',
                    usuario: user.name,
                    detalles: { data }
                });
                setIsModalOpen(false);
            }
        }
    };

    const handleDelete = async (id: string) => {
        if (!isAdmin) {
            const { error } = await supabase.from('restricciones_solicitudes').insert({
                tipo: 'DELETE',
                cliente_id: id,
                usuario: user.name,
                detalles: { action: 'FULL_DELETE' }
            });
            if (!error) alert('Solicitud de eliminación enviada al Administrador.');
            return;
        }

        if (!confirm('¿Seguro que deseas eliminar este registro permanentemente?')) return;

        const { error } = await supabase.from('clientes_restricciones').delete().eq('id', id);
        if (!error) {
            await supabase.from('clientes_restricciones_audit').insert({
                accion: 'DELETE',
                usuario: user.name,
                detalles: { target_id: id }
            });
        }
    };

    const handleApproveRequest = async (req: any) => {
        if (!isAdmin) return;

        if (req.tipo === 'DELETE') {
            const { error } = await supabase.from('clientes_restricciones').delete().eq('id', req.cliente_id);
            if (!error) {
                await supabase.from('clientes_restricciones_audit').insert({
                    accion: 'DELETE_APPROVED',
                    usuario: user.name,
                    detalles: { request_id: req.id, client_id: req.cliente_id, requester: req.usuario }
                });
            }
        } else if (req.tipo === 'REDUCE_WARNINGS') {
            const newVal = req.detalles.nuevos;
            let nuevoEstado: any = 'observacion';
            if (newVal === 2) nuevoEstado = 'suspendido';

            const { error } = await supabase.from('clientes_restricciones').update({
                advertencias: newVal,
                estado: nuevoEstado,
                bloqueo_hasta: null
            }).eq('id', req.cliente_id);

            if (!error) {
                await supabase.from('clientes_restricciones_audit').insert({
                    restriccion_id: req.cliente_id,
                    accion: 'REDUCE_APPROVED',
                    usuario: user.name,
                    detalles: { request_id: req.id, new_val: newVal, requester: req.usuario }
                });
            }
        } else if (req.tipo === 'CHANGE_STATUS') {
            const { error } = await supabase.from('clientes_restricciones').update({
                estado: req.detalles.nuevos,
                motivo: req.detalles.motivo
            }).eq('id', req.cliente_id);

            if (!error) {
                await supabase.from('clientes_restricciones_audit').insert({
                    restriccion_id: req.cliente_id,
                    accion: 'STATUS_APPROVED',
                    usuario: user.name,
                    detalles: { request_id: req.id, new_status: req.detalles.nuevos, requester: req.usuario }
                });
            }
        }

        await supabase.from('restricciones_solicitudes').update({
            estado: 'aprobado',
            procesado_por: user.name,
            procesado_at: new Date().toISOString()
        }).eq('id', req.id);
        fetchRequests();
    };

    const handleRejectRequest = async (id: string) => {
        await supabase.from('restricciones_solicitudes').update({
            estado: 'rechazado',
            procesado_por: user.name,
            procesado_at: new Date().toISOString()
        }).eq('id', id);
        fetchRequests();
    };

    // Helper for countdown timer
    const Timer: React.FC<{ target: string }> = ({ target }) => {
        const [timeLeft, setTimeLeft] = useState('');

        useEffect(() => {
            const interval = setInterval(() => {
                const now = new Date().getTime();
                const end = new Date(target).getTime();
                const diff = end - now;

                if (diff <= 0) {
                    setTimeLeft('EXPIRADO');
                    clearInterval(interval);
                } else {
                    const h = Math.floor(diff / (1000 * 60 * 60));
                    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                    const s = Math.floor((diff % (1000 * 60)) / 1000);
                    setTimeLeft(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
                }
            }, 1000);
            return () => clearInterval(interval);
        }, [target]);

        return <span className="font-mono text-xs font-black text-amber-500">{timeLeft}</span>;
    };

    const filteredClientes = clientes.filter(c =>
        c.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.whatsapp.includes(searchQuery)
    );

    return (
        <div className="min-h-screen bg-[#050505] text-slate-300 font-sans selection:bg-rose-500/30 overflow-x-hidden pb-20">
            {/* Background Effects */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-rose-600/5 rounded-full blur-[120px] animate-pulse"></div>
                <div className="absolute bottom-[10%] right-[-5%] w-[500px] h-[500px] bg-rose-900/10 rounded-full blur-[100px] animate-pulse delay-700"></div>
            </div>

            {/* Header */}
            <header className="relative z-10 border-b border-white/5 bg-black/60 backdrop-blur-2xl px-4 md:px-6 py-4 flex justify-between items-center shadow-2xl">
                <div className="flex items-center gap-3 md:gap-4">
                    <div className="p-2 md:p-3 bg-rose-500/10 rounded-xl md:rounded-2xl border border-rose-500/20 shadow-lg animate-pulse">
                        <ShieldAlert className="text-rose-500 w-5 h-5 md:w-6 md:h-6" />
                    </div>
                    <div>
                        <h1 className="text-white font-black tracking-tighter text-lg md:text-2xl uppercase italic leading-none">RESTRICCIÓN</h1>
                        <p className="hidden md:block text-[10px] text-rose-500/60 font-bold uppercase tracking-[0.3em] mt-1">Control de Seguridad en Tiempo Real</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 md:gap-3">
                    <button
                        onClick={() => setShowRequests(!showRequests)}
                        className={`p-2 md:p-2.5 rounded-xl border transition-all relative ${requests.length > 0 ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' : 'bg-white/5 border-white/10 text-slate-400'}`}
                    >
                        <Shield size={18} />
                        {requests.length > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-black text-[10px] font-black rounded-full flex items-center justify-center animate-bounce">{requests.length}</span>}
                    </button>
                    <button onClick={() => setShowAudit(!showAudit)} className="p-2 md:p-2.5 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all text-slate-400">
                        <History size={18} />
                    </button>
                    <button onClick={() => { setEditingCliente({}); setIsModalOpen(true); }} className="bg-rose-600 hover:bg-rose-500 text-white p-2 md:px-5 md:py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg shadow-rose-600/20 active:scale-95">
                        <Plus size={16} /> <span className="hidden md:inline">Agregar Cliente</span>
                    </button>
                    {onBack && <button onClick={onBack} className="p-2 md:p-2.5 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-slate-400 transition-all"><X size={18} /></button>}
                </div>
            </header>

            <main className="relative z-10 p-4 md:p-6 max-w-7xl mx-auto space-y-6 md:space-y-8">
                {/* Search Bar / Fast Check */}
                <div className="bg-slate-900/40 backdrop-blur-xl border border-white/5 p-4 md:p-6 rounded-[1.5rem] md:rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-5 text-rose-500 pointer-events-none rotate-12 transition-transform group-hover:rotate-0 duration-700 hidden md:block">
                        <Search size={120} />
                    </div>
                    <div className="relative flex flex-col md:flex-row gap-4 items-center">
                        <div className="flex-1 w-full relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                            <input
                                type="text"
                                placeholder="BUSCAR NOMBRE O WHATSAPP..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-black/40 border border-white/5 rounded-xl md:rounded-2xl py-3 md:py-4 pl-12 pr-4 text-white font-mono font-bold placeholder:text-slate-600 focus:border-rose-500 focus:bg-black/60 outline-none transition-all shadow-inner tracking-tight md:tracking-widest text-sm md:text-base"
                            />
                        </div>
                        <div className="flex items-center gap-3 px-4 py-3 md:px-6 md:py-4 bg-white/5 rounded-xl md:rounded-2xl border border-white/5 w-full md:w-auto justify-center">
                            <Shield className="text-emerald-500" size={18} />
                            <span className="text-[10px] font-black uppercase text-slate-400">Sistema:</span>
                            <span className="text-[10px] font-black uppercase text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">Sincronizado</span>
                        </div>
                    </div>
                </div>

                {/* Mobile Card Layout (Visible on small screens) */}
                <div className="grid grid-cols-1 gap-4 md:hidden">
                    {filteredClientes.map((cliente) => (
                        <div key={cliente.id} className="bg-slate-900/40 border border-white/5 rounded-[1.5rem] p-5 space-y-3">
                            {/* Header with Name, Number and Actions */}
                            <div className="flex justify-between items-start">
                                <div className="flex flex-col">
                                    <span className="text-white/40 font-black text-[10px] uppercase tracking-widest leading-none mb-1">{cliente.nombre}</span>
                                    <span className="text-2xl font-mono font-black text-white flex items-center gap-2 tracking-tighter leading-none">
                                        {cliente.whatsapp}
                                    </span>
                                </div>
                                <div className="flex gap-1">
                                    <button onClick={() => { setEditingCliente(cliente); setIsModalOpen(true); }} className="p-2 bg-white/5 rounded-lg text-slate-500 border border-white/5 active:bg-white/10">
                                        <Edit3 size={14} />
                                    </button>
                                    <button onClick={() => handleDelete(cliente.id)} className="p-2 bg-rose-500/10 rounded-lg text-rose-500 border border-rose-500/10 active:bg-rose-500/20">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>

                            <div className="bg-black/30 rounded-2xl p-4 border border-white/5 space-y-3">
                                <div className="flex justify-between items-center">
                                    <div className="flex flex-col">
                                        <span className={`text-[10px] font-black uppercase tracking-widest ${cliente.estado === 'baneado' ? 'text-rose-500' :
                                            cliente.estado === 'suspendido' ? 'text-amber-500' :
                                                'text-emerald-500'
                                            }`}>
                                            {cliente.estado === 'baneado' ? 'BLOQUEO PERMANENTE' :
                                                cliente.estado === 'suspendido' ? 'SUSPENSIÓN TEMPORAL' :
                                                    'EN OBSERVACIÓN'}
                                        </span>
                                        <span className="text-[11px] text-white font-bold italic mt-1 line-clamp-2">
                                            {cliente.motivo || 'Sin motivo registrado'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 ml-4">
                                        {[1, 2, 3].map((num) => (
                                            <button
                                                key={num}
                                                onClick={() => handleUpdateWarnings(cliente, cliente.advertencias >= num ? num - 1 : num)}
                                                className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all duration-300 ${cliente.advertencias >= num
                                                    ? 'bg-rose-600 border-rose-500 text-white shadow-[0_0_15px_rgba(225,29,72,0.4)] scale-105'
                                                    : 'bg-black/40 border-white/10 text-transparent'
                                                    }`}
                                            >
                                                {cliente.advertencias >= num && <div className="w-3.5 h-3.5 bg-white rounded-sm"></div>}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {cliente.estado === 'suspendido' && cliente.bloqueo_hasta && (
                                    <div className="flex items-center justify-between pt-2 border-t border-white/5">
                                        <div className="flex flex-col">
                                            <span className="text-[9px] text-amber-500 font-black uppercase">Suspensión Activa (3h)</span>
                                            <span className="text-[8px] text-white/30 font-mono">Fin: {new Date(cliente.bloqueo_hasta).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.1)]">
                                            <Clock size={12} className="text-amber-500 animate-pulse" />
                                            <Timer target={cliente.bloqueo_hasta} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Desktop Table Layout (Hidden on small screens) */}
                <div className="hidden md:block bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-black/40 border-b border-white/5">
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Cliente / WhatsApp</th>
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 text-center">Advertencias (Checks)</th>
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Estado</th>
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Motivo / Bloqueo</th>
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 text-right">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filteredClientes.map((cliente) => (
                                    <tr key={cliente.id} className="group hover:bg-white/[0.02] transition-colors">
                                        <td className="px-8 py-6">
                                            <div className="flex flex-col">
                                                <span className="text-white font-black text-sm uppercase tracking-tight">{cliente.nombre}</span>
                                                <span className="text-[10px] font-mono font-bold text-slate-500 flex items-center gap-2 mt-1">
                                                    <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" className="w-3 h-3 h-auto opacity-50" alt="" />
                                                    {cliente.whatsapp}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex justify-center items-center gap-4">
                                                {[1, 2, 3].map((num) => (
                                                    <button
                                                        key={num}
                                                        onClick={() => handleUpdateWarnings(cliente, cliente.advertencias >= num ? num - 1 : num)}
                                                        className={`w-7 h-7 rounded-md border-2 flex items-center justify-center transition-all duration-300 ${cliente.advertencias >= num
                                                            ? 'bg-rose-600 border-rose-500 text-white shadow-[0_0_15px_rgba(225,29,72,0.4)] scale-110'
                                                            : 'bg-black/40 border-white/20 text-transparent hover:border-rose-500/50 hover:bg-rose-500/5'
                                                            }`}
                                                    >
                                                        {cliente.advertencias >= num && <div className="w-3.5 h-3.5 bg-white rounded-sm animate-in zoom-in-50 duration-200"></div>}
                                                    </button>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <span className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest inline-flex items-center gap-2 ${cliente.estado === 'baneado' ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' :
                                                cliente.estado === 'suspendido' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                                                    'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                                }`}>
                                                {cliente.estado === 'baneado' ? <Ban size={10} /> : <UserCheck size={10} />}
                                                {cliente.estado}
                                            </span>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-[10px] text-slate-500 font-bold max-w-[200px] truncate italic">"{cliente.motivo || 'Sin registro de motivo'}"</span>
                                                {cliente.estado === 'suspendido' && cliente.bloqueo_hasta && (
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <Clock size={12} className="text-amber-500" />
                                                        <Timer target={cliente.bloqueo_hasta} />
                                                    </div>
                                                )}
                                                {cliente.estado === 'baneado' && <span className="text-[10px] text-rose-500 font-black uppercase">PERMANENTE</span>}
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button onClick={() => { setEditingCliente(cliente); setIsModalOpen(true); }} className="p-2 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition-all border border-transparent hover:border-white/10"><Edit3 size={16} /></button>
                                                <button onClick={() => handleDelete(cliente.id)} className="p-2 hover:bg-rose-500/10 rounded-lg text-slate-500 hover:text-rose-500 transition-all border border-transparent hover:border-rose-500/20"><Trash2 size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {filteredClientes.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-8 py-20 text-center">
                                            <div className="flex flex-col items-center opacity-20">
                                                <ShieldAlert size={60} className="mb-4" />
                                                <p className="font-black uppercase tracking-widest text-xs">No se encontraron registros de restricción</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>

            {/* REQUESTS DRAWER */}
            {showRequests && (
                <div className="fixed inset-0 z-[100] flex justify-end animate-in fade-in duration-300">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowRequests(false)}></div>
                    <div className="relative w-full max-w-md bg-[#080808] border-l border-amber-500/20 shadow-2xl flex flex-col animate-in slide-in-from-right duration-500">
                        <div className="p-8 border-b border-white/5 bg-amber-500/5 flex justify-between items-center">
                            <div>
                                <h3 className="text-white font-black text-xl uppercase italic">Solicitudes de <span className="text-amber-500">Autorización</span></h3>
                                <p className="text-[10px] text-amber-500/50 font-bold uppercase tracking-widest mt-1">Requiere aprobación del Administrador</p>
                            </div>
                            <button onClick={() => setShowRequests(false)} className="p-2 hover:bg-white/5 rounded-full transition-all text-slate-500"><X size={20} /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            {requests.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-20 opacity-20">
                                    <Shield size={60} className="mb-4" />
                                    <p className="font-black uppercase tracking-widest text-[10px]">No hay solicitudes pendientes</p>
                                </div>
                            )}
                            {requests.map((req) => (
                                <div key={req.id} className="bg-white/5 border border-white/5 p-5 rounded-2xl space-y-4">
                                    <div className="flex justify-between items-start">
                                        <div className="flex flex-col">
                                            <span className="text-[8px] font-black text-amber-500 uppercase tracking-[0.2em] mb-1">
                                                {req.tipo === 'DELETE' ? 'ELIMINACIÓN TOTAL' :
                                                    req.tipo === 'CHANGE_STATUS' ? 'CAMBIO DE ESTADO' :
                                                        'REDUCCIÓN DE CASTIGO'}
                                            </span>
                                            <span className="text-white font-black text-lg leading-tight uppercase tracking-tight">{req.cliente?.nombre || 'Cliente'}</span>
                                            <span className="text-[10px] font-mono font-bold text-slate-500">{req.cliente?.whatsapp}</span>
                                        </div>
                                        <div className="bg-amber-500/10 p-2 rounded-xl text-amber-500">
                                            <AlertCircle size={20} />
                                        </div>
                                    </div>

                                    <div className="py-3 px-4 bg-black/40 rounded-xl border border-white/5">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-[8px] text-slate-500 font-bold uppercase">Solicitado por:</span>
                                            <span className="text-[10px] text-white font-black uppercase">{req.usuario}</span>
                                        </div>
                                        {req.tipo === 'REDUCE_WARNINGS' && (
                                            <div className="flex justify-between items-center">
                                                <span className="text-[8px] text-slate-500 font-bold uppercase">Cambio:</span>
                                                <span className="text-[10px] text-amber-500 font-black">{req.detalles.previos} <span className="text-slate-500 mx-1">→</span> {req.detalles.nuevos} checks</span>
                                            </div>
                                        )}
                                        {req.tipo === 'CHANGE_STATUS' && (
                                            <div className="flex justify-between items-center">
                                                <span className="text-[8px] text-slate-500 font-bold uppercase">Cambio:</span>
                                                <span className="text-[10px] text-amber-500 font-black">{req.detalles.previos} <span className="text-slate-500 mx-1">→</span> {req.detalles.nuevos}</span>
                                            </div>
                                        )}
                                    </div>

                                    {isAdmin ? (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleApproveRequest(req)}
                                                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20"
                                            >
                                                <CheckCircle2 size={16} /> Autorizar
                                            </button>
                                            <button
                                                onClick={() => handleRejectRequest(req.id)}
                                                className="flex-1 bg-white/5 hover:bg-rose-500/10 text-slate-400 hover:text-rose-500 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest border border-white/10 hover:border-rose-500/20 transition-all flex items-center justify-center gap-2"
                                            >
                                                <XCircle size={16} /> Rechazar
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="py-2 text-center bg-white/5 rounded-xl border border-white/5">
                                            <span className="text-[8px] text-slate-500 font-black uppercase italic">Esperando aprobación de Admin...</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* AUDIT DRAWER */}
            {showAudit && (
                <div className="fixed inset-0 z-[100] flex justify-end animate-in fade-in duration-300">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAudit(false)}></div>
                    <div className="relative w-full max-w-md bg-[#0a0a0a] border-l border-white/10 shadow-2xl flex flex-col animate-in slide-in-from-right duration-500">
                        <div className="p-8 border-b border-white/5 bg-slate-900/40 flex justify-between items-center">
                            <div>
                                <h3 className="text-white font-black text-xl uppercase italic">Control de <span className="text-rose-500">Trazabilidad</span></h3>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Registro histórico de acciones</p>
                            </div>
                            <button onClick={() => setShowAudit(false)} className="p-2 hover:bg-white/5 rounded-full transition-all text-slate-500"><X size={20} /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            {auditLogs.map((log) => (
                                <div key={log.id} className="bg-white/5 border border-white/5 p-4 rounded-2xl relative group hover:border-rose-500/20 transition-all">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${log.accion === 'INSERT' ? 'bg-emerald-500/10 text-emerald-500' :
                                            log.accion === 'BAN' ? 'bg-rose-500/10 text-rose-500' :
                                                'bg-blue-500/10 text-blue-500'
                                            }`}>{log.accion}</span>
                                        <span className="text-[8px] font-mono text-slate-500">{new Date(log.created_at).toLocaleString()}</span>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] text-white font-bold">{log.usuario}</p>
                                        <p className="text-[9px] text-slate-500 italic mt-1 leading-relaxed">
                                            {log.accion === 'UPDATE_CHECK' && `Actualizó advertencias de ${log.detalles?.previos} a ${log.detalles?.nuevos}`}
                                            {log.accion === 'DELETE' && `Eliminó registro con ID ${log.detalles?.target_id}`}
                                            {log.accion === 'INSERT' && `Registró un nuevo cliente en el sistema`}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ADD/EDIT MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-[#0f0f0f] border border-white/10 p-8 rounded-[2.5rem] w-full max-w-lg shadow-[0_0_50px_rgba(244,63,94,0.1)] relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-rose-500 to-transparent"></div>
                        <div className="flex justify-between items-center mb-10">
                            <div>
                                <h3 className="text-2xl font-black text-white uppercase tracking-tighter italic">{editingCliente?.id ? 'Editar' : 'Nuevo'} <span className="text-rose-500">Registro</span></h3>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Configuración técnica de restricción</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-white p-2 hover:bg-white/5 rounded-full transition-all"><X size={28} /></button>
                        </div>

                        <form onSubmit={handleSaveCliente} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-6 md:col-span-2">
                                <div>
                                    <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest block mb-2">Nombre Completo del Cliente</label>
                                    <input
                                        type="text"
                                        value={editingCliente?.nombre || ''}
                                        onChange={e => setEditingCliente({ ...editingCliente, nombre: e.target.value })}
                                        className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-white font-bold focus:border-rose-500 outline-none transition-all"
                                        placeholder="Ej: Juan Pérez"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest block mb-2">WhatsApp / Identificador</label>
                                    <input
                                        type="text"
                                        value={editingCliente?.whatsapp || ''}
                                        onChange={e => setEditingCliente({ ...editingCliente, whatsapp: e.target.value })}
                                        className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-white font-mono font-bold focus:border-rose-500 outline-none transition-all"
                                        placeholder="+54 11..."
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest block mb-2">Estado de Control</label>
                                    <select
                                        value={editingCliente?.estado || 'observacion'}
                                        onChange={e => setEditingCliente({ ...editingCliente, estado: e.target.value as any })}
                                        className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-white font-bold focus:border-rose-500 outline-none transition-all uppercase text-xs"
                                    >
                                        <option value="observacion">En Observación</option>
                                        <option value="suspendido">Suspendido Temporal</option>
                                        <option value="baneado">Baneado Permanente</option>
                                    </select>
                                </div>
                                {editingCliente?.estado === 'suspendido' && (
                                    <div>
                                        <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest block mb-1">Duración de la Suspensión (Control total)</label>
                                        <div className="bg-black/40 border border-white/5 rounded-xl p-4 mb-4">
                                            <div className="flex justify-between items-center mb-4">
                                                <span className="text-[10px] font-black text-amber-500 uppercase">Ajustar Horas:</span>
                                                <span className="text-xl font-mono font-black text-white bg-amber-500/10 px-3 py-1 rounded-lg border border-amber-500/20">
                                                    {editingCliente?.bloqueo_hasta ? Math.ceil((new Date(editingCliente.bloqueo_hasta).getTime() - new Date().getTime()) / 3600000) : 3}h
                                                </span>
                                            </div>
                                            <input
                                                type="range"
                                                min="1"
                                                max="24"
                                                step="1"
                                                defaultValue="3"
                                                onChange={(e) => {
                                                    const hours = parseInt(e.target.value);
                                                    const d = new Date();
                                                    d.setHours(d.getHours() + hours);
                                                    setEditingCliente({ ...editingCliente, bloqueo_hasta: d.toISOString() });
                                                }}
                                                className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-500 mb-2"
                                            />
                                            <div className="flex justify-between text-[8px] font-black text-slate-500 uppercase">
                                                <span>1h</span>
                                                <span>6h</span>
                                                <span>12h</span>
                                                <span>18h</span>
                                                <span>24h</span>
                                            </div>
                                        </div>
                                        <input
                                            type="datetime-local"
                                            value={editingCliente?.bloqueo_hasta ? new Date(new Date(editingCliente.bloqueo_hasta).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}
                                            onChange={e => setEditingCliente({ ...editingCliente, bloqueo_hasta: new Date(e.target.value).toISOString() })}
                                            className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-white font-bold focus:border-rose-500 outline-none transition-all"
                                        />
                                    </div>
                                )}
                                <div>
                                    <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest block mb-2">Motivo del Bloqueo / Observación</label>
                                    <textarea
                                        value={editingCliente?.motivo || ''}
                                        onChange={e => setEditingCliente({ ...editingCliente, motivo: e.target.value })}
                                        className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-rose-500 outline-none transition-all resize-none min-h-[100px]"
                                        placeholder="Cancelaciones frecuentes, desconexiones, mal comportamiento..."
                                    />
                                </div>
                            </div>
                            <button type="submit" className="md:col-span-2 w-full py-4 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase tracking-[0.3em] rounded-2xl shadow-xl shadow-rose-600/20 active:scale-95 transition-all">
                                Guardar Cambios Técnicos
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RestriccionModule;
