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
  .then(() => c.query('DELETE FROM payment; DELETE FROM booking;'))
  .then(r => {
    console.log('Deleted rows from payment and booking to allow schema sync');
    return c.end();
  })
  .catch(e => console.error(e));
