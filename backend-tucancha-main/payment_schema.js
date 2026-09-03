const { Client } = require('pg');
const c = new Client({
  host: 'aws-0-us-east-1.pooler.supabase.com',
  port: 5432,
  user: 'postgres.fartlyhtwqgklcvweetb',
  password: 'Tucancha20206',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
});
c.connect()
  .then(() => c.query(`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'payment'`))
  .then(r => {
    console.table(r.rows);
    return c.end();
  })
  .catch(e => console.error(e));
