
import React, { useState, useEffect } from 'react';
import Dashboard from './Dashboard';
import MobileOperative from './MobileOperative';
import PublicityDashboard from './PublicityDashboard';
import RestriccionModule from './RestriccionModule';
import { User, Key, Eye, EyeOff, RefreshCw, ShieldAlert } from 'lucide-react';
import { supabase } from './lib/supabase';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<{ email: string; role: string; name: string } | null>(null);
  const [activeModule, setActiveModule] = useState<'main' | 'restriccion'>('main');

  // Simple State for Login Form
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 2FA STATE
  const [show2FA, setShow2FA] = useState(false);
  const [twoFACode, setTwoFACode] = useState('');
  const [tempUser, setTempUser] = useState<any>(null); // Store user while waiting for 2FA
  const [twoFAMethod, setTwoFAMethod] = useState<'totp' | 'pin'>('pin'); // Default or detected
  const [showPIN, setShowPIN] = useState(false); // Toggle visibility for PIN


  // Generador de ID de dispositivo único
  const getDeviceId = () => {
    let id = localStorage.getItem('fmx_device_id');
    if (!id) {
      id = Math.random().toString(36).substring(2) + Date.now().toString(36);
      localStorage.setItem('fmx_device_id', id);
    }
    return id;
  };

  const trackSession = async (email: string) => {
    const deviceId = getDeviceId();
    await supabase.from('gestor_sesiones').upsert({
      user_email: email,
      device_id: deviceId,
      last_active_at: new Date().toISOString()
    }, { onConflict: 'user_email,device_id' });
  };

  // Check session on load
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('dashboard_user');
      if (savedUser) {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
        setIsAuthenticated(true);
        trackSession(parsedUser.email);
      }
    } catch (e) {
      console.error("Error validando sesión", e);
      localStorage.removeItem('dashboard_user');
    }
  }, []);

  // HEARTBEAT para sesiones online
  useEffect(() => {
    if (isAuthenticated && user) {
      const interval = setInterval(async () => {
        const deviceId = getDeviceId();
        // 1. Verificar si la sesión aún existe
        const { data, error } = await supabase
          .from('gestor_sesiones')
          .select('id')
          .eq('user_email', user.email)
          .eq('device_id', deviceId)
          .maybeSingle();

        if (error || !data) {
          // Si no hay dato o hay error, la sesión fue eliminada (KICK) o expiró (Solo invitados)
          console.warn("Sesión invalidada por el Administrador.");
          handleLogout();
        } else {
          // 2. Si existe, actualizar pulso
          trackSession(user.email);
        }
      }, 120000); // OPTIMIZATION: Reduced to 120s to minimize Supabase usage
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, user]);


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Consultar usuario en la base de datos
      const { data: dbUser, error: dbError } = await supabase
        .from('usuarios_sistema')
        .select('*')
        .eq('username', username.toLowerCase())
        .single();

      if (dbError || !dbUser) {
        setError('Usuario no encontrado');
        setLoading(false);
        return;
      }

      // Verificar contraseña
      if (dbUser.password_text !== password) {
        setError('Contraseña incorrecta');
        setLoading(false);
        return;
      }

      // Verificar estado de aprobación
      if (dbUser.estado !== 'aprobado') {
        setError('Acceso pendiente de aprobación por el Administrador.');
        setLoading(false);
        return;
      }

      // 2FA CHECK FOR ADMINS
      if (dbUser.role === 'admin' || dbUser.role === 'vicepresident') {
        // Check if user has 2FA configured
        const hasTOTP = !!dbUser.secret_2fa;
        // ALWAYS SHOW 2FA FOR ADMINS (Fallback to Master PIN)
        setTempUser(dbUser);
        setShow2FA(true);
        // Prefer TOTP if available, otherwise PIN
        setTwoFAMethod(hasTOTP ? 'totp' : 'pin');
        setLoading(false);
        return;
      }

      // --- ACCESO TOTAL ADMIN (SIN LÍMITES 4X4) ---
      await trackSession(dbUser.username);

      // Login correcto
      const sessionUser = {
        email: dbUser.username,
        role: dbUser.role,
        name: dbUser.nombre
      };
      localStorage.setItem('dashboard_user', JSON.stringify(sessionUser));
      setUser(sessionUser);
      setIsAuthenticated(true);
    } catch (err) {
      console.error("Login error:", err);
      setError('Error de conexión con el servidor');
    } finally {
      if (!show2FA) setLoading(false);
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let isValid = false;

      // 1. CHECK PIN (User PIN or Master PIN)
      if (twoFACode === '119296' || (tempUser.pin_code && tempUser.pin_code === twoFACode)) {
        isValid = true;
      }

      // 2. CHECK TOTP (If not valid yet AND user has secret)
      if (!isValid && tempUser.secret_2fa) {
        try {
          const OTPAuth = await import('otpauth');
          const totp = new OTPAuth.TOTP({
            secret: OTPAuth.Secret.fromBase32(tempUser.secret_2fa),
            algorithm: 'SHA1',
            digits: 6,
            period: 30
          });
          // Verify with window 10
          const delta = totp.validate({ token: twoFACode, window: 10 });

          if (delta !== null) isValid = true;
        } catch (otpErr) {
          console.error("OTP Check Error", otpErr);
        }
      }

      if (isValid) {
        // LOGIN SUCCESS
        await trackSession(tempUser.username);
        const sessionUser = {
          email: tempUser.username,
          role: tempUser.role,
          name: tempUser.nombre
        };
        localStorage.setItem('dashboard_user', JSON.stringify(sessionUser));
        setUser(sessionUser);
        setIsAuthenticated(true);
      } else {
        setError('Código o PIN Incorrecto');
        setLoading(false);
      }

    } catch (err) {
      console.error("2FA Error:", err);
      setError('Error validando 2FA');
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('dashboard_user');
    setIsAuthenticated(false);
    setUser(null);
    setUsername('');
    setPassword('');
    setError(''); // Clear error on logout
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-black relative overflow-hidden font-sans selection:bg-cyan-500/30">

        {/* --- ULTRA-FUTURISTIC BACKGROUND (AURORA VOID) --- */}
        <div className="absolute inset-0 z-0">
          {/* Deep Space Base */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#1a1b26] via-[#000000] to-[#000000]"></div>

          {/* Moving Auroras (Animated Blobs) */}
          <div className="absolute top-[-20%] left-[-10%] w-[70vw] h-[70vw] bg-indigo-600/20 rounded-full blur-[100px] animate-pulse-slow mix-blend-screen"></div>
          <div className="absolute bottom-[-20%] right-[-10%] w-[70vw] h-[70vw] bg-cyan-600/10 rounded-full blur-[100px] animate-pulse-slow delay-2000 mix-blend-screen"></div>
          <div className="absolute top-[40%] left-[40%] w-[50vw] h-[50vw] bg-purple-600/10 rounded-full blur-[120px] animate-pulse-slow delay-4000 mix-blend-screen"></div>

          {/* Stars / Dust Particles */}
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:100px_100px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_100%)]"></div>
        </div>

        {/* --- REPLICA GLASS LOGIN CARD --- */}
        <div className="relative w-full max-w-[420px] z-10 perspective-1000">

          {/* Logo Section */}
          <div className="flex justify-center mb-10">
            <img
              src="/logo.png"
              alt="FMX Logo"
              className="w-full max-w-[350px] md:max-w-[480px] h-auto drop-shadow-[0_0_30px_rgba(255,255,255,0.3)] animate-pulse-slow"
            />
          </div>

          <div className="bg-white/5 backdrop-blur-[20px] border-t border-l border-white/20 border-b border-r border-white/10 p-10 rounded-[30px] shadow-[0_20px_40px_rgba(0,0,0,0.6)] relative overflow-hidden ring-1 ring-white/5">

            {/* Header */}
            <div className="text-center mb-10 relative">
              <h2 className="text-3xl font-bold text-white tracking-[0.3em] mb-6 drop-shadow-md">LOGIN</h2>
              <div className="h-[1px] w-3/4 mx-auto bg-gradient-to-r from-transparent via-white/40 to-transparent"></div>
            </div>

            {show2FA ? (
              <form onSubmit={handleVerify2FA} className="space-y-6">
                <div className="text-center text-white mb-4">
                  <h3 className="font-bold text-lg mb-2">VERIFICACIÓN DE SEGURIDAD</h3>
                  <p className="text-xs text-white/60">
                    Ingresa tu PIN Maestro o Código de Google Authenticator
                  </p>
                </div>

                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none z-10">
                    <ShieldAlert className="text-fuchsia-500 animate-pulse" size={20} />
                  </div>
                  <input
                    autoFocus
                    type={showPIN ? "text" : "password"}
                    maxLength={6}
                    className="w-full bg-black/40 border-2 border-fuchsia-500/50 rounded-xl py-4 pl-14 pr-12 text-white placeholder:text-white/20 text-2xl text-center tracking-[0.5em] focus:ring-0 focus:bg-black/60 transition-all font-mono font-bold shadow-[0_0_20px_rgba(232,121,249,0.2)]"
                    placeholder="000000"
                    value={twoFACode}
                    onChange={(e) => setTwoFACode(e.target.value.replace(/[^0-9]/g, ''))}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPIN(!showPIN)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-fuchsia-500 hover:text-white transition-colors cursor-pointer z-20 outline-none"
                    title={showPIN ? "Ocultar PIN" : "Mostrar PIN"}
                  >
                    {showPIN ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                {twoFAMethod === 'pin' && (
                  <div className="text-center mt-2">
                    <p className="text-[10px] text-white/30 hover:text-white/50 transition-colors cursor-help">
                      ¿Quieres usar Google Authenticator? Contacta al Soporte.
                    </p>
                  </div>
                )}

                {/* Allow switching if both exist (optional complexity, for now stick to one preferred) */}

                {/* Error Message */}
                <div className={`overflow-hidden transition-all duration-300 ${error ? 'max-h-20 opacity-100 mt-4' : 'max-h-0 opacity-0 mt-0'}`}>
                  <div className="text-fuchsia-500 text-xs text-center font-bold bg-black/30 p-3 rounded-lg border border-fuchsia-900/40 shadow-lg">
                    <span className="inline-block w-2 h-2 bg-fuchsia-700 rounded-full mr-2 animate-pulse"></span>
                    {error}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setShow2FA(false); setTempUser(null); setTwoFACode(''); setError(''); }}
                    className="w-1/3 bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 rounded-xl transition-all text-xs"
                  >
                    ATRÁS
                  </button>
                  <button
                    disabled={loading || twoFACode.length < 4}
                    className="w-2/3 bg-gradient-to-r from-[#be185d] to-[#701a75] hover:from-[#db2777] hover:to-[#86198f] text-white font-bold py-4 rounded-xl shadow-[0_10px_25px_rgba(190,24,93,0.3)] hover:shadow-[0_15px_35px_rgba(190,24,93,0.5)] transition-all transform hover:-translate-y-0.5 active:scale-95 tracking-[0.2em] text-sm flex items-center justify-center gap-2"
                  >
                    {loading ? <RefreshCw className="animate-spin" size={18} /> : 'VERIFICAR'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleLogin} className="space-y-6">

                {/* Input User */}
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none z-10">
                    <User className="text-black group-focus-within:text-black transition-colors" size={20} />
                  </div>
                  <input
                    type="text"
                    className="w-full bg-black/40 border-none rounded-xl py-4 pl-14 pr-4 text-white placeholder:text-white/40 text-[15px] focus:ring-0 focus:bg-black/60 transition-all font-bold tracking-wide shadow-inner"
                    placeholder="USUARIO"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>

                {/* Input Password */}
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none z-10">
                    <Key className="text-black group-focus-within:text-black transition-colors" size={20} />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    className="w-full bg-black/40 border-none rounded-xl py-4 pl-14 pr-12 text-white placeholder:text-white/40 text-[15px] focus:ring-0 focus:bg-black/60 transition-all font-bold tracking-wide shadow-inner"
                    placeholder="********"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-500 hover:text-gray-300 transition-colors cursor-pointer z-20 outline-none"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                {/* Options Row */}
                <div className="flex justify-start items-center text-[12px] text-white/70 px-2 mt-2">
                  <label className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors select-none">
                    <input type="checkbox" className="rounded bg-black/40 border-white/10 text-fuchsia-700 focus:ring-0 focus:ring-offset-0 w-4 h-4 checked:bg-fuchsia-800" />
                    <span className="font-bold">Recordar</span>
                  </label>
                </div>

                {/* Error Message */}
                <div className={`overflow-hidden transition-all duration-300 ${error ? 'max-h-20 opacity-100 mt-4' : 'max-h-0 opacity-0 mt-0'}`}>
                  <div className="text-fuchsia-500 text-xs text-center font-bold bg-black/30 p-3 rounded-lg border border-fuchsia-900/40 shadow-lg">
                    <span className="inline-block w-2 h-2 bg-fuchsia-700 rounded-full mr-2 animate-pulse"></span>
                    {error}
                  </div>
                </div>

                {/* Login Button */}
                <button
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-[#be185d] to-[#701a75] hover:from-[#db2777] hover:to-[#86198f] text-white font-bold py-4 rounded-xl shadow-[0_10px_25px_rgba(190,24,93,0.3)] hover:shadow-[0_15px_35px_rgba(190,24,93,0.5)] transition-all transform hover:-translate-y-0.5 active:scale-95 tracking-[0.2em] text-sm mt-6 flex items-center justify-center gap-2"
                >
                  {loading ? <RefreshCw className="animate-spin" size={18} /> : 'ACCEDER'}
                </button>

              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- ROUTING LOGIC ---

  // 1. Shaipubli Role (Exclusive for Advertising)
  if (user && user.role === 'shaipubli') {
    return <PublicityDashboard user={user as any} onLogout={handleLogout} />;
  }

  // 2. Mobile Operative (Barco, Cueva)
  if (user && ['fijo_barco', 'fijo_cueva'].includes(user.role)) {
    if (activeModule === 'restriccion') {
      return <RestriccionModule user={user as any} onBack={() => setActiveModule('main')} />;
    }
    return (
      <MobileOperative
        user={user as any}
        onLogout={handleLogout}
        onNavigateToRestriccion={() => setActiveModule('restriccion')}
      />
    );
  }

  // 3. Admin, Vicepresidente o Invitado -> Muestra el Dashboard Completo
  if (activeModule === 'restriccion') {
    return <RestriccionModule user={user as any} onBack={() => setActiveModule('main')} />;
  }

  return (
    <div className="relative">
      <Dashboard
        role={(user?.role as any) || 'guest'}
        userEmail={user?.email || ''}
        onLogout={handleLogout}
        onNavigateToRestriccion={() => setActiveModule('restriccion')}
      />
      {/* Botón flotante para acceder a Restricciones (solo para Admin, Vice o Invitado/Staff) */}
      <button
        onClick={() => setActiveModule('restriccion')}
        className="fixed bottom-6 right-6 z-50 p-4 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl shadow-2xl shadow-rose-600/30 transition-all active:scale-95 group flex items-center gap-3 border border-rose-400/20"
      >
        <ShieldAlert size={20} className="animate-pulse" />
        <span className="text-[10px] font-black uppercase tracking-widest hidden group-hover:block transition-all">Seguridad / Restricción</span>
      </button>
    </div>
  );
}

export default App;
