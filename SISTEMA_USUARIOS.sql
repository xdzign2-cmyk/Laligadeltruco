
-- RE-ESTRUCTURACIÓN COMPLETA DE USUARIOS (BORRA E INSERTA DE NUEVO PARA LIMPIEZA)
DROP TABLE IF EXISTS usuarios_sistema;

CREATE TABLE usuarios_sistema (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_text TEXT NOT NULL,
    nombre TEXT NOT NULL,
    role TEXT NOT NULL, -- 'admin', 'vicepresident', 'guest', 'fijo_barco', 'fijo_cueva', 'franquero'
    estado TEXT DEFAULT 'pendiente', -- 'pendiente', 'aprobado', 'denegado'
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE usuarios_sistema ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acceso total usuarios" ON usuarios_sistema FOR ALL USING (true);

-- INSERTAR USUARIO ADMIN GENÉRICO PROVISIONAL
INSERT INTO usuarios_sistema (username, password_text, nombre, role, estado)
VALUES 
('admin', 'admin123', 'Administrador de Pruebas', 'admin', 'aprobado')
ON CONFLICT (username) DO NOTHING;
