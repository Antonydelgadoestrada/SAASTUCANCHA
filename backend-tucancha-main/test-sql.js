const { Client } = require('pg');
const c = new Client('postgresql://postgres.fartlyhtwqgklcvweetb:Tucancha20206@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=no-verify');
process.env.NODE_TLS_REJECT_UNAUTHORIZED=0;
c.connect().then(() => 
  c.query(`SELECT id, "clubId", "courtId", "userId", date, "createdAt" FROM booking ORDER BY "createdAt" DESC LIMIT 5`)
).then(r => console.log(r.rows))
 .catch(e => console.error(e))
 .finally(() => c.end());
