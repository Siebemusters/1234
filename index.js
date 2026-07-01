require('dotenv').config();
const { ApifyClient } = require('apify-client');

const client = new ApifyClient({ token: process.env.APIFY_API_KEY });

(async () => {
  const me = await client.user('me').get();
  console.log('Connected as:', me.username);
})();
