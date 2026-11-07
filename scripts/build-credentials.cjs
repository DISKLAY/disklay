// Bundle only local, reviewed code into a standalone Edge Function.
const fs=require('fs'),path=require('path');
const dir=path.join(__dirname,'../supabase/functions/medzo-credentials');
const modules=['core.js','database.js','gotrue.js','session.js','handler.js','index.js'].map(f=>fs.readFileSync(path.join(dir,f),'utf8')).join('\n');
const sync=fs.readFileSync(path.join(__dirname,'../supabase/functions/medzo-study-sync/index.js'),'utf8').split('function createHandler(env,fetchFn=fetch)')[0];
const source=sync+'\n'+modules+`\nDeno.serve(MedzoPasswordEndpoint.create({Core:MedzoCredentialsCore,Database:MedzoCredentialsDatabase,GoTrue:MedzoGoTrue,PasswordSession:MedzoPasswordSession,CredentialHandler:MedzoCredentialsHandler,Sync:{hmac,signObject,verifyObject,validPhoto,validSnapshot}},Deno.env));\n`;
process.stdout.write(source);
