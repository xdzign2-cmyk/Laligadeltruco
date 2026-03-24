import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import {
    Activity, Calendar, TrendingUp,
    ChevronLeft, ChevronRight,
    LogOut, LayoutDashboard,
    Plus, Trash2, X, History, Edit3, PieChart, BarChart3
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, BarChart, Bar
} from 'recharts';

interface PublicityProps {
    user: { email: string; role: string; name: string };
    onLogout: () => void;
    onBack?: () => void;
    readOnly?: boolean;
    usdtRate?: number;
    initialGroup?: 'Barco' | 'Cueva';
}

const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const PublicityDashboard: React.FC<PublicityProps> = ({ user, onLogout, onBack, readOnly = false, usdtRate = 1, initialGroup = 'Barco' }) => {
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [publicityData, setPublicityData] = useState<any[]>([]);
    const [detailedLogs, setDetailedLogs] = useState<any[]>([]);
    const [_loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedDay, setSelectedDay] = useState<string | null>(null);
    const [hourlyDetailDay, setHourlyDetailDay] = useState<string | null>(null);
    const [comparisonData, setComparisonData] = useState<any[]>([]);
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [showAudit, setShowAudit] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState<'Barco' | 'Cueva'>(initialGroup || 'Barco');
    const [chartRange, setChartRange] = useState<'all' | '1-15' | '16-31'>('all');

    // Form state for new entry
    const [newEntry, setNewEntry] = useState({
        id: null as number | null,
        monto: '',
        hora: new Date().getHours(),
        nota: ''
    });

    const [stats, setStats] = useState({
        monthlyTotal: 0,
        activeDays: 0,
        productivity: 0
    });

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(val);
    };

    const formatUSD = (val: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
    };

    const calculateStats = (data: any[]) => {
        let monthly = 0;
        let activeCount = 0;

        data.forEach(d => {
            if (d.is_active) {
                monthly += d.costo;
                activeCount++;
            }
        });

        setStats({
            monthlyTotal: monthly,
            activeDays: activeCount,
            productivity: Math.round((activeCount / (data.length || 1)) * 100)
        });
    };

    const fetchAuditLogs = async () => {
        const { data } = await supabase.from('publicidad_audit').select('*').order('created_at', { ascending: false }).limit(20);
        if (data) setAuditLogs(data);
    };

    const fetchMonthlyComparison = async () => {
        const monthsFetched = [];
        for (let i = 2; i >= 0; i--) {
            let m = selectedMonth - i;
            let y = selectedYear;
            if (m < 0) { m += 12; y--; }

            const start = new Date(y, m, 1).toISOString().split('T')[0];
            const end = new Date(y, m + 1, 0).toISOString().split('T')[0];

            const { data } = await supabase.from('publicidad_detallada')
                .select('monto')
                .eq('grupo', selectedGroup)
                .gte('fecha', start)
                .lte('fecha', end);
            const total = (data || []).reduce((acc: number, curr: any) => acc + Number(curr.monto), 0);
            monthsFetched.push({
                name: monthNames[m].substring(0, 3).toUpperCase(),
                total: total,
                fullMonth: monthNames[m]
            });
        }
        setComparisonData(monthsFetched);
    };

    const fetchPublicity = async () => {
        setLoading(true);
        const startDate = new Date(selectedYear, selectedMonth, 1).toISOString().split('T')[0];
        const endDate = new Date(selectedYear, selectedMonth + 1, 0).toISOString().split('T')[0];

        const { data, error } = await supabase
            .from('publicidad_detallada')
            .select('*')
            .eq('grupo', selectedGroup)
            .gte('fecha', startDate)
            .lte('fecha', endDate)
            .order('fecha', { ascending: true })
            .order('hora', { ascending: true });

        if (!error && data) {
            setDetailedLogs(data);

            const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
            const fullMonthData = Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1;
                const dateKey = `${selectedYear}-${(selectedMonth + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                const dayEntries = data.filter(d => d.fecha === dateKey);
                const totalMonto = dayEntries.reduce((acc, curr) => acc + Number(curr.monto), 0);

                return {
                    fecha: dateKey,
                    dia: day,
                    is_active: dayEntries.length > 0,
                    costo: totalMonto,
                    entries: dayEntries
                };
            });

            setPublicityData(fullMonthData);
            calculateStats(fullMonthData);
        }
        setLoading(false);
    };

    const getFilteredChartData = () => {
        if (chartRange === '1-15') return publicityData.slice(0, 15);
        if (chartRange === '16-31') return publicityData.slice(15);
        return publicityData;
    };

    const logAction = async (action: string, date: string, previousValue: number | null, newValue: number | null, details: any = {}) => {
        await supabase.from('publicidad_audit').insert({
            fecha_registro: date,
            accion: action,
            monto_anterior: previousValue,
            monto_nuevo: newValue,
            usuario: user.name,
            grupo: selectedGroup,
            detalles: details
        });
    };

    const handleSaveEntry = async () => {
        if (!selectedDay || !newEntry.monto) return;

        if (newEntry.id) {
            // EDIT
            const oldVal = detailedLogs.find(l => l.id === newEntry.id)?.monto;
            const { error } = await supabase
                .from('publicidad_detallada')
                .update({
                    hora: parseInt(newEntry.hora.toString()),
                    monto: parseFloat(newEntry.monto),
                    nota: newEntry.nota
                })
                .eq('id', newEntry.id);
            if (!error) await logAction('UPDATE', selectedDay, oldVal, parseFloat(newEntry.monto), { entry_id: newEntry.id, nota: newEntry.nota });
            else alert(error.message);
        } else {
            // INSERT
            const { error } = await supabase
                .from('publicidad_detallada')
                .insert({
                    fecha: selectedDay,
                    hora: parseInt(newEntry.hora.toString()),
                    monto: parseFloat(newEntry.monto),
                    nota: newEntry.nota,
                    grupo: selectedGroup,
                    created_by: user.name
                });
            if (!error) await logAction('INSERT', selectedDay, null, parseFloat(newEntry.monto), { nota: newEntry.nota });
            else alert(error.message);
        }

        setIsModalOpen(false);
        setNewEntry({ id: null, monto: '', hora: new Date().getHours(), nota: '' });
    };

    const handleDeleteEntry = async (id: number) => {
        if (!confirm('¿Eliminar este registro?')) return;
        const oldLog = detailedLogs.find(l => l.id === id);
        const { error } = await supabase.from('publicidad_detallada').delete().eq('id', id);
        if (!error && oldLog) await logAction('DELETE', oldLog.fecha, oldLog.monto, null, { entry_id: id, nota: oldLog.nota });
        else if (error) alert(error.message);
    };

    const handleDeleteFullDay = async (date: string) => {
        if (!confirm(`¿Estás seguro de ELIMINAR TODOS los registros del día ${date} para el grupo ${selectedGroup}?`)) return;
        const dayTotal = publicityData.find(d => d.fecha === date)?.costo || 0;
        const { error } = await supabase.from('publicidad_detallada').delete().eq('fecha', date).eq('grupo', selectedGroup);
        if (!error) {
            await logAction('DELETE_FULL_DAY', date, dayTotal, 0, { deleted_count: 'all' });
            setHourlyDetailDay(null);
        } else alert(error.message);
    };

    useEffect(() => {
        fetchPublicity();
        fetchMonthlyComparison();
        fetchAuditLogs();

        const channel = supabase
            .channel('publicity_detailed_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'publicidad_detallada' }, () => {
                fetchPublicity();
                fetchMonthlyComparison();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'publicidad_audit' }, () => {
                fetchAuditLogs();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [selectedMonth, selectedYear, selectedGroup]);


    return (
        <div className="min-h-screen bg-[#050505] text-slate-300 font-sans selection:bg-emerald-500/30 overflow-x-hidden pb-20">

            <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-emerald-600/10 rounded-full blur-[120px] animate-pulse"></div>
                <div className="absolute bottom-[20%] left-[-5%] w-[400px] h-[400px] bg-emerald-900/15 rounded-full blur-[100px] animate-pulse delay-1000"></div>
            </div>

            <header className="relative z-20 border-b border-white/5 bg-black/60 backdrop-blur-2xl px-4 py-8 md:px-8 md:py-6 flex flex-col md:flex-row justify-between items-center gap-8 shadow-2xl">
                {/* LOGO SECTION */}
                <div className="flex flex-col items-center md:items-start group">
                    <img src="/logo-green.png" alt="FMX Logo" className="h-28 md:h-36 w-auto drop-shadow-[0_0_25px_rgba(16,185,129,0.5)] transition-all duration-500 cursor-pointer hover:scale-105" />
                </div>

                {/* SELECTOR & STATUS SECTION */}
                <div className="flex flex-col items-center gap-3">
                    <div className="flex items-center gap-1 bg-black/40 p-1 rounded-2xl border border-white/5 w-full max-w-[340px] md:max-w-none md:w-auto shadow-inner">
                        <button
                            onClick={() => setSelectedGroup('Barco')}
                            className={`flex-1 md:flex-none px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all duration-300 whitespace-nowrap ${selectedGroup === 'Barco' ? 'bg-emerald-500 text-black shadow-[0_0_20px_rgba(16,185,129,0.4)]' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                        >
                            El Barco
                        </button>
                        <button
                            onClick={() => setSelectedGroup('Cueva')}
                            className={`flex-1 md:flex-none px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all duration-300 whitespace-nowrap ${selectedGroup === 'Cueva' ? 'bg-emerald-500 text-black shadow-[0_0_20px_rgba(16,185,129,0.4)]' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                        >
                            La Cueva
                        </button>
                    </div>

                    {/* MINI STATUS */}
                    <div className="flex items-center gap-4 opacity-60">
                        <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
                            <span className="text-[8px] text-emerald-400 font-black uppercase tracking-[0.2em] leading-none">Online</span>
                        </div>
                        <div className="w-px h-2 bg-white/10"></div>
                        <span className="text-[8px] text-slate-500 font-bold uppercase tracking-[0.2em] leading-none">FMX CORE V2</span>
                    </div>
                </div>

                {/* ACTIONS - POS ABS ON MOBILE TOP, NORMAL ON DESKTOP */}
                <div className="absolute top-6 right-4 md:static flex items-center gap-2">
                    {onBack && <button onClick={onBack} className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 text-slate-400 transition-all flex items-center gap-2 group" title="Panel de Control">
                        <LayoutDashboard size={20} className="group-hover:text-emerald-400 transition-colors" />
                        <span className="text-xs font-bold uppercase hidden lg:block">Panel</span>
                    </button>}
                    <button onClick={onLogout} className="p-3 bg-rose-500/10 hover:bg-rose-500/20 rounded-2xl border border-rose-500/20 text-rose-400 transition-all" title="Cerrar Sesión">
                        <LogOut size={20} />
                    </button>
                </div>
            </header>

            <main className="relative z-10 p-6 max-w-[1400px] mx-auto space-y-6">
                {/* TOP STATS */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-slate-900/40 backdrop-blur-xl border border-white/5 p-5 rounded-3xl group transition-all">
                        <div className="flex justify-between items-center mb-2">
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Inversión Mensual</p>
                            <span className="text-[10px] bg-emerald-500 text-black px-2 py-0.5 rounded-full font-black">ARS</span>
                        </div>
                        <h3 className="text-3xl font-mono font-black text-white group-hover:text-emerald-400 transition-colors tracking-tighter">{formatCurrency(stats.monthlyTotal)}</h3>
                        <div className="mt-1 text-[11px] font-mono text-emerald-500/60 font-black">≈ {formatUSD(stats.monthlyTotal / (usdtRate || 1))}</div>
                    </div>
                    <div className="bg-slate-900/40 backdrop-blur-xl border border-white/5 p-5 rounded-3xl">
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Días Logrados</p>
                        <h3 className="text-2xl font-mono font-black text-white">{stats.activeDays} <span className="text-slate-600 text-sm">/ {publicityData.length}</span></h3>
                        <div className="mt-2 h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500" style={{ width: `${(stats.activeDays / (publicityData.length || 1)) * 100}%` }}></div>
                        </div>
                    </div>
                    <div className="bg-slate-900/40 backdrop-blur-xl border border-white/5 p-5 rounded-3xl relative overflow-hidden group">
                        <div className="absolute top-[-20%] right-[-20%] w-20 h-20 bg-emerald-500/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Productividad (%)</p>
                        <h3 className="text-4xl font-mono font-black text-emerald-400 tracking-tighter">{stats.productivity}%</h3>
                        <p className="text-[8px] text-slate-600 font-bold uppercase mt-1">Status Actual del Mes</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <button onClick={() => setShowAudit(!showAudit)} className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl text-[10px] font-black uppercase text-slate-300 transition-all">
                            <History size={14} className="text-emerald-500" /> Ver Historial
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* CALENDARIO */}
                    <div className="lg:col-span-2 bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-[2rem] md:rounded-[2.5rem] p-4 md:p-8 shadow-2xl relative">
                        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 md:gap-6 mb-6 md:mb-10">
                            <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                                <Calendar className="text-emerald-500" /> {monthNames[selectedMonth]} {selectedYear}
                            </h2>
                            <div className="flex items-center gap-1 md:gap-2 bg-black/40 p-1 md:p-1.5 rounded-2xl border border-white/5">
                                <button onClick={() => { if (selectedMonth === 0) { setSelectedMonth(11); setSelectedYear(y => y - 1); } else setSelectedMonth(m => m - 1); }} className="p-1.5 md:p-2 hover:bg-white/5 rounded-xl transition-all"><ChevronLeft size={18} /></button>
                                <button onClick={() => { setSelectedMonth(new Date().getMonth()); setSelectedYear(new Date().getFullYear()); }} className="px-3 md:px-4 py-1.5 md:py-2 text-[9px] md:text-[10px] font-black uppercase text-emerald-500">Hoy</button>
                                <button onClick={() => { if (selectedMonth === 11) { setSelectedMonth(0); setSelectedYear(y => y + 1); } else setSelectedMonth(m => m + 1); }} className="p-1.5 md:p-2 hover:bg-white/5 rounded-xl transition-all"><ChevronRight size={18} /></button>
                            </div>
                        </div>

                        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-7 lg:grid-cols-10 gap-2 md:gap-3">
                            {publicityData.map((d) => (
                                <div key={d.dia} className="relative group">
                                    <button
                                        onClick={() => { if (!readOnly) { setSelectedDay(d.fecha); setIsModalOpen(true); } else { setHourlyDetailDay(d.fecha); } }}
                                        className={`w-full aspect-square rounded-2xl border transition-all duration-300 flex flex-col items-center justify-center gap-0.5
                                                ${d.is_active
                                                ? 'bg-emerald-500 text-black border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                                                : 'bg-slate-950/40 border-slate-800 text-slate-500 hover:border-slate-500'}`}
                                    >
                                        <span className="text-[8px] font-black uppercase opacity-60">D{d.dia}</span>
                                        <span className="text-sm font-mono font-black">{d.is_active ? formatCurrency(d.costo).split(',')[0].replace('$', '') : '.'}</span>
                                    </button>
                                    {d.is_active && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setHourlyDetailDay(d.fecha === hourlyDetailDay ? null : d.fecha); }}
                                            className="absolute -top-1 -right-1 p-1 bg-black/80 border border-white/10 rounded-full text-emerald-500 hover:text-white transition-colors shadow-lg z-10"
                                        >
                                            <History size={10} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* PANEL DE DETALLE DIARIO */}
                    <div className="space-y-6">
                        {hourlyDetailDay ? (
                            <div className="bg-slate-900 border border-emerald-500/20 rounded-[2.5rem] p-8 shadow-2xl animate-in slide-in-from-right duration-300">
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <h3 className="text-xl font-black text-white uppercase tracking-tighter">{hourlyDetailDay}</h3>
                                        <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest mt-1">Registros del día</p>
                                    </div>
                                    <div className="flex gap-2">
                                        {!readOnly && <button onClick={() => handleDeleteFullDay(hourlyDetailDay)} className="p-2 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white rounded-xl transition-all border border-rose-500/20" title="Borrar Día Complet"><Trash2 size={16} /></button>}
                                        <button onClick={() => setHourlyDetailDay(null)} className="p-2 bg-white/5 text-slate-500 hover:text-white rounded-xl border border-white/10"><X size={16} /></button>
                                    </div>
                                </div>

                                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-emerald-900/50">
                                    {publicityData.find(d => d.fecha === hourlyDetailDay)?.entries.map((log: any) => (
                                        <div key={log.id} className="bg-black/40 border border-white/5 p-4 rounded-2xl group hover:border-emerald-500/20 transition-all">
                                            <div className="flex justify-between items-start">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xs font-mono font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">{log.hora}h</span>
                                                    <span className="text-lg font-mono font-black text-white">{formatCurrency(log.monto)}</span>
                                                </div>
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {!readOnly && (
                                                        <>
                                                            <button onClick={() => { setSelectedDay(log.fecha); setNewEntry({ id: log.id, monto: log.monto.toString(), hora: log.hora, nota: log.nota }); setIsModalOpen(true); }} className="p-1.5 text-blue-400 hover:bg-blue-500/10 rounded-lg"><Edit3 size={14} /></button>
                                                            <button onClick={() => handleDeleteEntry(log.id)} className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg"><Trash2 size={14} /></button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            <p className="text-[9px] text-slate-500 mt-2 italic">“{log.nota || 'Sin nota'}”</p>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-8 h-32 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={Array.from({ length: 24 }, (_, i) => ({ hora: `${i}h`, monto: publicityData.find(d => d.fecha === hourlyDetailDay)?.entries.filter((e: any) => e.hora === i).reduce((a: any, c: any) => a + Number(c.monto), 0) }))}>
                                            <Bar dataKey="monto" fill="#10b981" radius={[4, 4, 0, 0]} />
                                            <XAxis hide />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-slate-900/40 border border-white/5 rounded-[2.5rem] p-8 shadow-2xl flex flex-col items-center justify-center text-center">
                                <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center text-slate-600 mb-4 animate-pulse"><PieChart size={32} /></div>
                                <h3 className="text-white font-black text-xs uppercase tracking-widest">Selecciona un día</h3>
                                <p className="text-slate-500 text-[10px] mt-2 leading-relaxed">Haz clic en el icono de historial para ver el desglose horario, editar o borrar registros por cada jornada.</p>
                            </div>
                        )}

                        <div className="bg-gradient-to-br from-emerald-600/20 to-emerald-900/20 border border-emerald-500/20 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
                            <TrendingUp className="text-emerald-500/20 absolute -bottom-4 -right-4 w-24 h-24" />
                            <h4 className="text-white font-black text-[10px] uppercase tracking-[0.2em] mb-4">Métrica de Rendimiento</h4>
                            <div className="text-5xl font-mono font-black text-white">{stats.productivity}<span className="text-emerald-500 text-2xl">%</span></div>
                            <p className="text-[9px] text-emerald-500/60 font-bold uppercase mt-2 tracking-widest">Consistencia Diaria</p>
                        </div>
                    </div>
                </div>

                {/* GRÁFICO DIARIO GRANDE */}
                <div className="bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-6 lg:p-10 shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-10 opacity-[0.03] text-emerald-500 pointer-events-none"><Activity size={200} /></div>

                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 mb-10">
                        <div>
                            <h3 className="text-xl md:text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-4">
                                <BarChart3 className="text-emerald-500" /> FLUJO DE INVERSIÓN DIARIA - {monthNames[selectedMonth].toUpperCase()}
                            </h3>
                            <p className="text-[10px] md:text-xs text-slate-500 font-bold uppercase tracking-widest mt-2">Visualización consolidada de micro-gastos por cada 24 horas</p>
                        </div>

                        {/* CHART RANGE SELECTOR */}
                        <div className="flex items-center gap-1 bg-black/40 p-1 rounded-2xl border border-white/5 w-full lg:w-auto">
                            <button
                                onClick={() => setChartRange('1-15')}
                                className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all flex-1 lg:flex-none ${chartRange === '1-15' ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20' : 'text-slate-500 hover:text-white'}`}
                            >
                                Días 1-15
                            </button>
                            <button
                                onClick={() => setChartRange('16-31')}
                                className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all flex-1 lg:flex-none ${chartRange === '16-31' ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20' : 'text-slate-500 hover:text-white'}`}
                            >
                                Días 16-Fin
                            </button>
                            <button
                                onClick={() => setChartRange('all')}
                                className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all flex-1 lg:flex-none ${chartRange === 'all' ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20' : 'text-slate-500 hover:text-white'}`}
                            >
                                Mes Completo
                            </button>
                        </div>
                    </div>

                    <div className="h-[300px] md:h-[450px] w-full bg-black/40 rounded-[2.5rem] p-4 md:p-10 border border-white/5 shadow-2xl relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/[0.02] to-transparent pointer-events-none"></div>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={getFilteredChartData()} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorFMX" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.5} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                <XAxis
                                    dataKey="dia"
                                    stroke="#475569"
                                    fontSize={10}
                                    tickLine={false}
                                    axisLine={false}
                                    tick={{ fontWeight: '800' }}
                                    interval={chartRange === 'all' ? (typeof window !== 'undefined' && window.innerWidth < 768 ? 4 : 2) : 0}
                                />
                                <YAxis
                                    stroke="#475569"
                                    fontSize={10}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(v) => `$${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`}
                                    tick={{ fontWeight: '800' }}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'rgba(0,0,0,0.9)',
                                        backdropFilter: 'blur(10px)',
                                        border: '1px solid rgba(16,185,129,0.2)',
                                        borderRadius: '16px',
                                        fontSize: '11px',
                                        fontWeight: '800',
                                        boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                                        color: '#fff'
                                    }}
                                    itemStyle={{ color: '#10b981' }}
                                    formatter={(v: any) => [formatCurrency(v), 'Gasto']}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="costo"
                                    stroke="#10b981"
                                    strokeWidth={4}
                                    fill="url(#colorFMX)"
                                    animationDuration={2000}
                                    activeDot={{ r: 6, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* CHART COMPARATIVO DE MESES */}
                        <div className="bg-black/40 border border-white/5 p-8 rounded-[2.5rem] relative overflow-hidden group">
                            <div className="flex justify-between items-end mb-8">
                                <div>
                                    <h4 className="text-white font-black text-xs uppercase tracking-widest mb-1 flex items-center gap-2"><TrendingUp size={14} className="text-emerald-500" /> Comparativa Trimestral</h4>
                                    <p className="text-[9px] text-slate-500 font-bold uppercase italic">Variación de inversión vs meses previos</p>
                                </div>
                                <div className="text-right">
                                    <div className="text-lg font-mono font-black text-emerald-400">
                                        {comparisonData.length > 1 && stats.monthlyTotal > (comparisonData[comparisonData.length - 2]?.total || 0) ? '+' : ''}
                                        {comparisonData.length > 1 ? Math.round(((stats.monthlyTotal - (comparisonData[comparisonData.length - 2]?.total || 1)) / (comparisonData[comparisonData.length - 2]?.total || 1)) * 100) : 0}%
                                    </div>
                                    <div className="text-[8px] text-slate-500 font-bold uppercase">vs Mes Anterior</div>
                                </div>
                            </div>
                            <div className="h-[200px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={comparisonData}>
                                        <XAxis dataKey="name" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                                        <YAxis hide />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#000', border: '1px solid #10b98133', borderRadius: '15px', fontSize: '10px' }}
                                            formatter={(v: any) => [`$${v}`, 'Inversión']}
                                        />
                                        <Bar dataKey="total" fill="#10b981" radius={[10, 10, 0, 0]} animationDuration={2000}>
                                            {comparisonData.map((_entry, index) => (
                                                <Bar key={`cell-${index}`} fill={index === comparisonData.length - 1 ? '#10b981' : '#ffffff10'} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-black/40 border border-white/5 p-6 rounded-3xl hover:border-emerald-500/30 transition-all flex flex-col justify-center">
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Día más alto</p>
                                <div className="text-xl font-mono font-black text-white">{formatCurrency(Math.max(...publicityData.map(d => d.costo), 0))}</div>
                            </div>
                            <div className="bg-black/40 border border-white/5 p-6 rounded-3xl hover:border-emerald-500/30 transition-all flex flex-col justify-center">
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Promedio Diario</p>
                                <div className="text-xl font-mono font-black text-white">{formatCurrency(stats.monthlyTotal / (stats.activeDays || 1))}</div>
                            </div>
                            <div className="bg-black/40 border border-white/5 p-6 rounded-3xl hover:border-emerald-500/30 transition-all flex flex-col justify-center">
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Dias Inactivos</p>
                                <div className="text-xl font-mono font-black text-rose-500">{publicityData.length - stats.activeDays}</div>
                            </div>
                            <div className="bg-black/40 border border-white/5 p-6 rounded-3xl hover:border-emerald-500/30 transition-all flex flex-col justify-center">
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Productividad</p>
                                <div className="text-xl font-mono font-black text-emerald-400">{stats.productivity}%</div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* FOOTER */}
            <footer className="mt-20 py-10 border-t border-white/5 text-center opacity-30">
                <p className="text-[11px] font-mono tracking-[0.4em] text-slate-500">FMX PUBLISH • REAL-TIME AUDIT CORE • {new Date().getFullYear()}</p>
            </footer>

            {/* MODAL PARA NUEVO / EDITAR REGISTRO */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-white/10 p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-transparent"></div>
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-xl font-black text-white uppercase tracking-tighter">{newEntry.id ? 'Editar Gasto' : 'Nuevo Gasto'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-white p-2 hover:bg-white/5 rounded-full transition-all"><X size={24} /></button>
                        </div>
                        <div className="space-y-6">
                            <div className="bg-black/40 border border-white/5 p-4 rounded-2xl">
                                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block mb-2">Fecha del Proceso</label>
                                <div className="text-emerald-400 font-mono font-black text-center text-lg">{selectedDay}</div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block mb-1">Monto (ARS)</label>
                                    <input type="number" value={newEntry.monto} onChange={e => setNewEntry({ ...newEntry, monto: e.target.value })} className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-white font-mono font-bold focus:border-emerald-500 outline-none transition-all" placeholder="0.00" />
                                </div>
                                <div>
                                    <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block mb-1">Hora (H)</label>
                                    <input type="number" min="0" max="23" value={newEntry.hora} onChange={e => setNewEntry({ ...newEntry, hora: parseInt(e.target.value) })} className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-white font-mono font-bold focus:border-emerald-500 outline-none transition-all" />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block mb-1">Descripción / Nota</label>
                                <textarea value={newEntry.nota} onChange={e => setNewEntry({ ...newEntry, nota: e.target.value })} className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-white text-xs min-h-[80px] focus:border-emerald-500 outline-none transition-all resize-none" placeholder="Recarga, Ajuste de Campaña, etc..." />
                            </div>
                            <button onClick={handleSaveEntry} className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-2">
                                <Plus size={18} /> {newEntry.id ? 'Guardar Cambios' : 'Confirmar Gasto'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* PANEL LATERAL DE HISTORIAL */}
            {showAudit && (
                <div className="fixed inset-0 z-[110] flex justify-end animate-in fade-in duration-300">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAudit(false)}></div>
                    <div className="relative w-full max-w-md bg-slate-900 border-l border-white/10 shadow-2xl animate-in slide-in-from-right duration-500 flex flex-col">
                        <div className="p-8 border-b border-white/5 flex justify-between items-center bg-slate-950/20">
                            <div>
                                <h3 className="text-xl font-black text-white uppercase tracking-tighter flex items-center gap-2">
                                    <History className="text-emerald-500" /> HISTORIAL DE AUDITORÍA
                                </h3>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Control de trazabilidad FMX</p>
                            </div>
                            <button onClick={() => setShowAudit(false)} className="p-2 text-slate-500 hover:text-white hover:bg-white/5 rounded-full transition-all"><X size={24} /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-8 space-y-4 scrollbar-thin scrollbar-thumb-emerald-900/40">
                            {auditLogs.length === 0 ? (
                                <div className="text-center py-20 opacity-20"><History size={60} className="mx-auto mb-4" /><p className="font-bold text-xs">Sin registros históricos</p></div>
                            ) : (
                                auditLogs.map((log) => (
                                    <div key={log.id} className="bg-black/40 border border-white/5 p-5 rounded-[2rem] relative group hover:border-emerald-500/20 transition-all">
                                        <div className="flex justify-between items-start mb-3">
                                            <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${log.accion === 'INSERT' ? 'bg-emerald-500/10 text-emerald-400' :
                                                log.accion === 'UPDATE' ? 'bg-blue-500/10 text-blue-400' :
                                                    'bg-rose-500/10 text-rose-400'
                                                }`}>{log.accion}</span>
                                            <span className="text-[8px] font-mono text-slate-500">{new Date(log.created_at).toLocaleString()}</span>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="text-[10px] text-slate-400 font-bold">
                                                Día: <span className="text-white">{log.fecha_registro}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {log.monto_anterior !== null && <span className="text-[10px] font-mono text-slate-500 line-through">{formatCurrency(log.monto_anterior)}</span>}
                                                {log.monto_anterior !== null && <ChevronRight size={10} className="text-slate-700" />}
                                                {log.monto_nuevo !== null && <span className="text-sm font-mono font-black text-white">{formatCurrency(log.monto_nuevo)}</span>}
                                            </div>
                                            {log.detalles?.nota && <p className="text-[9px] text-slate-500 italic mt-2 border-t border-white/5 pt-2">“{log.detalles.nota}”</p>}
                                        </div>
                                        <div className="absolute top-4 right-8 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                            <span className="text-[8px] font-black uppercase text-emerald-500">{log.usuario}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PublicityDashboard;
