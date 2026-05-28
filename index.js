const express = require('express');

const app = express();

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('BOT ONLINE');
});

app.listen(PORT, () => {
  console.log('Web Server Start');
});

// Discord起動
require('./bot');
