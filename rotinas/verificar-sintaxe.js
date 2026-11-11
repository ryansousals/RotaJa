import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
for (const pasta of ['servidor','rotinas','testes','prisma']) {
 for (const arquivo of readdirSync(pasta).filter(nome=>nome.endsWith('.js'))) {
  const resultado=spawnSync(process.execPath,['--check',pasta+'/'+arquivo],{stdio:'inherit'});
  if (resultado.status!==0) process.exit(resultado.status??1);
 }
}
for (const pasta of ['servidor','rotinas','testes','prisma','interface/fonte','interface/testes','exemplos']) {
 const restos=readdirSync(pasta,{recursive:true}).filter(nome=>/\.tsx?$/.test(nome));
 if(restos.length) throw new Error('Arquivos TypeScript remanescentes: '+restos.join(', '));
}
console.log('Sintaxe JavaScript verificada; fontes sem TypeScript.');
