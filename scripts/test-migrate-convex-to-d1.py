import io, json, runpy, sqlite3, tempfile, unittest, zipfile
from pathlib import Path
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
class PreparedImportTest(unittest.TestCase):
 def setUp(self):
  self.db=sqlite3.connect(':memory:'); self.db.row_factory=sqlite3.Row
  for p in sorted((ROOT/'migrations').glob('*.sql')): self.db.executescript(p.read_text())
  self.base={'clientId':'c1','createdAt':'2026-09-01T00:00:00.000Z','updatedAt':'2026-09-01T00:00:00.000Z','deletedAt':None,'cryptoVersion':1,'isPinnedAside':False,'isPinnedHome':False}
  self.data={'users':[{'_id':'u1','_creationTime':1790000000000,'email':'test@example.com'}],'authAccounts':[{'_id':'a1','userId':'u1','provider':'github','providerAccountId':'42'}],'userKeys':[{'userId':'u1','wrappedDek':'wrapped-test'}],'folders':[],'snippets':[{**self.base,'_id':'s1','ownerId':'u1','title':'ciphertext-test','code':'large-ciphertext-'*10000,'language':'plaintext','folderId':None}],'authSessions':[]}
  self.writes=0; self.largest_sql=0
 def api(self,request,timeout):
  body=json.loads(request.data); queries=body.get('batch',[body]); results=[]
  with self.db:
   for q in queries:
    self.largest_sql=max(self.largest_sql,len(q['sql']))
    if not q['sql'].startswith('SELECT'): self.writes+=1
    c=self.db.execute(q['sql'],q.get('params',[]))
    results.append({'success':True,'results':[dict(r) for r in c.fetchall()] if c.description else []})
  return io.BytesIO(json.dumps({'success':True,'result':results}).encode())
 def run_import(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'source.zip'
   with zipfile.ZipFile(p,'w') as z:
    for name,rows in self.data.items(): z.writestr(name+'/documents.jsonl','\n'.join(json.dumps(r) for r in rows))
   args=['importer',str(p),'--apply-remote','--source-frozen','--account-id','test-account','--database-id','test-db']
   with patch('sys.argv',args),patch.dict('os.environ',{'CLOUDFLARE_API_TOKEN':'test'}),patch('urllib.request.urlopen',self.api):
    runpy.run_path(str(ROOT/'scripts/migrate-convex-to-d1.py'),run_name='__main__')
 def test_large_ciphertext_bound_and_unchanged_edits_not_duplicated(self):
  self.run_import()
  self.assertEqual(json.loads(self.db.execute('SELECT data FROM snippets').fetchone()[0])['code'],self.data['snippets'][0]['code'])
  revision=self.db.execute('SELECT revision FROM analytics_state').fetchone()[0]
  self.run_import()
  self.assertEqual(self.db.execute('SELECT revision FROM analytics_state').fetchone()[0],revision)
  self.assertLess(self.largest_sql,1000)
 def test_final_copy_reconciles_edits_and_deletions(self):
  self.run_import()
  self.data['snippets'][0]['updatedAt']='2026-09-02T00:00:00.000Z';self.data['snippets'][0]['code']='edited-ciphertext'
  self.run_import()
  self.assertEqual(json.loads(self.db.execute('SELECT data FROM snippets').fetchone()[0])['code'],'edited-ciphertext')
  self.data['snippets']=[]; self.run_import()
  self.assertEqual(self.db.execute('SELECT count(*) FROM snippets').fetchone()[0],0)
  self.assertEqual(self.db.execute('SELECT count(*) FROM analytics_snippets').fetchone()[0],0)
 def test_live_login_guard_runs_before_any_mutation(self):
  self.db.execute("INSERT INTO sessions(id,sessionToken,userId,expires) VALUES('session','hash','u1','2026-10-01T00:00:00.000Z')")
  with self.assertRaisesRegex(RuntimeError,'login sessions'): self.run_import()
  self.assertEqual(self.writes,0)
 def test_missing_required_table_stops_before_any_mutation(self):
  for name in list(self.data):
   with self.subTest(table=name):
    rows=self.data.pop(name)
    try:
     with self.assertRaisesRegex(ValueError,'Missing '+name+'/documents.jsonl'):
      self.run_import()
     self.assertEqual(self.writes,0)
    finally:
     self.data[name]=rows
if __name__=='__main__': unittest.main()
