const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { Pool } = require('pg');

const app = express();
app.use(express.json());
app.use(express.static(__dirname));
app.use(cors({ origin: true, credentials: true }));
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  next();
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

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
  await pool.query(`
    CREATE TABLE IF NOT EXISTS applications (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      age INTEGER NOT NULL,
      time_on_majestic VARCHAR(100) NOT NULL,
      other_families TEXT,
      hours_per_day VARCHAR(50) NOT NULL,
      shooting_stats TEXT,
      discord_id VARCHAR(30),
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`ALTER TABLE applications ADD COLUMN IF NOT EXISTS discord_id VARCHAR(30)`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS logs (
      id SERIAL PRIMARY KEY,
      type VARCHAR(20) NOT NULL,
      message TEXT NOT NULL,
      username VARCHAR(100) NOT NULL,
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

const logs = [];
function addLog(type, message, user = 'System') {
  pool.query(
    'INSERT INTO logs (type, message, username) VALUES ($1, $2, $3)',
    [type, message, user]
  ).catch(console.error);
}

async function requireAuth(req, res, next) {
  const token = req.headers['x-auth-token'] || req.query.token;
  if (!token) return res.status(401).json({ error: 'Не авторизован' });
  try {
    const result = await pool.query(
      'SELECT user_data FROM auth_tokens WHERE token = $1 AND expires_at > NOW()',
      [token]
    );
    if (result.rows.length === 0) return res.status(401).json({ error: 'Токен истёк' });
    req.user = result.rows[0].user_data;
    next();
  } catch {
    return res.status(401).json({ error: 'Ошибка авторизации' });
  }
}

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
    const userData = {
      id: userRes.data.id,
      username: userRes.data.username,
      nick,
      avatar: userRes.data.avatar ? `https://cdn.discordapp.com/avatars/${userRes.data.id}/${userRes.data.avatar}.png` : null,
      roles
    };

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 дней
    await pool.query(
      'INSERT INTO auth_tokens (token, user_data, expires_at) VALUES ($1, $2, $3)',
      [authToken, JSON.stringify(userData), expiresAt]
    );

    addLog('login', 'Вошёл в панель', nick);
    console.log('Auth success for:', nick);
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

app.get('/auth/logout', async (req, res) => {
  const token = req.headers['x-auth-token'] || req.query.token;
  if (token) {
    try {
      const result = await pool.query('SELECT user_data FROM auth_tokens WHERE token = $1', [token]);
      if (result.rows.length > 0) {
        addLog('logout', 'Вышел из панели', result.rows[0].user_data.nick);
      }
      await pool.query('DELETE FROM auth_tokens WHERE token = $1', [token]);
    } catch {}
  }
  res.json({ ok: true });
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

app.get('/api/logs', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM logs ORDER BY created_at DESC LIMIT 100');
    const logs = result.rows.map(r => ({
      type: r.type,
      message: r.message,
      user: r.username,
      time: r.created_at
    }));
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка получения логов' });
  }
});

app.get('/api/applications', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM applications ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка получения заявок' });
  }
});

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
    res.status(500).json({ error: 'Ошибка обновления заявки' });
  }
});

app.delete('/api/applications/:id', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM applications WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка удаления' });
  }
});

app.post('/api/apply', async (req, res) => {
  const { name, age, time_on_majestic, other_families, hours_per_day, shooting_stats, discord_id } = req.body;
  if (!name || !age || !time_on_majestic || !hours_per_day || !discord_id) {
    return res.status(400).json({ error: 'Заполните все обязательные поля' });
  }
  try {
    await pool.query(
      'INSERT INTO applications (name, age, time_on_majestic, other_families, hours_per_day, shooting_stats, discord_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [name, age, time_on_majestic, other_families || null, hours_per_day, shooting_stats || null, discord_id]
    );
    addLog('system', `Новая заявка от "${name}"`, 'System');
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сохранения заявки' });
  }
});

app.post('/api/applications/:id/call', requireAuth, async (req, res) => {
  const { id } = req.params;
  const VOICE_LINK = process.env.VOICE_LINK || 'https://discord.gg/panika';
  try {
    const result = await pool.query('SELECT * FROM applications WHERE id = $1', [id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Заявка не найдена' });
    const app = result.rows[0];
    if (!app.discord_id) return res.status(400).json({ error: 'Discord ID не указан' });
    await axios.post(`https://discord.com/api/users/@me/channels`,
      { recipient_id: app.discord_id },
      { headers: { Authorization: `Bot ${BOT_TOKEN}` } }
    ).then(async (dmRes) => {
      const channelId = dmRes.data.id;
      await axios.post(`https://discord.com/api/channels/${channelId}/messages`, {
        content: `👋 Привет, **${app.name}**!\n\nТвоя заявка в семью **Panika** рассмотрена. Тебя приглашают на **обзвон**!\n\n🎙️ Подключайся к голосовому каналу:\n${VOICE_LINK}\n\n// Majestic RP · Family Panika`
      }, { headers: { Authorization: `Bot ${BOT_TOKEN}` } });
    });
    await pool.query('UPDATE applications SET status = $1 WHERE id = $2', ['interview', id]);
    addLog('system', `Заявка "${app.name}" — вызван на обзвон`, req.user.nick);
    res.json({ ok: true });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: 'Ошибка отправки сообщения' });
  }
});
// Когда люди заходят на бэкенд напрямую, отдаем им обёртку (теперь это index.html)
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/api/stream', async (req, res) => {
  const streamers = ['dezlichh', 'dionispanika', 'antisocccia', 'winstonpnk', 'uglypnk', 'sudarpnk'];
  try {
    const tokenRes = await axios.post('https://id.twitch.tv/oauth2/token', null, {
      params: {
        client_id: process.env.TWITCH_CLIENT_ID,
        client_secret: process.env.TWITCH_CLIENT_SECRET,
        grant_type: 'client_credentials'
      }
    });
    const accessToken = tokenRes.data.access_token;
    const query = streamers.map(s => `user_login=${s}`).join('&');
    const streamsRes = await axios.get(`https://api.twitch.tv/helix/streams?${query}`, {
      headers: {
        'Client-ID': process.env.TWITCH_CLIENT_ID,
        'Authorization': `Bearer ${accessToken}`
      }
    });
    const liveStreams = streamsRes.data.data;
    if (liveStreams.length > 0) {
      res.json({ live: true, streamer: liveStreams[0].user_login, title: liveStreams[0].title, viewers: liveStreams[0].viewer_count });
    } else {
      res.json({ live: false });
    }
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.json({ live: false });
  }
});
// Ссылку /home теперь привязываем к окну авторизации (так как ты переименовал вход в home.html)
app.get('/home', (req, res) => res.sendFile(path.join(__dirname, 'home.html')));

// Остальные страницы панели остаются без изменений
app.get('/panel', (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));
app.get('/panel/members', (req, res) => res.sendFile(path.join(__dirname, 'members.html')));
app.get('/panel/roles', (req, res) => res.sendFile(path.join(__dirname, 'roles.html')));
app.get('/panel/logs', (req, res) => res.sendFile(path.join(__dirname, 'logs.html')));
app.get('/panel/settings', (req, res) => res.sendFile(path.join(__dirname, 'settings.html')));
app.get('/panel/applications', (req, res) => res.sendFile(path.join(__dirname, 'applications.html')));
app.get('/apply', (req, res) => res.sendFile(path.join(__dirname, 'apply.html')));

// Прокси для рейтинга игроков
app.get('/api/player-ratings', async (req, res) => {
  const { serverId } = req.query;
  if (!serverId) return res.status(400).json({ error: 'serverId required' });
  try {
    const response = await axios.get(
      `https://mitsuki-hub.ru/api/ext-captures/player-ratings?serverId=${serverId}`,
      { headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://mitsuki-hub.ru/captures?tab=ratings',
        'Origin': 'https://mitsuki-hub.ru',
        'Accept': 'application/json',
      }}
    );
    res.json(response.data);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Страницы статистики
app.get('/stats', (req, res) => res.sendFile(path.join(__dirname, 'stats.html')));
app.get('/stats/players', (req, res) => res.sendFile(path.join(__dirname, 'stats-players.html')));
app.get('/stats/servers', (req, res) => res.sendFile(path.join(__dirname, 'stats-servers.html')));

app.use((req, res) => res.status(404).send('404: ' + req.url));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
  console.log('Файлы:', fs.readdirSync(__dirname).join(', '));
});
