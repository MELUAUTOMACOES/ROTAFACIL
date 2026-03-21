const fs = require('fs');
const path = require('path');

const routesPath = path.join(__dirname, '../server/routes.ts');
let content = fs.readFileSync(routesPath, 'utf8');

// Adicionar import do requireRole se não existir
if (!content.includes('requireRole')) {
  // Acha os imports do middleware e adiciona
  content = content.replace(
    /import \{ authenticateToken \} from "\.\/middleware\/auth\.middleware";/,
    `import { authenticateToken } from "./middleware/auth.middleware";\nimport { requireRole } from "./middleware/role.middleware";`
  );
}

// Lista das rotas base que devem ser protegidas (bloqueadas para prestador/tecnico)
const pRoutes = [
  'clients',
  'appointments',
  'technicians',
  'vehicles',
  'services',
  'business-rules',
  'fuel-records',
  'routes-history',
  'dashboard',
];

let matchCount = 0;

for (const route of pRoutes) {
  // Regex para pegar app.get("/api/clients" e app.get("/api/clients/:id" etc, com ou sem param
  const regex = new RegExp(\`(app\\\\.(?:get|post|put|delete|patch)\\\\(\\\\"\\\\/api\\\\/\${route}(?:\\\\/[^\` + '"' + \`]+)?\\\\",\\\\s*)authenticateToken,\\\\s*(async \\\\(req)\`, 'g');
  
  content = content.replace(regex, (match, p1, p2) => {
    // verifica se já tem requireRole para não duplicar
    if (match.includes('requireRole')) return match;
    matchCount++;
    return \`\${p1}authenticateToken, requireRole(['admin', 'operador']), \${p2}\`;
  });
}

fs.writeFileSync(routesPath, content);
console.log('Rotas protegidas com sucesso! Matches substituídos:', matchCount);
