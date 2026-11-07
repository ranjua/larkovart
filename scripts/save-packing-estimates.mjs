import { createClient } from '@libsql/client';
if(process.env.DATABASE_ENVIRONMENT!=='development'||!process.env.TURSO_DATABASE_URL)throw Error('Expected development database');
const client=createClient({url:process.env.TURSO_DATABASE_URL,authToken:process.env.TURSO_AUTH_TOKEN});
const tx=await client.transaction('write');
try{
 for(const id of ['atitlan','gato','mar']){
  const result=await tx.execute({sql:'SELECT data FROM artworks WHERE id=?',args:[id]});
  if(!result.rows[0])continue;
  const data=JSON.parse(String(result.rows[0].data));
  data.packingEstimate={length:62,width:62,height:14,weight:4,basis:'unframed_canvas_planning'};
  await tx.execute({sql:'UPDATE artworks SET data=? WHERE id=?',args:[JSON.stringify(data),id]});
  console.log(id+': planning estimate saved; confirmed parcel and availability unchanged');
 }
 await tx.commit();
}catch(error){await tx.rollback();throw error;}finally{tx.close();client.close();}
