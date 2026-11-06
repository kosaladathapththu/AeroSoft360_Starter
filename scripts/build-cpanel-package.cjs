const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {spawnSync} = require('node:child_process');
const repository = path.resolve(__dirname, '..');
const frontend = path.join(repository, 'frontend');
const php = process.env.AEROSOFT_BUILD_PHP || 'D:/Software/Xammp/php/php.exe';
function run(binary, args, cwd = repository, env = process.env) {
  const result = spawnSync(binary, args, {cwd,env,stdio:'inherit'});
  if(result.error || result.status !== 0) throw new Error('Build step failed: '+path.basename(binary));
}
run(process.execPath, [path.join(frontend,'node_modules/typescript/bin/tsc'),'-b'], frontend);
run(process.execPath, [path.join(frontend,'node_modules/vite/bin/vite.js'),'build'], frontend, {...process.env,VITE_API_URL:'/api/v1'});
const output = path.join(repository,'output/hosting');
fs.mkdirSync(output,{recursive:true});
const stamp = new Date().toISOString().replace(/[:.]/g,'-');
const name = 'AeroSoft360-cPanel-staging-'+stamp;
const root = path.join(output,name);
if(fs.existsSync(root)) throw new Error('Build directory already exists');
fs.mkdirSync(root);
function copy(source,target) {
  const stat=fs.lstatSync(source);
  if(stat.isSymbolicLink()) throw new Error('Symbolic links are not accepted in this package');
  if(stat.isDirectory()) {
    fs.mkdirSync(target,{recursive:true});
    for(const entry of fs.readdirSync(source)) {
      if(['.git','.svn','.DS_Store'].includes(entry))continue;
      copy(path.join(source,entry),path.join(target,entry));
    }
  } else { fs.copyFileSync(source,target); }
}
const app=path.join(root,'aerosoft360');
const web=path.join(root,'erp.supuncompanies.com');
fs.mkdirSync(app);fs.mkdirSync(web);
for(const directory of ['app','config','routes','resources','vendor'])copy(path.join(repository,'backend',directory),path.join(app,directory));
fs.mkdirSync(path.join(app,'bootstrap/cache'),{recursive:true});
fs.writeFileSync(path.join(app,'bootstrap/cache/.gitkeep'),'');
for(const entry of ['app.php','providers.php'])if(fs.existsSync(path.join(repository,'backend/bootstrap',entry)))copy(path.join(repository,'backend/bootstrap',entry),path.join(app,'bootstrap',entry));
copy(path.join(repository,'backend/database/migrations'),path.join(app,'database/migrations'));
for(const filename of ['artisan','composer.json','composer.lock'])copy(path.join(repository,'backend',filename),path.join(app,filename));
for(const directory of ['storage/app/private/database-backups','storage/framework/cache/data','storage/framework/sessions','storage/framework/views','storage/logs']) {
  const folder=path.join(app,directory);fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(path.join(folder,'.gitkeep'),'');
}
copy(path.join(repository,'deployment/cpanel/production.env.example'),path.join(app,'.env.example'));
copy(path.join(repository,'deployment/cpanel/hosting-check.php'),path.join(app,'hosting-check.php'));
copy(path.join(frontend,'dist'),web);
copy(path.join(repository,'deployment/cpanel/public/index.php'),path.join(web,'index.php'));
copy(path.join(repository,'deployment/cpanel/public/.htaccess'),path.join(web,'.htaccess'));
copy(path.join(repository,'deployment/cpanel/START-HERE.md'),path.join(root,'START-HERE.md'));
const manifest={created_at:new Date().toISOString(),target_host:'erp.supuncompanies.com',target_ip:'159.198.36.23',status:'staging; credentials, database, TLS and framework-support prerequisites still required',files:[]};
function inspect(directory) {
  for(const entry of fs.readdirSync(directory)) {
    const filename=path.join(directory,entry),stat=fs.statSync(filename);
    if(stat.isDirectory())inspect(filename);
    else {
      const relative=path.relative(root,filename).split(path.sep).join('/');
      if(entry==='.env'||/\.(sql|sqlite|log)$/i.test(entry))throw new Error('Private runtime data detected: '+relative);
      if(relative.startsWith('erp.supuncompanies.com/')&&entry!=='.htaccess'&&!/\.(html|php|js|css|svg|png|ico|txt|webp|jpg|woff2?)$/i.test(entry))throw new Error('Unexpected public file: '+relative);
      manifest.files.push({path:relative,bytes:stat.size,sha256:crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex')});
    }
  }
}
inspect(root);
fs.writeFileSync(path.join(root,'PACKAGE-MANIFEST.json'),JSON.stringify(manifest,null,2));
const archive=path.join(output,name+'.zip');
run(php,[path.join(repository,'scripts/zip-hosting.php'),root,archive]);
const digest=crypto.createHash('sha256').update(fs.readFileSync(archive)).digest('hex');
fs.writeFileSync(archive+'.sha256',digest+'  '+path.basename(archive)+'\n');
console.log(JSON.stringify({archive,bytes:fs.statSync(archive).size,sha256:digest,files:manifest.files.length},null,2));
