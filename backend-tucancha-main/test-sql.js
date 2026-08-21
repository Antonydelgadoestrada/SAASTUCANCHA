const { Client } = require('pg');
const c = new Client('postgresql://postgres.fartlyhtwqgklcvweetb:Tucancha20206@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=no-verify');
process.env.NODE_TLS_REJECT_UNAUTHORIZED=0;
c.connect().then(() => 
  c.query(`UPDATE court SET "clubId" = '2ad51369-23d8-429e-823b-63b48b3c1464'`)
).then(r => console.log('Updated courts:', r.rowCount))
 .catch(e => console.error(e))
 .finally(() => c.end());
