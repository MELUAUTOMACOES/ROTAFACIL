-- Configurar usuário como administrador
UPDATE users 
SET role = 'admin', 
    email_verified = true,
    require_password_change = false
WHERE email = 'lucaspmastaler@gmail.com';

-- Verificar resultado
SELECT id, name, email, role, email_verified FROM users WHERE email = 'lucaspmastaler@gmail.com';
