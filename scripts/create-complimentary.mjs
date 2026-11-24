// Outputs a private code file and a SQL file containing only its hash. Never commit either file.
import {writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {recoveryCode,normalizeCode,hash,now} from '../server/access.mjs';
const owner=process.argv.includes('--owner'),directory=resolve(process.env.ORT_PRIVATE_OUTPUT || '../LOCAL_ONLY/oahu-passes');
await mkdir(directory,{recursive:true,mode:0o700});
const id=crypto.randomUUID(),code=recoveryCode(),stem=`pass-${id}`;
const sql=`INSERT INTO identities(id,recovery_hash,created_at) VALUES('${id}','${await hash(normalizeCode(code))}',${now()});\nINSERT INTO grants(source_id,identity_id,kind,status,created_at) VALUES('comp-${id}','${id}','${owner?'owner':'complimentary'}','active',${now()});\n`;
await writeFile(resolve(directory,stem+'.sql'),sql,{mode:0o600,flag:'wx'});
await writeFile(resolve(directory,stem+'.txt'),`Full Island Pass: complimentary${owner?' owner':''} access\n\n${code}\n\nThis is private. Anyone with this code can restore your access. It becomes usable only after the matching SQL is imported into the intended environment.\n`,{mode:0o600,flag:'wx'});
console.log(`Prepared private pass files in ${directory}. No pass has been activated or sent.`);
