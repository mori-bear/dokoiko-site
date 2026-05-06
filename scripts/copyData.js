import { copyFileSync, mkdirSync } from 'fs';
mkdirSync('./public/data', { recursive: true });
copyFileSync('./src/data/destinations.json', './public/data/destinations.json');
console.log('✅ destinations.json → public/data/destinations.json');
