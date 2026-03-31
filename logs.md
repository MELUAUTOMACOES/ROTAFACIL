LOGIN] Convite pendente detectado após login
index-BZ8hZ7df.js:690    - Token: 5462bb9da1...
index-BZ8hZ7df.js:996 🎫 [ACCEPT INVITE] Componente montado
index-BZ8hZ7df.js:996 🎫 [ACCEPT INVITE] Token da URL: 5462bb9da18bd95fc6a37853e0a50c99b9835a1ab6516d79a0eddef7740bde09
index-BZ8hZ7df.js:996 🔍 [VALIDATE INVITE] Validando convite...
index-BZ8hZ7df.js:996 🔍 [VALIDATE INVITE] URL: /api/invitations/5462bb9da18bd95fc6a37853e0a50c99b9835a1ab6516d79a0eddef7740bde09
index-BZ8hZ7df.js:996 🎫 [ACCEPT INVITE] Componente montado
index-BZ8hZ7df.js:996 🎫 [ACCEPT INVITE] Token da URL: 5462bb9da18bd95fc6a37853e0a50c99b9835a1ab6516d79a0eddef7740bde09
index-BZ8hZ7df.js:48 Collapsible is changing from uncontrolled to controlled. Components should not switch from controlled to uncontrolled (or vice versa). Decide between using a controlled or uncontrolled value for the lifetime of the component.
(anônimo) @ index-BZ8hZ7df.js:48Entenda o aviso
index-BZ8hZ7df.js:996 🔍 [VALIDATE INVITE] Status: 200
index-BZ8hZ7df.js:996 🔍 [VALIDATE INVITE] Response: Object
index-BZ8hZ7df.js:996 ✅ [VALIDATE INVITE] Convite válido!
index-BZ8hZ7df.js:996    - Email: meluautomacoes@gmail.com
index-BZ8hZ7df.js:996    - Empresa: Melu Automações
index-BZ8hZ7df.js:996    - Role: OPERADOR
index-BZ8hZ7df.js:996    - Usuário já tem conta? true
api/vehicles/available-for-me:1  Failed to load resource: the server responded with a status of 403 ()Entenda o erro
api/vehicles:1  Failed to load resource: the server responded with a status of 403 ()Entenda o erro
api/business-rules:1  Failed to load resource: the server responded with a status of 403 ()


🔍 [LIST USERS] Buscando usuários com memberships ativas na empresa 1...
✅ [LIST USERS] Encontrados 1 usuários com membership ativa
⚠️  [LIST USERS] ATENÇÃO: Esta listagem NÃO inclui convites pendentes!
   Use GET /api/company/users para ver convites pendentes também.
10:35:14 PM [express] GET /api/users 200 in 14ms :: [{"id":1,"username":"Lucas","email":"lucaspmastal…
🔐 [AUTH] Verificando permissão de admin...
📋 [AUTH] Usuário na requisição: { id: 1, email: 'lucaspmastaler@gmail.com', role: 'admin' }
✅ [AUTH] Sucesso: Usuário lucaspmastaler@gmail.com é admin
📝 [USER MANAGEMENT] Criando novo usuário
Dados recebidos: {
  name: 'Lucas Mastaler',
  email: 'meluautomacoes@gmail.com',
  username: 'melu',
  role: 'tecnico',
  phone: '',
  cep: '81690-200',
  logradouro: 'BR-116',
  numero: '15480',
  complemento: '',
  bairro: 'Fanny',
  cidade: 'Curitiba',
  estado: 'PR'
}
📋 [USER MANAGEMENT] E-mail já existe no sistema: meluautomacoes@gmail.com (ID: 26)
   - Email verificado: true
   - Ativo: true
🔍 [USER MANAGEMENT] Usuário existe em outra empresa. Verificando convites...
📧 [USER MANAGEMENT] Criando convite para usuário existente...
   - Email: meluautomacoes@gmail.com
   - Empresa: 1
   - Role: OPERADOR
✅ [USER MANAGEMENT] Convite criado com sucesso (ID: 6)
📧 [INVITATION] Enviando convite para: meluautomacoes@gmail.com
🔗 [INVITATION] Link do convite: https://rotafacilfrotas.com/convite/a69e45f0e7ed7a570425eda92eb8a7947686552791d53d9a2c34af138ef9f25c
✅ [INVITATION] Email enviado com sucesso!
📬 [INVITATION] ID: 0c718003-f931-4fd2-bfa1-a20b576c1ca3
✅ [USER MANAGEMENT] E-mail de convite enviado com sucesso
📧 [USER MANAGEMENT] Convite enviado para meluautomacoes@gmail.com → empresa 1. Aguardando aceite.
🔗 [USER MANAGEMENT] Token do convite: a69e45f0...
10:36:53 PM [express] POST /api/users 200 in 249ms :: {"message":"Este e-mail já possui conta na plat…
🔐 [AUTH] Verificando permissão de admin...
📋 [AUTH] Usuário na requisição: { id: 1, email: 'lucaspmastaler@gmail.com', role: 'admin' }
✅ [AUTH] Sucesso: Usuário lucaspmastaler@gmail.com é admin
📋 [LIST USERS] Admin lucaspmastaler@gmail.com listando usuários
   - Company ID: 1
🔍 [LIST USERS] Buscando usuários com memberships ativas na empresa 1...
✅ [LIST USERS] Encontrados 1 usuários com membership ativa
⚠️  [LIST USERS] ATENÇÃO: Esta listagem NÃO inclui convites pendentes!
   Use GET /api/company/users para ver convites pendentes também.
10:36:53 PM [express] GET /api/users 200 in 7ms :: [{"id":1,"username":"Lucas","email":"lucaspmastale…
10:38:06 PM [express] GET /api/invitations/a69e45f0e7ed7a570425eda92eb8a7947686552791d53d9a2c34af138e…
🔍 [LOGIN] Usuário meluautomacoes@gmail.com (ID: 26)
   - Memberships ativas: 1
     • Empresa 2 - Role: ADMINISTRATIVO - Ativo: true
📝 [AUDIT] auth.login (User: 26, Company: 2)
10:38:16 PM [express] POST /api/auth/login 200 in 142ms :: {"user":{"id":26,"email":"meluautomacoes@g…
✅ [AUDIT] Registrado com sucesso
10:38:16 PM [express] GET /api/public/whatsapp-settings 200 in 8ms :: {"whatsappNumber":"554199642870…
10:38:16 PM [express] GET /api/pending-appointments 200 in 28ms :: []
10:38:16 PM [express] POST /api/metrics/event 201 in 52ms :: {"success":true,"eventId":634}
❌ [ACCESS REJECTED] URL: /api/vehicles | Usuário = meluautomacoes@gmail.com | Role = tecnico tentou acessar rota restrita
10:41:20 PM [express] GET /api/vehicles 403 in 12ms :: {"error":"Acesso negado. Seu perfil não tem pe…
❌ [ACCESS REJECTED] URL: /api/vehicles/available-for-me | Usuário = meluautomacoes@gmail.com | Role = tecnico tentou acessar rota restrita
10:41:20 PM [express] GET /api/vehicles/available-for-me 403 in 9ms :: {"error":"Acesso negado. Seu p…
❌ [ACCESS REJECTED] URL: /api/business-rules | Usuário = meluautomacoes@gmail.com | Role = tecnico tentou acessar rota restrita
10:41:20 PM [express] GET /api/business-rules 403 in 28ms :: {"error":"Acesso negado. Seu perfil não …
10:41:20 PM [express] GET /api/provider/route 200 in 45ms
10:44:06 PM [express] GET /api/auth/me 200 in 12ms :: {"id":26,"email":"meluautomacoes@gmail.com","na…
❌ [ACCESS REJECTED] URL: /api/vehicles | Usuário = meluautomacoes@gmail.com | Role = tecnico tentou acessar rota restrita
10:44:06 PM [express] GET /api/vehicles 403 in 11ms :: {"error":"Acesso negado. Seu perfil não tem pe…
10:44:06 PM [express] GET /api/pending-appointments 200 in 27ms :: []
❌ [ACCESS REJECTED] URL: /api/business-rules | Usuário = meluautomacoes@gmail.com | Role = tecnico tentou acessar rota restrita
10:44:06 PM [express] GET /api/business-rules 403 in 51ms :: {"error":"Acesso negado. Seu perfil não …
❌ [ACCESS REJECTED] URL: /api/vehicles/available-for-me | Usuário = meluautomacoes@gmail.com | Role = tecnico tentou acessar rota restrita
10:44:06 PM [express] GET /api/vehicles/available-for-me 403 in 47ms :: {"error":"Acesso negado. Seu …
10:44:06 PM [express] GET /api/provider/route 200 in 45ms
 ELIFECYCLE  Command failed with exit code 1.


/docker-entrypoint.sh: Configuration complete; ready for start up
2026/03/31 22:53:37 [notice] 1#1: using the "epoll" event method
2026/03/31 22:53:37 [notice] 1#1: nginx/1.29.7
2026/03/31 22:53:37 [notice] 1#1: built by gcc 15.2.0 (Alpine 15.2.0) 
2026/03/31 22:53:37 [notice] 1#1: OS: Linux 6.8.0-90-generic
2026/03/31 22:53:37 [notice] 1#1: getrlimit(RLIMIT_NOFILE): 1048576:1048576
2026/03/31 22:53:37 [notice] 1#1: start worker processes
2026/03/31 22:53:37 [notice] 1#1: start worker process 29
2026/03/31 22:53:37 [notice] 1#1: start worker process 30
2026/03/31 22:53:40 [notice] 1#1: signal 3 (SIGQUIT) received, shutting down
2026/03/31 22:53:40 [notice] 29#29: gracefully shutting down
2026/03/31 22:53:40 [notice] 29#29: exiting
2026/03/31 22:53:40 [notice] 29#29: exit
2026/03/31 22:53:40 [notice] 30#30: gracefully shutting down
2026/03/31 22:53:40 [notice] 30#30: exiting
2026/03/31 22:53:40 [notice] 30#30: exit
2026/03/31 22:53:40 [notice] 1#1: signal 17 (SIGCHLD) received from 30
2026/03/31 22:53:40 [notice] 1#1: worker process 30 exited with code 0
2026/03/31 22:53:40 [notice] 1#1: signal 29 (SIGIO) received
2026/03/31 22:53:40 [notice] 1#1: signal 17 (SIGCHLD) received from 29
2026/03/31 22:53:40 [notice] 1#1: worker process 29 exited with code 0
2026/03/31 22:53:40 [notice] 1#1: exit
10.11.0.23 - - [31/Mar/2026:23:05:43 +0000] "GET /.env HTTP/1.1" 200 562 "-" "Mozilla/5.0 (MSIE 9.0; Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.79 Safari/537.36 Edge/14.14931" "45.148.10.120"
10.11.0.23 - - [31/Mar/2026:23:05:43 +0000] "GET /.env.production HTTP/1.1" 200 562 "-" "Mozilla/5.0 (X11; Linux i686) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/53.0.2785.101 Safari/537.36 OPR/40.0.2308.62" "45.148.10.120"
10.11.0.23 - - [31/Mar/2026:23:05:43 +0000] "GET /.aws/credentials HTTP/1.1" 200 562 "-" "Mozilla/5.0 (Linux; Android 6.0.1; SM-N910S) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/75.0.3770.143 Mobile Safari/537.36" "45.148.10.120"
10.11.0.23 - - [31/Mar/2026:23:05:43 +0000] "GET /aws.env HTTP/1.1" 200 562 "-" "Mozilla/5.0 (iPad; CPU OS 6_0 like Mac OS X) AppleWebKit/536.26 (KHTML, like Gecko) Version/6.0 Mobile/10A5355d Safari/8536.25" "45.148.10.120"
10.11.0.23 - - [31/Mar/2026:23:13:39 +0000] "GET /users HTTP/1.1" 200 562 "-" "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36" "191.177.138.236"
10.11.0.23 - - [31/Mar/2026:23:13:39 +0000] "GET /assets/index-21mZWfyp.css HTTP/1.1" 200 36210 "https://rotafacilfrotas.com/users" "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36" "191.177.138.236"
10.11.0.23 - - [31/Mar/2026:23:13:39 +0000] "GET /assets/index-BZ8hZ7df.js HTTP/1.1" 200 837838 "https://rotafacilfrotas.com/users" "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36" "191.177.138.236"
10.11.0.23 - - [31/Mar/2026:23:13:40 +0000] "GET /assets/index-BZ8hZ7df.js HTTP/1.1" 200 837846 "-" "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36" "191.177.138.236"
10.11.0.23 - - [31/Mar/2026:23:13:40 +0000] "GET /brand/rotafacil-pin.png HTTP/1.1" 200 1363369 "https://rotafacilfrotas.com/users" "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36" "191.177.138.236"
10.11.0.23 - - [31/Mar/2026:23:13:40 +0000] "GET /assets/SEM%20FUNDO_1750819798590-CVMFPH-D.png HTTP/1.1" 200 62777 "https://rotafacilfrotas.com/users" "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36" "191.177.138.236"
10.11.0.23 - - [31/Mar/2026:23:13:43 +0000] "GET /users HTTP/1.1" 200 562 "-" "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36" "191.177.138.236"
10.11.0.23 - - [31/Mar/2026:23:13:43 +0000] "GET /assets/index-21mZWfyp.css HTTP/1.1" 200 36210 "https://rotafacilfrotas.com/users" "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36" "191.177.138.236"
10.11.0.23 - - [31/Mar/2026:23:13:43 +0000] "GET /assets/index-BZ8hZ7df.js HTTP/1.1" 200 837838 "https://rotafacilfrotas.com/users" "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36" "191.177.138.236"
10.11.0.23 - - [31/Mar/2026:23:13:43 +0000] "GET /assets/SEM%20FUNDO_1750819798590-CVMFPH-D.png HTTP/1.1" 200 62777 "https://rotafacilfrotas.com/users" "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36" "191.177.138.236"
10.11.0.23 - - [31/Mar/2026:23:13:43 +0000] "GET /brand/rotafacil-pin.png HTTP/1.1" 200 1363369 "https://rotafacilfrotas.com/users" "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36" "191.177.138.236"
10.11.0.23 - - [31/Mar/2026:23:14:30 +0000] "GET /convite/5462bb9da18bd95fc6a37853e0a50c99b9835a1ab6516d79a0eddef7740bde09 HTTP/1.1" 200 562 "-" "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36" "191.177.138.236"
10.11.0.23 - - [31/Mar/2026:23:14:30 +0000] "GET /assets/index-21mZWfyp.css HTTP/1.1" 200 36210 "https://rotafacilfrotas.com/convite/5462bb9da18bd95fc6a37853e0a50c99b9835a1ab6516d79a0eddef7740bde09" "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36" "191.177.138.236"
10.11.0.23 - - [31/Mar/2026:23:14:30 +0000] "GET /assets/index-BZ8hZ7df.js HTTP/1.1" 200 837838 "https://rotafacilfrotas.com/convite/5462bb9da18bd95fc6a37853e0a50c99b9835a1ab6516d79a0eddef7740bde09" "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36" "191.177.138.236"
10.11.0.23 - - [31/Mar/2026:23:14:31 +0000] "GET /brand/rotafacil-pin.png HTTP/1.1" 200 1363369 "https://rotafacilfrotas.com/convite/5462bb9da18bd95fc6a37853e0a50c99b9835a1ab6516d79a0eddef7740bde09" "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36" "191.177.138.236"
10.11.0.23 - - [31/Mar/2026:23:14:35 +0000] "GET /login HTTP/1.1" 200 562 "https://rotafacilfrotas.com/convite/5462bb9da18bd95fc6a37853e0a50c99b9835a1ab6516d79a0eddef7740bde09" "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36" "191.177.138.236"
10.11.0.23 - - [31/Mar/2026:23:14:35 +0000] "GET /assets/SEM%20FUNDO_1750819798590-CVMFPH-D.png HTTP/1.1" 200 62777 "https://rotafacilfrotas.com/login" "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36" "191.177.138.236"
