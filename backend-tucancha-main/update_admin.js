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
  .then(() => c.query('UPDATE "user" SET email = $1 WHERE email = $2', ['tucancha100@gmail.com', 'brussitocomunica2017@gmail.com']))
  .then(r => {
    console.log(`Updated ${r.rowCount} rows to new admin email: tucancha100@gmail.com`);
    return c.end();
  })
  .catch(e => console.error(e));
