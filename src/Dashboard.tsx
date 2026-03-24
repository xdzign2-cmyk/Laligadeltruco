import { useState, useEffect, useRef } from 'react';
import { AreaChart, Area, Tooltip, ResponsiveContainer, XAxis, YAxis, CartesianGrid } from 'recharts';
import {
    Users, X, Edit2, Trash2, PlusCircle, User, Ship, Mountain, Lock, FileText, Upload, Plus,
    RefreshCw, Send, Landmark, Activity, Trophy, Medal, Calculator as CalcIcon, CircleDollarSign,
    TrendingUp, ChevronLeft, ChevronRight, ShieldAlert, CheckCircle2, Save, ScanLine
} from 'lucide-react';
import * as QRCode from 'qrcode';
import { TOTP, Secret } from 'otpauth';

const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
import { supabase } from './lib/supabase';
import { backupToGoogleSheets } from './lib/googleSheets';
import PublicityDashboard from './PublicityDashboard';
import NominaModule from './NominaModule';

// --- INTERFACES ---
interface Shipment {
    id: number | string;
    fecha: string;
    monto: number;
    nota: string;
    comprobante?: string;
}

interface Bank {
    id: number | string;
    nombre: string;
    monto: number;
}

interface Player {
    id: number | string;
    nombre: string;
    saldo: number;
    tipo: string;
}

interface Employee {
    id: string | number;
    name: string;
    email?: string;
    status: 'Activo' | 'Baja' | 'Pendiente' | string;
    group: 'Barco' | 'Cueva' | string;
    shift: string;
    pago: number;
    password?: string;
}

interface OperationalRow {
    id: string | number;
    dia: string;
    fullDate: string;
    barco: number;
    cueva: number;
    mesasBarco: number;
    mesasCueva: number;
    isManual?: boolean;
    gastos?: number;
    utilidad?: number;
    drop?: number;
}


// --- CONFIGURACIÓN & TYPES ---
const HOURS_PER_SHIFT = 9;   // Un turno dura 9 horas
const SHIFT_VALUE_USD = 9.6; // Un turno vale 9.6$ Dolares


// --- DATOS INICIALES POR DEFECTO ---


const defaultShipments = [
    { id: 1, fecha: '29/12', monto: 317000, nota: '' },
    { id: 2, fecha: '31/12', monto: 350000, nota: '' },
    { id: 3, fecha: '04/01', monto: 250000, nota: '' },
    { id: 4, fecha: '05/01', monto: 80000, nota: 'ADELANTO' },
    { id: 5, fecha: '06/01', monto: 200000, nota: '' },
    { id: 6, fecha: '08/01', monto: 330000, nota: '' },
    { id: 7, fecha: '09/01', monto: 210000, nota: '' },
    { id: 8, fecha: '10/01', monto: 189000, nota: '' },
];

const defaultBanks = [
    { id: 1, nombre: 'Banesco', monto: 150000 },
    { id: 2, nombre: 'Binance USDT', monto: 500000 },
    { id: 3, nombre: 'Efectivo Caja', monto: 25000 },
];

const defaultPlayers = [
    { id: 1, nombre: 'El Barco', saldo: 0, tipo: 'barco' },
    { id: 2, nombre: 'La Cueva', saldo: 0, tipo: 'cueva' },
];

// Ahora los empleados tienen GRUPO (Barco o Cueva)
const defaultEmployees = [
    { id: 1, name: 'Romero', email: 'romero@sistema.com', status: 'Activo', group: 'Barco', shift: 'Mañana', pago: 9.6 },
    { id: 2, name: 'Alfredo', email: 'alfredo@sistema.com', status: 'Activo', group: 'Barco', shift: 'Noche', pago: 9.6 },
    { id: 3, name: 'Francel', email: 'francel@sistema.com', status: 'Activo', group: 'Cueva', shift: 'Mañana', pago: 9.6 },
    { id: 4, name: 'Willy', email: 'willy@sistema.com', status: 'Activo', group: 'Cueva', shift: 'Noche', pago: 9.6 },
    { id: 5, name: 'Francis', email: 'francis@sistema.com', status: 'Activo', group: 'Barco', shift: 'Mañana', pago: 9.6 },
    { id: 6, name: 'Clemente', email: 'clemente@sistema.com', status: 'Activo', group: 'Cueva', shift: 'Mañana', pago: 9.6 },
];

const defaultShifts = {};

const Dashboard = ({ role = 'guest', userEmail, onLogout, onNavigateToRestriccion }: { role?: string, userEmail: string, onLogout: () => void, onNavigateToRestriccion?: () => void }) => {

    const [showPublicityAnalytics, setShowPublicityAnalytics] = useState(false);
    const isAdminOrVice = role === 'admin' || role === 'vicepresident';
    const isOnlyAdmin = role === 'admin';
    const [dashboardGroup, setDashboardGroup] = useState<'Barco' | 'Cueva' | 'Todos'>('Todos');


    // --- STATES & PERSISTENCE ---
    const loadState = (key: string, defaultValue: any) => {
        try {
            const saved = localStorage.getItem(key);
            return saved ? JSON.parse(saved) : defaultValue;
        } catch (e) {
            console.error(`Error loading ${key}, resetting to default.`, e);
            return defaultValue;
        }
    };

    // --- DYNAMIC PERIOD STATES (Synchronized with 3 AM Operational Shift) ---
    // --- DYNAMIC PERIOD STATES (Synchronized with 3 AM Operational Shift + PERSISTENCE) ---
    const [selectedMonth, setSelectedMonth] = useState(() => {
        try {
            const saved = localStorage.getItem('dashboard_view_filters');
            if (saved) return JSON.parse(saved).month;
        } catch (e) { }
        const d = new Date();
        if (d.getHours() < 3) d.setDate(d.getDate() - 1);
        return d.getMonth();
    });
    const [selectedYear, setSelectedYear] = useState(() => {
        try {
            const saved = localStorage.getItem('dashboard_view_filters');
            if (saved) return JSON.parse(saved).year;
        } catch (e) { }
        const d = new Date();
        if (d.getHours() < 3) d.setDate(d.getDate() - 1);
        return d.getFullYear();
    });
    const [viewMode, setViewMode] = useState<'Q1' | 'Q2'>(() => {
        const d = new Date();
        if (d.getHours() < 3) d.setDate(d.getDate() - 1);
        const autoDetected = d.getDate() <= 15 ? 'Q1' : 'Q2';
        return autoDetected;
    });

    const [currentFortnight, _setCurrentFortnight] = useState<number>(() => (new Date().getDate() <= 15 ? 1 : 2));

    const setFortnightBoth = (val: number) => {
        _setCurrentFortnight(val);
        setViewMode(val === 1 ? 'Q1' : 'Q2');
    };

    // Save filters
    useEffect(() => {
        localStorage.setItem('dashboard_view_filters', JSON.stringify({ month: selectedMonth, year: selectedYear, viewMode }));
    }, [selectedMonth, selectedYear, viewMode]);



    const [data, setData] = useState<OperationalRow[]>([]);
    const [shipments, setShipments] = useState<Shipment[]>(() => loadState('shipmentsData', defaultShipments));
    const [banks, setBanks] = useState<Bank[]>(() => loadState('banksData', defaultBanks));
    const [players, setPlayers] = useState<Player[]>(() => loadState('playersData', defaultPlayers));
    const [employees, setEmployees] = useState<Employee[]>(() => loadState('employeesData', defaultEmployees));
    const [shiftsMatrix, setShiftsMatrix] = useState<Record<string, any>>(() => loadState('shiftsMatrixData', defaultShifts));
    const [shiftsNotes, setShiftsNotes] = useState<Record<string, any>>(() => loadState('shiftsNotesData', {})); // New State for Notes

    // --- MASTERS VIEW STATE ---
    const [showMasterModal, setShowMasterModal] = useState(false);
    const [masterLogs, setMasterLogs] = useState<any[]>([]);
    const [selectedUserForReceipt, setSelectedUserForReceipt] = useState<string | null>(null);
    const [uploadUrl, setUploadUrl] = useState('');
    const [editingLog, setEditingLog] = useState<any>(null);
    const operativeQueryCache = useRef<Record<string, any>>({}); // Cache local para evitar overusage de DB

    // --- NEW: ONLINE USERS & APPROVALS STATES ---
    const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
    const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
    const [includePublicityInTotal, setIncludePublicityInTotal] = useState(() => loadState('includePublicityInTotal', true));
    const [activeShiftDay, setActiveShiftDay] = useState<{ empId: string | number; day: number } | null>(null);
    const [shiftDetailForm, setShiftDetailForm] = useState({ entrada: '', salida: '', horas: '', estatus: 'Falta' });

    const [showNominaPage, setShowNominaPage] = useState(false);

    // --- 2FA CONFIGURATION STATE ---
    const [show2FAModal, setShow2FAModal] = useState(false);
    const [newSecret, setNewSecret] = useState('');
    const [qrCodeUrl, setQrCodeUrl] = useState('');
    const [verifCode, setVerifCode] = useState('');

    const handleOpen2FAModal = async () => {
        // Generate new secret
        const secret = new Secret({ size: 20 });
        const secretBase32 = secret.base32;
        setNewSecret(secretBase32);

        // Generate QR Code Data URL
        // otpauth://totp/LABEL?secret=SECRET&issuer=ISSUER
        const uri = `otpauth://totp/DashboardOperativo:${userEmail}?secret=${secretBase32}&issuer=DashboardFMX`;

        try {
            const url = await QRCode.toDataURL(uri);
            setQrCodeUrl(url);
            setShow2FAModal(true);
            setVerifCode('');
        } catch (err) {
            console.error(err);
            alert("Error generando QR");
        }
    };

    const handleConfirm2FA = async () => {
        if (!verifCode) return alert("Ingresa el código para verificar");

        // Verify code
        const totp = new TOTP({
            secret: Secret.fromBase32(newSecret),
            algorithm: 'SHA1',
            digits: 6,
            period: 30
        });

        const delta = totp.validate({ token: verifCode, window: 10 });

        if (delta === null) {
            return alert(`Código incorrecto.\nRevisa la hora de tu PC y celular.`);
        }

        // Save to DB
        const { error } = await supabase
            .from('usuarios_sistema')
            .update({ secret_2fa: newSecret })
            .eq('username', userEmail); // Assuming username is email

        if (error) {
            alert("Error guardando secreto: " + error.message);
        } else {
            alert("¡2FA Configurado con Éxito! Ahora puedes usar Google Authenticator.");
            setShow2FAModal(false);
        }
    };

    const loadOnlineUsers = async () => {
        if (!isAdminOrVice) return;
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const { data: sessions } = await supabase
            .from('gestor_sesiones')
            .select('*')
            .gt('last_active_at', fiveMinutesAgo);

        if (sessions) {
            // Buscamos los roles para identificar ADMINS
            const { data: users } = await supabase.from('usuarios_sistema').select('username, role');
            const enriched = sessions.map(s => ({
                ...s,
                role: users?.find(u => u.username === s.user_email)?.role || 'guest'
            }));
            setOnlineUsers(enriched);
        }
    };

    const handleKickUser = async (userEmailToKick: string, deviceId: string) => {
        if (!isOnlyAdmin) return;
        if (!confirm(`¿Cerrar sesión forzosamente a ${userEmailToKick}?`)) return;

        const { error } = await supabase
            .from('gestor_sesiones')
            .delete()
            .eq('user_email', userEmailToKick)
            .eq('device_id', deviceId);

        if (error) alert('Error al expulsar: ' + error.message);
        else loadOnlineUsers();
    };

    const loadPendingApprovals = async () => {
        if (!isOnlyAdmin) return;
        const { data } = await supabase
            .from('usuarios_sistema')
            .select('*')
            .eq('estado', 'pendiente');
        if (data) setPendingApprovals(data);
    };

    const handleApproveUser = async (id: string) => {
        const { error } = await supabase.from('usuarios_sistema').update({ estado: 'aprobado' }).eq('id', id);
        if (error) alert(error.message);
        else loadPendingApprovals();
    };

    const handleDenyUser = async (id: string) => {
        if (!confirm('¿Denegar acceso definitivamente?')) return;
        const { error } = await supabase.from('usuarios_sistema').update({ estado: 'denegado' }).eq('id', id);
        if (error) alert(error.message);
        else loadPendingApprovals();
    };

    useEffect(() => {
        if (isAdminOrVice) {
            loadOnlineUsers();
            // OPTIMIZATION: Reduced polling to 90s
            const interval = setInterval(loadOnlineUsers, 90000);
            return () => clearInterval(interval);
        }
    }, [isAdminOrVice]);

    useEffect(() => {
        if (isOnlyAdmin) {
            loadPendingApprovals();
            // OPTIMIZATION: Reduced polling to 90s
            const interval = setInterval(loadPendingApprovals, 90000);
            return () => clearInterval(interval);
        }
    }, [isOnlyAdmin]);

    const [pubMonth, setPubMonth] = useState(new Date().getMonth());
    const [pubYear, setPubYear] = useState(new Date().getFullYear());
    const [pubGridGroup, setPubGridGroup] = useState<'Barco' | 'Cueva' | 'Todos'>('Todos');

    const fetchPublicityData = async () => {
        const { data } = await supabase.from('publicidad_detallada').select('*');
        if (data) {
            const activeMap: any = {};
            data.forEach(d => {
                if (!activeMap[d.fecha]) activeMap[d.fecha] = { Barco: 0, Cueva: 0, Total: 0 };
                const grupo = d.grupo || 'Barco';
                activeMap[d.fecha][grupo] += Number(d.monto);
                activeMap[d.fecha].Total += Number(d.monto);
            });
            setPublicityActive(activeMap);
        }
    };

    useEffect(() => {
        fetchPublicityData();
        const channel = supabase
            .channel('publicity_sync_detailed')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'publicidad_detallada' }, () => {
                fetchPublicityData();
            })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, []);

    const loadMasterLogs = async () => {
        const { data } = await supabase.from('registros_operativos').select('*').order('created_at', { ascending: false }).limit(50);
        if (data) setMasterLogs(data);
    };

    const handleDeleteMasterLog = async (id: string) => {
        if (role === 'guest') return;
        if (!confirm('¿Eliminar registro?')) return;
        const { error } = await supabase.from('registros_operativos').delete().eq('id', id);
        if (error) alert(error.message);
        else loadMasterLogs();
    };

    const handleUpdateMasterLog = async (e: React.FormEvent) => {
        e.preventDefault();
        if (role === 'guest') return;
        if (!editingLog) return;
        const profit = (parseFloat(editingLog.monto_apuesta) * 2) * 0.08;
        const { error } = await supabase.from('registros_operativos').update({
            monto_apuesta: parseFloat(editingLog.monto_apuesta),
            fecha_operacion: editingLog.fecha_operacion,
            bando: editingLog.bando,
            ganancia_calculada: profit
        }).eq('id', editingLog.id);

        if (!error) {
            setEditingLog(null);
            loadMasterLogs();
        } else {
            alert(error.message);
        }
    };

    const handleUploadReceipt = async () => {
        if (role === 'guest') return;
        if (!selectedUserForReceipt || !uploadUrl) return;
        const { error } = await supabase.from('perfiles_empleados').upsert({
            user_email: selectedUserForReceipt,
            comprobante_url: uploadUrl,
            ultimo_pago_update: new Date().toISOString()
        });

        if (!error) {
            alert('Comprobante asignado correctamente');
            setUploadUrl('');
            setSelectedUserForReceipt(null);
        } else {
            alert('Error: ' + error.message);
        }
    };

    const [forceSyncCount, setForceSyncCount] = useState(0);

    // --- SYNC & DATA GENERATION (DYNAMIC PERIOD) ---
    useEffect(() => {
        const syncData = async () => {
            // 1. Determine Date Range
            let startDate = new Date(selectedYear, selectedMonth, 1);
            let endDate = new Date(selectedYear, selectedMonth, 15);

            if (viewMode === 'Q1') {
                // REGLA ESPECIAL: La Q1 de Enero incluye desde el 29 de Diciembre anterior
                if (selectedMonth === 0) {
                    startDate = new Date(selectedYear - 1, 11, 29);
                } else {
                    startDate = new Date(selectedYear, selectedMonth, 1);
                }
                endDate = new Date(selectedYear, selectedMonth, 15);
            } else {
                startDate = new Date(selectedYear, selectedMonth, 16);
                endDate = new Date(selectedYear, selectedMonth + 1, 0); // End of month
            }

            console.log('🗓️ Current view settings:', { viewMode, selectedMonth, selectedYear, startDate: startDate.toISOString().split('T')[0], endDate: endDate.toISOString().split('T')[0] });

            // DATOS HISTORICOS DEMO (Hardcoded as requested)
            const prevYear = selectedYear - 1;
            const histData: any = {
                [`${prevYear}-12-29`]: { barco: 87800, cueva: 114450 },
                [`${prevYear}-12-30`]: { barco: 72300, cueva: 132496 },
                [`${prevYear}-12-31`]: { barco: 55400, cueva: 78940 },
                [`${selectedYear}-01-01`]: { barco: 0, cueva: 73649 },
                [`${selectedYear}-01-02`]: { barco: 11040, cueva: 53072 },
                [`${selectedYear}-01-03`]: { barco: 43712, cueva: 53152 },
                [`${selectedYear}-01-04`]: { barco: 27392, cueva: 39632 },
                [`${selectedYear}-01-05`]: { barco: 32624, cueva: 66048 },
                [`${selectedYear}-01-06`]: { barco: 45760, cueva: 64544 },
                [`${selectedYear}-01-07`]: { barco: 91536, cueva: 83712 },
                [`${selectedYear}-01-08`]: { barco: 63328, cueva: 60016 },
                [`${selectedYear}-01-09`]: { barco: 94832, cueva: 111920 }
            };

            let rows = [];
            // 2. Generate Grid (Iterate Dates)
            const current = new Date(startDate);
            while (current <= endDate) {
                const y = current.getFullYear();
                const m = (current.getMonth() + 1).toString().padStart(2, '0');
                const d = current.getDate().toString().padStart(2, '0');
                const fullDate = `${y}-${m}-${d}`; // Local YYYY-MM-DD

                // Label simple: "29", "30", "1" (User request)
                const label = parseInt(d).toString();

                const h = histData[fullDate] || { barco: 0, cueva: 0 };

                rows.push({
                    id: fullDate,
                    dia: label,
                    fullDate: fullDate,
                    barco: h.barco,
                    cueva: h.cueva,
                    mesasBarco: 0,
                    mesasCueva: 0,
                    gastos: 0, utilidad: 0, drop: 0
                });
                current.setDate(current.getDate() + 1);
            }


            const fmtStartDate = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
            const fmtEndDate = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

            // 3. Fetch Manual Overrides FROM SUPABASE (Fix Persistence)
            const { data: manualOverrides } = await supabase
                .from('registros_diarios_manuales')
                .select('*')
                .gte('fecha', fmtStartDate)
                .lte('fecha', fmtEndDate);

            const manualMap: any = {};
            if (manualOverrides) {
                manualOverrides.forEach((m: any) => {
                    manualMap[m.fecha] = {
                        barco: Number(m.barco),
                        cueva: Number(m.cueva),
                        mesasBarco: Number(m.mesas_barco),
                        mesasCueva: Number(m.mesas_cueva),
                        utilidad: Number(m.utilidad),
                        gastos: Number(m.gastos),
                        drop: Number(m.drop_val),
                        isManual: true
                    };
                });
            }

            // Apply Manual Overrides
            rows = rows.map(r => {
                const saved = manualMap[r.fullDate];
                return saved ? { ...r, ...saved } : r;
            });

            console.log('📅 Querying DB from', fmtStartDate, 'to', fmtEndDate);

            // 4. Aggregate DB Data (Real Profit)
            // PRODUCTION: Fetch ALL records using pagination (Supabase max is 1000 per query)
            let dbRegs: any[] = [];

            // --- CACHE LAYER IMPLEMENTATION ---
            // Key based on date range to avoid redundant fetches
            const cacheKey = `${fmtStartDate}_${fmtEndDate}`;

            // Only use cache if not forcing sync
            if (operativeQueryCache.current[cacheKey] && forceSyncCount === 0) {
                dbRegs = operativeQueryCache.current[cacheKey];
                console.log('⚡ CACHE HIT: Usando datos locales para', cacheKey);
            } else {
                console.log('🌍 CACHE MISS: Descargando datos de Supabase para', cacheKey);
                let rangeStart = 0;
                const batchSize = 1000;
                let hasMore = true;

                while (hasMore) {
                    const { data: batch } = await supabase
                        .from('registros_operativos')
                        .select('*')
                        .gte('fecha_operacion', fmtStartDate)
                        .lte('fecha_operacion', fmtEndDate)
                        .range(rangeStart, rangeStart + batchSize - 1);

                    if (batch && batch.length > 0) {
                        dbRegs = dbRegs.concat(batch);
                        rangeStart += batchSize;
                        hasMore = batch.length === batchSize; // Continue if we got a full batch
                    } else {
                        hasMore = false;
                    }
                }
                // Save to cache
                operativeQueryCache.current[cacheKey] = dbRegs;
                console.log('✅ Fetched and Cached', dbRegs.length, 'records');
            }
            // Removed .limit() to fetch all records

            const sums: any = {};
            if (dbRegs) {
                dbRegs.forEach(reg => {
                    const bandoClean = (reg.bando || '').trim().toUpperCase();
                    if (!sums[reg.fecha_operacion]) sums[reg.fecha_operacion] = { barco: 0, cueva: 0, mesasBarco: 0, mesasCueva: 0 };
                    if (bandoClean === 'BARCO') {
                        sums[reg.fecha_operacion].barco += Number(reg.ganancia_calculada || 0);
                        sums[reg.fecha_operacion].mesasBarco += 1;
                    } else if (bandoClean === 'CUEVA') {
                        sums[reg.fecha_operacion].cueva += Number(reg.ganancia_calculada || 0);
                        sums[reg.fecha_operacion].mesasCueva += 1;
                    }
                });
            }
            console.log('📊 DB Query returned', dbRegs?.length, 'records');
            console.log('📊 Aggregated sums for Jan 22-23:', {
                '2026-01-22': sums['2026-01-22'],
                '2026-01-23': sums['2026-01-23']
            });
            console.log('📊 All dates in sums:', Object.keys(sums).sort());


            // --- MERGE DB DATA WITH ROWS ---
            const initialRows = rows.map(r => {
                const dbSum = sums[r.fullDate] || { barco: 0, cueva: 0, mesasBarco: 0, mesasCueva: 0 };

                // If manual override exists, preserve it
                if (r.isManual) return r;

                return {
                    ...r,
                    barco: dbSum.barco, // Already calculated profit
                    cueva: dbSum.cueva, // Already calculated profit
                    mesasBarco: dbSum.mesasBarco,
                    mesasCueva: dbSum.mesasCueva,
                    isManual: false
                };
            });
            console.log('🔍 Final data being set:', initialRows.filter(r => r.fullDate === '2026-01-22' || r.fullDate === '2026-01-23').map(r => ({ date: r.fullDate, barco: r.barco, cueva: r.cueva, mesasBarco: r.mesasBarco, mesasCueva: r.mesasCueva })));
            // BLINDAJE ANTI-PARPADEO: Prioridad absoluta al Estado Local sobre la Base de Datos
            setData(prev => {
                if (prev.length === 0) return initialRows;
                return initialRows.map(newRow => {
                    // Usamos el estado actual como "Verdad Suprema" si fue editado manualmente
                    const current = prev.find(p => p.id === newRow.id);
                    if (current?.isManual) return current;
                    return newRow;
                });
            });


        };



        syncData();


    }, [selectedMonth, selectedYear, viewMode, forceSyncCount]);

    useEffect(() => {
        if (showMasterModal) loadMasterLogs();
    }, [showMasterModal]);

    // Save Effects
    // Save Effects (Dynamic Key)

    useEffect(() => { localStorage.setItem('shipmentsData', JSON.stringify(shipments)); }, [shipments]);
    useEffect(() => { localStorage.setItem('banksData', JSON.stringify(banks)); }, [banks]);
    useEffect(() => { localStorage.setItem('shiftsMatrixData', JSON.stringify(shiftsMatrix)); }, [shiftsMatrix]);
    useEffect(() => { localStorage.setItem('shiftsNotesData', JSON.stringify(shiftsNotes)); }, [shiftsNotes]);
    useEffect(() => { localStorage.setItem('employeesData', JSON.stringify(employees)); }, [employees]);
    useEffect(() => { localStorage.setItem('playersData', JSON.stringify(players)); }, [players]);

    const [felipeDays, setFelipeDays] = useState(() => loadState('felipeDays', 15));
    const [felipeExtraDays, setFelipeExtraDays] = useState(() => loadState('felipeExtraDays', 0));
    const [felipeAssignedFreeDays, setFelipeAssignedFreeDays] = useState(() => loadState('felipeAssignedFreeDays', 2)); // Default 2 días libres
    const [felipeAdvances, setFelipeAdvances] = useState(() => loadState('felipeAdvances', [])); // Nuevo Estado para Adelantos

    const [usdtRate, setUsdtRate] = useState(() => Number(loadState('usdtRate', 1100)));
    const [publicityActive, setPublicityActive] = useState(() => loadState('publicityActive', {}));
    const [pubARS, setPubARS] = useState(() => Number(loadState('pubARS', 0)));
    const [pubUSD, setPubUSD] = useState(() => Number(loadState('pubUSD', 0)));

    useEffect(() => { localStorage.setItem('felipeAssignedFreeDays', JSON.stringify(felipeAssignedFreeDays)); }, [felipeAssignedFreeDays]);

    useEffect(() => {
        localStorage.setItem('felipeDays', JSON.stringify(felipeDays));
        localStorage.setItem('felipeExtraDays', JSON.stringify(felipeExtraDays));
        localStorage.setItem('felipeAssignedFreeDays', JSON.stringify(felipeAssignedFreeDays));
        localStorage.setItem('felipeAdvances', JSON.stringify(felipeAdvances));
        localStorage.setItem('usdtRate', JSON.stringify(usdtRate));
        localStorage.setItem('publicityActive', JSON.stringify(publicityActive));
        localStorage.setItem('pubARS', JSON.stringify(pubARS));
        localStorage.setItem('pubUSD', JSON.stringify(pubUSD));
    }, [felipeDays, felipeExtraDays, felipeAssignedFreeDays, felipeAdvances, usdtRate, publicityActive, pubARS, pubUSD]);




    // Modals & Forms
    const [activeModal, setActiveModal] = useState<string | null>(null);
    const [editingItem, setEditingItem] = useState<any>(null);

    const [opForm, setOpForm] = useState({ dia: '', barco: '', cueva: '', mesasBarco: '', mesasCueva: '' });
    const [shipForm, setShipForm] = useState({ fecha: '', monto: '', nota: '', comprobante: '' });
    const [bankForm, setBankForm] = useState({ nombre: '', monto: '' });
    const [playerForm, setPlayerForm] = useState({ nombre: '', saldo: '' });
    const [employeeForm, setEmployeeForm] = useState({ name: '', password: '', status: 'Activo', group: 'Barco', shift: 'Mañana', pago: '9.6' });

    const [felipeAdvanceForm, setFelipeAdvanceForm] = useState({ motivo: '', monto: '' });
    const [guests, setGuests] = useState<any[]>([]);
    const [guestForm, setGuestForm] = useState({ username: '', password: '', status: 'aprobado' });

    const [binanceARS, setBinanceARS] = useState('');
    const [binanceUSDT, setBinanceUSDT] = useState('');
    const [isFetchingPrice, setIsFetchingPrice] = useState(false);
    const [showBinanceCalc, setShowBinanceCalc] = useState(false);

    // --- CALCULADORA STATE ---
    const [showCalc, setShowCalc] = useState(false);
    const [calcValue, setCalcValue] = useState('0');
    const [pendingOp, setPendingOp] = useState<string | null>(null);
    const [prevValue, setPrevValue] = useState<string | null>(null);

    const handleCalcAction = (action: string) => {
        if (/[0-9]/.test(action)) {
            setCalcValue(prev => (prev === '0' ? action : prev + action));
        } else if (action === '.') {
            if (!calcValue.includes('.')) setCalcValue(prev => prev + '.');
        } else if (action === 'C') {
            setCalcValue('0');
            setPendingOp(null);
            setPrevValue(null);
        } else if (action === '=') {
            if (pendingOp && prevValue !== null) {
                const current = parseFloat(calcValue);
                const previous = parseFloat(prevValue);
                let result = 0;
                if (pendingOp === '+') result = previous + current;
                if (pendingOp === '-') result = previous - current;
                if (pendingOp === '*') result = previous * current;
                if (pendingOp === '/') result = current !== 0 ? previous / current : 0;

                const finalResult = Math.round(result * 100) / 100;
                setCalcValue(finalResult.toString());
                setPendingOp(null);
                setPrevValue(null);
            }
        } else {
            if (pendingOp && prevValue !== null && calcValue !== '0') {
                const current = parseFloat(calcValue);
                const previous = parseFloat(prevValue);
                let partial = 0;
                if (pendingOp === '+') partial = previous + current;
                if (pendingOp === '-') partial = previous - current;
                if (pendingOp === '*') partial = previous * current;
                if (pendingOp === '/') partial = current !== 0 ? previous / current : 0;

                setPrevValue(partial.toString());
                setPendingOp(action);
                setCalcValue('0');
            } else {
                setPendingOp(action);
                setPrevValue(calcValue);
                setCalcValue('0');
            }
        }
    };

    // --- AUTO-SAVE STATES ---
    const [isLoaded, setIsLoaded] = useState(false);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [backupStatus, setBackupStatus] = useState<'idle' | 'backing-up' | 'success' | 'error'>('idle');

    // Manual Backup Handler
    const fetchFullAndBackup = async (force: boolean = false) => {
        setBackupStatus('backing-up');
        try {
            // 1. Define valid operating range (From Dec 29, 2025)
            const backupStart = '2025-12-29';
            const backupEnd = '2026-12-31';

            // 2. Fetch Aggregated Data (Operative) - PAGINATED LOOP
            let dbRegs: any[] = [];
            let rangeStart = 0;
            const batchSize = 1000;
            let hasMore = true;

            if (import.meta.env.DEV) console.log('🔍 Backup: Starting fetch loop...');
            while (hasMore) {
                const { data: batch } = await supabase
                    .from('registros_operativos')
                    .select('*')
                    .gte('fecha_operacion', backupStart)
                    .lte('fecha_operacion', backupEnd)
                    .range(rangeStart, rangeStart + batchSize - 1);

                if (batch && batch.length > 0) {
                    dbRegs = dbRegs.concat(batch);
                    rangeStart += batchSize;
                    hasMore = batch.length === batchSize; // If full batch, maybe more
                } else {
                    hasMore = false;
                }
            }
            if (import.meta.env.DEV) {
                console.log(`🔍 Backup: Fetched ${dbRegs.length} operational records`);
                if (dbRegs.length > 0) console.log('🔍 Sample Record:', dbRegs[0]);
            }

            // 3. Fetch Manual Overrides
            const { data: manualOverrides } = await supabase
                .from('registros_diarios_manuales')
                .select('*')
                .gte('fecha', backupStart)
                .lte('fecha', backupEnd);

            // 4. Merge Logic 
            const sums: any = {};

            // Generate dates
            const start = new Date(backupStart);
            const end = new Date();
            const dateArray = [];
            let curr = new Date(start);
            while (curr <= end) {
                dateArray.push(curr.toISOString().split('T')[0]);
                curr.setDate(curr.getDate() + 1);
            }

            dateArray.forEach(date => {
                sums[date] = {
                    id: date, fullDate: date, dia: date,
                    barco: 0, cueva: 0, mesasBarco: 0, mesasCueva: 0,
                    utilidad: 0, gastos: 0, drop: 0,
                    isManual: false
                };
            });

            // Aggregate DB Data
            dbRegs?.forEach((r: any) => {
                const rawDate = r.fecha_operacion || '';
                const tDate = rawDate.includes('T') ? rawDate.split('T')[0] : rawDate;

                if (sums[tDate]) {
                    let val = Number(r.ganancia_calculada);
                    if (!val && r.monto_apuesta) val = r.monto_apuesta * 0.05; // Fallback
                    val = val || 0;

                    if (r.bando === 'Barco') {
                        sums[tDate].barco += val;
                        if (r.mesa && r.mesa !== 'General') sums[tDate].mesasBarco += val;
                    } else if (r.bando === 'Cueva') {
                        sums[tDate].cueva += val;
                        if (r.mesa && r.mesa !== 'General') sums[tDate].mesasCueva += val;
                    }
                }
            });

            // Apply Manual Overrides
            manualOverrides?.forEach((m: any) => {
                const rawDate = m.fecha || '';
                const date = rawDate.includes('T') ? rawDate.split('T')[0] : rawDate;
                if (sums[date]) {
                    sums[date] = {
                        ...sums[date],
                        barco: Number(m.barco),
                        cueva: Number(m.cueva),
                        mesasBarco: Number(m.mesas_barco),
                        mesasCueva: Number(m.mesas_cueva),
                        utilidad: Number(m.utilidad),
                        gastos: Number(m.gastos),
                        drop: Number(m.drop_val),
                        isManual: true
                    };
                }
            });

            const fullData = Object.values(sums).sort((a: any, b: any) => a.fullDate.localeCompare(b.fullDate));

            // 5. Send to Backup
            const result = await backupToGoogleSheets(fullData, force);

            if (result.success) {
                setBackupStatus('success');
                setTimeout(() => setBackupStatus('idle'), 3000);
            } else if (result.skipped) {
                if (import.meta.env.DEV) console.log('Skipped backup (already done today)');
                setBackupStatus('idle');
            } else {
                console.error(result.error);
                setBackupStatus('error');
                setTimeout(() => setBackupStatus('idle'), 3000);
            }

        } catch (err) {
            console.error(err);
            setBackupStatus('error');
            setTimeout(() => setBackupStatus('idle'), 3000);
        }
    };

    const handleManualBackup = () => { if (role === 'guest') return; fetchFullAndBackup(true); };

    const handleClearMonth = () => {
        if (!isAdminOrVice) return;
        if (!confirm(`¿⚠️ ATENCIÓN: Estás seguro de BORRAR TODOS los datos de ${monthNames[selectedMonth]} ${selectedYear}? Esta acción es irreversible.`)) return;

        const updated = { ...shiftsMatrix };
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

        setShiftsMatrix(updated);
        alert("Mes limpiado correctamente.");
    };

    // Identificador único de sesión para evitar bucles infinitos en Realtime
    const [sessionId] = useState(() => Math.random().toString(36).substring(7));
    const isRemoteUpdate = useState({ current: false })[0]; // Usamos objeto mutable para persistencia entre renders

    // Formatters
    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(value);
    };

    const formatUSD = (value: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(value);
    }

    const formatNumber = (value: number) => {
        return new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
    }

    // Logic
    const daysInFortnight = currentFortnight === 1
        ? Array.from({ length: 15 }, (_, i) => i + 1)
        : Array.from({ length: 16 }, (_, i) => i + 16);

    // Helpper to parse "8:30" => 8.5
    const parseHours = (val: string | number): number => {
        if (typeof val === 'number') return val;
        if (!val) return 0;

        // Handle "HH:MM"
        if (val.includes(':')) {
            const [h, m] = val.split(':').map(Number);
            return (h || 0) + ((m || 0) / 60);
        }

        // Handle normal numbers (replace comma with dot just in case)
        return parseFloat(val.replace(',', '.')) || 0;
    };

    const handleShiftChange = (empId: any, day: number, value: any) => {
        if (role === 'guest') return;
        setShiftsMatrix((prev: any) => {
            const dateKey = `${selectedYear}-${(selectedMonth + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

            const newEmpData = { ...prev[empId] };
            newEmpData[dateKey] = value;

            // CLEANUP: If we are writing a new date key, we should ensure the legacy key is removed/synced if needed.
            // But for safety in this transition, if it's Jan 2026, we might want to kill the legacy key so it doesn't conflictingly display?
            // Actually, getShiftValue prioritizes dateKey, so legacy key becomes irrelevant once dateKey exists.

            return {
                ...prev,
                [empId]: newEmpData
            };
        });
    };

    const getShiftValue = (empId: any, day: number) => {
        const dateKey = `${selectedYear}-${(selectedMonth + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        let val = shiftsMatrix[empId]?.[dateKey];

        // FALLBACK LEGACY: Solo para Enero 2026
        if (!val && selectedYear === 2026 && selectedMonth === 0) {
            val = shiftsMatrix[empId]?.[day];
        }

        val = val || '';
        if (typeof val === 'object' && val !== null) return val.horas || '';
        return val;
    };

    const calculateEmployeeStats = (empId: any) => {
        // FALLBACK: Si no hay datos por ID, intentamos por nombre (para IDs que migraron)
        let empShifts = shiftsMatrix[empId] || {};
        const emp = employees.find((e: any) => e.id === empId);

        if (Object.keys(empShifts).length === 0 && emp) {
            // Intentar encontrar si hay datos bajo algun ID numerico viejo que coincida con este nombre
            // (Esta es una proteccion proactiva contra el disconnect)
            const oldId = Object.keys(shiftsMatrix).find(id => {
                const oldEmp = employees.find((e: any) => e.id.toString() === id);
                return oldEmp && oldEmp.name === emp.name;
            });
            if (oldId) empShifts = shiftsMatrix[oldId];
        }

        let totalHours = 0;
        let totalPayUSD = 0;

        // CHECK FOR TOTAL OVERRIDE FIRST
        const overrideKey = `TOTAL_OV_${selectedYear}_${selectedMonth}_${currentFortnight}`;
        const totalOverride = empShifts[overrideKey];

        if (totalOverride !== undefined && totalOverride !== "") {
            // Still calculate hours for display, but fix pay
            daysInFortnight.forEach(day => {
                const dateKey = `${selectedYear}-${(selectedMonth + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                let val = empShifts[dateKey];
                // Legacy fallback
                if (val === undefined && selectedMonth === 0 && selectedYear === 2026) val = empShifts[day];

                let hours = 0;
                if (typeof val === 'object' && val !== null) hours = parseHours(val.horas);
                else hours = parseHours(val);
                totalHours += hours;
            });
            return { totalHours, totalPayUSD: parseFloat(totalOverride) };
        }

        daysInFortnight.forEach(day => {
            const dateKey = `${selectedYear}-${(selectedMonth + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
            let val = empShifts[dateKey];

            // FALLBACK LEGACY: Solo para Enero 2026
            if (val === undefined && selectedMonth === 0 && selectedYear === 2026) {
                val = empShifts[day];
            }

            // Calc Hours
            let hours = 0;
            if (typeof val === 'object' && val !== null) {
                hours = parseHours(val.horas);
            } else {
                hours = parseHours(val);
            }
            totalHours += hours;

            // Safe Access to Custom Pay
            const customPay = (typeof val === 'object' && val !== null) ? val.customPay : undefined;

            // Calc Pay Per Day (Vital for Feb 2026 split rates)
            if (hours > 0) {
                const shiftsCount = hours / HOURS_PER_SHIFT;
                let currentRate = emp?.pago || SHIFT_VALUE_USD;

                // MANUAL PAY OVERRIDE (If edited in NominaModule)
                if (customPay !== undefined && customPay !== "") {
                    totalPayUSD += parseFloat(customPay);
                } else {
                    totalPayUSD += shiftsCount * currentRate;
                }
            } else if (customPay !== undefined && customPay !== "") {
                // If 0 hours but Manual Pay set (e.g. Bonus/Correction)
                totalPayUSD += parseFloat(customPay);
            }
        });

        return { totalHours, totalPayUSD };
    };

    const handleSaveOp = (e: any) => {
        e.preventDefault();
        if (role === 'guest') return;
        const newItem = {
            // Preservar ID si es edición, o generar Timestamp si es nuevo
            id: editingItem?.id || Date.now(),
            dia: opForm.dia,
            // Asegurar fullDate correcto
            fullDate: editingItem?.fullDate || `${selectedYear}-${(selectedMonth + 1).toString().padStart(2, '0')}-${opForm.dia.padStart(2, '0')}`,
            barco: Math.max(0, parseFloat(opForm.barco) || 0),
            cueva: Math.max(0, parseFloat(opForm.cueva) || 0),
            mesasBarco: Math.max(0, parseInt(opForm.mesasBarco) || 0),
            mesasCueva: Math.max(0, parseInt(opForm.mesasCueva) || 0),
            utilidad: editingItem?.utilidad || 0,
            gastos: editingItem?.gastos || 0,
            drop: editingItem?.drop || 0,
            isManual: true // Marca como edición manual
        };

        // --- SAVE TO SUPABASE (FIX: PERSISTENCE) ---
        supabase.from('registros_diarios_manuales').upsert({
            fecha: newItem.fullDate,
            barco: newItem.barco,
            cueva: newItem.cueva,
            mesas_barco: newItem.mesasBarco,
            mesas_cueva: newItem.mesasCueva,
            utilidad: newItem.utilidad || 0,
            gastos: newItem.gastos || 0,
            drop_val: newItem.drop || 0,
            updated_by: userEmail
        }, { onConflict: 'fecha' })
            .then(({ error }) => {
                if (error) {
                    console.error("Error guardando en nube:", error);
                } else {
                    // Trigger Full Backup (Automatic)
                    // CACHE PROTECTION: Desactivado backup automático global para reducir lecturas masivas
                    // fetchFullAndBackup(false);
                }
            });
        // ------------------------------------------

        if (editingItem) setData(data.map((d: any) => d.id === newItem.id ? newItem : d));
        else setData([...data, newItem]);
        setActiveModal(null);
    };
    const handleDeleteOp = (id: number) => { if (role === 'guest') return; if (confirm('Borrar?')) setData(data.filter((d: any) => d.id !== id)); };

    const handleSaveShip = (e: any) => { e.preventDefault(); if (role === 'guest') return; const newItem = { id: editingItem?.id || Date.now(), fecha: shipForm.fecha, monto: parseFloat(shipForm.monto), nota: shipForm.nota, comprobante: shipForm.comprobante }; if (editingItem) setShipments(shipments.map((s: any) => s.id === newItem.id ? newItem : s)); else setShipments([...shipments, newItem]); setActiveModal(null); };
    const handleDeleteShip = (id: number) => { if (role === 'guest') return; if (confirm('Borrar?')) setShipments(shipments.filter((s: any) => s.id !== id)); };

    const handleSaveBank = (e: any) => { e.preventDefault(); if (role === 'guest') return; const newItem = { id: editingItem?.id || Date.now(), nombre: bankForm.nombre, monto: parseFloat(bankForm.monto) }; if (editingItem) setBanks(banks.map((b: any) => b.id === newItem.id ? newItem : b)); else setBanks([...banks, newItem]); setActiveModal(null); };
    const handleDeleteBank = (id: number) => { if (role === 'guest') return; if (confirm('Borrar?')) setBanks(banks.filter((b: any) => b.id !== id)); };

    const handleSaveEmployee = async (e: any) => {
        e.preventDefault();
        if (role === 'guest') return;
        const newItem = {
            id: editingItem?.id || Date.now(),
            name: employeeForm.name,
            password: employeeForm.password, // Capture password from form
            status: employeeForm.status,
            group: employeeForm.group,
            shift: employeeForm.shift,
            pago: parseFloat(employeeForm.pago) || 9.6
        };

        // 1. Update Local State immediately
        if (editingItem) setEmployees(employees.map((em: any) => em.id === newItem.id ? newItem : em));
        else setEmployees([...employees, newItem]);
        setActiveModal(null);

        // 2. Persist to 'usuarios_sistema' (The "Principal" DB)
        // Map Group to Role
        let dbRole = 'fijo_barco';
        if (newItem.group === 'Cueva') dbRole = 'fijo_cueva';

        // Use name as username ID if random ID
        // Use name as username ID if random ID
        // FIX: Ensure ID is valid UUID before sending to DB.
        const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

        let validUUID = undefined;
        if (editingItem?.id && typeof editingItem.id === 'string' && isUUID(editingItem.id)) {
            validUUID = editingItem.id;
        }

        // Generate stable username for upsert match
        const usernameBase = newItem.name.toLowerCase().replace(/\s+/g, '.').normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const dbUsername = validUUID ? (editingItem?.email?.split('@')[0] || usernameBase) : usernameBase;

        const payload: any = {
            id: validUUID,
            username: dbUsername, // Match on username if ID is missing/invalid
            nombre: newItem.name,
            role: dbRole,
            estado: newItem.status === 'Activo' ? 'aprobado' : 'pendiente'
        };

        // PASSWORD LOGIC
        // 1. If user typed a password, use it.
        // 2. If it's a NEW user and no password, force default '123456'.
        // 3. If editing and no password typed, do NOTHING (keep existing).
        if (newItem.password && newItem.password.trim() !== '') {
            payload.password_text = newItem.password.trim();
        } else if (!editingItem) {
            payload.password_text = '123456';
        }

        // FIX: Add default password for NEW users to avoid DB Not-Null constraint error
        // (Redundant now given above, but keeping for clarity if we change logic later)
        if (!editingItem) {
            payload.password_text = '123456';
        }

        const { error } = await supabase.from('usuarios_sistema').upsert(payload, { onConflict: 'username' });

        if (error) {
            console.error("Error syncing to usuarios_sistema:", error);
            alert("Guardado localmente, pero error conectando con DB Principal: " + error.message);
        } else {
            // Re-sync to ensure everything matches
            // setTimeout(syncEmployeesWithDB, 1000); 
        }
    };
    const handleDeleteEmployee = async (id: number | string) => {
        if (role === 'guest') return;
        if (!confirm('¿Eliminar empleado definitivamente de la lista y del acceso al sistema?')) return;

        // 1. Encontrar al empleado para tener su info de DB
        const empToDelete = employees.find((e: any) => e.id === id);

        // 2. Eliminar localmente
        setEmployees(employees.filter((em: any) => em.id !== id));

        // 3. Eliminar de la base de datos principal si existe
        if (empToDelete && empToDelete.name) {
            const username = empToDelete.name.toLowerCase().replace(/\s+/g, '.').normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const { error } = await supabase
                .from('usuarios_sistema')
                .delete()
                .eq('username', username);

            if (error) {
                console.error("Error al borrar de DB:", error);
            } else {
                alert(`Empleado ${empToDelete.name} eliminado correctamente.`);
            }
        }
    };

    const handleSaveFelipeAdvance = (e: any) => {
        e.preventDefault();
        if (role === 'guest') return;
        const newItem = { id: editingItem?.id || Date.now(), motivo: felipeAdvanceForm.motivo, monto: parseFloat(felipeAdvanceForm.monto) };
        if (editingItem) setFelipeAdvances(felipeAdvances.map((a: any) => a.id === newItem.id ? newItem : a));
        else setFelipeAdvances([...(felipeAdvances || []), newItem]);
        setActiveModal(null);
    };
    const handleDeleteFelipeAdvance = (id: number) => { if (role === 'guest') return; if (confirm('Borrar adelanto?')) setFelipeAdvances(felipeAdvances.filter((a: any) => a.id !== id)); };

    // --- GUEST MANAGEMENT LOGIC ---
    const loadGuests = async () => {
        if (!isAdminOrVice) return;
        const { data } = await supabase.from('usuarios_sistema').select('*').eq('role', 'guest');
        if (data) setGuests(data);
    };

    const handleSaveGuest = async (e: any) => {
        e.preventDefault();
        if (role === 'guest') return;

        // Prepare base payload
        const payload: any = {
            username: guestForm.username.toLowerCase().trim(),
            password_text: guestForm.password || '123456',
            role: 'guest',
            estado: guestForm.status,
            // Only set name if creating new, otherwise keep existing or generic
            nombre: editingItem?.nombre || `Invitado ${Math.floor(Math.random() * 1000)}`
        };

        let result;
        if (editingItem?.id) {
            // STRICT UPDATE
            result = await supabase
                .from('usuarios_sistema')
                .update(payload)
                .eq('id', editingItem.id);
        } else {
            // INSERT
            result = await supabase
                .from('usuarios_sistema')
                .insert(payload);
        }

        const { error } = result;

        if (error) {
            alert('Error guardando invitado: ' + error.message);
        } else {
            setActiveModal(null);
            // Force small delay to allow DB propagation
            setTimeout(() => loadGuests(), 200);
        }
    };

    const handleDeleteGuest = async (id: string) => {
        if (role === 'guest') return;
        if (!confirm('¿Eliminar invitado permanentemente?')) return;
        const { error } = await supabase.from('usuarios_sistema').delete().eq('id', id);
        if (error) alert(error.message);
        else loadGuests();
    };

    useEffect(() => {
        if (role === 'admin') loadGuests();
    }, [role]);


    const syncEmployeesWithDB = async () => {
        const { data: dbUsers } = await supabase
            .from('usuarios_sistema')
            .select('*')
            .in('role', ['fijo_barco', 'fijo_cueva'])
            .eq('estado', 'aprobado');

        if (dbUsers) {
            // DEDUPLICACIÓN POR NOMBRE (Evitar "Clemente" y "Clemente ")
            const uniqueUsersMap = new Map<string, any>();
            dbUsers.forEach(u => {
                const cleanName = u.nombre.trim().toLowerCase();
                const existing = uniqueUsersMap.get(cleanName);

                // Prioridad: Si ya existe, solo reemplazar si el nuevo es "fijo" y el previo no lo era
                if (!existing) {
                    uniqueUsersMap.set(cleanName, u);
                } else {
                    const isNewFijo = ['fijo_barco', 'fijo_cueva'].includes(u.role);
                    const isOldFijo = ['fijo_barco', 'fijo_cueva'].includes(existing.role);
                    if (isNewFijo && !isOldFijo) {
                        uniqueUsersMap.set(cleanName, u);
                    }
                }
            });

            const dedupedUsers = Array.from(uniqueUsersMap.values());

            setEmployees((prev: any[]) => {
                const newMatrix = { ...shiftsMatrix };
                let migrated = false;

                const updated = dedupedUsers.map(u => {
                    const username = u.username;
                    // Buscar TODOS los posibles IDs previos para este nombre para no dejar datos atrás
                    const previousMatches = prev.filter(e =>
                        e.name.trim().toLowerCase() === u.nombre.trim().toLowerCase() ||
                        String(e.id) === username
                    );

                    previousMatches.forEach(prevEmp => {
                        const oldId = String(prevEmp.id);
                        if (oldId !== username && shiftsMatrix[oldId]) {
                            // Migrar/Fusionar datos al nuevo ID estable
                            newMatrix[username] = { ...(newMatrix[username] || {}), ...shiftsMatrix[oldId] };
                            migrated = true;
                        }
                    });

                    const existing = previousMatches.find(e => String(e.id) === username) || previousMatches[0];

                    return {
                        id: username, // Usar username como ID estable
                        name: u.nombre.trim(),
                        email: username,
                        status: existing?.status || 'Activo',
                        group: u.role === 'fijo_barco' ? 'Barco' : (u.role === 'fijo_cueva' ? 'Cueva' : (existing?.group || 'Barco')),
                        shift: existing?.shift || 'Mañana',
                        pago: existing?.pago || 9.6
                    };
                });

                if (migrated) setShiftsMatrix(newMatrix);
                return updated;
            });
        }
    };




    // --- SUPABASE INTEGRATION: FULL SYNC ---

    // 1. Cargar Estado Completo al Inicio
    // --- SUPABASE INTEGRATION: FULL SYNC & REALTIME ---

    useEffect(() => {
        const handleOnlineStatus = () => setIsOnline(navigator.onLine);
        window.addEventListener('online', handleOnlineStatus);
        window.addEventListener('offline', handleOnlineStatus);
        return () => {
            window.removeEventListener('online', handleOnlineStatus);
            window.removeEventListener('offline', handleOnlineStatus);
        };
    }, []);

    // 1. Cargar Estado Completo al Inicio y Suscribirse a Cambios
    useEffect(() => {
        const fetchFullState = async () => {
            console.log('🔄 Sincronizando: Buscando respaldo en nube...');
            try {
                const { data: backupData } = await supabase
                    .from('app_backups')
                    .select('content')
                    .eq('id', 1)
                    .single();

                if (backupData?.content) {
                    hydrateState(backupData.content);
                }
            } catch (err) {
                console.error('Excepción al cargar:', err);
            } finally {
                setIsLoaded(true);
                // SINCRONIZACION DINAMICA DE EMPLEADOS DESDE LA DB PRINCIPAL
                syncEmployeesWithDB();
            }
        };

        const hydrateState = (c: any) => {
            console.log('💧 Hidratando estado desde la nube...');
            isRemoteUpdate.current = true; // Marcar como actualización remota para evitar re-guardado

            // IMPORTANTE: NO SOBRESCRIBIMOS "data" (Operative) DIRECTAMENTE desde el backup
            // Porque el backup puede ser viejo y sobrescribir el cálculo de "Ganancia Real"
            // En su lugar, si hay overrides manuales en el backup, podríamos guardarlos (opcional)
            // Pero para arreglar el bug de $0, lo mejor es dejar que syncData() haga su trabajo.
            // CRITICAL FIX: DO NOT hydrate operative data from backups
            // Registro Diario should ALWAYS come from registros_operativos + registros_diarios_manuales
            // The backup system was overwriting real DB data with stale cached values
            // if (c.operative && c.operative.length > 0) {
            //     localStorage.setItem(`opData_${selectedYear}_${selectedMonth}_${viewMode}`, JSON.stringify(c.operative));
            //     setForceSyncCount(prev => prev + 1);
            // }

            if (c.shipments && c.shipments.length > 0) setShipments(c.shipments);
            if (c.banks && c.banks.length > 0) setBanks(c.banks);
            if (c.players && c.players.length > 0) setPlayers(c.players);
            if (c.employees && c.employees.length > 0) setEmployees(c.employees);

            // SEGURIDAD: Solo hidratar turnos si el backup contiene datos reales
            if (c.shifts && Object.keys(c.shifts).length > 0) {
                setShiftsMatrix(c.shifts);
            }
            if (c.shiftsNotes && Object.keys(c.shiftsNotes).length > 0) {
                setShiftsNotes(c.shiftsNotes);
            }

            if (c.felipe) {
                if (c.felipe.days !== undefined) setFelipeDays(c.felipe.days);
                if (c.felipe.extra !== undefined) setFelipeExtraDays(c.felipe.extra);
                if (c.felipe.free !== undefined) setFelipeAssignedFreeDays(c.felipe.free);
                if (c.felipe.advances !== undefined) setFelipeAdvances(c.felipe.advances);
            }
            if (c.usdtRate !== undefined) setUsdtRate(c.usdtRate);
            if (c.publicityActive !== undefined) setPublicityActive(c.publicityActive);
            if (c.pubARS !== undefined) setPubARS(c.pubARS);
            if (c.pubUSD !== undefined) setPubUSD(c.pubUSD);
            if (c.includePublicityInTotal !== undefined) setIncludePublicityInTotal(c.includePublicityInTotal);

            // Persistencia de la Vista (Quincena/Mes seleccionado)
            if (c.viewConfig) {
                if (c.viewConfig.month !== undefined) setSelectedMonth(c.viewConfig.month);
                if (c.viewConfig.year !== undefined) setSelectedYear(c.viewConfig.year);
                if (c.viewConfig.viewMode !== undefined) {
                    const vm = c.viewConfig.viewMode;
                    setViewMode(vm);
                    // Actualizar también el estado interno de la nómina
                    _setCurrentFortnight(vm === 'Q1' ? 1 : 2);
                }
            }

            // Hack para resetear la bandera después de que se procesen los efectos
            setTimeout(() => { isRemoteUpdate.current = false; }, 500);
        };

        fetchFullState();

        // PRODUCTION FIX: Real-time sync disabled to prevent excessive Supabase requests
        // This was causing 25k+ requests and constant data overwrites
        // If you need real-time sync, implement debouncing/throttling (e.g., max 1 update per 30 seconds)
        /*
        const channel = supabase
            .channel('dashboard-changes')
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'app_backups', filter: 'id=eq.1' },
                (payload) => {
                    const newContent = payload.new.content;
                    if (newContent?.meta?.sessionId === sessionId) {
                        return;
                    }
                    console.log('📡 Cambio recibido en tiempo real de otro usuario!');
                    hydrateState(newContent);
                    syncEmployeesWithDB();
                    setSaveStatus('saved');
                    setTimeout(() => setSaveStatus('idle'), 2000);
                }
            )
            .subscribe();
    
        return () => {
            supabase.removeChannel(channel);
        };
        */
    }, []);

    // 2. Función de Guardado (Reutilizable)
    const saveToCloud = async (silent = false) => {
        if (!silent) setSaveStatus('saving');

        const fullBackup = {
            operative: data,
            shipments: shipments,
            banks: banks,
            players: players,
            employees: employees,
            shifts: shiftsMatrix,
            shiftsNotes: shiftsNotes,
            felipe: { days: felipeDays, extra: felipeExtraDays, free: felipeAssignedFreeDays, advances: felipeAdvances },
            usdtRate: usdtRate,
            publicityActive: publicityActive,
            pubARS: pubARS,
            pubUSD: pubUSD,
            includePublicityInTotal: includePublicityInTotal,
            viewConfig: {
                month: selectedMonth,
                year: selectedYear,
                viewMode: viewMode
            },
            meta: {
                timestamp: new Date().toISOString(),
                user: role,
                sessionId: sessionId // Firmamos el cambio con nuestra ID
            }
        };

        // SEGURIDAD: Antes de guardar, verificamos que no estemos guardando algo vacío si ya hay datos
        if (data.length === 0 && employees.length === 0 && shipments.length === 0) {
            // Si todo está vacío, podría ser un error de carga. No sobrescribimos el backup principal.
            console.warn("⚠️ Intento de guardar estado vacío. Abortando para proteger la DB.");
            return;
        }

        // 1. Guardar como principal (ID 1)
        const { error } = await supabase.from('app_backups').upsert({
            id: 1,
            updated_at: new Date().toISOString(),
            content: fullBackup
        }, { onConflict: 'id' });

        // 2. Guardar HISTORIAL (ID basado en timestamp) - Esto asegura que NADA se borre para siempre
        // Guardamos una versión cada hora como máximo para no saturar
        const hourlyId = Math.floor(Date.now() / (1000 * 60 * 60));
        await supabase.from('app_backups').upsert({
            id: hourlyId,
            updated_at: new Date().toISOString(),
            content: fullBackup
        }, { onConflict: 'id' });

        if (error) {
            console.error('Error guardando:', error);
            if (!silent) {
                setSaveStatus('error');
                alert(`⚠️ ERROR DE GUARDADO: ${error.message || 'Error desconocido'}`);
            }
        } else {
            console.log('☁️ Estado guardado en Supabase (con respaldo histórico)');
            if (!silent) setSaveStatus('saved');
            if (!silent) setTimeout(() => setSaveStatus('idle'), 2000);
        }
    };

    // 3. Auto-Save Effect (Debounced)
    useEffect(() => {
        if (!isLoaded) return;

        // CRÍTICO: Si el cambio vino de fuera (Realtime), NO lo guardamos de vuelta.
        if (isRemoteUpdate.current) {
            return;
        }

        setSaveStatus('saving');

        const timer = setTimeout(() => {
            saveToCloud();
        }, 5000); // PRODUCTION: Increased to 5s to reduce Supabase writes

        return () => clearTimeout(timer);
    }, [data, shipments, banks, players, employees, shiftsMatrix, shiftsNotes, felipeDays, felipeExtraDays, felipeAssignedFreeDays, felipeAdvances, usdtRate, publicityActive, pubARS, pubUSD, isLoaded]);

    // 4. Bloqueo de salida si está guardando
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (saveStatus === 'saving') {
                e.preventDefault();
                e.returnValue = 'Guardado en progreso. ¿Seguro que quieres salir?';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [saveStatus]);

    // --- ACTIONS HANDLERS ---

    // Manual Trigger (ahora usa la misma logica)




    const handleSavePlayer = (e: any) => { e.preventDefault(); if (role === 'guest') return; if (editingItem) setPlayers(players.map((p: any) => p.id === editingItem.id ? { ...p, saldo: parseFloat(playerForm.saldo) } : p)); setActiveModal(null); };

    const totalBarco = data.reduce((sum: any, item: any) => sum + item.barco, 0);
    const totalCueva = data.reduce((sum: any, item: any) => sum + item.cueva, 0);

    // --- FILTRO DE ENVIOS DINÁMICO ---
    const filteredShipments = shipments.filter((s: any) => {
        const [d, m, y] = s.fecha.split('/').map(Number);
        const sYear = y || 2026; // Default to 2026 if not present

        // Regla Especial de Febrero: Incluir 31 de Enero
        if (selectedMonth === 1 && selectedYear === 2026) {
            return (m === 2 && sYear === 2026) || (m === 1 && d === 31 && sYear === 2026);
        }

        // Regla Especial de Enero: EXCLUIR el 31 (ya que se suma a Febrero)
        if (selectedMonth === 0 && selectedYear === 2026) {
            return (m === 1 && d !== 31 && sYear === 2026);
        }

        // Regla General: Solo el mes y año seleccionado
        return m === (selectedMonth + 1) && sYear === selectedYear;
    }).sort((a: any, b: any) => {
        const [d1, m1] = a.fecha.split('/').map(Number);
        const [d2, m2] = b.fecha.split('/').map(Number);
        if (m1 !== m2) return m1 - m2;
        return d1 - d2;
    });

    const totalEnviado = filteredShipments.reduce((sum: any, item: any) => sum + item.monto, 0);

    const q1Shipments = filteredShipments.filter((s: any) => {
        const [d, m] = s.fecha.split('/').map(Number);
        if (selectedMonth === 1 && selectedYear === 2026) {
            return (m === 1 && d === 31) || (m === 2 && d <= 15);
        }
        return d <= 15;
    });

    const q2Shipments = filteredShipments.filter((s: any) => {
        const [d, m] = s.fecha.split('/').map(Number);
        if (selectedMonth === 1 && selectedYear === 2026) {
            return m === 2 && d > 15;
        }
        return d > 15;
    });

    const q1TotalSent = q1Shipments.filter((s: any) => dashboardGroup === 'Todos' || s.grupo === dashboardGroup).reduce((acc: any, s: any) => acc + s.monto, 0);
    const q2TotalSent = q2Shipments.filter((s: any) => dashboardGroup === 'Todos' || s.grupo === dashboardGroup).reduce((acc: any, s: any) => acc + s.monto, 0);

    // --- TOP PERFORMANCE LOGIC (QUINCENA) ---
    const topEmployees = employees
        .map((emp: any) => ({
            name: emp.name,
            group: emp.group,
            stats: calculateEmployeeStats(emp.id)
        }))
        .filter((emp: any) => emp.stats.totalHours > 0)
        .sort((a: any, b: any) => b.stats.totalHours - a.stats.totalHours)
        .slice(0, 3);

    const maxHours = topEmployees.length > 0 ? Math.max(...topEmployees.map((e: any) => e.stats.totalHours)) : 100;

    // --- CALCULOS PUBLICIDAD SINCRONIZADA ---
    const fortnightActivePublicity = Object.keys(publicityActive).filter(k => {
        const [y, m, _d] = k.split('-').map(Number);
        return y === selectedYear && m === (selectedMonth + 1) && daysInFortnight.includes(_d);
    });

    const totalFortnightPubARS_Barco = fortnightActivePublicity.reduce((acc, k) => acc + (publicityActive[k]?.Barco || 0), 0);
    const totalFortnightPubARS_Cueva = fortnightActivePublicity.reduce((acc, k) => acc + (publicityActive[k]?.Cueva || 0), 0);
    const totalFortnightPubARS_Total = totalFortnightPubARS_Barco + totalFortnightPubARS_Cueva;

    const totalFortnightPubUSD_Barco = usdtRate > 0 ? totalFortnightPubARS_Barco / usdtRate : 0;
    const totalFortnightPubUSD_Cueva = usdtRate > 0 ? totalFortnightPubARS_Cueva / usdtRate : 0;
    const totalFortnightPubUSD_Total = usdtRate > 0 ? totalFortnightPubARS_Total / usdtRate : 0;

    const monthlyActivePublicity = Object.keys(publicityActive).filter(k => {
        const [y, m, _d] = k.split('-').map(Number);
        return y === selectedYear && m === (selectedMonth + 1);
    });

    const totalMonthPubARS_Barco = monthlyActivePublicity.reduce((acc, k) => acc + (publicityActive[k]?.Barco || 0), 0);
    const totalMonthPubARS_Cueva = monthlyActivePublicity.reduce((acc, k) => acc + (publicityActive[k]?.Cueva || 0), 0);
    const totalMonthPubARS_Total = totalMonthPubARS_Barco + totalMonthPubARS_Cueva;

    const totalMonthPubUSD_Total = usdtRate > 0 ? totalMonthPubARS_Total / usdtRate : 0;

    // --- CALCULOS NOMINA FINAL ---
    const staffTotalUSD = employees.reduce((acc: number, emp: any) => acc + (calculateEmployeeStats(emp.id)?.totalPayUSD || 0), 0);
    const felipeTotalUSD = (((felipeDays || 0) + (felipeExtraDays || 0)) * 28.84) - ((felipeAdvances || []).reduce((acc: number, cur: any) => acc + (cur.monto || 0), 0));
    const subTotalPayrollUSD = staffTotalUSD + felipeTotalUSD;
    const grandTotalUSD = subTotalPayrollUSD + (includePublicityInTotal ? (totalFortnightPubUSD_Total || 0) : 0);

    const fetchLivePrice = async () => {
        setIsFetchingPrice(true);
        try {
            const res = await fetch('https://criptoya.com/api/binance/usdt/ars/1');
            const data = await res.json();
            if (data.ask) {
                setUsdtRate(Math.ceil(data.ask));
            }
        } catch (e) {
            console.error("Error fetching price", e);
        } finally {
            setIsFetchingPrice(false);
        }
    };

    // Auto-fetch price on mount
    useEffect(() => {
        fetchLivePrice();
    }, []);






    // Reactive calculation when rate changes
    useEffect(() => {
        if (binanceARS && usdtRate > 0) {
            setBinanceUSDT((parseFloat(binanceARS) / usdtRate).toFixed(2));
        }
    }, [usdtRate]);


    if (showNominaPage) {
        return (
            <NominaModule
                key={`${selectedMonth}-${selectedYear}`} // FORCE RE-MOUNT ON MONTH CHANGE
                user={{ email: userEmail, role, name: role === 'admin' ? 'Administrador' : userEmail.split('@')[0] }}
                employees={employees.filter((e: any) =>
                    dashboardGroup === 'Todos'
                        ? true
                        : e.group === dashboardGroup
                )}
                shiftsMatrix={shiftsMatrix}
                onBack={() => setShowNominaPage(false)}
                onSave={(newMatrix) => {
                    setShiftsMatrix(newMatrix);
                    // Instant Cloud Sync (Silent)
                    setTimeout(() => saveToCloud(true), 50);
                }}
                syncWithDB={syncEmployeesWithDB}
            />
        );
    }

    if (showPublicityAnalytics) {
        return <PublicityDashboard user={{ email: userEmail, role, name: role === 'admin' ? 'Master Admin' : 'Admin User' }} onLogout={onLogout} onBack={() => setShowPublicityAnalytics(false)} readOnly={role === 'guest'} usdtRate={usdtRate} initialGroup={dashboardGroup === 'Todos' ? 'Barco' : dashboardGroup} />;
    }

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 font-sans relative pb-20 selection:bg-purple-500/50">
            {/* STATUS INDICATOR BOTTOM RIGHT */}
            <div className={`fixed bottom-4 right-4 z-[100] px-4 py-2 rounded-full border backdrop-blur-md shadow-lg flex items-center gap-3 transition-all duration-300 font-bold text-xs uppercase tracking-widest ${!isOnline ? 'bg-red-500/20 border-red-500/50 text-red-500 translate-y-0 opacity-100' : saveStatus === 'saving' ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400 translate-y-0 opacity-100' : saveStatus === 'saved' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 translate-y-0 opacity-100' : saveStatus === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-500 translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
                {!isOnline && (
                    <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>MODO OFFLINE (RECONECTANDO...)</span>
                    </>
                )}
                {isOnline && saveStatus === 'saving' && (
                    <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>Sincronizando...</span>
                    </>
                )}
                {isOnline && saveStatus === 'saved' && (
                    <>
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span>Guardado</span>
                        <span className="text-[9px] opacity-70 normal-case border-l border-emerald-500/30 pl-2 ml-1">
                            {role === 'admin' ? `Admin: ${role}` : `User: ${role}`}
                        </span>
                    </>
                )}
                {isOnline && saveStatus === 'error' && <span>Error al guardar</span>}
            </div>

            {/* FUTURISTIC BACKGROUND */}
            {/* MODERN DEEP BACKGROUND - NO NOISE */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none z-0 bg-slate-950">
                <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-[#0f0c29] to-[#0b0f19] opacity-100"></div>
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#4f46e5]/10 rounded-full blur-[120px] animate-pulse-slow"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#3b82f6]/10 rounded-full blur-[120px] animate-pulse-slow delay-1000"></div>
                <div className="absolute top-[40%] left-[20%] w-[30%] h-[30%] bg-[#a855f7]/5 rounded-full blur-[100px]"></div>
            </div>

            <div className="relative z-10 p-4 max-w-[1800px] mx-auto space-y-6">

                {/* HEADER */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-4 border-b border-indigo-500/20 bg-slate-900/40 backdrop-blur-xl rounded-2xl px-6 shadow-2xl shadow-indigo-500/10">
                    <div className="flex flex-col items-center md:items-start gap-3">
                        <div className="flex justify-center md:justify-start relative group">
                            <div className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-full opacity-0 group-hover:opacity-30 transition-opacity duration-1000"></div>
                            <img src="/logo.png" alt="FMX Logo" className="w-64 md:w-80 h-auto drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] filter brightness-125 animate-pulse relative z-10" />
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-indigo-300/80 font-mono tracking-[0.2em] uppercase bg-black/20 px-3 py-1.5 rounded-full border border-white/5">
                            <div className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse"></span>
                                <span className="text-emerald-400">ONLINE</span>
                            </div>
                            <span className="text-slate-600 mx-1">|</span>
                            <span>SISTEMA OPERATIVO V3.1</span>
                        </div>

                        {/* SELECTOR DE GRUPO GLOBAL */}
                        <div className="flex bg-slate-950/60 p-1 rounded-xl border border-white/5 shadow-inner">
                            {['Todos', 'Barco', 'Cueva'].map((g) => (
                                <button
                                    key={g}
                                    onClick={() => setDashboardGroup(g as any)}
                                    className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase transition-all flex items-center gap-2 
                                    ${dashboardGroup === g
                                            ? g === 'Barco' ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.3)]'
                                                : g === 'Cueva' ? 'bg-slate-700 text-slate-200 border border-slate-600 shadow-lg'
                                                    : 'bg-indigo-600 text-white shadow-lg'
                                            : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    {g === 'Todos' ? <Users size={12} /> : g === 'Barco' ? <Ship size={12} /> : <Mountain size={12} />}
                                    {g === 'Todos' ? 'General' : g}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex gap-3 items-center flex-wrap justify-center md:justify-end">
                        {/* TOOLS (ADMIN ONLY) */}
                        {role === 'admin' && (
                            <button onClick={() => setShowMasterModal(true)} className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20 transition-all no-print" title="Vista Maestra Operativa">
                                <FileText size={20} />
                            </button>
                        )}



                        {/* LOGOUT (ALL USERS) */}
                        <button onClick={onLogout} className="p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:bg-red-900/50 hover:border-red-500/30 transition-all no-print" title="Cerrar Sesión">
                            <Lock size={20} />
                        </button>

                        {/* 2FA SETUP (ADMIN ONLY) */}
                        {role === 'admin' && (
                            <button onClick={handleOpen2FAModal} className="p-2.5 rounded-xl bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-400 hover:bg-fuchsia-500/20 transition-all no-print active:scale-95" title="Configurar Google Authenticator">
                                <ScanLine size={20} />
                            </button>
                        )}

                        {/* MANUAL SAVE (ADMIN) */}
                        {role === 'admin' && (
                            <button onClick={() => saveToCloud()} className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-all no-print active:scale-95" title="Guardar Manualmente">
                                <Send size={20} />
                            </button>
                        )}

                        {/* CALCULADORA (NUEVA POSICIÓN) */}
                        <button onClick={() => setShowCalc(!showCalc)} className={`p-2.5 rounded-xl border transition-all no-print ${showCalc ? 'bg-amber-500/40 border-amber-500/60 text-white shadow-[0_0_15px_rgba(245,158,11,0.3)]' : 'bg-amber-500/10 border-amber-500/20 text-amber-500 hover:bg-amber-500/20'}`} title="Calculadora Normal">
                            <CalcIcon size={20} />
                        </button>

                        {/* BINANCE CONVERTER (NUEVA POSICIÓN) */}
                        <button onClick={() => setShowBinanceCalc(!showBinanceCalc)} className={`p-2.5 rounded-xl border transition-all no-print ${showBinanceCalc ? 'bg-yellow-500/40 border-yellow-500/60 text-white shadow-[0_0_15px_rgba(234,179,8,0.3)]' : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500 hover:bg-yellow-500/20'}`} title="Binance Live Converter">
                            <CircleDollarSign size={20} />
                        </button>

                    </div>

                    {/* ACTIONS ROW (Mobile: Bottom, Desktop: Inline) */}
                    <div className="flex gap-3 items-center w-full md:w-auto justify-center md:justify-end">

                        {/* NÓMINA PRINCIPAL NAVIGATION */}
                        {role === 'admin' && (
                            <button onClick={() => setShowNominaPage(true)} className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20 transition-all no-print flex items-center gap-2 font-bold text-[10px] uppercase tracking-widest" title="Abrir Nómina Principal">
                                <Users size={18} /> NÓMINA
                            </button>
                        )}

                        {/* ADD DAY (ADMIN) */}
                        {role === 'admin' && (
                            <button onClick={() => { setActiveModal('operative'); setEditingItem(null); setOpForm({ dia: '', barco: '', cueva: '', mesasBarco: '', mesasCueva: '' }) }} className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-3 py-2 md:px-5 md:py-2.5 rounded-xl flex items-center gap-1.5 md:gap-2 text-[10px] md:text-sm font-bold shadow-lg shadow-emerald-500/20 transition-all border border-emerald-400/20 hover:scale-105 active:scale-95 no-print uppercase">
                                <PlusCircle size={14} className="md:w-[18px] md:h-[18px]" /> AGREGAR DÍA
                            </button>
                        )}
                    </div>
                </div>

                {/* --- KPI SUMMARY PREMIUM (3 CARDS) --- */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[
                        {
                            title: `GANANCIA ${monthNames[selectedMonth].toUpperCase()} (${viewMode})`,
                            icon: Activity,
                            color: 'indigo',
                            value: totalBarco + totalCueva,
                            details: [
                                { label: 'Barco', val: totalBarco, color: 'text-yellow-400' },
                                { label: 'Cueva', val: totalCueva, color: 'text-pink-400' }
                            ]
                        },
                        {
                            title: `ENVIADO ${monthNames[selectedMonth].toUpperCase()}`,
                            icon: Send,
                            color: 'purple',
                            value: filteredShipments.filter((s: any) => dashboardGroup === 'Todos' || s.grupo === dashboardGroup).reduce((acc: any, s: any) => acc + s.monto, 0),
                            details: [
                                { label: `Q1: ${selectedMonth === 1 ? '31/01' : '01'} - 15/${(selectedMonth + 1).toString().padStart(2, '0')}`, val: q1TotalSent, color: 'text-purple-300' },
                                { label: `Q2: 16 - Fin/${(selectedMonth + 1).toString().padStart(2, '0')}`, val: q2TotalSent, color: 'text-purple-400' }
                            ]
                        },
                        {
                            title: 'LIQUIDEZ BANCOS',
                            icon: Landmark,
                            color: 'emerald',
                            value: banks.reduce((acc: any, b: any) => acc + (parseFloat(b.monto) || 0), 0)
                        },
                    ].map((kpi: any, idx) => {
                        const colorMap: any = {
                            indigo: { border: 'border-indigo-500/20', icon: 'text-indigo-500', title: 'text-indigo-400', hover: 'hover:border-indigo-500/40 hover:shadow-indigo-500/10' },
                            purple: { border: 'border-purple-500/20', icon: 'text-purple-500', title: 'text-purple-400', hover: 'hover:border-purple-500/40 hover:shadow-purple-500/10' },
                            emerald: { border: 'border-emerald-500/20', icon: 'text-emerald-500', title: 'text-emerald-400', hover: 'hover:border-emerald-500/40 hover:shadow-emerald-500/10' },
                            rose: { border: 'border-rose-500/20', icon: 'text-rose-500', title: 'text-rose-400', hover: 'hover:border-rose-500/40 hover:shadow-rose-500/10' }
                        };
                        const colors = colorMap[kpi.color] || colorMap.indigo;

                        return (
                            <div key={idx} className={`bg-slate-900/60 backdrop-blur-2xl border p-4 md:p-6 rounded-[2rem] relative overflow-hidden group transition-all duration-500 hover:shadow-2xl ${colors.border} ${colors.hover}`}>
                                <div className={`absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 group-hover:scale-125 transition-all duration-700 ${colors.icon}`}><kpi.icon size={120} /></div>

                                <div className="flex flex-col relative z-10 h-full justify-between">
                                    <div>
                                        <span className={`text-[9px] font-black tracking-[0.2em] uppercase mb-4 block ${colors.title}`}>{kpi.title}</span>
                                        <div className="flex items-baseline gap-1 md:gap-2">
                                            <span className="text-xl md:text-3xl font-black text-white font-mono tracking-tighter transition-all group-hover:drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
                                                {formatCurrency(kpi.value || 0)}
                                            </span>
                                        </div>
                                    </div>

                                    {kpi.details ? (
                                        <div className="mt-6 pt-4 border-t border-white/5 grid grid-cols-2 gap-4">
                                            {kpi.details.map((det: any, i: number) => (
                                                <div key={i} className="flex flex-col">
                                                    <span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">{det.label}</span>
                                                    <span className={`text-sm font-mono font-bold ${det.color}`}>{formatCurrency(det.val)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="mt-6 pt-4 border-t border-white/5">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-1.5 h-1.5 rounded-full bg-${kpi.color}-500 animate-pulse`}></div>
                                                <span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">Monitoreo en Tiempo Real</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* --- MAIN CONTENT --- */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

                    {/* LEFT COLUMN */}
                    <div className="xl:col-span-2 space-y-6">

                        {/* HISTORICO OPERATIVO TABLE */}
                        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden shadow-2xl relative group">
                            <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 to-transparent pointer-events-none"></div>
                            <div className="px-5 py-4 border-b border-slate-700/50 flex flex-wrap gap-4 justify-between items-center bg-slate-900/80">
                                <h2 className="font-bold text-white flex items-center gap-2 text-sm uppercase tracking-widest">
                                    <div className="p-1.5 bg-yellow-400/20 rounded text-yellow-400"><Activity size={16} /></div>
                                    Registro Diario
                                </h2>

                                {/* CONTROLS */}
                                <div className="flex items-center gap-2">
                                    <select
                                        value={selectedMonth}
                                        onChange={e => setSelectedMonth(Number(e.target.value))}
                                        className="bg-slate-950 text-white text-xs py-1.5 px-3 rounded-lg border border-slate-700 outline-none focus:border-yellow-500 transition-colors"
                                    >
                                        {monthNames.map((m, i) => (
                                            <option key={i} value={i}>{m}</option>
                                        ))}
                                    </select>

                                    <select
                                        value={selectedYear}
                                        onChange={e => setSelectedYear(Number(e.target.value))}
                                        className="bg-slate-950 text-white text-xs py-1.5 px-3 rounded-lg border border-slate-700 outline-none focus:border-yellow-500 transition-colors"
                                    >
                                        <option value={2025}>2025</option>
                                        <option value={2026}>2026</option>
                                    </select>

                                    <div className="flex bg-slate-950 rounded-lg border border-slate-700 p-1">
                                        <button
                                            onClick={() => setFortnightBoth(1)}
                                            className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${viewMode === 'Q1' ? 'bg-yellow-500 text-slate-950 shadow-lg shadow-yellow-500/20' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                                        >
                                            Q1 (1-15)
                                        </button>
                                        <button
                                            onClick={() => setFortnightBoth(2)}
                                            className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${viewMode === 'Q2' ? 'bg-yellow-500 text-slate-950 shadow-lg shadow-yellow-500/20' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                                        >
                                            Q2 (16-End)
                                        </button>
                                    </div>

                                    {/* Manual Backup Button */}
                                    <button
                                        onClick={handleManualBackup}
                                        disabled={backupStatus === 'backing-up'}
                                        className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all flex items-center gap-2 ${backupStatus === 'success' ? 'bg-green-500 text-white' :
                                            backupStatus === 'error' ? 'bg-red-500 text-white' :
                                                backupStatus === 'backing-up' ? 'bg-yellow-500 text-slate-950' :
                                                    'bg-slate-700 hover:bg-slate-600 text-slate-300'
                                            }`}
                                        title="Respaldar en Google Sheets"
                                    >
                                        {backupStatus === 'backing-up' ? <RefreshCw size={14} className="animate-spin" /> :
                                            backupStatus === 'success' ? <CheckCircle2 size={14} /> :
                                                backupStatus === 'error' ? <X size={14} /> :
                                                    <Upload size={14} />}
                                    </button>
                                </div>
                            </div>


                            {/* --- CHART SECTION --- */}
                            <div className="h-64 w-full bg-slate-900/40 border-b border-slate-800/50 relative">
                                <div className="absolute top-4 right-4 flex gap-4 text-[10px] font-bold uppercase tracking-widest z-10">
                                    {(dashboardGroup === 'Todos' || dashboardGroup === 'Barco') && <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400 shadow-[0_0_8px_#facc15]"></span> Barco</div>}
                                    {(dashboardGroup === 'Todos' || dashboardGroup === 'Cueva') && <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#ff0099] shadow-[0_0_10px_#ff0099]"></span> Cueva</div>}
                                </div>
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={data} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorBarco" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#facc15" stopOpacity={0.6} />
                                                <stop offset="95%" stopColor="#facc15" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="colorCueva" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#ff0099" stopOpacity={0.6} />
                                                <stop offset="95%" stopColor="#ff0099" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} vertical={false} />
                                        <XAxis dataKey="dia" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value / 1000}k`} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', borderColor: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', color: '#f1f5f9', borderRadius: '12px', boxShadow: '0 0 20px rgba(0,0,0,0.5)' }}
                                            itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                                            formatter={(value: number | undefined) => formatCurrency(value || 0)}
                                            labelStyle={{ color: '#94a3b8', marginBottom: '5px' }}
                                        />
                                        {(dashboardGroup === 'Todos' || dashboardGroup === 'Barco') && (
                                            <Area type="monotone" dataKey="barco" stroke="#facc15" strokeWidth={3} fillOpacity={1} fill="url(#colorBarco)" animationDuration={2000} animationEasing="ease-in-out" style={{ filter: 'drop-shadow(0 0 8px rgba(250, 204, 21, 0.5))' }} />
                                        )}
                                        {(dashboardGroup === 'Todos' || dashboardGroup === 'Cueva') && (
                                            <Area type="monotone" dataKey="cueva" stroke="#ff0099" strokeWidth={3} fillOpacity={1} fill="url(#colorCueva)" animationDuration={2500} animationEasing="ease-in-out" style={{ filter: 'drop-shadow(0 0 10px rgba(255, 0, 153, 0.5))' }} />
                                        )}
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>

                            <div className="overflow-x-auto max-h-[450px] scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-950/90 text-slate-400 text-xs uppercase sticky top-0 z-10 backdrop-blur">
                                        <tr>
                                            <th className="p-4 text-center w-20 tracking-wider">Día</th>
                                            <th className="p-4 tracking-wider text-yellow-300">Barco</th>
                                            <th className="p-4 tracking-wider text-pink-300">Cueva</th>
                                            <th className="p-2 text-center text-[10px] text-yellow-400 font-bold uppercase tracking-tighter">M. Barco</th>
                                            <th className="p-2 text-center text-[10px] text-pink-400 font-bold uppercase tracking-tighter">M. Cueva</th>
                                            <th className="p-4 tracking-wider font-bold text-white">Total</th>
                                            <th className="p-4 text-right"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/50">
                                        {data.map((row: any) => (
                                            <tr key={row.id} className="group hover:bg-slate-800/60 transition-colors">
                                                <td className="p-3 text-center">
                                                    <span className="inline-block w-8 h-8 leading-8 rounded bg-slate-800/80 border border-slate-700 text-slate-200 font-mono font-bold shadow-inner">{row.dia}</span>
                                                </td>
                                                <td className="p-3 font-mono text-yellow-300 font-medium">{formatCurrency(row.barco)}</td>
                                                <td className="p-3 font-mono text-pink-400 font-medium">{formatCurrency(row.cueva)}</td>
                                                <td className="p-2 text-center font-mono text-yellow-500/70 font-bold text-xs">{row.mesasBarco || 0}</td>
                                                <td className="p-2 text-center font-mono text-pink-500/70 font-bold text-xs">{row.mesasCueva || 0}</td>
                                                <td className="p-3 font-mono font-bold text-white shadow-cyan-500/5">{formatCurrency(row.barco + row.cueva)}</td>
                                                <td className="p-3 text-right">
                                                    <div className="flex justify-end gap-2 text-slate-500">
                                                        {row.isManual && isOnlyAdmin && (
                                                            <button
                                                                onClick={() => {
                                                                    const updated = data.map((d: any) => d.id === row.id ? { ...d, isManual: false } : d);
                                                                    setData(updated);
                                                                    setForceSyncCount(prev => prev + 1); // Forzar re-sincronización con DB
                                                                }}
                                                                className="p-1.5 hover:bg-emerald-500/10 rounded-lg text-emerald-500/60 hover:text-emerald-400 transition-colors"
                                                                title="Resetear a cálculo automático (DB) - ADMIN ONLY"
                                                            >
                                                                <RefreshCw size={14} />
                                                            </button>
                                                        )}
                                                        {role === 'admin' && (
                                                            <>
                                                                <button onClick={() => { setEditingItem(row); setOpForm({ dia: row.dia, barco: row.barco.toString(), cueva: row.cueva.toString(), mesasBarco: (row.mesasBarco || 0).toString(), mesasCueva: (row.mesasCueva || 0).toString() }); setActiveModal('operative') }} className="p-1.5 hover:bg-blue-500/20 rounded text-slate-500 hover:text-blue-400 transition-colors"><Edit2 size={16} /></button>
                                                                <button onClick={() => handleDeleteOp(row.id)} className="p-1.5 hover:bg-red-500/20 rounded text-slate-500 hover:text-red-400 transition-colors"><Trash2 size={16} /></button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-slate-950/80 border-t-2 border-slate-700 font-bold text-sm sticky bottom-0 z-10 shadow-2xl">
                                            <td className="p-4 text-center text-slate-400 uppercase tracking-widest text-xs">Totales</td>
                                            <td className="p-4 font-mono text-yellow-300 text-base">{formatCurrency(totalBarco)}</td>
                                            <td className="p-4 font-mono text-pink-300 text-base">{formatCurrency(totalCueva)}</td>
                                            <td className="p-2 text-center font-mono text-yellow-400 text-xs">{data.reduce((sum, r) => sum + (r.mesasBarco || 0), 0)}</td>
                                            <td className="p-2 text-center font-mono text-pink-400 text-xs">{data.reduce((sum, r) => sum + (r.mesasCueva || 0), 0)}</td>
                                            <td className="p-4 font-mono text-white text-lg bg-emerald-500/10 border border-emerald-500/20 rounded shadow-[0_0_15px_rgba(16,185,129,0.2)]">{formatCurrency(totalBarco + totalCueva)}</td>
                                            <td></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>

                        {/* NÓMINA PRINCIPAL (DYNAMIC DB) */}
                        <div id="nomina-principal-section" className="bg-slate-900/60 backdrop-blur-xl border border-indigo-500/30 rounded-2xl overflow-hidden shadow-2xl relative scroll-mt-6">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                            <div className="px-5 py-4 border-b border-indigo-500/20 flex justify-between items-center bg-slate-900/80">
                                <div className="flex items-center gap-4">
                                    <h2 className="font-bold text-indigo-300 flex items-center gap-2 text-sm uppercase tracking-widest">
                                        <div className="p-1.5 bg-indigo-500/20 rounded text-indigo-400"><Users size={16} /></div>
                                        NÓMINA PRINCIPAL (MANUAL)
                                    </h2>
                                    <div className="flex items-center gap-2 bg-slate-950/50 rounded-lg p-1 border border-indigo-500/20">
                                        <select
                                            value={selectedMonth}
                                            onChange={e => setSelectedMonth(Number(e.target.value))}
                                            className="bg-transparent text-[10px] font-bold uppercase text-white outline-none px-2 cursor-pointer hover:text-indigo-400 transition-colors"
                                        >
                                            {monthNames.map((m, i) => <option key={i} value={i} className="bg-slate-900">{m}</option>)}
                                        </select>
                                        <div className="w-px h-3 bg-indigo-500/20"></div>
                                        <select
                                            value={selectedYear}
                                            onChange={e => setSelectedYear(Number(e.target.value))}
                                            className="bg-transparent text-[10px] font-bold uppercase text-white outline-none px-2 cursor-pointer hover:text-indigo-400 transition-colors"
                                        >
                                            {[2024, 2025, 2026].map(y => <option key={y} value={y} className="bg-slate-900">{y}</option>)}
                                        </select>
                                        <div className="w-px h-3 bg-indigo-500/20 mr-1"></div>
                                        {/* QUINCENA BUTTONS */}
                                        {[1, 2].map(num => (
                                            <button key={num} onClick={() => setFortnightBoth(num)} className={`px-4 py-1 text-[10px] font-bold uppercase rounded-md transition-all ${currentFortnight === num ? 'bg-indigo-600 text-white shadow-[0_0_10px_rgba(79,70,229,0.4)]' : 'text-slate-500 hover:text-indigo-400'}`}>
                                                {num === 1 ? '01-15' : '16-31'}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {role === 'admin' && (
                                    <div className="flex gap-2">
                                        <button onClick={() => { setActiveModal('employee'); setEmployeeForm({ name: '', password: '', status: 'Activo', group: 'Barco', shift: 'Mañana', pago: '9.6' }); }} className="text-[10px] bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 px-3 py-1.5 rounded-lg border border-indigo-500/20 flex items-center gap-2 transition-all font-bold uppercase transition-all" title="Añadir nuevo empleado">
                                            <Plus size={14} /> AGREGAR STAFF
                                        </button>
                                        <button
                                            onClick={() => {
                                                syncEmployeesWithDB();
                                                alert("Nombres de empleados sincronizados con la Base de Datos Principal.");
                                            }}
                                            className="text-[10px] bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 px-3 py-1.5 rounded-lg border border-indigo-500/20 flex items-center gap-2 transition-all font-bold uppercase"
                                            title="Sincronizar nombres con DB Principal"
                                        >
                                            <RefreshCw size={14} /> SINCRONIZAR DB
                                        </button>
                                        <button
                                            onClick={handleClearMonth}
                                            className="text-[10px] bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 px-3 py-1.5 rounded-lg border border-rose-500/20 flex items-center gap-2 transition-all font-bold uppercase"
                                            title="Limpiar Mes Actual"
                                        >
                                            <Trash2 size={14} /> LIMPIAR MES
                                        </button>
                                        <button
                                            onClick={() => {
                                                saveToCloud();
                                                alert("Cambios guardados en la Nómina Principal.");
                                            }}
                                            className="text-[10px] bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 px-3 py-1.5 rounded-lg border border-emerald-500/20 flex items-center gap-2 transition-all font-bold uppercase shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                                            title="Guardar todos los registros de la nómina"
                                        >
                                            <Save size={14} /> GUARDAR CAMBIOS
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="overflow-x-auto scrolbar-thin scrollbar-thumb-indigo-900/50">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead className="bg-slate-950/80 text-indigo-400/60 uppercase font-semibold">
                                        <tr>
                                            <th className="p-3 sticky left-0 z-20 bg-slate-950 border-r border-indigo-500/10 min-w-[150px]">Agente / Bando</th>
                                            {daysInFortnight.map(day => (
                                                <th key={day} className="p-2 text-center min-w-[45px] border-r border-indigo-500/10 text-slate-500">{day}</th>
                                            ))}
                                            <th className="p-3 text-center bg-indigo-500/5 text-indigo-300 min-w-[60px]">HRS</th>
                                            <th className="p-3 text-center bg-emerald-500/5 text-emerald-300 min-w-[80px]">NÓMINA</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-indigo-500/10 text-slate-300">
                                        {employees.filter((e: any) => dashboardGroup === 'Todos' || e.group === dashboardGroup).map((emp: any) => {
                                            const stats = calculateEmployeeStats(emp.id);
                                            return (
                                                <tr key={emp.id} className="group hover:bg-indigo-500/5 transition-colors">
                                                    <td className="p-3 sticky left-0 z-10 bg-slate-900/95 group-hover:bg-slate-900 border-r border-indigo-500/20 shadow-[5px_0_15px_rgba(0,0,0,0.5)]">
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex justify-between items-center">
                                                                <span className={`font-bold text-sm tracking-wide ${emp.status === 'Renunció' ? 'text-slate-500 line-through' : 'text-white'}`}>{emp.name}</span>
                                                                <span className={`text-[9px] px-1 rounded uppercase font-bold border ${emp.group === 'Barco' ? 'border-yellow-500/50 text-yellow-400 bg-yellow-500/10' : 'border-pink-500/50 text-pink-400 bg-pink-500/10'}`}>{emp.group || '?'}</span>
                                                            </div>

                                                            {/* SHIFT & STATUS ROW */}
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                <select disabled={role !== 'admin'} value={emp.shift || 'Mañana'} onChange={(e) => { const updated = { ...emp, shift: e.target.value }; setEmployees(employees.map((em: any) => em.id === emp.id ? updated : em)); }} className="bg-slate-950/50 rounded px-1 py-0.5 text-[9px] uppercase font-bold border border-slate-700 text-slate-400 outline-none cursor-pointer hover:border-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed">
                                                                    <option value="Mañana">☀️ Mañ</option>
                                                                    <option value="Noche">🌙 Noc</option>
                                                                </select>

                                                                <select disabled={role !== 'admin'} value={emp.status} onChange={(e) => { const updated = { ...emp, status: e.target.value }; setEmployees(employees.map((em: any) => em.id === emp.id ? updated : em)); }} className={`bg-slate-950/50 rounded px-1 py-0.5 text-[9px] uppercase font-bold border border-slate-700 outline-none cursor-pointer flex-1 ${emp.status === 'Activo' ? 'text-emerald-400 border-emerald-500/30' : emp.status === 'Ausente' ? 'text-red-400 border-red-500/30' : emp.status === 'Renunció' ? 'text-slate-500 border-slate-600' : 'text-blue-400 border-blue-500/30'} disabled:opacity-50 disabled:cursor-not-allowed`}>
                                                                    <option value="Activo">Activo</option>
                                                                    <option value="Ausente">Ausente</option>
                                                                    <option value="Suplente">Suplente</option>
                                                                    <option value="Renunció">Renunció</option>
                                                                </select>
                                                            </div>

                                                            <div className="flex justify-end opacity-30 group-hover:opacity-100 transition-opacity gap-1 mt-0.5">
                                                                {role === 'admin' && (
                                                                    <>
                                                                        <button onClick={() => { setActiveModal('employee'); setEditingItem(emp); setEmployeeForm({ name: emp.name, password: '', status: emp.status, group: emp.group || 'Barco', shift: emp.shift || 'Mañana', pago: (emp.pago || 9.6).toString() }) }} className="text-slate-600 hover:text-indigo-400"><Edit2 size={12} /></button>
                                                                        <button onClick={() => handleDeleteEmployee(emp.id)} className="text-slate-600 hover:text-pink-400"><Trash2 size={12} /></button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    {daysInFortnight.map(day => {
                                                        const hasNote = shiftsNotes[emp.id]?.[day];
                                                        // FIX: Strict Date Key Usage to avoid ghost data
                                                        const dateKey = `${selectedYear}-${(selectedMonth + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                                                        let detail = shiftsMatrix[emp.id]?.[dateKey];

                                                        // FALLBACK LEGACY: Solo permitir leer keys numéricas simples en Enero 2026
                                                        if (!detail && selectedYear === 2026 && selectedMonth === 0) {
                                                            detail = shiftsMatrix[emp.id]?.[day];
                                                        }

                                                        const isPresent = detail && typeof detail === 'object' ? parseFloat(detail.horas) > 0 : parseFloat(detail) > 0;

                                                        return (
                                                            <td key={day} className="p-0 border-r border-indigo-500/10 text-center relative group/cell">
                                                                <div
                                                                    onClick={() => {
                                                                        if (role !== 'admin') return;
                                                                        const dateKey = `${selectedYear}-${(selectedMonth + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                                                                        let existing = shiftsMatrix[emp.id]?.[dateKey];

                                                                        if (!existing && selectedYear === 2026 && selectedMonth === 0) {
                                                                            existing = shiftsMatrix[emp.id]?.[day];
                                                                        }
                                                                        existing = existing || {};

                                                                        const defaultDetail = typeof existing === 'object' ? existing : { entrada: '', salida: '', horas: existing, estatus: parseFloat(existing) > 0 ? 'Presente' : 'Falta' };
                                                                        setShiftDetailForm(defaultDetail);
                                                                        setActiveShiftDay({ empId: emp.id, day });
                                                                        setActiveModal('shiftDetail');
                                                                    }}
                                                                    className={`w-full h-full py-4 text-center cursor-pointer font-mono font-bold transition-all flex flex-col items-center justify-center ${isPresent ? 'text-emerald-400 bg-emerald-500/5' : 'text-slate-600'} hover:bg-white/5`}
                                                                >
                                                                    <span>{getShiftValue(emp.id, day) || '.'}</span>
                                                                </div>
                                                                {hasNote && (
                                                                    <div className="absolute top-1 right-1 w-1 h-1 rounded-full bg-purple-500 shadow-[0_0_5px_#a855f7]"></div>
                                                                )}
                                                            </td>
                                                        );
                                                    })}
                                                    <td className="p-2 text-center font-mono font-bold text-indigo-300 bg-indigo-500/5">{formatNumber(stats.totalHours)}</td>
                                                    <td className="p-2 text-center font-mono font-bold text-emerald-400 bg-emerald-500/5 text-sm">
                                                        {role === 'admin' ? (
                                                            <input
                                                                type="text"
                                                                className="w-full bg-transparent text-center border-b border-transparent hover:border-emerald-500/50 focus:border-emerald-500 outline-none text-emerald-400 font-bold placeholder-emerald-500/30"
                                                                placeholder={formatUSD(stats.totalPayUSD).replace('$', '')}
                                                                defaultValue={shiftsMatrix[emp.id]?.[`TOTAL_OV_${selectedYear}_${selectedMonth}_${currentFortnight}`] || ''}
                                                                onBlur={(e) => {
                                                                    const val = e.target.value;
                                                                    const overrideKey = `TOTAL_OV_${selectedYear}_${selectedMonth}_${currentFortnight}`;
                                                                    const newMatrix = { ...shiftsMatrix };
                                                                    if (!newMatrix[emp.id]) newMatrix[emp.id] = {};

                                                                    if (val && val.trim() !== '') {
                                                                        newMatrix[emp.id][overrideKey] = val;
                                                                    } else {
                                                                        delete newMatrix[emp.id][overrideKey];
                                                                    }
                                                                    setShiftsMatrix(newMatrix);
                                                                }}
                                                                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                                                            />
                                                        ) : (
                                                            <span>{formatUSD(stats.totalPayUSD)} S</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            <div className="bg-slate-900/40 p-3 border-t border-indigo-500/20 flex justify-between items-center">
                                <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">Total Staff (Sin Felipe)</span>
                                <span className="text-indigo-400 font-mono font-bold">{formatUSD(employees.reduce((acc: number, emp: any) => acc + calculateEmployeeStats(emp.id).totalPayUSD, 0))}</span>
                            </div>
                        </div>

                        {/* --- FELIPE SUPERVISOR SECTION --- */}
                        {/* --- FELIPE SUPERVISOR SECTION --- */}
                        <div className="bg-gradient-to-r from-slate-900 to-indigo-950/30 backdrop-blur-xl border border-indigo-500/30 rounded-2xl p-5 relative overflow-hidden shadow-2xl group transition-all hover:border-indigo-500/50">
                            {/* CLEAN BACKGROUND, NO NOISE */}
                            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 opacity-50"></div>
                            <div className="absolute -right-4 -top-4 w-20 h-20 bg-indigo-500/20 rounded-full blur-xl"></div>

                            <div className="flex justify-between items-center relative z-10">
                                <div>
                                    <h3 className="text-indigo-300 font-bold uppercase tracking-widest text-xs mb-1 flex items-center gap-2">
                                        <div className="p-1 bg-indigo-500/20 rounded"><Users size={14} /></div>
                                        SUPERVISOR
                                    </h3>
                                    <div className="text-2xl font-bold text-white tracking-tight">Felipe</div>
                                    <div className="text-[10px] text-slate-400 font-mono mt-1">TARIFA: $28.84 / DÍA</div>
                                </div>

                                <div className="flex flex-col md:flex-row bg-slate-950/40 rounded-xl p-3 border border-indigo-500/20 items-end gap-5">
                                    <div className="flex flex-col items-center">
                                        <label className="text-[10px] text-slate-500 font-bold uppercase mb-1">Normales</label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                disabled={role !== 'admin'}
                                                className="w-12 bg-slate-900 border border-slate-700 rounded-lg py-2 px-1 text-center text-white font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                                                value={felipeDays}
                                                onChange={(e) => setFelipeDays(Number(e.target.value))}
                                            />
                                            {role === 'admin' && <button onClick={() => setFelipeDays(daysInFortnight.length)} className="text-[9px] bg-indigo-500/20 hover:bg-indigo-500 px-1.5 py-1 rounded text-indigo-300 hover:text-white transition-colors">FULL</button>}
                                        </div>
                                    </div>

                                    {/* SECCIÓN DÍAS LIBRES SEPARADA VISUALMENTE */}
                                    <div className="flex flex-col items-center gap-1 bg-indigo-500/5 p-2 rounded-lg border border-indigo-500/10">
                                        <label className="text-[9px] text-indigo-300/60 font-bold uppercase tracking-widest border-b border-indigo-500/10 pb-1 w-full text-center">DÍAS LIBRES</label>
                                        <div className="flex gap-2">
                                            <div className="flex flex-col items-center">
                                                <label className="text-[8px] text-blue-400/50 uppercase">Asig.</label>
                                                <input
                                                    type="number"
                                                    disabled={role !== 'admin'}
                                                    className="w-10 bg-slate-900/50 border border-blue-500/20 rounded py-1 px-1 text-center text-blue-300 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                                                    value={felipeAssignedFreeDays}
                                                    onChange={(e) => setFelipeAssignedFreeDays(Number(e.target.value))}
                                                />
                                            </div>
                                            <div className="flex flex-col items-center">
                                                <label className="text-[8px] text-emerald-400/50 uppercase">Trab.</label>
                                                <input
                                                    type="number"
                                                    disabled={role !== 'admin'}
                                                    className="w-10 bg-slate-900 border border-emerald-500/40 rounded py-1 px-1 text-center text-emerald-400 font-bold text-lg focus:ring-1 focus:ring-emerald-500 outline-none shadow-[0_0_10px_rgba(16,185,129,0.1)]"
                                                    value={felipeExtraDays}
                                                    onChange={(e) => setFelipeExtraDays(Number(e.target.value))}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                            </div>

                            {/* --- SECCIÓN ADELANTOS FELIPE --- */}
                            <div className="mt-4 bg-slate-950/40 rounded-xl p-4 border border-indigo-500/20 relative z-10">
                                <div className="flex justify-between items-center mb-3">
                                    <h4 className="text-[10px] text-indigo-300 font-bold uppercase tracking-widest flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div> LISTADO DE ADELANTOS
                                    </h4>
                                    {role === 'admin' && (
                                        <button
                                            onClick={() => {
                                                setEditingItem(null);
                                                setFelipeAdvanceForm({ motivo: '', monto: '' });
                                                setActiveModal('felipe_advance');
                                            }}
                                            className="text-[9px] bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 px-2 py-1 rounded border border-indigo-500/30 flex items-center gap-1 transition-colors"
                                        >
                                            <Plus size={10} /> AGREGAR ADELANTO
                                        </button>
                                    )}
                                </div>

                                <div className="space-y-1 mb-3">
                                    {(felipeAdvances || []).length === 0 ? (
                                        <div className="text-center py-2 text-slate-600 text-[10px] italic">No hay adelantos registrados</div>
                                    ) : (
                                        (felipeAdvances || []).map((adv: any) => (
                                            <div key={adv.id} className="flex justify-between items-center text-xs bg-slate-900/50 p-2 rounded border border-indigo-500/10 group hover:border-indigo-500/30 transition-colors">
                                                <span className="text-slate-400 font-medium">{adv.motivo}</span>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-red-300 font-mono font-bold">- {formatUSD(adv.monto)}</span>
                                                    {role === 'admin' && (
                                                        <button
                                                            onClick={() => handleDeleteFelipeAdvance(adv.id)}
                                                            className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                                        >
                                                            <Trash2 size={10} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>

                                <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                                    <span className="text-[10px] text-slate-500 font-bold uppercase">Total Descuentos</span>
                                    <span className="text-sm text-red-400 font-mono font-bold">
                                        - {formatUSD((felipeAdvances || []).reduce((acc: number, cur: any) => acc + (cur.monto || 0), 0))}
                                    </span>
                                </div>
                            </div>

                            <div className="mt-4 text-right bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/10 min-w-[120px]">
                                <div className="text-[9px] text-emerald-400/60 font-bold uppercase mb-1">Total a Pagar (Neto)</div>
                                <div className="text-2xl font-mono font-bold text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.3)]">
                                    {formatUSD(
                                        ((felipeDays + felipeExtraDays) * 28.84) -
                                        ((felipeAdvances || []).reduce((acc: number, cur: any) => acc + (cur.monto || 0), 0))
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* TOTAL GENERAL NOMINA */}
                        <div className="bg-slate-900/60 backdrop-blur-xl border border-emerald-500/30 rounded-2xl p-6 shadow-2xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-5 text-emerald-500"><Landmark size={60} /></div>

                            <h3 className="text-xs font-bold uppercase text-emerald-400 tracking-widest flex items-center gap-2 mb-6">
                                <div className="p-1.5 bg-emerald-500/20 rounded-lg text-emerald-400"><Medal size={16} /></div>
                                RESUMEN DE PAGO TOTAL
                            </h3>

                            <div className="space-y-3 mb-6">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-500 font-bold">STAFF (AGENTES)</span>
                                    <span className="text-white font-mono font-bold">{formatUSD(staffTotalUSD)}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-500 font-bold">SUPERVISOR (FELIPE)</span>
                                    <span className="text-white font-mono font-bold">{formatUSD(felipeTotalUSD)}</span>
                                </div>

                                {/* SUBTOTAL NÓMINA */}
                                <div className="flex justify-between items-center py-2 border-y border-slate-800/50 my-2">
                                    <span className="text-emerald-400 font-bold text-xs uppercase tracking-widest">Subtotal Nómina</span>
                                    <span className="text-emerald-400 font-mono font-bold">{formatUSD(subTotalPayrollUSD)}</span>
                                </div>

                                {/* SECCION PUBLICIDAD POR GRUPO */}
                                <div className="space-y-4 pt-2 border-t border-slate-800/30 mt-2">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-blue-400 font-bold uppercase text-[10px] tracking-widest text-left">Inversión Publicidad (FMX Sync)</span>
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                                        </div>

                                        {/* TOGGLE SUMA PUBLICIDAD */}
                                        <button
                                            onClick={() => {
                                                const newVal = !includePublicityInTotal;
                                                setIncludePublicityInTotal(newVal);
                                                localStorage.setItem('includePublicityInTotal', JSON.stringify(newVal));
                                            }}
                                            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border transition-all ${includePublicityInTotal ? 'bg-blue-500/20 border-blue-500/40 text-blue-300' : 'bg-slate-800 border-slate-700 text-slate-500'}`}
                                            title={includePublicityInTotal ? "Suma activa al total final" : "Suma desactivada"}
                                        >
                                            <div className={`w-3 h-3 rounded-full flex items-center justify-center border ${includePublicityInTotal ? 'border-blue-400 bg-blue-500 shadow-[0_0_8px_#3b82f6]' : 'border-slate-500'}`}>
                                                {includePublicityInTotal && <CheckCircle2 size={10} className="text-white" />}
                                            </div>
                                            <span className="text-[9px] font-black uppercase tracking-tighter">
                                                {includePublicityInTotal ? 'SUMAR' : 'IGNORAR'}
                                            </span>
                                        </button>
                                    </div>

                                    {(dashboardGroup === 'Todos' || dashboardGroup === 'Barco') && (
                                        <div className="flex justify-between items-center text-sm pl-2 border-l-2 border-emerald-500/30">
                                            <div className="flex flex-col">
                                                <span className="text-slate-500 font-bold text-[10px]">EL BARCO</span>
                                                <span className="text-[8px] text-slate-600 font-mono">Q: {formatCurrency(totalFortnightPubARS_Barco)}</span>
                                            </div>
                                            <span className="text-white font-mono font-bold">{formatUSD(totalFortnightPubUSD_Barco)}</span>
                                        </div>
                                    )}

                                    {(dashboardGroup === 'Todos' || dashboardGroup === 'Cueva') && (
                                        <div className="flex justify-between items-center text-sm pl-2 border-l-2 border-orange-500/30">
                                            <div className="flex flex-col">
                                                <span className="text-slate-500 font-bold text-[10px]">LA CUEVA</span>
                                                <span className="text-[8px] text-slate-600 font-mono">Q: {formatCurrency(totalFortnightPubARS_Cueva)}</span>
                                            </div>
                                            <span className="text-white font-mono font-bold">{formatUSD(totalFortnightPubUSD_Cueva)}</span>
                                        </div>
                                    )}

                                    {dashboardGroup === 'Todos' && (
                                        <div className="flex justify-between items-center py-2 bg-blue-500/5 px-3 rounded-xl border border-blue-500/10">
                                            <div className="flex flex-col">
                                                <span className="text-blue-400 font-black text-[10px] uppercase">Total Publicidad</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[9px] text-slate-400 font-mono">ARS: {formatCurrency(totalFortnightPubARS_Total)}</span>
                                                    <span className="text-[9px] text-slate-400 font-bold">• Mes: {formatUSD(totalMonthPubUSD_Total)}</span>
                                                </div>
                                            </div>
                                            <span className="text-blue-400 font-mono font-black text-lg">{formatUSD(totalFortnightPubUSD_Total)}</span>
                                        </div>
                                    )}
                                    <span className="text-[8px] text-blue-500/40 font-bold uppercase tracking-tighter block italic text-center">Datos sincronizados en tiempo real por grupo</span>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-emerald-500/20 flex justify-between items-end">
                                <div>
                                    <span className="text-emerald-400/80 text-[10px] font-bold uppercase tracking-[0.2em] block mb-1">Total Final a Liquidar</span>
                                    <div className="text-3xl font-mono font-bold text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.4)]">
                                        {formatUSD(grandTotalUSD)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN */}
                    <div className="space-y-6">

                        {/* --- EXCLUSIVE ADMIN CENTER --- */}
                        {isAdminOrVice && (
                            <div className="space-y-6 animate-in slide-in-from-right duration-700">

                                {/* MONITOREO DE SEGURIDAD (NEW: RESTRICCIONES) */}
                                <div className="bg-slate-900/60 backdrop-blur-xl border border-rose-500/30 rounded-2xl p-6 shadow-2xl relative overflow-hidden group hover:border-rose-500/50 transition-all cursor-pointer" onClick={onNavigateToRestriccion}>
                                    <div className="absolute top-0 right-0 p-4 opacity-5 text-rose-500 group-hover:scale-110 transition-transform"><ShieldAlert size={60} /></div>
                                    <h3 className="text-xs font-bold uppercase text-rose-400 tracking-widest flex items-center gap-2 mb-4">
                                        <div className="p-1.5 bg-rose-500/20 rounded-lg text-rose-500">
                                            <ShieldAlert size={16} />
                                        </div>
                                        CENTRO DE SEGURIDAD
                                    </h3>
                                    <div className="space-y-4">
                                        <div>
                                            <h4 className="text-white font-black text-lg uppercase italic tracking-tighter">RESTRICCIÓN & LISTA NEGRA</h4>
                                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Control de clientes y advertencias</p>
                                        </div>
                                        <button
                                            className="w-full py-3 bg-rose-600/10 hover:bg-rose-600 text-rose-500 hover:text-white border border-rose-500/20 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all"
                                        >
                                            ENTRAR AL MÓDULO
                                        </button>
                                    </div>
                                </div>

                                {/* MONITOR DE USUARIOS ONLINE (Admin & Vice) */}
                                <div className="bg-slate-900/60 backdrop-blur-xl border border-blue-500/20 rounded-2xl p-5 shadow-2xl relative overflow-hidden group hover:border-blue-500/40 transition-all">
                                    <div className="absolute -right-6 -top-6 w-20 h-20 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all"></div>
                                    <h3 className="text-xs font-bold uppercase text-blue-400 tracking-widest flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <div className="p-1.5 bg-blue-500/20 rounded-lg text-blue-400">
                                                <Users size={16} />
                                            </div>
                                            USUARIOS ONLINE
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                            <span className="text-[10px] text-emerald-400 font-mono">{onlineUsers.length} ACTIVOS</span>
                                        </div>
                                    </h3>

                                    <div className="space-y-3 max-h-[160px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-blue-900/30">
                                        {onlineUsers.length === 0 ? (
                                            <div className="text-center py-4 text-slate-500 italic text-[10px]">No hay sesiones activas</div>
                                        ) : (
                                            onlineUsers.map((session, idx) => (
                                                <div key={idx} className="flex justify-between items-center p-2.5 rounded-xl bg-slate-950/40 border border-slate-800/50 group/item hover:border-blue-500/30 transition-all">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className="w-7 h-7 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20">
                                                            <User size={14} />
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-bold text-white leading-none capitalize">
                                                                {session.user_email} {session.user_email === userEmail && <span className="text-[10px] text-blue-400 font-black ml-1">(YO)</span>}
                                                            </span>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <span className="text-[8px] text-slate-500 uppercase tracking-tighter font-mono">Disp: {session.device_id.substring(0, 8)}...</span>
                                                                {(session.role === 'admin' || session.role === 'vicepresident') && (
                                                                    <span className="text-[7px] bg-amber-500/20 text-amber-500 border border-amber-500/30 px-1 rounded font-black uppercase tracking-tighter animate-pulse">ADMIN PRIVILEGED</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <div className="text-[9px] text-blue-400/60 font-mono font-bold">LIVE</div>
                                                        {isOnlyAdmin && session.device_id !== localStorage.getItem('fmx_device_id') && (
                                                            <button
                                                                onClick={() => handleKickUser(session.user_email, session.device_id)}
                                                                className="p-1.5 hover:bg-red-500/20 rounded text-slate-500 hover:text-red-400 transition-colors"
                                                                title="Forzar Cierre de Sesión"
                                                            >
                                                                <X size={12} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                                {/* GESTIÓN DE APROBACIONES (ADMIN ONLY) */}
                                {isOnlyAdmin && (
                                    <div className="bg-slate-900/60 backdrop-blur-xl border border-amber-500/20 rounded-2xl p-5 shadow-2xl relative overflow-hidden group hover:border-amber-500/40 transition-all">
                                        <h3 className="text-xs font-bold uppercase text-amber-400 tracking-widest flex items-center gap-2 mb-4">
                                            <div className="p-1.5 bg-amber-500/20 rounded-lg text-amber-400">
                                                <Lock size={16} />
                                            </div>
                                            SOLICITUDES DE ACCESO
                                        </h3>

                                        <div className="space-y-3">
                                            {pendingApprovals.length === 0 ? (
                                                <div className="text-center py-4 text-slate-500 italic text-[10px]">Sin solicitudes pendientes</div>
                                            ) : (
                                                pendingApprovals.map((req) => (
                                                    <div key={req.id} className="p-3 rounded-xl bg-slate-950/60 border border-amber-500/20 space-y-3">
                                                        <div className="flex justify-between items-start">
                                                            <div className="flex flex-col">
                                                                <span className="text-sm font-black text-white">{req.username}</span>
                                                                <span className="text-[9px] text-slate-400 uppercase font-bold tracking-tighter">{req.nombre} • Rol: {req.role}</span>
                                                            </div>
                                                            <div className="bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded text-[8px] font-black uppercase ring-1 ring-amber-500/20">Pendiente</div>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <button
                                                                onClick={() => handleApproveUser(req.id)}
                                                                className="flex items-center justify-center gap-1.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-lg text-[9px] font-black transition-all hover:scale-[1.02] active:scale-95"
                                                            >
                                                                APROBAR
                                                            </button>
                                                            <button
                                                                onClick={() => handleDenyUser(req.id)}
                                                                className="flex items-center justify-center gap-1.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg text-[9px] font-black transition-all hover:scale-[1.02] active:scale-95"
                                                            >
                                                                DENEGAR
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}


                        {/* SALDO JUGADORES */}
                        <div className="bg-slate-900/60 backdrop-blur-xl border border-pink-500/20 rounded-2xl p-5 space-y-4 hover:border-pink-500/40 transition-colors shadow-2xl relative overflow-hidden">
                            <div className="absolute -right-10 -top-10 w-32 h-32 bg-pink-500/10 rounded-full blur-2xl pointer-events-none"></div>
                            <h3 className="text-xs font-bold uppercase text-pink-400 tracking-widest flex items-center gap-2 mb-4">
                                <div className="p-1 bg-pink-500/20 rounded"><User size={12} /></div> SALDOS JUGADORES
                            </h3>
                            {players.map((p: any) => (
                                <div key={p.id} className={`flex justify-between items-center p-4 rounded-xl bg-slate-950/40 border border-slate-800 hover:border-${p.tipo === 'barco' ? 'yellow' : 'pink'}-500/50 transition-all group hover:shadow-[0_0_15px_rgba(${p.tipo === 'barco' ? '234,179,8' : '236,72,153'},0.1)]`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${p.tipo === 'barco' ? 'bg-yellow-500/10 text-yellow-400' : 'bg-fuchsia-500/10 text-fuchsia-400'}`}>
                                            {p.tipo === 'barco' ? <Ship size={18} /> : <Mountain size={18} />}
                                        </div>
                                        <span className="font-bold text-sm tracking-wide text-slate-200">{p.nombre}</span>
                                    </div>
                                    <button onClick={() => { if (role === 'admin') { setActiveModal('player'); setEditingItem(p); setPlayerForm({ nombre: p.nombre, saldo: p.saldo }) } }} className={`flex items-center gap-3 ${role === 'admin' ? 'group-hover:scale-105 cursor-pointer' : 'cursor-default'} transition-transform`}>
                                        <span className={`font-mono font-bold text-lg ${p.saldo < 0 ? 'text-red-400 drop-shadow-[0_0_5px_rgba(248,113,113,0.5)]' : 'text-emerald-400 drop-shadow-[0_0_5px_rgba(52,211,153,0.5)]'}`}>{formatCurrency(p.saldo)}</span>
                                    </button>
                                </div>
                            ))}
                        </div>

                        {/* BANCOS */}
                        <div className="bg-slate-900/60 backdrop-blur-xl border border-emerald-500/20 rounded-2xl p-5 hover:border-emerald-500/40 transition-colors shadow-2xl">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xs font-bold uppercase text-emerald-400 tracking-widest flex items-center gap-2">
                                    <div className="p-1 bg-emerald-500/20 rounded"><Landmark size={12} /></div> BANCOS & CAJAS
                                </h3>
                                <button onClick={() => { if (role === 'admin') { setActiveModal('bank'); setEditingItem(null); setBankForm({ nombre: '', monto: '' }) } }} className={`text-emerald-500/50 ${role === 'admin' ? 'hover:text-emerald-400' : 'opacity-0 cursor-default'}`}><PlusCircle size={16} /></button>
                            </div>
                            <div className="space-y-2">
                                {banks.map((b: any) => (
                                    <div key={b.id} className="flex justify-between items-center p-3 rounded-lg bg-slate-950/30 border border-transparent hover:border-emerald-500/30 hover:bg-slate-950/60 group transition-all">
                                        <span className="text-slate-400 text-sm font-medium pl-2 border-l-2 border-slate-700 group-hover:border-emerald-500 transition-colors">{b.nombre}</span>
                                        <div className="flex items-center gap-3">
                                            <span className="font-mono text-white font-bold">{formatCurrency(b.monto)}</span>
                                            <div className="flex opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                                                {role === 'admin' && (
                                                    <>
                                                        <button onClick={() => { setActiveModal('bank'); setEditingItem(b); setBankForm({ nombre: b.nombre, monto: b.monto }) }} className="p-1 hover:bg-slate-700 rounded text-slate-500 hover:text-white"><Edit2 size={12} /></button>
                                                        <button onClick={() => handleDeleteBank(b.id)} className="p-1 hover:bg-red-900/20 rounded text-slate-500 hover:text-red-400"><Trash2 size={12} /></button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* ENVIOS LIST */}
                        <div className="bg-slate-900/60 backdrop-blur-xl border border-purple-500/20 rounded-2xl overflow-hidden shadow-2xl">
                            <div className="p-4 border-b border-purple-500/10 flex justify-between items-center bg-slate-950/40">
                                <h3 className="text-xs font-bold uppercase text-purple-400 tracking-widest flex items-center gap-2">
                                    <div className="p-1 bg-purple-500/20 rounded"><Send size={12} /></div> ENVÍOS
                                </h3>
                                <button onClick={() => { if (role === 'admin') { setActiveModal('shipment'); setEditingItem(null); setShipForm({ fecha: '', monto: '', nota: '', comprobante: '' }) } }} className={`text-purple-400/50 ${role === 'admin' ? 'hover:text-purple-300' : 'opacity-0 cursor-default'}`}><PlusCircle size={16} /></button>
                            </div>
                            <div className="max-h-[350px] overflow-y-auto scrollbar-thin scrollbar-thumb-purple-900/30">
                                <table className="w-full text-xs text-left">
                                    <tbody className="divide-y divide-purple-500/10">
                                        {/* PRIMERA QUINCENA */}
                                        {q1Shipments.length > 0 && (
                                            <tr className="bg-purple-900/10">
                                                <td colSpan={3} className="p-2 text-[10px] font-black text-purple-400 uppercase tracking-[0.2em] text-center border-y border-purple-500/20">
                                                    Primera Quincena (31/01 - 15/02)
                                                </td>
                                            </tr>
                                        )}
                                        {q1Shipments.map((s: any) => (
                                            <tr key={s.id} className="hover:bg-purple-500/5 transition-colors group">
                                                <td className="p-3 text-purple-200 font-medium">{s.fecha}</td>
                                                <td className="p-3 font-mono text-white text-sm">{formatCurrency(s.monto)}</td>
                                                <td className="p-3 flex items-center justify-end gap-2">
                                                    {s.comprobante && (
                                                        <a
                                                            href={s.comprobante}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded transition-all"
                                                            title="Ver Comprobante"
                                                        >
                                                            <Upload size={12} />
                                                        </a>
                                                    )}
                                                    {s.nota && (
                                                        <span className="px-1.5 py-0.5 rounded border border-purple-500/30 bg-purple-500/10 text-purple-300 text-[10px] font-bold uppercase">
                                                            {s.nota}
                                                        </span>
                                                    )}
                                                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        {role === 'admin' && (
                                                            <>
                                                                <button onClick={() => { setActiveModal('shipment'); setEditingItem(s); setShipForm({ fecha: s.fecha, monto: s.monto, nota: s.nota, comprobante: s.comprobante || '' }) }} className="text-slate-500 hover:text-white"><Edit2 size={12} /></button>
                                                                <button onClick={() => handleDeleteShip(s.id)} className="text-slate-500 hover:text-red-400"><Trash2 size={12} /></button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}

                                        {/* SEGUNDA QUINCENA */}
                                        {q2Shipments.length > 0 && (
                                            <tr className="bg-purple-900/10">
                                                <td colSpan={3} className="p-2 text-[10px] font-black text-purple-400 uppercase tracking-[0.2em] text-center border-y border-purple-500/20">
                                                    Segunda Quincena (16/02 - Fin)
                                                </td>
                                            </tr>
                                        )}
                                        {q2Shipments.map((s: any) => (
                                            <tr key={s.id} className="hover:bg-purple-500/5 transition-colors group">
                                                <td className="p-3 text-purple-200 font-medium">{s.fecha}</td>
                                                <td className="p-3 font-mono text-white text-sm">{formatCurrency(s.monto)}</td>
                                                <td className="p-3 flex items-center justify-end gap-2">
                                                    {s.comprobante && (
                                                        <a
                                                            href={s.comprobante}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded transition-all"
                                                            title="Ver Comprobante"
                                                        >
                                                            <Upload size={12} />
                                                        </a>
                                                    )}
                                                    {s.nota && (
                                                        <span className="px-1.5 py-0.5 rounded border border-purple-500/30 bg-purple-500/10 text-purple-300 text-[10px] font-bold uppercase">
                                                            {s.nota}
                                                        </span>
                                                    )}
                                                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        {role === 'admin' && (
                                                            <>
                                                                <button onClick={() => { setActiveModal('shipment'); setEditingItem(s); setShipForm({ fecha: s.fecha, monto: s.monto, nota: s.nota, comprobante: s.comprobante || '' }) }} className="text-slate-500 hover:text-white"><Edit2 size={12} /></button>
                                                                <button onClick={() => handleDeleteShip(s.id)} className="text-slate-500 hover:text-red-400"><Trash2 size={12} /></button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* TOTAL FOOTER (NUEVO) */}
                            <div className="p-4 bg-purple-500/5 border-t border-purple-500/20 flex justify-between items-center bg-slate-950/40">
                                <div className="flex flex-col">
                                    <span className="text-[10px] text-purple-400 font-black uppercase tracking-[0.2em]">Total Acumulado</span>
                                    <span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest leading-none mt-0.5">Control de Envíos</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-xl font-mono font-black text-white drop-shadow-[0_0_15px_rgba(168,85,247,0.4)]">
                                        {formatCurrency(totalEnviado)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* TOP 3 PERFORMANCE WIDGET */}
                        <div className="bg-slate-900/60 backdrop-blur-xl border border-yellow-500/20 rounded-2xl p-5 shadow-2xl relative overflow-hidden group hover:border-yellow-500/40 transition-all duration-500">
                            <div className="absolute -right-6 -top-6 w-24 h-24 bg-yellow-500/10 rounded-full blur-2xl group-hover:bg-yellow-500/20 transition-all"></div>
                            <h3 className="text-xs font-bold uppercase text-yellow-500 tracking-widest flex items-center justify-between mb-6">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-yellow-500/20 rounded-lg text-yellow-500">
                                        <Trophy size={16} />
                                    </div>
                                    TOP RENDIMIENTO
                                </div>
                                <span className="text-[10px] text-slate-500 font-mono">HRS QUINCENA</span>
                            </h3>

                            <div className="space-y-6">
                                {topEmployees.length === 0 ? (
                                    <div className="text-center py-8 text-slate-600 italic text-xs">Sin registros esta quincena</div>
                                ) : (
                                    topEmployees.map((emp: any, idx: number) => (
                                        <div key={idx} className="relative">
                                            <div className="flex justify-between items-end mb-2">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] ${idx === 0 ? 'bg-yellow-500 text-black' : idx === 1 ? 'bg-slate-300 text-black' : 'bg-amber-700 text-white'}`}>
                                                        {idx + 1}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-bold text-white tracking-wide">{emp.name}</span>
                                                        <span className={`text-[9px] font-bold uppercase tracking-widest ${emp.group === 'Barco' ? 'text-yellow-400' : 'text-fuchsia-400'}`}>{emp.group}</span>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-lg font-mono font-bold text-white leading-none">{emp.stats.totalHours.toFixed(1)}</div>
                                                    <div className="text-[9px] text-slate-500 font-bold uppercase mt-1">Acumuladas</div>
                                                </div>
                                            </div>

                                            {/* PROGRESS BAR */}
                                            <div className="h-2 w-full bg-slate-800/50 rounded-full overflow-hidden border border-white/5">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(255,255,255,0.1)] ${idx === 0 ? 'bg-gradient-to-r from-yellow-600 to-yellow-300' : idx === 1 ? 'bg-gradient-to-r from-slate-500 to-slate-200' : 'bg-gradient-to-r from-amber-800 to-amber-500'}`}
                                                    style={{ width: `${(emp.stats.totalHours / maxHours) * 100}%` }}
                                                ></div>
                                            </div>

                                            {idx === 0 && (
                                                <div className="absolute -left-1 top-0 bottom-0 w-[2px] bg-yellow-400 shadow-[0_0_10px_#eab308] opacity-50"></div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>

                            <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between">
                                <div className="flex items-center gap-1.5 grayscale opacity-50">
                                    <Medal size={14} className="text-slate-400" />
                                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Merito Operativo</span>
                                </div>
                                <div className="text-[10px] text-yellow-500/50 font-mono italic">
                                    v3.1 Algorithm
                                </div>
                            </div>
                        </div>

                        {/* --- PUBLICIDAD SECTION (MOVED UP) --- */}
                        <div className="bg-slate-900/60 backdrop-blur-xl border border-emerald-500/20 rounded-2xl p-5 shadow-2xl relative overflow-hidden group hover:border-emerald-500/30 transition-all">
                            <div className="absolute top-0 right-0 p-4 opacity-5 text-emerald-500"><Activity size={40} /></div>
                            <h3 className="text-xs font-bold uppercase text-emerald-400 tracking-widest flex items-center gap-2 mb-6">
                                <div className="p-1.5 bg-emerald-500/20 rounded-lg text-emerald-400"><Activity size={16} /></div>
                                CONTROL PUBLICIDAD
                            </h3>

                            <div className="space-y-6">
                                {/* CALENDARIO PUBLICIDAD (FULL MONTH) */}
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center px-1">
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-white/5">
                                                <button onClick={() => { if (pubMonth === 0) { setPubMonth(11); setPubYear(y => y - 1); } else setPubMonth(m => m - 1); }} className="p-1 hover:bg-white/5 rounded text-slate-500 hover:text-white transition-all"><ChevronLeft size={14} /></button>
                                                <span className="text-[9px] font-black uppercase text-white w-20 text-center">{monthNames[pubMonth]} {pubYear}</span>
                                                <button onClick={() => { if (pubMonth === 11) { setPubMonth(0); setPubYear(y => y + 1); } else setPubMonth(m => m + 1); }} className="p-1 hover:bg-white/5 rounded text-slate-500 hover:text-white transition-all"><ChevronRight size={14} /></button>
                                            </div>
                                        </div>
                                        <div className="flex gap-4 items-center">
                                            <button
                                                onClick={() => setShowPublicityAnalytics(true)}
                                                className="px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 rounded border border-emerald-500/20 text-[9px] font-black uppercase text-emerald-400 transition-all flex items-center gap-1.5"
                                            >
                                                <TrendingUp size={10} /> Full Analytics
                                            </button>
                                            <div className="flex bg-black/40 p-0.5 rounded-lg border border-white/5">
                                                {(['Todos', 'Barco', 'Cueva'] as const).map(g => (
                                                    <button
                                                        key={g}
                                                        onClick={() => setPubGridGroup(g)}
                                                        className={`px-2 py-1 rounded text-[8px] font-black uppercase transition-all ${pubGridGroup === g ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20' : 'text-slate-500 hover:text-emerald-400'}`}
                                                    >
                                                        {g === 'Todos' ? 'Total' : g}
                                                    </button>
                                                ))}
                                            </div>
                                            <div className="text-right">
                                                <div className="text-xs font-mono font-bold text-emerald-400">
                                                    Mes: {formatCurrency(Object.keys(publicityActive).filter(k => k.startsWith(`${pubYear}-${(pubMonth + 1).toString().padStart(2, '0')}`)).reduce((acc, k) => acc + (publicityActive[k]?.[pubGridGroup === 'Todos' ? 'Total' : pubGridGroup] || 0), 0) || 0)}
                                                </div>
                                                <div className="text-[9px] text-slate-500 font-bold uppercase">Inversión Lograda</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-7 sm:grid-cols-10 md:grid-cols-7 lg:grid-cols-10 gap-1.5">
                                        {Array.from({ length: new Date(pubYear, pubMonth + 1, 0).getDate() }, (_, i) => {
                                            const day = i + 1;
                                            const dateKey = `${pubYear}-${(pubMonth + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                                            const dayData = publicityActive[dateKey];
                                            const hasWork = !!dayData?.[pubGridGroup === 'Todos' ? 'Total' : pubGridGroup];
                                            return (
                                                <button
                                                    key={day}
                                                    onClick={() => setShowPublicityAnalytics(true)}
                                                    className={`aspect-square rounded-lg border flex flex-col items-center justify-center gap-0.5 transition-all ${hasWork ? 'bg-emerald-600 border-emerald-400 text-white shadow-lg shadow-emerald-500/20' : 'bg-slate-950/50 border-slate-800 text-slate-500 hover:border-slate-600'}`}
                                                    title={hasWork ? `Total: ${formatCurrency(dayData.Total)}\nBarco: ${formatCurrency(dayData.Barco || 0)}\nCueva: ${formatCurrency(dayData.Cueva || 0)}` : 'Sin gasto'}
                                                >
                                                    <span className="text-[8px] font-bold opacity-60">D{day}</span>
                                                    {hasWork ? (
                                                        <div className="flex flex-col items-center gap-1">
                                                            <div className="flex gap-1">
                                                                {(pubGridGroup === 'Todos' || pubGridGroup === 'Barco') && dayData.Barco > 0 && <div className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_5px_white]"></div>}
                                                                {(pubGridGroup === 'Todos' || pubGridGroup === 'Cueva') && dayData.Cueva > 0 && <div className="w-1.5 h-1.5 rounded-full bg-orange-400 shadow-[0_0_5px_rgba(251,146,60,0.8)]"></div>}
                                                            </div>
                                                            <span className="text-[7px] font-mono leading-none font-bold">
                                                                {formatCurrency(dayData[pubGridGroup === 'Todos' ? 'Total' : pubGridGroup]).replace('$', '').trim()}
                                                            </span>
                                                        </div>
                                                    ) : <span className="text-xs font-bold font-mono text-white/5 italic">·</span>}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* MINI CHART PUBLICIDAD (NEON GREEN) */}
                                <div className="bg-black/60 rounded-xl p-4 border border-emerald-500/10 h-40 shadow-inner">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={Array.from({ length: new Date(pubYear, pubMonth + 1, 0).getDate() }, (_, i) => {
                                            const day = i + 1;
                                            const dateKey = `${pubYear}-${(pubMonth + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                                            return { dia: day, activo: publicityActive[dateKey]?.[pubGridGroup === 'Todos' ? 'Total' : pubGridGroup] || 0 };
                                        })}>
                                            <defs>
                                                <linearGradient id="colorPubNeon" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.6} />
                                                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <XAxis dataKey="dia" hide />
                                            <YAxis hide />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#052c16', border: '1px solid #16a34a', borderRadius: '12px', fontSize: '10px', boxShadow: '0 0 15px rgba(34,197,94,0.3)' }}
                                                itemStyle={{ color: '#4ade80' }}
                                                formatter={(value: any) => [formatCurrency(Number(value) || 0), 'Inversión']}
                                            />
                                            <Area type="monotone" dataKey="activo" stroke="#4ade80" fill="url(#colorPubNeon)" strokeWidth={3} animationDuration={1500} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                    <div className="text-center mt-2 text-[9px] text-emerald-500/50 font-bold uppercase tracking-[0.2em]">Live Pulse Investment</div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>

            {/* --- GUEST MANAGEMENT SECTION (ADMIN ONLY) --- */}
            {
                role === 'admin' && (
                    <div className="max-w-[1900px] mx-auto px-4 md:px-8 pb-8">
                        <div className="bg-slate-900/60 backdrop-blur-xl border border-indigo-500/20 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-5 text-indigo-500"><User size={60} /></div>

                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xs font-bold uppercase text-indigo-400 tracking-widest flex items-center gap-2">
                                    <div className="p-1.5 bg-indigo-500/20 rounded-lg text-indigo-400"><User size={16} /></div>
                                    GESTIÓN DE INVITADOS <span className="text-white/40 ml-1">({guests.length})</span>
                                </h3>
                                <button
                                    onClick={() => { setActiveModal('guest'); setEditingItem(null); setGuestForm({ username: '', password: '', status: 'aprobado' }); }}
                                    className="px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-2"
                                >
                                    <Plus size={12} /> CREAR INVITADO
                                </button>
                            </div>

                            <div className="space-y-2">
                                {guests.length === 0 ? (
                                    <div className="text-center py-4 text-slate-500 italic text-xs">No hay invitados registrados</div>
                                ) : (
                                    guests.map((g: any) => (
                                        <div key={g.id} className="flex justify-between items-center p-3 rounded-xl bg-slate-950/40 border border-slate-800/50 group hover:border-indigo-500/30 transition-all">
                                            <div className="flex flex-col">
                                                <span className="text-white font-bold text-sm">{g.username}</span>
                                                <span className="text-[10px] text-slate-500 font-mono">Pass: {g.password_text || '****'}</span>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${g.estado === 'aprobado' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                                    {g.estado}
                                                </span>
                                                <div className="flex gap-1">
                                                    <button onClick={() => { setActiveModal('guest'); setEditingItem(g); setGuestForm({ username: g.username, password: g.password_text, status: g.estado || 'aprobado' }); }} className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"><Edit2 size={12} /></button>
                                                    <button onClick={() => handleDeleteGuest(g.id)} className="p-1.5 hover:bg-red-900/20 rounded text-slate-400 hover:text-red-400 transition-colors"><Trash2 size={12} /></button>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )
            }

            {/* --- MODAL (GLASS) --- */}
            {
                activeModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
                        <div className="bg-slate-900 border border-slate-700/50 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl scale-100 animate-in zoom-in-95 duration-200 ring-1 ring-white/10">
                            <div className="p-5 border-b border-slate-700/50 flex justify-between items-center bg-slate-950/50">
                                <h3 className="text-lg font-bold text-white tracking-tight">
                                    {activeModal === 'operative' && (editingItem ? 'Editar Día' : 'Nuevo Día')}
                                    {activeModal === 'shipment' && (editingItem ? 'Editar Envío' : 'Registrar Envío')}
                                    {activeModal === 'bank' && (editingItem ? 'Editar Banco' : 'Nuevo Banco')}
                                    {activeModal === 'employee' && (editingItem ? 'Editar Staff' : 'Nuevo Staff')}
                                    {activeModal === 'guest' && (editingItem ? 'Editar Invitado' : 'Nuevo Invitado')}
                                    {activeModal === 'player' && 'Actualizar Saldo'}
                                    {activeModal === 'felipe_advance' && 'Nuevo Adelanto Felipe'}
                                </h3>
                                <button onClick={() => setActiveModal(null)} className="text-slate-500 hover:text-white transition-colors bg-slate-800 p-1 rounded-full"><X size={16} /></button>
                            </div>

                            <form onSubmit={(e) => {
                                if (activeModal === 'operative') handleSaveOp(e);
                                else if (activeModal === 'shipment') handleSaveShip(e);
                                else if (activeModal === 'bank') handleSaveBank(e);
                                else if (activeModal === 'player') handleSavePlayer(e);
                                else if (activeModal === 'felipe_advance') handleSaveFelipeAdvance(e);
                                else if (activeModal === 'guest') handleSaveGuest(e);
                                else handleSaveEmployee(e);
                            }} className="p-5 space-y-4">

                                {activeModal === 'operative' && (
                                    <>
                                        <input autoFocus type="text" className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-yellow-500 outline-none transition-all focus:border-yellow-500" placeholder="Día (Ej. 12)" value={opForm.dia} onChange={e => setOpForm({ ...opForm, dia: e.target.value })} />
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <label className="text-[10px] text-yellow-500 font-bold uppercase ml-1">Monto Barco</label>
                                                <input type="number" min="0" step="any" className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-yellow-500 outline-none transition-all focus:border-yellow-500" placeholder="0" value={opForm.barco} onChange={e => setOpForm({ ...opForm, barco: e.target.value })} />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] text-pink-400 font-bold uppercase ml-1">Monto Cueva</label>
                                                <input type="number" min="0" step="any" className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-pink-500 outline-none transition-all focus:border-pink-500" placeholder="0" value={opForm.cueva} onChange={e => setOpForm({ ...opForm, cueva: e.target.value })} />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] text-yellow-500/60 font-bold uppercase ml-1">Mesas Barco</label>
                                                <input type="number" min="0" className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-yellow-500/50 outline-none" placeholder="0" value={opForm.mesasBarco} onChange={e => setOpForm({ ...opForm, mesasBarco: e.target.value })} />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] text-pink-400/60 font-bold uppercase ml-1">Mesas Cueva</label>
                                                <input type="number" min="0" className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-pink-500/50 outline-none" placeholder="0" value={opForm.mesasCueva} onChange={e => setOpForm({ ...opForm, mesasCueva: e.target.value })} />
                                            </div>
                                        </div>
                                    </>
                                )}

                                {activeModal === 'shipment' && (
                                    <>
                                        <input autoFocus type="text" className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-purple-500 outline-none transition-all focus:border-purple-500" placeholder="Fecha (Ej. 12/01)" value={shipForm.fecha} onChange={e => setShipForm({ ...shipForm, fecha: e.target.value })} />
                                        <input type="number" step="any" className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-purple-500 outline-none transition-all focus:border-purple-500" placeholder="Monto" value={shipForm.monto} onChange={e => setShipForm({ ...shipForm, monto: e.target.value })} />
                                        <input type="text" className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-purple-500 outline-none transition-all focus:border-purple-500" placeholder="Nota (Opcional)" value={shipForm.nota} onChange={e => setShipForm({ ...shipForm, nota: e.target.value })} />
                                        <div className="relative">
                                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-500/50"><Upload size={14} /></div>
                                            <input type="text" className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white focus:ring-1 focus:ring-purple-500 outline-none transition-all focus:border-purple-500" placeholder="Link Comprobante (Drive)" value={shipForm.comprobante} onChange={e => setShipForm({ ...shipForm, comprobante: e.target.value })} />
                                        </div>
                                    </>
                                )}

                                {activeModal === 'bank' && (
                                    <>
                                        <input autoFocus type="text" className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-emerald-500 outline-none transition-all focus:border-emerald-500" placeholder="Nombre Banco" value={bankForm.nombre} onChange={e => setBankForm({ ...bankForm, nombre: e.target.value })} />
                                        <input type="number" step="any" className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-emerald-500 outline-none transition-all focus:border-emerald-500" placeholder="Monto" value={bankForm.monto} onChange={e => setBankForm({ ...bankForm, monto: e.target.value })} />
                                    </>
                                )}

                                {activeModal === 'player' && (
                                    <>
                                        <div className="text-center mb-2">
                                            <span className="text-slate-400 text-xs uppercase tracking-widest">Saldo Actual</span>
                                            <div className="text-xl font-bold text-white mt-1">{editingItem?.nombre}</div>
                                        </div>
                                        <input autoFocus type="number" step="any" className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-pink-500 outline-none transition-transform focus:scale-105 text-center font-mono text-lg font-bold" value={playerForm.saldo} onChange={e => setPlayerForm({ ...playerForm, saldo: e.target.value })} />
                                    </>
                                )}

                                {activeModal === 'employee' && (
                                    <>
                                        <input type="text" className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-indigo-500 outline-none relative z-10" placeholder="Nombre completo" value={employeeForm.name || ''} onChange={e => { const val = e.target.value; setEmployeeForm(prev => ({ ...prev, name: val })); }} />

                                        {/* ADMIN PASSWORD FIELD */}
                                        {role === 'admin' && (
                                            <input
                                                type="text"
                                                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-indigo-500 outline-none relative z-10"
                                                placeholder="Contraseña (Opcional - Dejar vacío para mantener)"
                                                value={employeeForm.password || ''}
                                                onChange={e => setEmployeeForm(prev => ({ ...prev, password: e.target.value }))}
                                            />
                                        )}
                                        <select className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-indigo-500 outline-none" value={employeeForm.shift} onChange={e => setEmployeeForm({ ...employeeForm, shift: e.target.value })}>
                                            <option value="Mañana">Turno Mañana</option>
                                            <option value="Noche">Turno Noche</option>
                                        </select>
                                        <select className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-indigo-500 outline-none" value={employeeForm.status} onChange={e => setEmployeeForm({ ...employeeForm, status: e.target.value })}>
                                            <option value="Activo">Activo</option>
                                            <option value="Ausente">Ausente</option>
                                            <option value="Suplente">Suplente</option>
                                            <option value="Renunció">Renunció</option>
                                        </select>
                                        <select className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-indigo-500 outline-none" value={employeeForm.group} onChange={e => setEmployeeForm({ ...employeeForm, group: e.target.value })}>
                                            <option value="Barco">Bando: Barco</option>
                                            <option value="Cueva">Bando: Cueva</option>
                                        </select>
                                        <div className="space-y-1">
                                            <label className="text-[10px] text-indigo-400 font-bold uppercase ml-1">Pago por Turno (USD)</label>
                                            <input type="number" step="any" className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-indigo-500 outline-none" placeholder="9.60" value={employeeForm.pago} onChange={e => setEmployeeForm({ ...employeeForm, pago: e.target.value })} />
                                        </div>
                                    </>
                                )}

                                {activeModal === 'guest' && (
                                    <>
                                        <input autoFocus type="text" className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-indigo-500 outline-none" placeholder="Usuario (Login)" value={guestForm.username} onChange={e => setGuestForm({ ...guestForm, username: e.target.value })} disabled={!!editingItem} />
                                        <input type="text" className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-indigo-500 outline-none" placeholder="Contraseña" value={guestForm.password} onChange={e => setGuestForm({ ...guestForm, password: e.target.value })} />
                                        <select className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-indigo-500 outline-none" value={guestForm.status} onChange={e => setGuestForm({ ...guestForm, status: e.target.value })}>
                                            <option value="aprobado">Aprobado (Permitir Acceso)</option>
                                            <option value="denegado">Denegado / Bloqueado</option>
                                        </select>
                                    </>
                                )}

                                {activeModal === 'felipe_advance' && (
                                    <>
                                        <input autoFocus type="text" className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-red-500 outline-none" placeholder="Motivo o Razón" value={felipeAdvanceForm.motivo} onChange={e => setFelipeAdvanceForm({ ...felipeAdvanceForm, motivo: e.target.value })} />
                                        <input type="number" step="any" className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-red-500 outline-none" placeholder="Monto a descontar ($)" value={felipeAdvanceForm.monto} onChange={e => setFelipeAdvanceForm({ ...felipeAdvanceForm, monto: e.target.value })} />
                                    </>
                                )}

                                <button className="w-full bg-gradient-to-r from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 text-white font-bold py-3 rounded-xl transition-all border border-slate-700 shadow-lg mt-2 tracking-wide uppercase text-sm">Guardar Cambios</button>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* --- MASTER MODAL (OPERATIONS) --- */}
            {
                showMasterModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200">
                        <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
                            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
                                <div>
                                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                        <Activity className="text-emerald-500" /> Maestro de Operaciones
                                    </h3>
                                    <p className="text-slate-400 text-xs mt-1">Visión global de todos los movimientos operativos (App Móvil)</p>
                                </div>
                                <button onClick={() => setShowMasterModal(false)} className="text-slate-500 hover:text-white bg-slate-800 p-2 rounded-full"><X size={20} /></button>
                            </div>

                            <div className="flex-1 overflow-auto p-6 space-y-6">
                                {/* SECCION CARGA COMPROBANTES */}
                                {role === 'admin' && (
                                    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                                        <h4 className="text-indigo-400 font-bold uppercase text-xs tracking-widest mb-4 flex items-center gap-2">
                                            <Upload size={14} /> Subir Pago / Comprobante
                                        </h4>
                                        <div className="flex gap-4 items-end">
                                            <div className="flex-1">
                                                <label className="text-xs text-slate-500 mb-1 block">Usuario Destino</label>
                                                <select className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500" onChange={e => setSelectedUserForReceipt(e.target.value)} value={selectedUserForReceipt || ''}>
                                                    <option value="">Seleccionar perfil de usuario...</option>
                                                    {employees.map((emp: any) => (
                                                        <option key={emp.id} value={emp.email || ''}>
                                                            {emp.name} ({emp.group} - {emp.shift})
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="flex-[2]">
                                                <label className="text-xs text-slate-500 mb-1 block">Comprobante (Imagen/PDF)</label>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="file"
                                                        accept="image/*,application/pdf"
                                                        onChange={async (e) => {
                                                            const file = e.target.files?.[0];
                                                            if (!file) return;

                                                            // Upload Logic Inline
                                                            setUploadUrl(''); // Clear previous
                                                            const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '-')}`;
                                                            const { error } = await supabase.storage.from('comprobantes').upload(fileName, file);

                                                            if (error) {
                                                                alert(`Error subiendo: ${error.message} (Verifica que exista el bucket 'comprobantes' publico en Supabase)`);
                                                            } else {
                                                                const { data } = supabase.storage.from('comprobantes').getPublicUrl(fileName);
                                                                setUploadUrl(data.publicUrl);
                                                            }
                                                        }}
                                                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-1.5 text-slate-300 text-xs file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-indigo-500/10 file:text-indigo-400 hover:file:bg-indigo-500/20"
                                                    />
                                                </div>
                                                {uploadUrl && <span className="text-[10px] text-emerald-400 mt-1 block">✅ Archivo listo para asignar</span>}
                                            </div>
                                            <button onClick={handleUploadReceipt} disabled={!uploadUrl || !selectedUserForReceipt} className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg transition-all">
                                                ASIGNAR
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* TABLA DE REGISTROS (CON EDICIÓN) */}
                                <div>
                                    <h4 className="text-emerald-400 font-bold uppercase text-xs tracking-widest mb-4">Últimos Registros (Tiempo Real)</h4>

                                    {editingLog ? (
                                        <div className="bg-slate-800 p-6 rounded-xl border border-yellow-500/50 shadow-xl animate-in fade-in zoom-in-95 duration-200">
                                            <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
                                                <Edit2 className="text-yellow-400" size={20} /> Editar Registro <span className="text-slate-500 text-sm">ID: {editingLog.id.toString().slice(0, 8)}...</span>
                                            </h3>
                                            <form onSubmit={handleUpdateMasterLog} className="space-y-4">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="text-xs text-slate-500 block mb-1">Fecha Operación</label>
                                                        <input type="date" required className="bg-slate-950 text-white rounded-lg p-2 w-full border border-slate-700 focus:border-yellow-500 outline-none"
                                                            value={editingLog.fecha_operacion}
                                                            onChange={e => setEditingLog({ ...editingLog, fecha_operacion: e.target.value })} />
                                                    </div>
                                                    <div>
                                                        <label className="text-xs text-slate-500 block mb-1">Monto Apuesta</label>
                                                        <input type="number" step="any" required className="bg-slate-950 text-white rounded-lg p-2 w-full border border-slate-700 focus:border-yellow-500 outline-none"
                                                            value={editingLog.monto_apuesta}
                                                            onChange={e => setEditingLog({ ...editingLog, monto_apuesta: e.target.value })} />
                                                    </div>
                                                    <div>
                                                        <label className="text-xs text-slate-500 block mb-1">Bando</label>
                                                        <select className="bg-slate-950 text-white rounded-lg p-2 w-full border border-slate-700 focus:border-yellow-500 outline-none"
                                                            value={editingLog.bando}
                                                            onChange={e => setEditingLog({ ...editingLog, bando: e.target.value })}>
                                                            <option value="Barco">Barco</option>
                                                            <option value="Cueva">Cueva</option>
                                                        </select>
                                                    </div>
                                                </div>
                                                <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-slate-700">
                                                    <button type="button" onClick={() => setEditingLog(null)} className="px-4 py-2 text-slate-400 hover:text-white text-sm">Cancelar</button>
                                                    <button type="submit" className="px-6 py-2 bg-yellow-600 hover:bg-yellow-500 text-slate-950 rounded-lg text-sm font-bold shadow-lg shadow-yellow-500/20">Guardar Cambios</button>
                                                </div>
                                            </form>
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto rounded-xl border border-slate-800">
                                            <table className="w-full text-left text-sm text-slate-400">
                                                <thead className="bg-slate-950 text-xs uppercase font-bold text-slate-500">
                                                    <tr>
                                                        <th className="p-3">Hora</th>
                                                        <th className="p-3">Usuario</th>
                                                        <th className="p-3">Bando</th>
                                                        <th className="p-3">Mesa</th>
                                                        <th className="p-3 text-right text-indigo-400">Apuesta</th>
                                                        <th className="p-3 text-right text-emerald-400">Ganancia (8%)</th>
                                                        <th className="p-3 text-center">Acciones</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-800 bg-slate-900/40">
                                                    {masterLogs.filter((log: any) => dashboardGroup === 'Todos' || log.bando === dashboardGroup).map((log: any) => (
                                                        <tr key={log.id} className="hover:bg-slate-800/50 transition-colors group">
                                                            <td className="p-3 font-mono text-xs">{log.fecha_operacion} <span className="text-slate-600">{log.hora_registro}</span></td>
                                                            <td className="p-3 text-white font-bold text-xs">{log.user_email.split('@')[0]}</td>
                                                            <td className="p-3"><span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${log.bando === 'Barco' ? 'border-yellow-500/30 text-yellow-400 bg-yellow-500/10' : 'border-pink-500/30 text-pink-400 bg-pink-500/10'}`}>{log.bando}</span></td>
                                                            <td className="p-3 text-white text-xs opacity-50">{log.mesa}</td>
                                                            <td className="p-3 text-right font-mono text-white">${log.monto_apuesta}</td>
                                                            <td className="p-3 text-right font-mono text-emerald-300 font-bold">+${log.ganancia_calculada.toFixed(2)}</td>
                                                            <td className="p-3 flex justify-center gap-2">
                                                                {role === 'admin' && (
                                                                    <>
                                                                        <button onClick={() => setEditingLog(log)} className="p-1.5 hover:bg-yellow-500/20 rounded text-slate-500 hover:text-yellow-400 transition-colors"><Edit2 size={14} /></button>
                                                                        <button onClick={() => handleDeleteMasterLog(log.id)} className="p-1.5 hover:bg-red-500/20 rounded text-slate-500 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
                                                                    </>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }


            {/* --- CALCULADORA FLOTANTE --- */}
            {
                showCalc && (
                    <div className="fixed bottom-10 right-10 z-[60] w-64 bg-slate-900/90 backdrop-blur-2xl border border-slate-700/50 rounded-3xl shadow-2xl p-4 animate-in slide-in-from-bottom-5 duration-300 ring-1 ring-white/10 no-print">
                        <div className="flex justify-between items-center mb-4 px-1">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-yellow-500/20 rounded-lg text-yellow-500"><CalcIcon size={14} /></div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Calculadora</span>
                            </div>
                            <button onClick={() => setShowCalc(false)} className="text-slate-500 hover:text-white transition-colors bg-slate-800 p-1 rounded-full"><X size={12} /></button>
                        </div>

                        <div className="bg-black/40 border border-slate-800 rounded-2xl p-4 mb-4">
                            <div className="text-[10px] text-slate-600 font-mono text-right h-4 overflow-hidden mb-1">
                                {prevValue} {pendingOp}
                            </div>
                            <div className="text-2xl font-mono font-bold text-white text-right truncate">
                                {calcValue}
                            </div>
                        </div>

                        <div className="grid grid-cols-4 gap-2">
                            {['C', '/', '*', '-'].map(btn => (
                                <button key={btn} onClick={() => handleCalcAction(btn)} className={`p-3 rounded-xl font-bold flex items-center justify-center transition-all ${btn === 'C' ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'}`}>
                                    {btn}
                                </button>
                            ))}
                            {[7, 8, 9, '+'].map(btn => (
                                <button key={btn} onClick={() => handleCalcAction(btn.toString())} className={`p-3 rounded-xl font-bold flex items-center justify-center transition-all ${btn === '+' ? 'row-span-2 bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30' : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'}`}>
                                    {btn}
                                </button>
                            ))}
                            {[4, 5, 6].map(btn => (
                                <button key={btn} onClick={() => handleCalcAction(btn.toString())} className="p-3 bg-slate-800 text-slate-300 rounded-xl font-bold flex items-center justify-center hover:bg-slate-700 hover:text-white transition-all">
                                    {btn}
                                </button>
                            ))}
                            {[1, 2, 3, '='].map(btn => (
                                <button key={btn} onClick={() => handleCalcAction(btn.toString())} className={`p-3 rounded-xl font-bold flex items-center justify-center transition-all ${btn === '=' ? 'row-span-2 bg-yellow-500 text-slate-950 hover:bg-yellow-400 shadow-lg shadow-yellow-500/20' : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'}`}>
                                    {btn}
                                </button>
                            ))}
                            <button onClick={() => handleCalcAction('0')} className="col-span-2 p-3 bg-slate-800 text-slate-300 rounded-xl font-bold flex items-center justify-center hover:bg-slate-700 hover:text-white transition-all">0</button>
                            <button onClick={() => handleCalcAction('.')} className="p-3 bg-slate-800 text-slate-300 rounded-xl font-bold flex items-center justify-center hover:bg-slate-700 hover:text-white transition-all">.</button>
                        </div>
                    </div>
                )
            }

            {/* --- BINANCE FLOATING CONVERTER --- */}
            {
                showBinanceCalc && (
                    <div className="fixed bottom-10 right-10 z-[60] w-80 bg-slate-900/95 backdrop-blur-3xl border border-yellow-500/30 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.5),0_0_30px_rgba(234,179,8,0.1)] p-6 animate-in zoom-in-95 slide-in-from-bottom-10 duration-500 ring-1 ring-white/10 no-print">
                        <div className="flex justify-between items-start mb-6">
                            <div className="flex flex-col gap-1">
                                <h3 className="text-[10px] font-black uppercase text-yellow-500 tracking-[0.3em] flex items-center gap-2">
                                    <div className="p-1.5 bg-yellow-500/20 rounded-xl text-yellow-500"><CircleDollarSign size={16} /></div>
                                    Binance Live
                                </h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-2xl font-mono font-black text-white">{formatCurrency(usdtRate)}</span>
                                    <span className="text-[8px] bg-emerald-500 text-black px-1.5 py-0.5 rounded-full font-black tracking-widest animate-pulse">LIVE</span>
                                </div>
                            </div>
                            <button onClick={() => setShowBinanceCalc(false)} className="text-slate-500 hover:text-white transition-all bg-slate-800 p-2 rounded-full hover:rotate-90 duration-300"><X size={14} /></button>
                        </div>

                        <div className="space-y-4">
                            <div className="bg-black/40 border border-white/5 rounded-3xl p-5 space-y-4 shadow-inner">
                                <div className="space-y-1.5">
                                    <label className="text-[9px] text-slate-500 font-black uppercase tracking-widest ml-1">Pesos (ARS)</label>
                                    <div className="relative">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-yellow-500 font-black">$</div>
                                        <input
                                            type="number"
                                            className="w-full bg-slate-900/50 border border-slate-700/50 rounded-2xl pl-10 pr-4 py-3 text-white font-mono font-bold focus:ring-2 focus:ring-yellow-500/20 outline-none transition-all"
                                            placeholder="ARS"
                                            value={binanceARS}
                                            onChange={e => {
                                                const val = e.target.value;
                                                setBinanceARS(val);
                                                const num = parseFloat(val);
                                                if (!isNaN(num) && usdtRate > 0) setBinanceUSDT((num / usdtRate).toFixed(2));
                                                else setBinanceUSDT('');
                                            }}
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-center py-1">
                                    <RefreshCw size={12} className="text-slate-700" />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[9px] text-slate-500 font-black uppercase tracking-widest ml-1">Cripto (USDT)</label>
                                    <div className="relative">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-yellow-500 font-black">₮</div>
                                        <input
                                            type="number"
                                            className="w-full bg-slate-900/50 border border-slate-700/50 rounded-2xl pl-10 pr-4 py-3 text-white font-mono font-bold focus:ring-2 focus:ring-yellow-500/20 outline-none transition-all"
                                            placeholder="USDT"
                                            value={binanceUSDT}
                                            onChange={e => {
                                                const val = e.target.value;
                                                setBinanceUSDT(val);
                                                const num = parseFloat(val);
                                                if (!isNaN(num) && usdtRate > 0) setBinanceARS((num * usdtRate).toFixed(0));
                                                else setBinanceARS('');
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={fetchLivePrice}
                                disabled={isFetchingPrice}
                                className="w-full py-3 bg-yellow-500 text-black rounded-2xl font-black text-[10px] tracking-[0.2em] uppercase hover:bg-yellow-400 transition-all flex items-center justify-center gap-2 shadow-lg shadow-yellow-500/20 disabled:opacity-50"
                            >
                                <RefreshCw size={14} className={isFetchingPrice ? 'animate-spin' : ''} />
                                Actualizar Tasa
                            </button>
                        </div>
                    </div>
                )
            }

            {/* --- MODAL DETALLE DE TURNO --- */}
            {
                activeModal === 'shiftDetail' && activeShiftDay && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="bg-slate-900/90 border border-indigo-500/30 w-full max-w-sm rounded-[2rem] p-8 shadow-2xl relative">
                            <div className="absolute top-0 right-0 p-4 opacity-5 text-indigo-500"><Activity size={80} /></div>

                            <button
                                onClick={() => setActiveModal(null)}
                                className="absolute top-4 right-4 p-4 bg-slate-800 hover:bg-slate-700 rounded-full text-white transition-all z-[100] cursor-pointer shadow-xl border border-white/10 active:scale-95 pointer-events-auto"
                                type="button"
                            >
                                <X size={24} />
                            </button>

                            <div className="flex justify-between items-center mb-6 pt-4">
                                <div>
                                    <h3 className="text-white font-black text-xl tracking-tight">Registro de Asistencia</h3>
                                    <p className="text-indigo-400 text-[10px] font-bold uppercase tracking-widest mt-1">Día {activeShiftDay.day} • {employees.find((e: any) => e.id === activeShiftDay.empId)?.name}</p>
                                </div>
                            </div>

                            <form onSubmit={(e) => {
                                e.preventDefault();
                                const newStatus = parseFloat(shiftDetailForm.horas) > 0 ? 'Presente' : 'Falta';
                                handleShiftChange(activeShiftDay.empId, activeShiftDay.day, { ...shiftDetailForm, estatus: newStatus });
                                setActiveModal(null);
                            }} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] text-slate-500 font-bold uppercase ml-1">Entrada</label>
                                        <input
                                            type="text"
                                            placeholder="HH:MM"
                                            className="w-full bg-slate-950/50 border border-slate-700/50 rounded-xl py-3 px-4 text-white font-mono focus:border-indigo-500 transition-all outline-none"
                                            value={shiftDetailForm.entrada}
                                            onChange={(e) => setShiftDetailForm({ ...shiftDetailForm, entrada: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] text-slate-500 font-bold uppercase ml-1">Salida</label>
                                        <input
                                            type="text"
                                            placeholder="HH:MM"
                                            className="w-full bg-slate-950/50 border border-slate-700/50 rounded-xl py-3 px-4 text-white font-mono focus:border-indigo-500 transition-all outline-none"
                                            value={shiftDetailForm.salida}
                                            onChange={(e) => setShiftDetailForm({ ...shiftDetailForm, salida: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] text-slate-500 font-bold uppercase ml-1">Total Horas</label>
                                    <input
                                        type="text"
                                        placeholder="0.0"
                                        required
                                        className="w-full bg-slate-950/50 border border-emerald-500/30 rounded-xl py-4 px-4 text-emerald-400 font-mono text-2xl font-black focus:border-emerald-500 transition-all outline-none text-center"
                                        value={shiftDetailForm.horas}
                                        onChange={(e) => setShiftDetailForm({ ...shiftDetailForm, horas: e.target.value.replace(',', '.') })}
                                    />
                                </div>

                                <div className="pt-4 space-y-3">
                                    <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-xl shadow-[0_0_20px_rgba(79,70,229,0.3)] transition-all flex items-center justify-center gap-2">
                                        <Save size={18} /> GUARDAR REGISTRO
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveModal(null)}
                                        className="w-full py-2 text-slate-500 font-bold uppercase tracking-widest text-[10px] hover:text-white transition-colors"
                                    >
                                        Cancelar / Cerrar
                                    </button>
                                </div>
                                <p className="text-[8px] text-slate-500 italic text-center uppercase tracking-tighter">Automatic status: {parseFloat(shiftDetailForm.horas) > 0 ? 'Presente' : 'Falta'}</p>
                            </form>
                        </div>
                    </div>
                )
            }
            {/* --- NÓMINA PRINCIPAL MOVED TO EARLY RETURN --- */}
            {/* 2FA SETUP MODAL */}
            {show2FAModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-fuchsia-500/30 rounded-2xl w-full max-w-md p-6 shadow-2xl relative overflow-hidden">

                        {/* Header */}
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <ScanLine className="text-fuchsia-500" />
                                Configurar Google Auth
                            </h2>
                            <button onClick={() => setShow2FAModal(false)} className="text-slate-400 hover:text-white"><X size={24} /></button>
                        </div>

                        {/* Content */}
                        <div className="space-y-6 text-center">

                            <div className="bg-white p-4 rounded-xl inline-block mx-auto shadow-lg shadow-fuchsia-500/20">
                                {qrCodeUrl && <img src={qrCodeUrl} alt="2FA QR Code" className="w-48 h-48 mix-blend-multiply" />}
                            </div>

                            <div className="space-y-2">
                                <p className="text-sm text-slate-300">1. Abre <strong>Google Authenticator</strong> en tu celular.</p>
                                <p className="text-sm text-slate-300">2. Escanea el código QR de arriba.</p>
                                <p className="text-sm text-slate-300">3. Ingresa el código de 6 dígitos que aparece.</p>
                            </div>

                            <div className="bg-slate-950/50 p-3 rounded-lg border border-white/5">
                                <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest mb-1">Tu Clave Secreta (Backup)</p>
                                <code className="text-fuchsia-400 font-mono text-xs select-all">{newSecret}</code>
                            </div>

                            <div className="space-y-3 pt-2">
                                <input
                                    type="text"
                                    className="w-full bg-black/40 border border-fuchsia-500/30 rounded-lg p-3 text-center text-white font-mono text-xl tracking-[0.5em] focus:border-fuchsia-500 focus:ring-0 outline-none placeholder:text-white/10"
                                    placeholder="000000"
                                    maxLength={6}
                                    value={verifCode}
                                    onChange={(e) => setVerifCode(e.target.value.replace(/[^0-9]/g, ''))}
                                />
                                <button
                                    onClick={handleConfirm2FA}
                                    className="w-full py-3 bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-fuchsia-500/25 active:scale-95"
                                >
                                    VERIFICAR Y ACTIVAR
                                </button>
                            </div>

                        </div>
                    </div>
                </div>
            )}
        </div >
    );


};

export default Dashboard;
