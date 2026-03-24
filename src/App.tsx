
import React, { useState, useEffect } from 'react';
import Dashboard from './Dashboard';
import MobileOperative from './MobileOperative';
import PublicityDashboard from './PublicityDashboard';
import RestriccionModule from './RestriccionModule';
import { Eye, EyeOff, RefreshCw, ShieldAlert, TrendingUp } from 'lucide-react';
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

  // Componente de partículas doradas con Canvas y efecto de Movimiento Líquido y Estrellas Fugaces
  const GoldNetwork = () => {
    const canvasRef = React.useRef<HTMLCanvasElement>(null);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d', { alpha: true });
      if (!ctx) return;

      let particles: any[] = [];
      let shootingStars: any[] = [];
      const particleCount = 55;
      const connectionDistance = 170;
      let time = 0;

      const resize = () => {
        if (!canvas) return;
        const dpr = window.devicePixelRatio || 1;
        const w = window.innerWidth;
        const h = window.innerHeight;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
        ctx.scale(dpr, dpr);
      };

      class Particle {
        x: number; y: number; vx: number; vy: number; baseSize: number; z: number; phase: number;
        constructor() {
          this.x = Math.random() * window.innerWidth;
          this.y = Math.random() * window.innerHeight;
          this.z = Math.random() * 1.5;
          this.phase = Math.random() * Math.PI * 2;
          const angle = Math.random() * Math.PI * 2;
          const speed = (Math.random() * 0.2 + 0.1) * (this.z + 0.5);
          this.vx = Math.cos(angle) * speed;
          this.vy = Math.sin(angle) * speed;
          this.baseSize = (this.z + 0.5) * 1.5;
        }
        update(time: number) {
          // Movimiento base + ligero balanceo líquido
          this.x += this.vx + Math.sin(time * 0.001 + this.phase) * 0.1;
          this.y += this.vy + Math.cos(time * 0.001 + this.phase) * 0.1;
          
          if (this.x < -100) this.x = window.innerWidth + 100;
          if (this.x > window.innerWidth + 100) this.x = -100;
          if (this.y < -100) this.y = window.innerHeight + 100;
          if (this.y > window.innerHeight + 100) this.y = -100;
        }
        draw(time: number) {
          if (!ctx) return;
          // Pulso de tamaño
          const size = this.baseSize + Math.sin(time * 0.003 + this.phase) * 0.5;
          // Color dinámico (cambio sutil entre dorados)
          const goldHue = 40 + Math.sin(time * 0.001) * 10;
          
          ctx.beginPath();
          ctx.arc(this.x, this.y, size, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${goldHue}, 100%, 50%, ${this.z * 0.4 + 0.2})`;
          ctx.fill();
        }
      }

      class ShootingStar {
        x: number; y: number; vx: number; vy: number; len: number; life: number;
        constructor() {
          this.x = Math.random() * window.innerWidth;
          this.y = Math.random() * (window.innerHeight / 2);
          this.vx = 8 + Math.random() * 8;
          this.vy = 4 + Math.random() * 4;
          this.len = 50 + Math.random() * 100;
          this.life = 1;
        }
        update() {
          this.x += this.vx;
          this.y += this.vy;
          this.life -= 0.015;
        }
        draw() {
          if (!ctx) return;
          const grad = ctx.createLinearGradient(this.x, this.y, this.x - this.vx * 5, this.y - this.vy * 5);
          grad.addColorStop(0, `rgba(255, 200, 0, ${this.life})`);
          grad.addColorStop(1, 'rgba(255, 100, 0, 0)');
          ctx.beginPath();
          ctx.moveTo(this.x, this.y);
          ctx.lineTo(this.x - this.vx * 3, this.y - this.vy * 3);
          ctx.strokeStyle = grad;
          ctx.lineWidth = 2;
          ctx.lineCap = 'round';
          ctx.stroke();
        }
      }

      for (let i = 0; i < particleCount; i++) particles.push(new Particle());

      const animate = () => {
        if (!ctx || !canvas) return;
        time += 16;
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

        // Generar estrella fugaz ocasional
        if (Math.random() < 0.005) shootingStars.push(new ShootingStar());

        particles.forEach((p, i) => {
          p.update(time);
          p.draw(time);
          for (let j = i + 1; j < particles.length; j++) {
            const p2 = particles[j];
            const dx = p.x - p2.x;
            const dy = p.y - p2.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < connectionDistance && Math.abs(p.z - p2.z) < 0.5) {
              ctx.beginPath();
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.strokeStyle = `rgba(255, 184, 0, ${(1 - dist / connectionDistance) * 0.15})`;
              ctx.lineWidth = 0.5;
              ctx.stroke();
            }
          }
        });

        shootingStars = shootingStars.filter(s => {
          s.update();
          s.draw();
          return s.life > 0;
        });

        requestAnimationFrame(animate);
      };

      window.addEventListener('resize', resize);
      resize();
      animate();
      return () => window.removeEventListener('resize', resize);
    }, []);

    return <canvas ref={canvasRef} className="absolute inset-0 z-0 bg-black" />;
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-black login-premium-container font-sans selection:bg-[#FF6B00]/30 selection:text-white overflow-hidden">
        
        <GoldNetwork />
        
        {/* Glow de fondo para la tarjeta */}
        <div className="absolute w-[600px] h-[600px] bg-[#FF6B00]/5 rounded-full blur-[100px] z-0 animate-pulse-slow"></div>

        {/* --- GLASSMORPHISM LOGIN CARD --- */}
        <div className="w-full max-w-[360px] relative z-20 animate-in zoom-in-95 fade-in duration-500 fill-mode-both">
          {/* Tarjeta de Inicio de Sesión */}
          <div className="relative group/card">
            <div className="absolute -inset-[1px] bg-gradient-to-tr from-[#FFB800]/20 via-orange-500/10 to-[#FFB800]/20 rounded-[32px] blur-sm opacity-50 transition-opacity"></div>
            <div className="relative bg-[#000000]/85 backdrop-blur-3xl py-6 px-8 rounded-[32px] border border-white/10 shadow-[0_30px_90px_rgba(0,0,0,1)]">
              
              <div className="flex flex-col items-center mb-4">
                <div className="relative mb-2 animate-in slide-in-from-bottom-2 fade-in duration-500">
                  <div className="absolute -inset-4 bg-[#FFB800]/10 rounded-full blur-xl animate-pulse"></div>
                  <img 
                    src="/logo.png" 
                    alt="Logo" 
                    className="w-40 h-40 object-contain contrast-125 brightness-110 drop-shadow-[0_0_25px_rgba(255,184,0,0.5)]" 
                  />
                </div>
                <h1 className="text-2xl font-black text-white tracking-[0.4em] uppercase text-center animate-in slide-in-from-bottom-2 fade-in duration-500 delay-100">
                  Entrar
                </h1>
              </div>

            <form onSubmit={handleLogin} className="w-full space-y-4">
              
              <div className="space-y-3">
                  <div className="login-input-group animate-in slide-in-from-bottom-4 fade-in duration-500 fill-mode-both">
                    <label className="text-[11px] text-white/40 ml-1 mb-2 block font-bold tracking-[0.2em] uppercase">Usuario o Email</label>
                    <input
                      type="text"
                      className="login-input"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Nombre de usuario"
                    />
                  </div>

                  <div className="login-input-group animate-in slide-in-from-bottom-4 fade-in duration-500 delay-150 fill-mode-both">
                    <label className="text-[11px] text-white/40 ml-1 mb-2 block font-bold tracking-[0.2em] uppercase">Contraseña</label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        className="login-input pr-14"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-5 top-1/2 -translate-y-1/2 text-white/20 hover:text-white transition-colors cursor-pointer outline-none"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
              </div>

              <div className="flex justify-between items-center text-[11px] text-white/40 px-1 animate-in fade-in duration-500 delay-200 fill-mode-both">
                <label className="flex items-center gap-3 cursor-pointer hover:text-white/60 transition-colors py-1 group">
                  <input type="checkbox" className="w-5 h-5 rounded-lg border-white/10 bg-white/5 accent-[#FF6B00] transition-all cursor-pointer group-hover:scale-110" />
                  <span className="font-medium tracking-wide">Recordarme</span>
                </label>
                <button type="button" className="hover:text-white transition-colors font-bold uppercase tracking-widest text-[#FFB800]/60">
                  ¿Olvidaste tu clave?
                </button>
              </div>

              <div className={`overflow-hidden transition-all duration-300 ${error ? 'max-h-20 opacity-100 animate-[shake_0.4s_ease-in-out]' : 'max-h-0 opacity-0'}`}>
                <div className="text-red-400 text-[11px] text-center font-bold bg-red-950/40 py-3 px-6 rounded-2xl border border-red-500/20">
                  {error}
                </div>
              </div>

              <div className="pt-2 flex flex-col gap-6 items-center animate-in slide-in-from-bottom-4 fade-in duration-500 delay-250 fill-mode-both">
                <button
                  disabled={loading}
                  className="w-full bg-[#FF6B00] hover:bg-[#FF8A00] text-black font-black py-5 rounded-3xl transition-all tracking-[0.3em] text-[12px] flex justify-center items-center gap-2 shadow-[0_20px_50px_rgba(255,107,0,0.4)] active:scale-95 disabled:opacity-50 gold-glow-btn group"
                >
                  {loading ? <RefreshCw className="animate-spin" size={20} /> : (
                    <>
                      <span>ENTRAR AL SISTEMA</span>
                      <TrendingUp className="opacity-0 group-hover:opacity-100 transition-opacity translate-x-2" size={18} />
                    </>
                  )}
                </button>
              </div>
            </form>
            </div>
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
