const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');

const users = require('./userStore');
const { signToken, requireAuth } = require('./auth');

const PORT = process.env.PORT || 5000;
const PASSWORD_MIN_LENGTH = 8;

const app = express();
app.use(cors());
app.use(express.json());

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

router.post('/register', async (req, res) => {
  const { email, password, name } = req.body || {};

  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'email and password are required' });
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return res.status(400).json({ error: `password must be at least ${PASSWORD_MIN_LENGTH} characters` });
  }
  if (users.findByEmail(email)) {
    return res.status(409).json({ error: 'a user with this email already exists' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = users.create({ email, passwordHash, name });
  const token = signToken(user);

  res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name } });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const user = users.findByEmail(email);
  const passwordMatches = user && (await bcrypt.compare(password, user.passwordHash));
  if (!passwordMatches) {
    return res.status(401).json({ error: 'invalid email or password' });
  }

  const token = signToken(user);
  res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
});

router.get('/me', requireAuth, (req, res) => {
  const user = users.findByEmail(req.user.email);
  if (!user) {
    return res.status(404).json({ error: 'user not found' });
  }
  res.json({ id: user.id, email: user.email, name: user.name });
});

// Mounted at /api/auth to match the nginx gateway's proxy_pass for this service.
app.use('/api/auth', router);

app.use((req, res) => {
  res.status(404).json({ error: 'not found' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'internal server error' });
});

app.listen(PORT, () => {
  console.log(`auth-server listening on port ${PORT}`);
});
