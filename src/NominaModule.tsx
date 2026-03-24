import React, { useState, useEffect } from 'react';
import {
    Users, X, Search, Save, Plus,
    Clock, DollarSign, CheckCircle2,
    RefreshCw, ChevronLeft, Edit3, Trash2
} from 'lucide-react';

interface NominaProp {
    user: { email: string; role: string; name: string };
    employees: any[];
    shiftsMatrix: any;
    onBack?: () => void;
    onSave?: (updatedMatrix: any) => void;
    syncWithDB?: () => Promise<void>;
}

const SHIFT_VALUE_USD = 9.60;
const HOURS_PER_SHIFT = 9;

const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

// Helper para parsear horas (ej. "8:30" -> 8.5)
const parseHours = (val: string | number): number => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    const sVal = val.toString().replace(',', '.');
    if (sVal.includes(':')) {
        const [h, m] = sVal.split(':').map(Number);
        return (h || 0) + ((m || 0) / 60);
    }
    return parseFloat(sVal) || 0;
};

const NominaModule: React.FC<NominaProp> = ({ user, employees, shiftsMatrix, onBack, onSave, syncWithDB }) => {
    const isAdmin = user.role === 'admin';
    const [localMatrix, setLocalMatrix] = useState(shiftsMatrix);
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [fortnight, setFortnight] = useState<1 | 2>(new Date().getDate() <= 15 ? 1 : 2);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedStatus, setSelectedStatus] = useState<'Todos' | 'Presente' | 'Falta' | 'Franco'>('Todos');

    // Estado para periodos pagados
    const [paidPeriods, setPaidPeriods] = useState<Record<string, boolean>>(() => {
        const saved = localStorage.getItem('nomina_paid_periods');
        return saved ? JSON.parse(saved) : {};
    });

    const currentPeriodKey = `${selectedYear}-${selectedMonth}-${fortnight}`;
    const isPaid = paidPeriods[currentPeriodKey] || false;

    useEffect(() => {
        localStorage.setItem('nomina_paid_periods', JSON.stringify(paidPeriods));
    }, [paidPeriods]);

    const handleTogglePaid = () => {
        if (!isAdmin) return;
        if (!isPaid && !confirm('¿Marcar esta quincena como PAGADA? Esto pondrá el balance visual en $0.')) return;
        if (isPaid && !confirm('¿Reabrir esta quincena? El balance volverá a mostrarse.')) return;

        setPaidPeriods(prev => ({
            ...prev,
            [currentPeriodKey]: !isPaid
        }));

        // Si se acaba de marcar como pagado, ofrecer mover al siguiente periodo
        if (!isPaid) {
            setTimeout(() => {
                if (confirm('¿Deseas moverte automáticamente a la siguiente quincena/mes?')) {
                    if (fortnight === 1) {
                        setFortnight(2);
                    } else {
                        setFortnight(1);
                        if (selectedMonth === 11) {
                            setSelectedMonth(0);
                            setSelectedYear(y => y + 1);
                        } else {
                            setSelectedMonth(m => m + 1);
                        }
                    }
                }
            }, 300);
        }
    };


    // UI States
    const [activeModal, setActiveModal] = useState<'detail' | null>(null);
    const [activeEntry, setActiveEntry] = useState<{ empId: string; day: number; isNew?: boolean } | null>(null);
    const [detailForm, setDetailForm] = useState({ entrada: '', salida: '', horas: '0', estatus: 'Falta', notas: '', customPay: '' });

    useEffect(() => {
        setLocalMatrix(shiftsMatrix);
    }, [shiftsMatrix]);

    // Generar días de la quincena
    const getDays = () => {
        const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
        const start = fortnight === 1 ? 1 : 16;
        const end = fortnight === 1 ? 15 : lastDay;
        const days = [];
        for (let i = start; i <= end; i++) days.push(i);
        return days;
    };

    const days = getDays();

    // Aplanar datos para el listado tipo hoja
    const generateFlatData = () => {
        const flat: any[] = [];
        employees.forEach(emp => {
            if (searchQuery && !emp.name.toLowerCase().includes(searchQuery.toLowerCase())) return;

            days.forEach(day => {
                // ID de fecha único para evitar colisiones entre meses (YYYY-MM-DD)
                const dateKey = `${selectedYear}-${(selectedMonth + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

                // Lógica de recuperación: 
                // 1. Prioridad: Fecha exacta (YYYY-MM-DD)
                // 2. Fallback Legacy: Solo si estamos en ENERO 2026 (mes donde se originaron los datos sin fecha)
                // Esto "ancla" la data vieja a Enero y libera Febrero para ser un mes nuevo y vacío.
                const isLegacyMonth = selectedMonth === 0 && selectedYear === 2026;

                let entry = localMatrix[emp.id]?.[dateKey];
                if (!entry && isLegacyMonth) {
                    entry = localMatrix[emp.id]?.[day];
                }

                // Si aún no hay entrada, crear una representación vacía en lugar de saltar (para que aparezca en la lista)
                const val = typeof entry === 'object' ? entry : { horas: entry || '0', estatus: parseFloat(entry || '0') > 0 ? 'Presente' : 'Falta' };

                const horas = parseHours(val.horas);

                // DYNAMIC RATE REMOVED - NOW FIXED OR MANUAL
                let currentShiftValue = emp.pago || SHIFT_VALUE_USD;

                const currentHourlyRate = currentShiftValue / HOURS_PER_SHIFT;
                // Allow Manual Override
                const totalPay = (val.customPay !== undefined && val.customPay !== "")
                    ? parseFloat(val.customPay)
                    : (horas * currentHourlyRate);

                const status = val.estatus || (horas > 0 ? 'Presente' : 'Falta');

                if (selectedStatus !== 'Todos' && status !== selectedStatus) return;

                const finalGroup = emp.group;

                flat.push({
                    empId: emp.id,
                    name: emp.name,
                    group: finalGroup,
                    day,
                    date: `${day.toString().padStart(2, '0')}/${(selectedMonth + 1).toString().padStart(2, '0')}/${selectedYear}`,
                    entrada: val.entrada || '0',
                    salida: val.salida || '0',
                    horas: horas.toFixed(2),
                    rate: currentHourlyRate.toFixed(2),
                    pay: totalPay.toFixed(2),
                    status,
                    notas: val.notas || ''
                });
            });
        });

        return flat.sort((a, b) => a.day - b.day || a.name.localeCompare(b.name));
    };

    const flatData = generateFlatData();

    const handleNewEntry = () => {
        if (!isAdmin) return;
        setDetailForm({ entrada: '', salida: '', horas: '0', estatus: 'Falta', notas: '', customPay: '' });
        setActiveEntry({ empId: employees[0]?.id, day: days[0], isNew: true });
        setActiveModal('detail');
    };

    const handleOpenDetail = (empId: string, day: number) => {
        if (!isAdmin) return;

        const dateKey = `${selectedYear}-${(selectedMonth + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        const isLegacyMonth = selectedMonth === 0 && selectedYear === 2026;

        let entry = localMatrix[empId]?.[dateKey];
        if (!entry && isLegacyMonth) {
            entry = localMatrix[empId]?.[day];
        }

        entry = entry || {};

        const val = typeof entry === 'object' ? entry : {
            entrada: '',
            salida: '',
            horas: entry,
            estatus: parseFloat(entry) > 0 ? 'Presente' : 'Falta',
            notas: '',
            customPay: ''
        };

        setDetailForm({
            entrada: val.entrada || '',
            salida: val.salida || '',
            horas: val.horas || '0',
            estatus: val.estatus || (parseFloat(val.horas) > 0 ? 'Presente' : 'Falta'),
            notas: val.notas || '',
            customPay: val.customPay || ''
        });
        setActiveEntry({ empId, day }); // We keep day as ID for the modal state
        setActiveModal('detail');
    };

    const handleSaveDetail = () => {
        if (!activeEntry) return;
        const updated = { ...localMatrix };
        if (!updated[activeEntry.empId]) updated[activeEntry.empId] = {};

        let finalStatus = detailForm.estatus;
        if (parseFloat(detailForm.horas) > 0 && finalStatus === 'Falta') finalStatus = 'Presente';
        if (parseFloat(detailForm.horas) === 0 && finalStatus === 'Presente') finalStatus = 'Falta';

        // NEW LOGIC: Always save to Date Key
        const dateKey = `${selectedYear}-${(selectedMonth + 1).toString().padStart(2, '0')}-${activeEntry.day.toString().padStart(2, '0')}`;
        updated[activeEntry.empId][dateKey] = { ...detailForm, estatus: finalStatus };

        // Remove legacy key if it exists to avoid confusion/fallback issues? 
        // Better to leave it for safety? No, if we don't remove it, we don't rely on it due to priority.
        // But for clarity, we could strictly migrate. Let's just write to new key.

        setLocalMatrix(updated);
        if (onSave) onSave(updated);
        setActiveModal(null);
    };

    const handleDeleteEntry = (e: React.MouseEvent, empId: string, day: number) => {
        e.stopPropagation();
        if (!confirm('¿Estás seguro de borrar este registro?')) return;
        const updated = { ...localMatrix };
        if (updated[empId]) {
            const dateKey = `${selectedYear}-${(selectedMonth + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
            const isLegacyMonth = selectedMonth === 0 && selectedYear === 2026;

            delete updated[empId][dateKey];
            if (isLegacyMonth) {
                delete updated[empId][day];
            }

            setLocalMatrix({ ...updated });
            if (onSave) onSave(updated);
        }
    };

    const handleClearMonth = () => {
        if (!isAdmin) return;
        if (!confirm(`¿ATENCIÓN: Estás seguro de BORRAR TODOS los datos de ${monthNames[selectedMonth]} ${selectedYear} para los empleados visibles? Esta acción es irreversible.`)) return;

        const updated = { ...localMatrix };
        const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
        const isLegacyMonth = selectedMonth === 0 && selectedYear === 2026;

        employees.forEach(emp => {
            if (updated[emp.id]) {
                updated[emp.id] = { ...updated[emp.id] };
                for (let d = 1; d <= lastDay; d++) {
                    const dateKey = `${selectedYear}-${(selectedMonth + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
                    delete updated[emp.id][dateKey];
                    if (isLegacyMonth) delete updated[emp.id][d];
                }
            }
        });

        setLocalMatrix(updated);
        if (onSave) onSave(updated);
        alert("Mes limpiado correctamente.");
    };

    const handleGlobalSave = () => {
        if (onSave) onSave(localMatrix);
        alert("Nómina guardada y sincronizada con éxito.");
    };

    const totalPaid = flatData.reduce((acc, curr) => acc + parseFloat(curr.pay), 0);
    const totalHours = flatData.reduce((acc, curr) => acc + parseFloat(curr.horas), 0);
    const presentCount = flatData.filter(d => d.status === 'Presente').length;

    return (
        <div className="fixed inset-0 z-[120] bg-[#020617] text-slate-200 flex flex-col animate-in fade-in duration-300 overflow-hidden font-sans">
            <div className="absolute inset-0 pointer-events-none opacity-20">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/20 rounded-full blur-[120px]"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-600/10 rounded-full blur-[120px]"></div>
            </div>

            {/* Header Toolbar - Mobile Optimized */}
            <header className="relative z-10 bg-slate-900/80 backdrop-blur-2xl border-b border-indigo-500/20 px-4 md:px-8 py-4 md:py-5 shadow-2xl">
                <div className="flex flex-col gap-4 md:gap-6">
                    {/* Top Row: Back & Title */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 md:gap-6">
                            <button onClick={onBack} className="p-2 md:p-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl md:rounded-2xl border border-white/5 transition-all">
                                <ChevronLeft size={18} />
                            </button>
                            <div className="flex flex-col md:flex-row items-center md:gap-3">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 md:p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
                                        <Users size={20} />
                                    </div>
                                    <h1 className="text-base md:text-2xl font-black uppercase italic tracking-tighter">Nómina Principal</h1>
                                </div>
                                <p className="text-[8px] md:text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] opacity-60">Administración de Jornadas y Pagos</p>
                                <p className="text-[9px] text-yellow-500/80 font-mono">
                                    Debug: Mes={selectedMonth + 1} ({monthNames[selectedMonth]}), Año={selectedYear}, Legacy={(selectedMonth === 0 && selectedYear === 2026) ? 'ON (Enero)' : 'OFF'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Middle Row: Selectors */}
                    <div className="flex flex-wrap items-center gap-2 md:gap-4 p-1.5 bg-slate-950/40 rounded-2xl md:rounded-3xl border border-white/5">
                        <select
                            value={selectedMonth}
                            onChange={e => setSelectedMonth(Number(e.target.value))}
                            className="bg-transparent text-white text-[9px] md:text-xs font-black uppercase outline-none px-3 py-1.5 md:py-2"
                        >
                            {monthNames.map((m, i) => <option key={i} value={i} className="bg-slate-900">{m}</option>)}
                        </select>
                        <select
                            value={selectedYear}
                            onChange={e => setSelectedYear(Number(e.target.value))}
                            className="bg-transparent text-white text-[9px] md:text-xs font-black uppercase outline-none px-3 py-1.5 md:py-2"
                        >
                            <option value={2024} className="bg-slate-900">2024</option>
                            <option value={2025} className="bg-slate-900">2025</option>
                            <option value={2026} className="bg-slate-900">2026</option>
                        </select>

                        <div className="w-px h-4 bg-white/10 mx-1"></div>
                        <div className="flex gap-1 flex-1 md:flex-initial">
                            <button onClick={() => setFortnight(1)} className={`flex-1 md:px-5 py-1.5 md:py-2 rounded-xl text-[9px] md:text-xs font-black uppercase transition-all ${fortnight === 1 ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-500'}`}>01-15</button>
                            <button onClick={() => setFortnight(2)} className={`flex-1 md:px-5 py-1.5 md:py-2 rounded-xl text-[9px] md:text-xs font-black uppercase transition-all ${fortnight === 2 ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-500'}`}>16-FIN</button>
                        </div>
                    </div>

                    {/* Bottom Row: Actions */}
                    <div className="flex items-center gap-2 md:gap-4">
                        <button onClick={handleNewEntry} className="flex-1 px-4 py-3 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-xl md:rounded-2xl border border-indigo-500/20 transition-all font-black text-[9px] md:text-xs uppercase flex items-center justify-center gap-2">
                            <Plus size={16} /> <span>AGREGAR DÍA</span>
                        </button>
                        <button onClick={() => syncWithDB?.()} className="p-3 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-xl md:rounded-2xl border border-indigo-500/20" title="Sincronizar">
                            <RefreshCw size={18} />
                        </button>

                        <button onClick={handleClearMonth} className="p-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl md:rounded-2xl border border-rose-500/20" title="Limpiar Mes">
                            <Trash2 size={18} />
                        </button>
                        <button
                            onClick={handleTogglePaid}
                            className={`flex-1 px-4 py-3 font-black text-[9px] md:text-xs uppercase flex items-center justify-center gap-2 rounded-xl md:rounded-2xl transition-all border shadow-lg ${isPaid ? 'bg-emerald-500 text-white border-emerald-400' : 'bg-slate-800 text-slate-400 border-white/5 hover:bg-slate-700'}`}
                        >
                            {isPaid ? <CheckCircle2 size={16} /> : <DollarSign size={16} />}
                            {isPaid ? 'QUINCENA PAGADA' : 'MARCAR PAGO'}
                        </button>
                        <button onClick={handleGlobalSave} className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[9px] md:text-xs uppercase flex items-center justify-center gap-2 rounded-xl md:rounded-2xl shadow-xl shadow-emerald-500/20 transition-all">
                            <Save size={16} /> GUARDAR
                        </button>
                    </div>
                </div>
            </header>

            {/* Stats Bar */}
            <div className="relative z-10 grid grid-cols-2 lg:grid-cols-4 gap-3 px-4 md:px-8 py-4 bg-slate-900/40 border-b border-white/5 shrink-0">
                {[
                    { label: 'Total Devengado', val: isPaid ? '$0 (PAGADO)' : `$${totalPaid.toLocaleString()}`, icon: DollarSign, color: isPaid ? 'emerald' : 'emerald' },
                    { label: 'Carga Horaria', val: `${totalHours.toFixed(1)} HRS`, icon: Clock, color: 'blue' },

                    { label: 'Total Agentes', val: employees.length, icon: Users, color: 'indigo' },
                    { label: 'Asistencias', val: presentCount, icon: CheckCircle2, color: 'amber' },
                ].map((stat, i) => (
                    <div key={i} className="bg-black/30 border border-white/5 p-3 rounded-2xl flex items-center gap-3 transition-transform hover:scale-[1.02]">
                        <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400"><stat.icon size={18} /></div>
                        <div>
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">{stat.label}</p>
                            <p className="text-sm md:text-lg font-mono font-black text-white leading-none">{stat.val}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Content Area */}
            <main className="flex-1 min-h-0 overflow-hidden flex flex-col p-4 md:p-8 gap-4 md:gap-6 relative z-10">
                {/* Search & Status Filter */}
                <div className="bg-slate-900/60 p-4 md:p-5 rounded-2xl md:rounded-[2rem] border border-white/5 backdrop-blur-xl flex flex-col md:flex-row gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar Agente por nombre..."
                            className="w-full bg-black/40 border border-slate-700/30 rounded-xl md:rounded-2xl py-3 pl-12 pr-4 text-white font-bold placeholder:text-slate-600 focus:border-indigo-500 transition-all outline-none"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-1.5 md:gap-2 overflow-x-auto pb-1 md:pb-0">
                        {['Todos', 'Presente', 'Falta', 'Franco'].map(s => (
                            <button
                                key={s}
                                onClick={() => setSelectedStatus(s as any)}
                                className={`px-4 py-2 md:py-2.5 rounded-xl text-[9px] md:text-[10px] font-black uppercase border transition-all whitespace-nowrap ${selectedStatus === s ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-800 border-white/5 text-slate-500'}`}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Main List */}
                <div className="flex-1 bg-slate-900/60 backdrop-blur-xl border border-white/5 rounded-2xl md:rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col min-h-0">
                    {/* PC Table */}
                    <div className="hidden md:block flex-1 overflow-auto scrollbar-thin scrollbar-thumb-indigo-500/20">
                        <table className="w-full border-collapse text-left">
                            <thead className="bg-black/60 sticky top-0 z-20">
                                <tr>
                                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 border-b border-white/5">Agente</th>
                                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 border-b border-white/5">Fecha</th>
                                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 border-b border-white/5 text-center">Entrada</th>
                                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 border-b border-white/5 text-center">Salida</th>
                                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 border-b border-white/5 text-center">Horas</th>
                                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 border-b border-white/5 text-center text-emerald-400">Pago</th>
                                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 border-b border-white/5">Estatus</th>
                                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 border-b border-white/5 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {flatData.map((row, index) => {
                                    const isNewDay = index === 0 || flatData[index - 1].day !== row.day;
                                    return (
                                        <React.Fragment key={`${row.empId}-${row.day}`}>
                                            {isNewDay && (
                                                <tr className="bg-slate-950/80 border-y border-indigo-500/30">
                                                    <td colSpan={8} className="py-3 px-6">
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-1.5 bg-indigo-500 rounded text-white shadow-lg"><Clock size={14} /></div>
                                                            <span className="text-white font-black text-xs uppercase tracking-[0.2em]">{row.date}</span>
                                                            <div className="h-px bg-indigo-500/20 flex-1"></div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                            <tr className="group hover:bg-white/[0.03] transition-colors cursor-pointer" onClick={() => handleOpenDetail(row.empId, row.day)}>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col">
                                                        <span className="text-white font-black text-sm">{row.name}</span>
                                                        <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded w-fit mt-1 border ${row.group === 'Barco' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' : 'bg-pink-500/10 text-pink-500 border-pink-500/20'}`}>{row.group}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 font-mono text-xs text-slate-500">{row.date}</td>
                                                <td className="px-6 py-4 text-center font-mono text-white text-xs">{row.entrada !== '0' ? row.entrada : '-'}</td>
                                                <td className="px-6 py-4 text-center font-mono text-white text-xs">{row.salida !== '0' ? row.salida : '-'}</td>
                                                <td className="px-6 py-4 text-center"><span className="font-mono font-bold text-sm text-indigo-400">{row.horas}</span></td>
                                                <td className="px-6 py-4 text-center"><span className="font-mono font-bold text-sm text-emerald-400">{isPaid ? '$0' : `$${row.pay}`}</span></td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase border ${row.status === 'Presente' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20'}`}>
                                                        <div className={`w-1.5 h-1.5 rounded-full ${row.status === 'Presente' ? 'bg-emerald-400' : 'bg-rose-500'}`}></div>
                                                        {row.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={(e) => { e.stopPropagation(); handleOpenDetail(row.empId, row.day); }} className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg hover:bg-indigo-500/20"><Edit3 size={14} /></button>
                                                        <button onClick={(e) => handleDeleteEntry(e, row.empId, row.day)} className="p-2 bg-rose-500/10 text-rose-400 rounded-lg hover:bg-rose-500/20"><Trash2 size={14} /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Cards */}
                    <div className="md:hidden flex-1 overflow-auto p-4 flex flex-col gap-4">
                        {flatData.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-500 italic">
                                <Search size={40} className="mb-4 opacity-20" />
                                <p className="text-xs font-black uppercase tracking-widest">Sin registros encontrados</p>
                                <p className="text-[9px] mt-1 font-bold">Intenta cambiar los filtros o el periodo</p>
                            </div>
                        ) : (
                            flatData.map((row, index) => {
                                const isNewDay = index === 0 || flatData[index - 1].day !== row.day;
                                return (
                                    <React.Fragment key={`${row.empId}-${row.day}`}>
                                        {isNewDay && (
                                            <div className="mt-4 mb-2 flex items-center gap-3">
                                                <span className="text-white font-black text-[10px] uppercase tracking-[0.2em] bg-indigo-600 px-3 py-1 rounded-lg">{row.date}</span>
                                                <div className="h-px bg-indigo-500/20 flex-1"></div>
                                            </div>
                                        )}
                                        <div
                                            onClick={() => handleOpenDetail(row.empId, row.day)}
                                            className="bg-black/30 border border-white/5 rounded-2xl p-4 active:scale-[0.98] transition-all"
                                        >
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="flex flex-col">
                                                    <span className="text-white font-black text-sm uppercase">{row.name}</span>
                                                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded w-fit border ${row.group === 'Barco' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' : 'bg-pink-500/10 text-pink-500 border-pink-500/20'}`}>{row.group}</span>
                                                </div>
                                                <div className={`p-1.5 rounded-lg border flex items-center gap-1 ${row.status === 'Presente' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>
                                                    <div className={`w-1.5 h-1.5 rounded-full ${row.status === 'Presente' ? 'bg-emerald-400 shadow-[0_0_5px_#10b981]' : 'bg-rose-500 animate-pulse'}`}></div>
                                                    <span className="text-[8px] font-black uppercase tracking-widest">{row.status}</span>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-3">
                                                <div>
                                                    <p className="text-[8px] text-slate-500 uppercase font-black mb-1">Carga Horaria</p>
                                                    <p className="text-sm font-mono font-bold text-indigo-400">{row.horas} HRS</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[8px] text-slate-500 uppercase font-black mb-1">Pago Devengado</p>
                                                    <p className="text-sm font-mono font-bold text-emerald-400">{isPaid ? '$0' : `$${row.pay}`}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </React.Fragment>
                                );
                            })
                        )}
                    </div>
                </div>
            </main>

            {/* Modal de Detalle */}
            {activeModal === 'detail' && activeEntry && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md">
                    <div className="bg-[#0f172a] border border-indigo-500/30 w-full max-w-md rounded-[2.5rem] p-8 shadow-3xl relative">
                        <button onClick={() => setActiveModal(null)} className="absolute top-6 right-6 p-2 text-slate-500 hover:text-white"><X size={24} /></button>

                        <h3 className="text-white font-black text-2xl uppercase italic mb-6">Detalle Asistencia</h3>

                        <div className="space-y-6">
                            {activeEntry.isNew ? (
                                <div className="grid grid-cols-2 gap-3 mb-6">
                                    <select value={activeEntry.empId} onChange={e => setActiveEntry({ ...activeEntry, empId: e.target.value })} className="bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-xs font-bold text-white outline-none">
                                        {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                                    </select>
                                    <select value={activeEntry.day} onChange={e => setActiveEntry({ ...activeEntry, day: Number(e.target.value) })} className="bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-xs font-bold text-white outline-none text-center">
                                        {days.map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                </div>
                            ) : (
                                <p className="text-indigo-400 font-black text-xs uppercase bg-indigo-500/10 px-4 py-2 rounded-xl border border-indigo-500/20 w-fit mb-6">
                                    {employees.find(e => e.id === activeEntry.empId)?.name} • Día {activeEntry.day}
                                </p>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] text-slate-500 font-black uppercase">Entrada</label>
                                    <input type="text" value={detailForm.entrada} onChange={e => setDetailForm({ ...detailForm, entrada: e.target.value })} placeholder="00:00" className="w-full bg-slate-950 border border-white/5 rounded-2xl p-4 text-white font-mono text-center outline-none focus:border-indigo-500 transition-all" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] text-slate-500 font-black uppercase">Salida</label>
                                    <input type="text" value={detailForm.salida} onChange={e => setDetailForm({ ...detailForm, salida: e.target.value })} placeholder="00:00" className="w-full bg-slate-950 border border-white/5 rounded-2xl p-4 text-white font-mono text-center outline-none focus:border-indigo-500 transition-all" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] text-slate-500 font-black uppercase">Total Horas</label>
                                    <input type="number" step="any" value={detailForm.horas} onChange={e => setDetailForm({ ...detailForm, horas: e.target.value })} className="w-full bg-slate-950 border border-indigo-500/30 rounded-2xl p-6 text-indigo-400 font-mono text-4xl font-black text-center outline-none" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] text-slate-500 font-black uppercase">Pago Manual ($)</label>
                                    <input type="number" step="any" placeholder="Auto" value={detailForm.customPay} onChange={e => setDetailForm({ ...detailForm, customPay: e.target.value })} className="w-full bg-slate-950 border border-emerald-500/30 rounded-2xl p-6 text-emerald-400 font-mono text-4xl font-black text-center outline-none" />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                                {['Presente', 'Falta', 'Franco'].map(st => (
                                    <button key={st} onClick={() => setDetailForm({ ...detailForm, estatus: st })} className={`py-3 rounded-xl text-[10px] font-black uppercase border transition-all ${detailForm.estatus === st ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-slate-900 border-white/5 text-slate-500'}`}>{st}</button>
                                ))}
                            </div>

                            <button onClick={handleSaveDetail} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-2xl shadow-xl shadow-indigo-500/20 flex items-center justify-center gap-3 transition-all active:scale-95">
                                <Save size={24} /> <span className="text-xl">GUARDAR</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NominaModule;
