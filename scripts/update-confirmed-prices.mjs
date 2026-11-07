import { createClient } from '@libsql/client';
if(process.env.DATABASE_ENVIRONMENT!=='development'||!process.env.TURSO_DATABASE_URL)throw Error('Expected isolated development database');
const client=createClient({url:process.env.TURSO_DATABASE_URL,authToken:process.env.TURSO_AUTH_TOKEN});
const tx=await client.transaction('write');
try {
 for(const id of ['atitlan','gato','mar']) {
  const result=await tx.execute({sql:'SELECT data, status FROM artworks WHERE id=?',args:[id]});
  const row=result.rows[0];
  if(!row||row.status!=='available'){console.log(id+': unchanged (missing or unavailable)');continue;}
  const data=JSON.parse(String(row.data));data.price=10000;
  await tx.execute({sql:"UPDATE artworks SET data=? WHERE id=? AND status='available'",args:[JSON.stringify(data),id]});
  console.log(id+': USD 100, shipping included; availability preserved');
 }
 await tx.commit();
} catch(error){await tx.rollback();throw error;} finally {tx.close();client.close();}
