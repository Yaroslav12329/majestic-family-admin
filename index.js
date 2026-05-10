const express = require('express');
const session = require('express-session');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

app.use(cors({
  origin: true,
  credentials: true
}));

app.use(session({
  secret: 'majestic-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true,
    httpOnly: true,
    sameSite: 'none',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const GUILD_ID = process.env.GUILD_ID;
const REDIRECT_URI = process.env.REDIRECT_URI;
const BOT_TOKEN = process.env.BOT_TOKEN;

const logs = [];
function addLog(type, message, user = 'System') {
  logs.unshift({ type, message, user, time: new Date().toISOString() });
  if (logs.length > 100) logs.pop();
}

function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Не авторизован' });
  next();
}

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

    const nick = memberRes.data.nick || userRes.data.username;
    const roles = memberRes.data.roles || [];

req.session.user = {
      id: userRes.data.id,
      username: userRes.data.username,
      nick,
      avatar: userRes.data.avatar ? `https://cdn.discordapp.com/avatars/${userRes.data.id}/${userRes.data.avatar}.png` : null,
      roles
    };

    addLog('login', 'Вошёл в панель', nick);
    res.redirect('/dashboard');
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.redirect('/?error=auth_failed');
  }
});
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.redirect('/?error=auth_failed');
  }
});

app.get('/auth/me', requireAuth, async (req, res) => {
  try {
    const guildRes = await axios.get(`https://discord.com/api/guilds/${GUILD_ID}/roles`, {
      headers: { Authorization: `Bot ${BOT_TOKEN}` }
    });
    const allRoles = guildRes.data;
    const userRoleIds = req.session.user.roles;
    const userRoles = allRoles.filter(r => userRoleIds.includes(r.id));
    const topRole = userRoles.sort((a, b) => b.position - a.position)[0];
    res.json({ ...req.session.user, topRole: topRole ? { name: topRole.name, color: topRole.color } : null });
  } catch {
    res.json(req.session.user);
  }
});

app.get('/api/members', requireAuth, async (req, res) => {
  try {
    const [membersRes, rolesRes] = await Promise.all([
      axios.get(`https://discord.com/api/guilds/${GUILD_ID}/members?limit=100`, { headers: { Authorization: `Bot ${BOT_TOKEN}` } }),
      axios.get(`https://discord.com/api/guilds/${GUILD_ID}/roles`, { headers: { Authorization: `Bot ${BOT_TOKEN}` } })
    ]);
    const allRoles = rolesRes.data;
    const members = membersRes.data.map(m => {
      const userRoles = allRoles.filter(r => m.roles.includes(r.id));
      const topRole = userRoles.sort((a, b) => b.position - a.position)[0];
      return {
        id: m.user.id,
        username: m.user.username,
        nick: m.nick || m.user.username,
        avatar: m.user.avatar ? `https://cdn.discordapp.com/avatars/${m.user.id}/${m.user.avatar}.png` : null,
        roles: userRoles.map(r => ({ id: r.id, name: r.name, color: r.color })),
        topRole: topRole ? { id: topRole.id, name: topRole.name, color: topRole.color } : null,
        joinedAt: m.joined_at
      };
    });
    res.json(members);
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: 'Ошибка получения участников' });
  }
});

app.get('/api/roles', requireAuth, async (req, res) => {
  try {
    const rolesRes = await axios.get(`https://discord.com/api/guilds/${GUILD_ID}/roles`, {
      headers: { Authorization: `Bot ${BOT_TOKEN}` }
    });
    res.json(rolesRes.data.sort((a, b) => b.position - a.position));
  } catch (err) {
    res.status(500).json({ error: 'Ошибка получения ролей' });
  }
});

app.get('/api/logs', requireAuth, (req, res) => {
  res.json(logs);
});

app.get('/auth/logout', (req, res) => {
  if (req.session.user) {
    addLog('logout', 'Вышел из панели', req.session.user.nick);
  }
  req.session.destroy();
  res.json({ ok: true });
});

app.get('/test', (req, res) => {
  res.send('Сервер работает! __dirname: ' + __dirname);
});

app.get('/dashboard', (req, res) => {
  if (!req.session.user) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/members', (req, res) => {
  if (!req.session.user) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'members.html'));
});

app.get('/roles', (req, res) => {
  if (!req.session.user) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'roles.html'));
});

app.get('/logs', (req, res) => {
  if (!req.session.user) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'logs.html'));
});

app.get('/settings', (req, res) => {
  if (!req.session.user) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'settings.html'));
});

app.get('/', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.use((req, res) => {
  res.status(404).send('404 - не найдено: ' + req.url);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
  console.log('Файлы:', fs.readdirSync(__dirname).join(', '));
});
