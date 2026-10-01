#!/usr/bin/env python3
"""Generate an idempotent D1 import from a protected Convex export. Never decrypts.

Run only before the D1 cutover, with Convex workspace writes frozen. SQL files
contain private data: keep them outside the repository, with mode 0600.
"""
import argparse
import hashlib
import json
import os
import subprocess
import urllib.request
import urllib.error
import tomllib
import zipfile
from pathlib import Path
from datetime import datetime, timezone

parser = argparse.ArgumentParser()
parser.add_argument('export', type=Path)
parser.add_argument('--sql', type=Path)
parser.add_argument('--analytics', type=Path)
parser.add_argument('--verify', action='store_true')
parser.add_argument('--local', action='store_true')
parser.add_argument('--apply-remote', action='store_true', help='Prepared REST batches; only before cutover')
parser.add_argument('--source-frozen', action='store_true', help='Confirm the source write guard is enabled')
parser.add_argument('--account-id')
parser.add_argument('--database-id')
parser.add_argument('--oauth-config', type=Path, help='Wrangler OAuth config; otherwise use CLOUDFLARE_API_TOKEN')
args = parser.parse_args()
archive = zipfile.ZipFile(args.export)
def table(name):
    try: return [json.loads(line) for line in archive.read(name+'/documents.jsonl').splitlines() if line]
    except KeyError:
        raise ValueError(f'Missing {name}/documents.jsonl in export; refusing to reconcile data') from None
def quote(value):
    if value is None: return 'NULL'
    if isinstance(value, (int,float)): return str(round(value))
    return "'"+str(value).replace("'","''")+"'"
def iso(ms): return datetime.fromtimestamp(ms/1000, timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')
def hashid(s): return hashlib.sha256(s.encode()).hexdigest()[:8]
users=table('users'); keys=table('userKeys'); folders=table('folders'); snippets=table('snippets')
clock=round(datetime.now(timezone.utc).timestamp()*1000)
statements=[]
prepared=[]
def insert(name, fields, values, suffix=''):
    statements.append(f"INSERT INTO {name}({','.join(fields)}) VALUES({','.join(quote(x) for x in values)}) {suffix};")
    prepared.append((name, {'sql':f"INSERT INTO {name}({','.join(fields)}) VALUES({','.join('?' for _ in values)}) {suffix}", 'params':values}))
for u in users:
    insert('users',['id','name','email','image','emailVerified','created_at','country'],[u['_id'],u.get('name'),u.get('email'),u.get('image'),iso(u['emailVerificationTime']) if u.get('emailVerificationTime') else None,round(u['_creationTime']),u.get('country')], 'ON CONFLICT(id) DO UPDATE SET name=excluded.name,email=excluded.email,image=excluded.image,emailVerified=excluded.emailVerified')
for a in table('authAccounts'):
    if a['provider']!='github': raise ValueError('Unsupported legacy provider')
    insert('accounts',['id','userId','type','provider','providerAccountId'],[a['_id'],a['userId'],'oauth',a['provider'],a['providerAccountId']], 'ON CONFLICT(provider,providerAccountId) DO NOTHING')
for k in keys:
    insert('user_keys',['user_id','wrapped_dek'],[k['userId'],k['wrappedDek']], 'ON CONFLICT(user_id) DO NOTHING')
common=['clientId','createdAt','updatedAt','deletedAt','cryptoVersion','isPinnedAside','isPinnedHome']
def wire(row,kind):
    return {k:row[k] for k in common+(['name','parentId'] if kind=='folders' else ['title','code','language','folderId'])}
for name,records in [('folders',folders),('snippets',snippets)]:
    for r in records:
        insert(name,['owner_id','client_id','analytics_id','data','updated_at','server_updated_at'],[r['ownerId'],r['clientId'],r['_id'],json.dumps(wire(r,name),separators=(',',':'),ensure_ascii=True),r['updatedAt'],clock], 'ON CONFLICT(owner_id,client_id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at,server_updated_at=excluded.server_updated_at WHERE excluded.updated_at>='+name+'.updated_at AND excluded.data<>'+name+'.data')
    # A second pre-cutover import reconciles deletions made since the first copy.
    present=json.dumps([r['_id'] for r in records])
    statements.append(f'DELETE FROM {name} WHERE analytics_id NOT IN (SELECT value FROM json_each({quote(present)}));')
    prepared.append((name, {'sql':f'DELETE FROM {name} WHERE analytics_id NOT IN (SELECT value FROM json_each(?))', 'params':[present]}))
for s in table('authSessions'):
    insert('analytics_signins',['id','account','at'],[s['_id'],s['userId'],round(s['_creationTime'])], 'ON CONFLICT DO NOTHING')
if args.analytics:
    previous=json.loads(args.analytics.read_text())
    owners={hashid(u['_id']):u['_id'] for u in users}
    snippet_ids={hashid(s['_id']):s['_id'] for s in snippets}
    for e in previous.get('edits',[]):
        if e['account'] in owners:
            insert('analytics_edits',['snippet','account','language','at'],[snippet_ids.get(e['snippet'],'anon:'+e['snippet']),owners[e['account']],e['language'],e['at']], 'ON CONFLICT(snippet,at) DO NOTHING')
    for s in previous.get('sessions',[]):
        if s['account'] in owners:
            insert('analytics_signins',['id','account','at'],['legacy:'+s['account']+':'+str(s['at']),owners[s['account']],s['at']], 'ON CONFLICT DO NOTHING')
# Only the final copy's epoch is trusted; old device cursors force a full pull.
statements.append(f"UPDATE app_meta SET value={clock} WHERE key='backend_epoch';")
prepared.append(('app_meta', {'sql':"UPDATE app_meta SET value=? WHERE key='backend_epoch'", 'params':[clock]}))
if args.sql:
    fd=os.open(args.sql,os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)
    with os.fdopen(fd,'w') as f: f.write('\n'.join(statements)+'\n')
    print(json.dumps({'users':len(users),'keys':len(keys),'folders':len(folders),'snippets':len(snippets),'statements':len(statements),'sql_bytes':args.sql.stat().st_size}))
if args.apply_remote:
    if args.local or not args.source_frozen or not args.account_id or not args.database_id:
        parser.error('--apply-remote requires --source-frozen, --account-id and --database-id, without --local')
    token=os.environ.get('CLOUDFLARE_API_TOKEN')
    if not token and args.oauth_config:
        token=tomllib.loads(args.oauth_config.read_text()).get('oauth_token')
    if not token:
        parser.error('Provide CLOUDFLARE_API_TOKEN or --oauth-config; never pass tokens on the command line')
    endpoint=f'https://api.cloudflare.com/client/v4/accounts/{args.account_id}/d1/database/{args.database_id}/query'
    def remote(body):
        request=urllib.request.Request(endpoint, data=json.dumps(body).encode(), headers={'Authorization':'Bearer '+token,'Content-Type':'application/json'})
        try:
            with urllib.request.urlopen(request,timeout=60) as response:
                result=json.load(response)
        except urllib.error.HTTPError as error:
            # API errors may echo private SQL parameters; report only the code.
            raise RuntimeError(f'Cloudflare HTTP {error.code}; import stopped, do not activate traffic') from None
        if not result.get('success') or any(not r.get('success') for r in result.get('result',[])):
            raise RuntimeError('D1 import failed; do not activate traffic')
        return result['result']
    if remote({'sql':'SELECT count(*) AS count FROM sessions'})[0]['results'][0]['count']:
        raise RuntimeError('D1 already has login sessions. Refusing to import over a live workspace.')
    stored={}
    for kind in ['folders','snippets']:
        stored[kind]={(r['owner_id'],r['client_id']):r for r in remote({'sql':f'SELECT owner_id,client_id,analytics_id,data FROM {kind}'})[0]['results']}
    pending=[]
    skipped=0
    for kind, statement in prepared:
        if kind in stored and statement['sql'].startswith('INSERT'):
            owner,client,analytics_id,data,*_=statement['params']
            old=stored[kind].get((owner,client))
            if old and old['analytics_id']==analytics_id and json.loads(old['data'])==json.loads(data):
                skipped+=1
                continue
        pending.append(statement)
    # Large SQL imports can fail with D1_RESET_DO. Bind values instead, skipping
    # unchanged ciphertext and bounding each request. The source stays frozen;
    # verification must pass before any version accepts D1 traffic.
    batch=[]
    total=0
    size=0
    for statement in pending:
        length=len(json.dumps(statement).encode())
        if batch and (len(batch)>=100 or size+length>2000000):
            remote({'batch':batch})
            total+=len(batch)
            batch=[]
            size=0
        batch.append(statement)
        size+=length
    if batch:
        remote({'batch':batch})
        total+=len(batch)
    print(json.dumps({'applied_statements':total,'unchanged_workspace_records_skipped':skipped}))
if args.verify:
    def query(sql):
        proc=subprocess.run(['pnpm','exec','wrangler','d1','execute','DB','--local' if args.local else '--remote','--json','--command',sql],capture_output=True,text=True,check=True)
        return json.loads(proc.stdout)[0]['results']
    stored_users=query('SELECT id FROM users'); assert {u['id'] for u in stored_users}=={u['_id'] for u in users},'User mismatch'
    stored_keys=query('SELECT user_id,wrapped_dek FROM user_keys');assert {k['user_id']:k['wrapped_dek'] for k in stored_keys}=={k['userId']:k['wrappedDek'] for k in keys},'Key mismatch'
    for kind, records in [('folders',folders),('snippets',snippets)]:
        stored=query(f'SELECT owner_id,client_id,analytics_id,data FROM {kind}')
        expected={(r['ownerId'],r['clientId']):(r['_id'],wire(r,kind)) for r in records}
        actual={(r['owner_id'],r['client_id']):(r['analytics_id'],json.loads(r['data'])) for r in stored}
        assert actual==expected,kind+' mismatch'
    accounts=query('SELECT userId,provider,providerAccountId FROM accounts')
    assert {(a['userId'],a['provider'],a['providerAccountId']) for a in accounts}=={(a['userId'],a['provider'],a['providerAccountId']) for a in table('authAccounts')},'GitHub account mismatch'
    print('Verified all account ids, GitHub identities, ciphertext fields and wrapped keys byte for byte.')
