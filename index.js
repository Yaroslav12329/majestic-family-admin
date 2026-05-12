const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { Pool } = require('pg');

const app = express();
app.use(express.json());
app.use(cors({ origin: true, credentials: true }));

app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  next();
});

// База данных
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Создаём таблицу заявок если не существует
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS applications (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      age INTEGER NOT NULL,
      time_on_majestic VARCHAR(100) NOT NULL,
      other_families TEXT,
      hours_per_day VARCHAR(50) NOT NULL,
      shooting_stats TEXT,
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('База данных готова');
}

initDB().catch(console.error);

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const GUILD_ID = process.env.GUILD_ID;
const REDIRECT_URI = process.env.REDIRECT_URI;
const BOT_TOKEN = process.env.BOT_TOKEN;

const tokens = {};
const logs = [];

function addLog(type, message, user = 'System') {
  logs.unshift({ type, message, user, time: new Date().toISOString() });
  if (logs.length > 100) logs.pop();
}

function requireAuth(req, res, next) {
  const token = req.headers['x-auth-token'] || req.query.token;
  if (!token || !tokens[token]) return res.status(401).json({ error: 'Не авторизован' });
  req.user = tokens[token];
  next();
}

// OAuth
app.get('/auth/login', (req, res) => {
  const url = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify%20guilds.members.read`;
  res.redirect(url);
});

app.get('/auth/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.redirect('/?error=no_code');
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

    const authToken = crypto.randomBytes(32).toString('hex');
    tokens[authToken] = {
      id: userRes.data.id,
      username: userRes.data.username,
      nick,
      avatar: userRes.data.avatar ? `https://cdn.discordapp.com/avatars/${userRes.data.id}/${userRes.data.avatar}.png` : null,
      roles
    };

    setTimeout(() => delete tokens[authToken], 24 * 60 * 60 * 1000);
    addLog('login', 'Вошёл в панель', nick);
    res.redirect('/panel?token=' + authToken);
  } catch (err) {
    console.error('Auth error:', err.response?.data || err.message);
    res.redirect('/?error=auth_failed');
  }
});

app.get('/auth/me', requireAuth, async (req, res) => {
  try {
    const guildRes = await axios.get(`https://discord.com/api/guilds/${GUILD_ID}/roles`, {
      headers: { Authorization: `Bot ${BOT_TOKEN}` }
    });
    const allRoles = guildRes.data;
    const userRoleIds = req.user.roles;
    const userRoles = allRoles.filter(r => userRoleIds.includes(r.id));
    const topRole = userRoles.sort((a, b) => b.position - a.position)[0];
    res.json({ ...req.user, topRole: topRole ? { name: topRole.name, color: topRole.color } : null });
  } catch {
    res.json(req.user);
  }
});

app.get('/auth/logout', (req, res) => {
  const token = req.headers['x-auth-token'] || req.query.token;
  if (token && tokens[token]) {
    addLog('logout', 'Вышел из панели', tokens[token].nick);
    delete tokens[token];
  }
  res.json({ ok: true });
});

// API участники и роли
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

// ЗАЯВКИ
// Получить все заявки (для админов)
app.get('/api/applications', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM applications ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения заявок' });
  }
});

// Обновить статус заявки
app.patch('/api/applications/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const validStatuses = ['pending', 'accepted', 'accepted_rp', 'rejected', 'interview'];
  if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Неверный статус' });
  try {
    await pool.query('UPDATE applications SET status = $1 WHERE id = $2', [status, id]);
    const appResult = await pool.query('SELECT name FROM applications WHERE id = $1', [id]);
    const appName = appResult.rows[0]?.name || 'Неизвестно';
    const statusLabels = { accepted: 'Принят', accepted_rp: 'Принят на РП', rejected: 'Отклонён', interview: 'Вызван на обзвон' };
    addLog('system', `Заявка "${appName}" — ${statusLabels[status]}`, req.user.nick);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка обновления заявки' });
  }
});

// Удалить заявку
app.delete('/api/applications/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM applications WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка удаления' });
  }
});

// Отправить заявку (публичный роут)
app.post('/api/apply', async (req, res) => {
  const { name, age, time_on_majestic, other_families, hours_per_day, shooting_stats } = req.body;
  if (!name || !age || !time_on_majestic || !hours_per_day) {
    return res.status(400).json({ error: 'Заполните все обязательные поля' });
  }
  try {
    await pool.query(
      'INSERT INTO applications (name, age, time_on_majestic, other_families, hours_per_day, shooting_stats) VALUES ($1, $2, $3, $4, $5, $6)',
      [name, age, time_on_majestic, other_families || null, hours_per_day, shooting_stats || null]
    );
    addLog('system', `Новая заявка от "${name}"`, 'System');
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сохранения заявки' });
  }
});

// Страницы
app.get('/panel', (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));
app.get('/panel/members', (req, res) => res.sendFile(path.join(__dirname, 'members.html')));
app.get('/panel/roles', (req, res) => res.sendFile(path.join(__dirname, 'roles.html')));
app.get('/panel/logs', (req, res) => res.sendFile(path.join(__dirname, 'logs.html')));
app.get('/panel/settings', (req, res) => res.sendFile(path.join(__dirname, 'settings.html')));
app.get('/panel/applications', (req, res) => res.sendFile(path.join(__dirname, 'applications.html')));
app.get('/apply', (req, res) => res.sendFile(path.join(__dirname, 'apply.html')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.use((req, res) => res.status(404).send('404: ' + req.url));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
  console.log('Файлы:', fs.readdirSync(__dirname).join(', '));
});
