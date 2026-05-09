const express = require('express');
const session = require('express-session');
const axios = require('axios');
const cors = require('cors');

const app = express();

app.use(cors({ origin: '*', credentials: true }));
app.use(session({ secret: 'majestic-secret-key', resave: false, saveUninitialized: false }));

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const GUILD_ID = process.env.GUILD_ID;
const REDIRECT_URI = process.env.REDIRECT_URI;

app.get('/auth/login', (req, res) => {
  const url = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify%20guilds.members.read`;
  res.redirect(url);
});

app.get('/auth/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).json({ error: 'Нет кода' });
  try {
    const tokenRes = await axios.post('https://discord.com/api/oauth2/token',
      new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    const accessToken = tokenRes.data.access_token;
    const userRes = await axios.get('https://discord.com/api/users/@me', { headers: { Authorization: `Bearer ${accessToken}` } });
    const memberRes = await axios.get(`https://discord.com/api/users/@me/guilds/${GUILD_ID}/member`, { headers: { Authorization: `Bearer ${accessToken}` } });
    req.session.user = {
      id: userRes.data.id,
      username: userRes.data.username,
      nick: memberRes.data.nick || userRes.data.username,
      avatar: userRes.data.avatar ? `https://cdn.discordapp.com/avatars/${userRes.data.id}/${userRes.data.avatar}.png` : null,
      roles: memberRes.data.roles
    };
    res.redirect(process.env.FRONTEND_URL || '/');
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: 'Ошибка авторизации' });
  }
});

app.get('/auth/me', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Не авторизован' });
  res.json(req.session.user);
});

app.get('/auth/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`));
