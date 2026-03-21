import fs from 'fs';

const routesPath = './server/routes.ts';
let content = fs.readFileSync(routesPath, 'utf8');

if (!content.includes('requireRole')) {
  content = content.replace(
    /import \{ authenticateToken \} from "\.\/middleware\/auth\.middleware";/,
    `import { authenticateToken } from "./middleware/auth.middleware";\nimport { requireRole } from "./middleware/role.middleware";`
  );
}

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
  const regex = new RegExp(`(app\\.(?:get|post|put|delete|patch)\\("\\/api\\/${route}(?:\\/[^"]+)?",\\s*)authenticateToken,\\s*(async \\(req)`, 'g');
  
  content = content.replace(regex, (match, p1, p2) => {
    if (match.includes('requireRole')) return match;
    matchCount++;
    return `${p1}authenticateToken, requireRole(['admin', 'operador']), ${p2}`;
  });
}

fs.writeFileSync(routesPath, content);
console.log('Rotas protegidas com sucesso! Matches substituídos:', matchCount);
