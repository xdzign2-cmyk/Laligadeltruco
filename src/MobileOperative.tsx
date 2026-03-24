import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { DollarSign, LogOut, Save, Trash2, Edit2, X, FileText, Calendar, RefreshCw, ShieldAlert, Ship, Mountain, ChevronLeft, ChevronRight } from 'lucide-react';

interface MobileProps {
    user: { email: string; role: 'fijo_barco' | 'fijo_cueva'; name: string };
    onLogout: () => void;
    onNavigateToRestriccion?: () => void;
}

const MobileOperative: React.FC<MobileProps> = ({ user, onLogout, onNavigateToRestriccion }) => {
    // --- ESTADOS ---
    const [view, setView] = useState<'registro' | 'nomina'>('registro');
    const [bando, setBando] = useState<'Barco' | 'Cueva'>(
        user.role === 'fijo_barco' ? 'Barco' : 'Cueva'
    );
    const [monto, setMonto] = useState('');
    const [cantidadBulk, setCantidadBulk] = useState('');
    const [montoBulk, setMontoBulk] = useState('');
    const [loadingBulk, setLoadingBulk] = useState(false);
    const [batches, setBatches] = useState<any[]>([]);
    const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
    const [newBatchAmount, setNewBatchAmount] = useState('');

    const getOperationalDate = () => {
        const now = new Date();
        // Shift transition: before 3 AM local is still the previous operational day
        if (now.getHours() < 3) {
            now.setDate(now.getDate() - 1);
        }

        // Use local date parts for consistency (avoiding UTC jumps from toISOString)
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');

        return `${year}-${month}-${day}`;
    };

    const [fecha, setFecha] = useState(getOperationalDate()); // Default: Turno actual
    const [registros, setRegistros] = useState<any[]>([]);
    const [historialDias, setHistorialDias] = useState<any>({}); // Grouped history
    const [loading, setLoading] = useState(false);

    // Estado para edición
    const [editingId, setEditingId] = useState<string | null>(null);

    // --- ESTADOS DE NÓMINA ---
    const [payrollData, setPayrollData] = useState<any>(null);
    const [loadingPayroll, setLoadingPayroll] = useState(false);
    const [currentFortnight, setCurrentFortnight] = useState(1);
    const [comprobanteUrl, setComprobanteUrl] = useState<string | null>(null);

    useEffect(() => {
        loadDailyRecords();
        loadPayrollData();
        loadProfile();
        loadHistorySummary();
        loadDailyBatches();
    }, []);

    // Add useEffect to reload when 'fecha' changes
    useEffect(() => {
        loadDailyRecords();
        loadDailyBatches();
    }, [fecha]);

    // Live sync for date transitions (past 3 AM)
    useEffect(() => {
        const interval = setInterval(() => {
            const actualToday = getOperationalDate();
            setFecha(prev => {
                const now = new Date();
                // If it's exactly the hour of transition and we are still on the "old" day, 
                // we sync automatically. This ensures "Every time they start session" logic
                // also works for long-running sessions that cross the 3 AM mark.
                if (now.getHours() === 3 && now.getMinutes() === 0) {
                    return actualToday;
                }
                return prev;
            });
        }, 60000);
        return () => clearInterval(interval);
    }, []);

    const loadProfile = async () => {
        try {
            const { data } = await supabase
                .from('perfiles_empleados')
                .select('comprobante_url')
                .eq('user_email', user.email);

            if (data && data.length > 0) {
                setComprobanteUrl(data[0].comprobante_url);
            }
        } catch (err) {
            console.error("Error cargando perfil:", err);
        }
    };

    // --- LOGICA REGISTROS ---
    const loadDailyRecords = async () => {
        const { data } = await supabase
            .from('registros_operativos')
            .select('*')
            .eq('user_email', user.email)
            .eq('fecha_operacion', fecha)
            .order('created_at', { ascending: false });

        if (data) setRegistros(data);
    };

    const loadHistorySummary = async () => {
        const { data } = await supabase
            .from('registros_operativos')
            .select('fecha_operacion, monto_apuesta')
            .eq('user_email', user.email)
            .order('fecha_operacion', { ascending: false });

        if (data) {
            const months: any = {};
            data.forEach((r: any) => {
                const dateObj = new Date(r.fecha_operacion + 'T12:00:00'); // Evitar problemas de timezone
                const monthName = dateObj.toLocaleString('es-ES', { month: 'long' }).toUpperCase();
                const year = dateObj.getFullYear();
                const day = dateObj.getDate();
                const key = `${monthName} ${year}`;
                const fortnight = day <= 15 ? 'Q1 (01-15)' : 'Q2 (16-31/30)';

                if (!months[key]) months[key] = {};
                if (!months[key][fortnight]) months[key][fortnight] = { total: 0, days: [] };

                months[key][fortnight].total += r.monto_apuesta;
                if (!months[key][fortnight].days.includes(r.fecha_operacion)) {
                    months[key][fortnight].days.push(r.fecha_operacion);
                }
            });
            setHistorialDias(months);
        }
    };

    const loadDailyBatches = async () => {
        try {
            console.log("Cargando lotes para:", { email: user.email, fecha, bando });
            const { data, error } = await supabase
                .from('registros_operativos')
                .select('batch_id, monto_apuesta, bando')
                .eq('user_email', user.email)
                .eq('fecha_operacion', fecha)
                .not('batch_id', 'is', null);

            if (error) throw error;

            if (data) {
                console.log("Datos de lotes crudos:", data.length);
                // Group by batch_id
                const grouped = data.reduce((acc: any, curr: any) => {
                    if (!acc[curr.batch_id]) {
                        acc[curr.batch_id] = {
                            batch_id: curr.batch_id,
                            amount: curr.monto_apuesta,
                            count: 0,
                            bando: curr.bando
                        };
                    }
                    acc[curr.batch_id].count += 1;
                    return acc;
                }, {});
                const batchList = Object.values(grouped);
                console.log("Lotes procesados:", batchList.length);
                setBatches(batchList);
            }
        } catch (err) {
            console.error("Error cargando lotes:", err);
        }
    };

    const handleGuardar = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!monto) return;

        setLoading(true);
        // FORCE POSITIVE AND ROUND
        const montoNum = Math.abs(parseFloat(monto) || 0);

        // Calculo individual para compatibilidad
        const gananciaIndividual = (montoNum * 2) * 0.08;

        // FIXED TIME FORMAT: HH:MM:SS (24h)
        const timeString = new Date().toTimeString().split(' ')[0];
        // USAMOS LA FECHA SELECCIONADA POR EL USUARIO (o la calculada por defecto)
        const opDate = fecha;

        if (editingId) {
            // UPDATE
            const { error } = await supabase.from('registros_operativos').update({
                monto_apuesta: montoNum,
                ganancia_calculada: gananciaIndividual,
                bando: bando,
                fecha_operacion: opDate // Permitir cambiar fecha al editar
            }).eq('id', editingId);

            if (!error) {
                setMonto('');
                setEditingId(null);
                // Removed auto-reset to today to allow staying on the edited day's view
                loadDailyRecords();
            } else {
                alert('Error al actualizar: ' + error.message);
            }
        } else {
            // INSERT
            const { error } = await supabase.from('registros_operativos').insert({
                user_email: user.email,
                user_role: user.role,
                bando: bando,
                mesa: 'General',
                monto_apuesta: montoNum,
                ganancia_calculada: gananciaIndividual,
                hora_registro: timeString, // Uses standard format now
                fecha_operacion: opDate
            });

            if (!error) {
                setMonto('');
                loadDailyRecords();
                loadHistorySummary();
            } else {
                alert('Error al guardar: ' + error.message);
            }
        }
        setLoading(false);
    };

    const handleGuardarMasivo = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!cantidadBulk || !montoBulk) return;

        const count = parseInt(cantidadBulk);
        const amount = Math.abs(parseFloat(montoBulk) || 0);
        if (count <= 0 || amount <= 0) return;

        if (!confirm(`¿Registrar ${count} apuestas de $${amount} cada una?`)) return;

        setLoadingBulk(true);
        try {
            const opDate = fecha;
            const timeString = new Date().toTimeString().split(' ')[0];
            const gananciaIndividual = (amount * 2) * 0.08;

            // Robust UUID fallback for environments without crypto.randomUUID
            let batchId;
            if (typeof crypto !== 'undefined' && crypto.randomUUID) {
                batchId = crypto.randomUUID();
            } else {
                batchId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
                    return v.toString(16);
                });
            }

            console.log("Insertando lote...", { count, amount, batchId });

            const newRecords = Array.from({ length: count }).map(() => ({
                user_email: user.email,
                user_role: user.role,
                bando: bando,
                mesa: 'General',
                monto_apuesta: amount,
                ganancia_calculada: gananciaIndividual,
                hora_registro: timeString,
                fecha_operacion: opDate,
                batch_id: batchId
            }));

            const { error } = await supabase.from('registros_operativos').insert(newRecords);

            if (error) {
                console.error('Error insertando lote:', error);
                alert('Error al guardar lote: ' + error.message);
            } else {
                console.log("Lote insertado con éxito.");
                setCantidadBulk('');
                setMontoBulk('');
                await loadDailyRecords();
                await loadHistorySummary();
                await loadDailyBatches();
                alert(`✅ ${count} apuestas registradas correctamente.`);
            }
        } catch (err: any) {
            console.error("Excepción en guardado masivo:", err);
            alert("Error crítico al guardar: " + err.message);
        } finally {
            setLoadingBulk(false);
        }
    };

    const handleDeleteBatch = async (batchId: string) => {
        if (!confirm('¿Seguro que quieres eliminar TODO este lote de apuestas?')) return;

        setLoadingBulk(true);
        const { error } = await supabase
            .from('registros_operativos')
            .delete()
            .eq('batch_id', batchId);

        if (!error) {
            loadDailyRecords();
            loadHistorySummary();
            loadDailyBatches();
        } else {
            alert('Error al eliminar lote: ' + error.message);
        }
        setLoadingBulk(false);
    };

    const handleEditBatch = async (batch: any) => {
        setEditingBatchId(batch.batch_id);
        setNewBatchAmount(batch.amount.toString());
    };

    const saveEditedBatch = async () => {
        if (!editingBatchId || !newBatchAmount) return;

        const newAmountNum = Math.abs(parseFloat(newBatchAmount) || 0);
        const newGanancia = (newAmountNum * 2) * 0.08;

        setLoadingBulk(true);
        const { error } = await supabase
            .from('registros_operativos')
            .update({
                monto_apuesta: newAmountNum,
                ganancia_calculada: newGanancia
            })
            .eq('batch_id', editingBatchId);

        if (!error) {
            setEditingBatchId(null);
            setNewBatchAmount('');
            loadDailyRecords();
            loadHistorySummary();
            loadDailyBatches();
        } else {
            alert('Error al actualizar lote: ' + error.message);
        }
        setLoadingBulk(false);
    };

    const handleEdit = (reg: any) => {
        setMonto(reg.monto_apuesta.toString());
        setFecha(reg.fecha_operacion);
        setBando(reg.bando); // Sincronizar el bando al editar
        setEditingId(reg.id);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Borrar este registro?')) return;
        const { error } = await supabase.from('registros_operativos').delete().eq('id', id);
        if (!error) {
            loadDailyRecords();
            loadHistorySummary();
        }
    };

    const cancelEdit = () => {
        setEditingId(null);
        setMonto('');
        // No reset to today on cancel, stay where the user was
    };

    // --- LOGICA NÓMINA (Sync with Admin Backup) ---
    const loadPayrollData = async () => {
        setLoadingPayroll(true);
        // Leemos el backup ID=1 que guarda el Dashboard
        const { data } = await supabase.from('app_backups').select('content').eq('id', 1).single();
        if (data && data.content) {
            setPayrollData(data.content);
        } else {
            // Si no hay backup, quizás no se ha guardado nunca desde el Dashboard
            console.warn("No se encontró backup ID=1 en app_backups");
        }
        setLoadingPayroll(false);
    };

    const getEmployeeData = () => {
        if (!payrollData || !payrollData.employees) return null;
        // Buscamos coincidencia por nombre (El admin debe poner el mismo nombre que tienes aqui)
        return payrollData.employees.find((e: any) => e.name.trim().toLowerCase() === user.name.trim().toLowerCase());
    };

    const getShiftValue = (empId: any, day: number): string => {
        if (!payrollData || !payrollData.shifts) return '';
        const matrix = payrollData.shifts[empId];
        if (!matrix) return '';
        const entry = matrix[day];
        if (!entry) return '';

        // Si es un objeto (estructura nueva {horas, estatus...})
        if (typeof entry === 'object' && entry !== null) {
            return String(entry.horas || '');
        }
        // Si es un string o numero (estructura vieja)
        return String(entry);
    };

    // --- CALCULOS FILTRADOS POR BANDO ---
    const registrosFiltrados = registros.filter((r: any) => r.bando === bando);
    const totalApuestas = registrosFiltrados.reduce((acc, curr) => acc + curr.monto_apuesta, 0);
    // LOGICA PEDIDA: ((TotalApuestas * 2) * 0.08)
    const totalGananciaTurno = (totalApuestas * 2) * 0.08;

    const matchedEmployee = getEmployeeData();
    const daysRange = currentFortnight === 1
        ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
        : [16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31];

    // Helper para parsear horas
    const parseHours = (val: string | number) => {
        if (!val) return 0;
        if (typeof val === 'number') return val;
        // Fix: Replace comma with dot for decimal handling (4,5 -> 4.5)
        const sVal = val.toString().replace(',', '.');
        if (sVal.includes(':')) {
            const [h, m] = sVal.split(':').map(Number);
            return h + (m / 60);
        }
        return parseFloat(sVal) || 0;
    };

    let totalHours = 0;
    let totalPay = 0;
    if (matchedEmployee) {
        daysRange.forEach(day => {
            const val = getShiftValue(matchedEmployee.id, day);
            if (val && !['F', 'A', 'L'].includes(val)) {
                totalHours += parseHours(val);
            }
        });
        // Connect with employee pay rate or fallback to default
        const empRate = matchedEmployee.pago || 9.6;
        totalPay = (totalHours / 9) * empRate;
    }

    return (
        <div className="min-h-screen bg-black font-sans pb-24 relative overflow-hidden selection:bg-cyan-500/30">
            {/* --- ULTRA-FUTURISTIC BACKGROUND (AURORA VOID) --- */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#1a1b26] via-[#000000] to-[#000000]"></div>
                <div className="absolute top-[-10%] left-[-10%] w-[100vw] h-[100vw] bg-indigo-600/10 rounded-full blur-[120px] animate-pulse mix-blend-screen opacity-50"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[100vw] h-[100vw] bg-cyan-600/10 rounded-full blur-[120px] animate-pulse delay-1000 mix-blend-screen opacity-50"></div>
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_100%)]"></div>
            </div>

            {/* HEADER */}
            <header className="relative z-50 bg-slate-900 border-b border-slate-800 p-4 sticky top-0 shadow-lg">
                <div className="flex justify-between items-center">
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <img src="/logo.png" alt="Logo" className="h-8 w-auto" />
                        </div>
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
                            {user.name} • {bando}
                        </span>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => {
                                loadDailyRecords();
                                loadPayrollData();
                                loadHistorySummary();
                            }}
                            className="p-2 bg-slate-800 text-slate-400 rounded-lg active:scale-90 transition-all"
                            title="Refrescar Datos"
                        >
                            <RefreshCw size={20} className={loading || loadingPayroll ? 'animate-spin' : ''} />
                        </button>
                        <button onClick={onLogout} className="p-2 bg-red-500/10 text-red-500 rounded-lg active:scale-90 transition-all">
                            <LogOut size={20} />
                        </button>
                    </div>
                </div>

                {/* SELECTOR DE BANDO MOVIL - ULTRA LLAMATIVO */}
                <div className="mt-4 flex bg-slate-950/50 p-1.5 rounded-[2rem] border border-white/10 gap-2 shadow-inner">
                    <button
                        onClick={() => setBando('Barco')}
                        className={`flex-1 py-4 rounded-[1.5rem] text-xs font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 ${bando === 'Barco' ? 'bg-indigo-600 text-white shadow-[0_10px_20px_-5px_rgba(79,70,229,0.5)] border-t border-white/30' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        <Ship size={18} className={bando === 'Barco' ? 'animate-pulse' : ''} /> BARCO
                    </button>
                    <button
                        onClick={() => setBando('Cueva')}
                        className={`flex-1 py-4 rounded-[1.5rem] text-xs font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 ${bando === 'Cueva' ? 'bg-fuchsia-600 text-white shadow-[0_10px_20px_-5px_rgba(217,70,239,0.5)] border-t border-white/30' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        <Mountain size={18} className={bando === 'Cueva' ? 'animate-pulse' : ''} /> CUEVA
                    </button>
                </div>
            </header>

            {/* INDICADOR DE FECHA OPERATIVA - ULTRA LLAMATIVO FUCSIA */}
            <div className="mt-4 mx-4 flex flex-col md:flex-row items-center justify-between bg-black/60 p-5 rounded-[2rem] border-2 border-fuchsia-500/50 shadow-[0_0_30px_rgba(217,70,239,0.2)] gap-4 relative z-10">
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="w-4 h-4 rounded-full bg-fuchsia-500 animate-ping shadow-[0_0_20px_#d946ef]"></div>
                    <div className="relative">
                        <div className="absolute -inset-1 bg-fuchsia-500 blur opacity-25 rounded-full"></div>
                        <p className="text-[11px] text-fuchsia-400 font-black uppercase tracking-[0.2em] leading-none">Jornada Operativa</p>
                        <p className="text-xl font-mono font-black text-white mt-1 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">{fecha}</p>
                    </div>
                </div>

                <div className="flex flex-col items-center md:items-end gap-2 w-full md:w-auto">
                    <span className="text-[11px] text-fuchsia-300 font-black uppercase tracking-widest animate-bounce flex items-center gap-2 bg-fuchsia-500/10 px-3 py-1 rounded-full border border-fuchsia-500/20">
                        Verifica la fecha que cargaras
                    </span>
                    <div className="flex items-center gap-2 w-full">
                        <button
                            onClick={() => {
                                const d = new Date(fecha + 'T12:00:00');
                                d.setDate(d.getDate() - 1);
                                setFecha(d.toISOString().split('T')[0]);
                            }}
                            className="bg-fuchsia-600 text-white p-4 rounded-2xl border-2 border-fuchsia-400 active:scale-95 transition-all shadow-lg"
                        >
                            <ChevronLeft size={24} strokeWidth={4} />
                        </button>

                        <div className="relative flex-1 group">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-fuchsia-400 z-10 pointer-events-none group-hover:scale-110 transition-transform">
                                <Calendar size={24} className="drop-shadow-[0_0_10px_rgba(217,70,239,0.8)]" strokeWidth={3} />
                            </div>
                            <input
                                type="date"
                                value={fecha}
                                onChange={(e) => setFecha(e.target.value)}
                                className="w-full bg-slate-900 text-white text-lg font-black pl-14 pr-4 py-5 rounded-2xl border-4 border-fuchsia-600 outline-none focus:border-fuchsia-400 focus:ring-8 focus:ring-fuchsia-500/30 transition-all cursor-pointer shadow-[0_0_20px_rgba(217,70,239,0.4)] appearance-none"
                            />
                            <div className="absolute inset-0 rounded-2xl border-2 border-fuchsia-400/50 animate-pulse pointer-events-none"></div>
                        </div>

                        <button
                            onClick={() => {
                                const d = new Date(fecha + 'T12:00:00');
                                d.setDate(d.getDate() + 1);
                                setFecha(d.toISOString().split('T')[0]);
                            }}
                            className="bg-fuchsia-600 text-white p-4 rounded-2xl border-2 border-fuchsia-400 active:scale-95 transition-all shadow-lg"
                        >
                            <ChevronRight size={24} strokeWidth={4} />
                        </button>
                    </div>
                </div>
            </div>

            {/* CONTENIDO PRINCIPAL */}
            <div className="px-4 mt-6 relative z-10">
                {view === 'registro' && (
                    <div className="space-y-6">
                        {/* SELECTOR DE BANDO (SECUNDARIO SE QUITA PORQUE YA ESTA EN EL HEADER) */}

                        {/* FORMULARIO */}
                        <div className={`bg-slate-900/40 backdrop-blur-2xl rounded-[2.5rem] p-8 border border-white/10 shadow-2xl relative overflow-hidden transition-all duration-500 ${editingId ? 'ring-2 ring-cyan-400 scale-[1.02]' : ''}`}>
                            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-20 animate-pulse"></div>
                            <h2 className="text-white font-bold text-lg mb-6 flex items-center justify-between">
                                <span className="flex items-center gap-3">
                                    <div className={`p-2.5 rounded-xl transition-all shadow-lg ${editingId ? 'bg-cyan-500 text-white shadow-cyan-500/20' : 'bg-white/5 text-cyan-400 border border-white/10'}`}>
                                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                                    </div>
                                    <span className="tracking-tight">{editingId ? 'EDITAR APUESTA' : 'NUEVA APUESTA'}</span>
                                </span>
                                {editingId && <button onClick={cancelEdit} className="text-slate-400 hover:text-white bg-white/5 p-2 rounded-full border border-white/10"><X size={20} /></button>}
                            </h2>

                            <form onSubmit={handleGuardar} className="space-y-6">
                                <div className="bg-black/40 rounded-2xl p-4 flex items-center justify-between border border-white/5 group focus-within:border-cyan-500/30 transition-all shadow-inner">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em] flex items-center gap-2">
                                        <Calendar size={14} className="text-cyan-400" /> FECHA TURNO
                                    </span>
                                    <input type="date" required className="bg-transparent text-white font-bold text-sm outline-none text-right [color-scheme:dark] flex-1 ml-4" value={fecha} onChange={e => setFecha(e.target.value)} />
                                </div>

                                {!editingId && (
                                    <div className="relative group/panel pt-2">
                                        {/* Aura Exterior de Poder (Neon Pulse) */}
                                        <div className="absolute -inset-1 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-[2.8rem] blur-xl opacity-20 group-hover/panel:opacity-40 animate-pulse transition-opacity"></div>

                                        <div className="bg-slate-950/80 backdrop-blur-3xl p-7 rounded-[2.5rem] border-2 border-cyan-400/60 shadow-[0_0_40px_rgba(34,211,238,0.2)] space-y-6 relative overflow-hidden transition-all hover:border-cyan-400 hover:shadow-[0_0_60px_rgba(34,211,238,0.4)]">

                                            {/* Líneas de escaneo futuristas */}
                                            <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-0 bg-[length:100%_4px,3px_100%]"></div>

                                            {/* Brillo de barrido (Sweep light) */}
                                            <div className="absolute top-0 -left-[100%] w-full h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-[shimmer_3s_infinite] opacity-50 z-0"></div>

                                            {/* Detalles ciber-esquinas */}
                                            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-cyan-500/80 rounded-tl-[2.2rem]"></div>
                                            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-blue-500/80 rounded-br-[2.2rem]"></div>

                                            <div className="flex items-center justify-between relative z-10">
                                                <div className="flex items-center gap-3">
                                                    <div className="relative">
                                                        <div className="w-3 h-3 rounded-full bg-cyan-400 animate-ping absolute opacity-70"></div>
                                                        <div className="w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_15px_#22d3ee] relative"></div>
                                                    </div>
                                                    <span className="text-[12px] font-black text-white uppercase tracking-[0.4em] drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
                                                        Carga por Lote <span className="text-cyan-400">Pro</span>
                                                    </span>
                                                </div>
                                                <div className="flex-1 h-[2px] bg-gradient-to-r from-cyan-500/40 via-blue-500/20 to-transparent ml-6"></div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-5 relative z-10">
                                                <div className="space-y-2.5">
                                                    <div className="flex justify-between items-center ml-2">
                                                        <label className="text-[10px] uppercase font-black text-cyan-400/70 tracking-tighter">Cantidad</label>
                                                        <span className="text-[8px] font-mono text-slate-600">INPUT_01</span>
                                                    </div>
                                                    <input
                                                        type="number"
                                                        placeholder="00"
                                                        className="w-full bg-black/80 border-2 border-white/5 rounded-2xl py-5 px-6 text-white font-mono font-black text-2xl focus:border-cyan-500 focus:bg-cyan-500/5 focus:ring-8 focus:ring-cyan-500/10 outline-none transition-all shadow-2xl text-center placeholder:text-slate-800"
                                                        value={cantidadBulk}
                                                        onChange={e => setCantidadBulk(e.target.value)}
                                                    />
                                                </div>
                                                <div className="space-y-2.5">
                                                    <div className="flex justify-between items-center ml-2">
                                                        <label className="text-[10px] uppercase font-black text-blue-400/70 tracking-tighter">Monto c/u</label>
                                                        <span className="text-[8px] font-mono text-slate-600">UNIT_PAY</span>
                                                    </div>
                                                    <div className="relative">
                                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-400 font-black text-xl">$</div>
                                                        <input
                                                            type="number"
                                                            placeholder="0.00"
                                                            className="w-full bg-black/80 border-2 border-white/5 rounded-2xl py-5 pl-10 pr-6 text-white font-mono font-black text-2xl focus:border-blue-500 focus:bg-blue-500/5 focus:ring-8 focus:ring-blue-500/10 outline-none transition-all shadow-2xl text-center placeholder:text-slate-800"
                                                            value={montoBulk}
                                                            onChange={e => setMontoBulk(e.target.value)}
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={handleGuardarMasivo}
                                                disabled={loadingBulk || !cantidadBulk || !montoBulk}
                                                className="w-full relative group/btn pt-2"
                                            >
                                                {/* Efecto de carga inferior neón */}
                                                <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-2xl blur opacity-20 group-hover/btn:opacity-60 transition-opacity"></div>

                                                <div className="relative bg-slate-950 hover:bg-black text-white font-black py-5 rounded-2xl text-xs uppercase tracking-[0.3em] transition-all disabled:opacity-30 disabled:grayscale flex items-center justify-center gap-4 border border-white/10 group-active/btn:scale-95 overflow-hidden">
                                                    {/* Reflejo de cristal pasando */}
                                                    <div className="absolute top-0 -left-[100%] w-1/2 h-full bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-[45deg] animate-[shimmer_2s_infinite]"></div>

                                                    {loadingBulk ? (
                                                        <div className="flex items-center gap-2">
                                                            <RefreshCw size={18} className="animate-spin text-cyan-400" />
                                                            <span className="animate-pulse">PROCESANDO...</span>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <div className="bg-cyan-500/20 p-2 rounded-lg text-cyan-400">
                                                                <Save size={18} />
                                                            </div>
                                                            <span className="drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">INICIAR CARGA MASIVA</span>
                                                        </>
                                                    )}
                                                </div>
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <div className="relative group/monto pt-2">
                                    <div className="absolute -inset-1 bg-cyan-500/10 rounded-[2.2rem] blur-xl opacity-0 group-focus-within/monto:opacity-100 transition-opacity duration-500"></div>
                                    <div className="relative flex items-center bg-black/60 rounded-[2rem] border-2 border-white/5 group-focus-within/monto:border-cyan-500/40 transition-all overflow-hidden shadow-inner">
                                        <div className="absolute left-6 text-cyan-400 font-bold text-2xl drop-shadow-[0_0_8px_rgba(34,211,238,0.4)] z-10 transition-transform group-focus-within/monto:scale-125">$</div>
                                        <input
                                            type="number"
                                            step="any"
                                            required={!editingId}
                                            className="w-full bg-transparent py-10 pl-14 pr-6 text-white font-mono font-bold text-5xl text-center focus:ring-0 outline-none placeholder:text-slate-900"
                                            placeholder="0"
                                            value={monto}
                                            onChange={e => setMonto(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <button
                                    disabled={loading}
                                    className={`w-full font-bold py-6 rounded-2xl text-lg shadow-2xl active:scale-95 transition-all flex justify-center items-center gap-3 tracking-widest ${editingId
                                            ? 'bg-cyan-500 text-white shadow-cyan-500/20'
                                            : 'bg-white text-black hover:bg-cyan-400 hover:text-white shadow-white/5'
                                        }`}
                                >
                                    {loading ? (
                                        <>
                                            <RefreshCw size={20} className="animate-spin" />
                                            <span>PROCESANDO...</span>
                                        </>
                                    ) : (
                                        <>
                                            {editingId ? <RefreshCw size={20} /> : <DollarSign size={20} />}
                                            {editingId ? 'ACTUALIZAR' : 'REGISTRAR'}
                                        </>
                                    )}
                                </button>
                            </form>

                            {/* GESTIÓN DE LOTES */}
                            <div className="mt-8 pt-6 border-t border-white/5 space-y-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">Lotes del Día ({bando})</span>
                                    <div className="h-px flex-1 bg-gradient-to-r from-indigo-500/20 to-transparent ml-4"></div>
                                </div>

                                {batches.filter(b => b.bando === bando).length === 0 ? (
                                    <p className="text-[10px] text-slate-600 italic text-center py-2">No hay lotes registrados hoy con esta fecha.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {batches.filter(b => b.bando === bando).map((batch) => (
                                            <div key={batch.batch_id} className="bg-black/30 rounded-2xl p-4 border border-white/5 flex items-center justify-between hover:border-indigo-500/20 transition-all">
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] font-bold text-slate-500 uppercase">Lote de {batch.count} mesas</span>
                                                    {editingBatchId === batch.batch_id ? (
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className="text-indigo-400 font-bold">$</span>
                                                            <input
                                                                type="number"
                                                                className="w-20 bg-black/60 border border-indigo-500/30 rounded-lg px-2 py-1 text-white font-mono text-sm focus:outline-none"
                                                                value={newBatchAmount}
                                                                onChange={e => setNewBatchAmount(e.target.value)}
                                                                autoFocus
                                                            />
                                                        </div>
                                                    ) : (
                                                        <span className="text-white font-mono font-bold text-lg">${batch.amount.toLocaleString()} <span className="text-[8px] text-slate-600">c/u</span></span>
                                                    )}
                                                </div>

                                                <div className="flex gap-2">
                                                    {editingBatchId === batch.batch_id ? (
                                                        <>
                                                            <button
                                                                onClick={saveEditedBatch}
                                                                className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl border border-emerald-500/20 hover:bg-emerald-500/20 transition-all"
                                                                title="Aplicar a todo el lote"
                                                            >
                                                                <Save size={14} />
                                                            </button>
                                                            <button
                                                                onClick={() => setEditingBatchId(null)}
                                                                className="p-2 bg-white/5 text-slate-400 rounded-xl border border-white/10 hover:bg-white/10 transition-all"
                                                            >
                                                                <X size={14} />
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button
                                                                onClick={() => handleEditBatch(batch)}
                                                                className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20 hover:bg-indigo-500/20 transition-all"
                                                            >
                                                                <Edit2 size={14} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteBatch(batch.batch_id)}
                                                                className="p-2 bg-rose-500/10 text-rose-500 rounded-xl border border-rose-500/20 hover:bg-rose-500/20 transition-all"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* TOTALES DEL TURNO */}
                        <div className="bg-slate-900/60 backdrop-blur-xl rounded-[2rem] p-8 text-white shadow-2xl border border-white/10 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-[60px] -mr-10 -mt-10"></div>
                            <div className="relative z-10 grid grid-cols-2 gap-4">
                                <div className="text-[8px] uppercase font-black tracking-[0.2em] mb-1 text-slate-500">Apuesta Total</div>
                                <div className="text-xl font-mono font-black text-white tracking-tighter">${totalApuestas.toLocaleString()}</div>
                            </div>
                            <div className="bg-white/5 p-4 rounded-[1.5rem] border border-white/10 text-right">
                                <div className="text-[8px] uppercase font-black tracking-[0.2em] mb-1 text-pink-400/70">Registros</div>
                                <div className="text-xl font-mono font-black text-pink-400 drop-shadow-[0_0_8px_rgba(236,72,153,0.3)]">{registrosFiltrados.length}</div>
                            </div>
                            <div className="bg-emerald-500/10 p-4 rounded-[1.5rem] border border-emerald-500/20 col-span-2">
                                <div className="text-[8px] uppercase font-black tracking-[0.2em] mb-1 text-emerald-400 text-center">Ganancia Real (8%)</div>
                                <div className="text-xl font-mono font-black text-emerald-300 tracking-tighter text-center">${totalGananciaTurno.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                            </div>
                        </div>

                        {/* DETALLE DE APUESTAS */}
                        <div>
                            <h3 className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px] mb-4 ml-4 flex justify-between items-center opacity-80">
                                <span className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse"></div>
                                    DETALLE APUESTAS
                                </span>
                                <span className="bg-white/5 px-2.5 py-1 rounded-full border border-white/10 text-[9px] font-mono">{registrosFiltrados.length} REGS.</span>
                            </h3>
                            <div className="space-y-3 pb-4">
                                {registrosFiltrados.map((reg) => (
                                    <div key={reg.id} className="group bg-slate-900/40 backdrop-blur-md border border-white/5 p-4 flex justify-between items-center rounded-2xl hover:border-cyan-500/30 transition-all">
                                        <div className="flex items-center gap-4">
                                            <div className="bg-black/40 p-3 rounded-xl border border-white/5 text-cyan-400 group-hover:scale-110 transition-transform">
                                                <DollarSign size={18} />
                                            </div>
                                            <div>
                                                <div className="text-white font-bold font-mono text-xl tracking-tight">${reg.monto_apuesta}</div>
                                                <div className="text-slate-500 text-[10px] font-mono mt-0.5">{reg.hora_registro}</div>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => handleEdit(reg)} className="p-3 text-slate-400 hover:text-cyan-400 bg-white/5 rounded-xl border border-white/5 hover:border-cyan-500/20 active:scale-90 transition-all"><Edit2 size={14} /></button>
                                            <button onClick={() => handleDelete(reg.id)} className="p-3 text-slate-400 hover:text-rose-400 bg-white/5 rounded-xl border border-white/5 hover:border-rose-500/20 active:scale-90 transition-all"><Trash2 size={14} /></button>
                                        </div>
                                    </div>
                                ))}
                                {registrosFiltrados.length === 0 && (
                                    <div className="p-12 text-center bg-slate-900/20 rounded-[2rem] border border-white/5 border-dashed">
                                        <div className="text-slate-600 font-bold text-sm uppercase tracking-widest italic opacity-50">Sin transmisiones hoy</div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* HISTORIAL POR QUINCENAS */}
                        <div className="pb-28">
                            <h3 className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px] mb-4 ml-4 flex items-center gap-2 opacity-80">
                                <FileText size={14} className="text-indigo-400" /> HISTORIAL POR QUINCENAS
                            </h3>
                            <div className="space-y-6">
                                {Object.entries(historialDias).map(([monthKey, fortnights]: [string, any]) => (
                                    <div key={monthKey} className="space-y-3">
                                        <div className="text-indigo-400 font-black text-[11px] tracking-[0.3em] ml-4 pt-2 border-t border-white/5">{monthKey}</div>
                                        {Object.entries(fortnights).map(([qKey, data]: [string, any]) => (
                                            <div key={qKey} className="bg-slate-900/40 border border-white/5 rounded-2xl overflow-hidden shadow-xl">
                                                <div className="p-4 bg-white/5 flex justify-between items-center border-b border-white/5">
                                                    <span className="text-xs font-bold text-slate-300">{qKey}</span>
                                                    <span className="text-sm font-black text-white font-mono">${data.total.toFixed(2)}</span>
                                                </div>
                                                <div className="p-2 grid grid-cols-3 gap-2">
                                                    {data.days.sort().reverse().map((d: string) => (
                                                        <button key={d} onClick={() => { setFecha(d); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className={`py-2 rounded-lg text-[10px] font-bold border transition-all ${fecha === d ? 'bg-cyan-500 text-white border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.3)]' : 'bg-black/20 text-slate-500 border-white/5 hover:border-white/10'}`}>
                                                            DÍA {d.split('-')[2]}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                                {Object.keys(historialDias).length === 0 && (
                                    <div className="p-8 text-center text-slate-600 text-xs italic">No hay historial disponible</div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {view === 'nomina' && (
                    <div className="space-y-6 animate-in slide-in-from-right duration-500 relative z-10">
                        <div className="flex justify-between items-center mb-2 px-2">
                            <h2 className="text-white font-bold text-lg flex items-center gap-3">
                                <div className="p-2 bg-indigo-500/20 rounded-lg border border-indigo-500/30 text-indigo-400">
                                    <Calendar size={20} />
                                </div>
                                <span className="tracking-tight capitalize">Mi Nómina</span>
                            </h2>
                            <button onClick={loadPayrollData} className="p-3 bg-slate-900/60 text-indigo-400 rounded-full border border-white/10 hover:bg-indigo-500/20 hover:text-white transition-all active:rotate-180 duration-500" title="Recargar"><RefreshCw size={18} className={loadingPayroll ? 'animate-spin' : ''} /></button>
                        </div>

                        {/* CONTROLES DE QUINCENA */}
                        <div className="flex bg-slate-950/60 backdrop-blur-xl p-1.5 rounded-2xl border border-white/10 shadow-2xl">
                            <button onClick={() => setCurrentFortnight(1)} className={`flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${currentFortnight === 1 ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(79,70,229,0.4)]' : 'text-slate-500 hover:text-slate-300'}`}>01 - 15 ENE</button>
                            <button onClick={() => setCurrentFortnight(2)} className={`flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${currentFortnight === 2 ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(79,70,229,0.4)]' : 'text-slate-500 hover:text-slate-300'}`}>16 - 31 ENE</button>
                        </div>

                        {matchedEmployee ? (
                            <div className="space-y-6 font-sans">
                                <div className="bg-slate-900/40 backdrop-blur-2xl rounded-[2rem] overflow-hidden border border-white/10 shadow-2xl">
                                    <div className="p-5 bg-white/5 border-b border-white/5 flex justify-between items-center tracking-tight">
                                        <span className="font-bold text-white uppercase text-xs tracking-[0.1em]">{matchedEmployee.name}</span>
                                        <span className={`text-[9px] px-2.5 py-1 rounded-full uppercase font-bold tracking-widest border shadow-lg ${matchedEmployee.status === 'Activo' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border-rose-500/30'}`}>{matchedEmployee.status}</span>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left border-collapse">
                                            <thead className="bg-black/20 text-slate-500 text-[9px] uppercase font-bold tracking-[0.2em]">
                                                <tr>
                                                    <th className="p-4 text-center">Día</th>
                                                    <th className="p-4 text-center">Horas</th>
                                                    <th className="p-4 text-center">Subtotal</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5">
                                                {daysRange.map(day => {
                                                    const val = getShiftValue(matchedEmployee.id, day);
                                                    if (!val || val === '.') return null;

                                                    let displayVal = val;
                                                    let rowClass = "text-slate-300";

                                                    if (val === 'F') {
                                                        displayVal = 'FALTA';
                                                        rowClass = "text-rose-500 font-bold";
                                                    } else if (val === 'L') {
                                                        displayVal = 'LIBRE';
                                                        rowClass = "text-indigo-400 font-bold";
                                                    } else if (val === 'A') {
                                                        displayVal = 'AUSENTE';
                                                        rowClass = "text-yellow-500 font-bold";
                                                    } else {
                                                        displayVal = val + ' HRS';
                                                        rowClass = "font-bold text-cyan-100 group-hover:text-cyan-400";
                                                    }

                                                    const empRate = matchedEmployee.pago || 9.6;
                                                    // Usar directamente 'val' que ya es un string gracias a getShiftValue
                                                    const cleanHours = !['F', 'L', 'A'].includes(val) ? parseHours(val) : 0;
                                                    const dailyPay = (cleanHours / 9) * empRate;

                                                    return (
                                                        <tr key={day} className="group hover:bg-white/5 transition-colors">
                                                            <td className="p-4 text-center font-mono text-slate-500 text-[10px]">{day}</td>
                                                            <td className={`p-4 text-center ${rowClass} transition-colors`}>{displayVal}</td>
                                                            <td className="p-4 text-center font-mono text-cyan-400 font-bold text-xs ring-inset">
                                                                {dailyPay > 0 ? `$${dailyPay.toFixed(2)}` : '-'}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                            <tfoot className="bg-black/40 font-bold border-t border-white/10 backdrop-blur-md">
                                                <tr>
                                                    <td className="p-5 text-center uppercase text-[9px] text-slate-500 tracking-[0.2em]">Resumen</td>
                                                    <td className="p-5 text-center text-indigo-400 font-mono italic">{totalHours} HRS</td>
                                                    <td className="p-5 text-center text-cyan-400 font-mono text-lg tracking-tighter drop-shadow-[0_0_8px_rgba(34,211,238,0.3)]">${totalPay.toFixed(2)}</td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                    {payrollData.meta && (
                                        <div className="p-3 text-center text-[8px] text-slate-700 bg-black/60 border-t border-white/5 uppercase tracking-[0.2em] font-medium">
                                            Sync: {new Date(payrollData.meta.timestamp).toLocaleTimeString()} • {new Date(payrollData.meta.timestamp).toLocaleDateString()}
                                        </div>
                                    )}
                                </div>
                                <div className="bg-slate-900/60 backdrop-blur-2xl rounded-[2rem] p-8 shadow-2xl border border-white/10 relative overflow-hidden animate-in slide-in-from-bottom duration-700 delay-200">
                                    <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/10 rounded-full blur-[80px] -mr-10 -mt-10"></div>
                                    <h3 className="text-white font-bold text-base mb-6 flex items-center gap-3 relative z-10">
                                        <div className="p-2 bg-yellow-400/10 rounded-lg border border-yellow-400/30 text-yellow-400">
                                            <FileText size={18} />
                                        </div>
                                        <span className="tracking-tight uppercase text-xs font-bold tracking-[0.1em]">Comprobante Oficial</span>
                                    </h3>
                                    {comprobanteUrl ? (
                                        <div className="space-y-4 relative z-10 font-sans">
                                            <div className="bg-black/40 rounded-2xl p-5 border border-white/5 shadow-inner">
                                                <p className="text-slate-500 text-[10px] mb-4 leading-relaxed font-bold uppercase tracking-wider">Tu liquidación ha sido procesada:</p>
                                                <a href={comprobanteUrl} target="_blank" rel="noreferrer" className="block w-full bg-white text-black hover:bg-cyan-400 hover:text-white font-bold py-4 rounded-xl text-center text-xs transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] active:scale-95 flex items-center justify-center gap-3 transform hover:-translate-y-1">
                                                    <FileText size={18} /> DESCARGAR RECIBO PDF
                                                </a>
                                            </div>
                                            <p className="text-[9px] text-slate-700 text-center uppercase tracking-[0.4em] font-black opacity-40">Blockchain Verified</p>
                                        </div>
                                    ) : (
                                        <div className="bg-black/40 rounded-2xl p-10 border border-white/5 border-dashed text-center relative z-10 group hover:border-white/20 transition-colors">
                                            <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/5 shadow-inner">
                                                <FileText size={20} className="text-slate-800" />
                                            </div>
                                            <p className="text-slate-600 text-[10px] font-bold uppercase tracking-widest italic opacity-60">Pago en proceso</p>
                                            <p className="text-[10px] text-slate-700 mt-3 leading-relaxed font-medium">El comprobante aparecerá aquí <br />al confirmar la transferencia.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] p-10 text-center border border-white/10 border-dashed animate-pulse">
                                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/5">
                                    <RefreshCw className="text-slate-700 animate-spin-slow" size={32} />
                                </div>
                                <div className="text-slate-400 text-sm font-bold uppercase tracking-widest mb-2">Sincronizando...</div>
                                <p className="text-xs text-slate-600 leading-relaxed font-medium">No se encontraron datos vinculados.<br />Nombre de usuario: <span className="text-cyan-400">"{user.name}"</span></p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* NAV BAR */}
            <div className="fixed bottom-0 left-0 w-full bg-black/80 backdrop-blur-2xl border-t border-white/10 p-3 flex justify-around items-center z-40 rounded-t-[30px] shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
                <button onClick={() => setView('registro')} className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-all w-24 relative ${view === 'registro' ? 'text-cyan-400' : 'text-slate-600'}`}>
                    {view === 'registro' && <div className="absolute inset-0 bg-cyan-500/10 rounded-2xl border border-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.15)] animate-in fade-in zoom-in-95 duration-300"></div>}
                    <Save size={24} className={`relative z-10 transition-transform ${view === 'registro' ? 'scale-110 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]' : ''}`} />
                    <span className="text-[10px] font-bold uppercase tracking-widest relative z-10">Registro</span>
                </button>
                <div className="w-[1px] h-8 bg-white/5"></div>
                <button onClick={() => setView('nomina')} className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-all w-24 relative ${view === 'nomina' ? 'text-indigo-400' : 'text-slate-600'}`}>
                    {view === 'nomina' && <div className="absolute inset-0 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 shadow-[0_0_15px_rgba(79,70,229,0.15)] animate-in fade-in zoom-in-95 duration-300"></div>}
                    <FileText size={24} className={`relative z-10 transition-transform ${view === 'nomina' ? 'scale-110 drop-shadow-[0_0_8px_rgba(129,140,248,0.5)]' : ''}`} />
                    <span className="text-[10px] font-bold uppercase tracking-widest relative z-10">Nómina</span>
                </button>
                <div className="w-[1px] h-8 bg-white/5"></div>
                <button onClick={onNavigateToRestriccion} className="flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-all w-24 relative text-rose-500/80 hover:text-rose-500">
                    <ShieldAlert size={24} className="animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Bloqueos</span>
                </button>
            </div>
        </div>
    );
};

export default MobileOperative;
