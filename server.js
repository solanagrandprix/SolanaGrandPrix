const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------------------
// Fake "database" of drivers (temporary)
// ---------------------------------------------------------------------------
const fakeDrivers = {
  lemon: {
    name: 'Lemon',
    number: 93,
    team: 'SolanaGP',
    primaryCar: 'Mazda MX-5 Cup',
    avatar: '/images/riley.png',
    irating: 2580,
    license: 'TBD',
    starts: 0,

    freeAgent: true, 

    championships: 0,
    wins: 0,
    podiums: 0,
    dnfs: 0,
    earnings: 1250, // total prize money

    races: [
      { track: 'Sebring', car: 'Mazda MX-5', finish: 3, srChange: 0.12 },
      { track: 'Lime Rock', car: 'Mazda MX-5', finish: 1, srChange: 0.18 },
      { track: 'Spa', car: 'GT3', finish: 7, srChange: -0.04 },
    ],

    irHistory: [2200, 2250, 2300, 2400, 2450, 2520, 2580],
  },
};

// ---------------------------------------------------------------------------
// API ROUTES
// ---------------------------------------------------------------------------

// Simple backend test
app.get('/hello', (req, res) => {
  res.send('Backend is working! 🏁');
});

// Return single driver stats
app.get('/api/stats', (req, res) => {
  const key = (req.query.driver || 'lemon').toLowerCase();
  const d = fakeDrivers[key];

  if (!d) {
    // Fallback if driver key not found
    return res.json({
      name: 'Unknown',
      number: 0,
      team: 'Unknown',
      primaryCar: 'Unknown',
      avatar: '',
      irating: 0,
      license: 'N/A',
      starts: 0,
      championships: 0,
      wins: 0,
      podiums: 0,
      dnfs: 0,
      earnings: 0,
      freeAgent: true, 
    });
  }

  // Normal driver
  return res.json({
    name: d.name,
    number: d.number,
    team: d.team,
    primaryCar: d.primaryCar,
    avatar: d.avatar,
    irating: d.irating,
    license: d.license,
    starts: d.starts,
    championships: d.championships || 0,
    wins: d.wins || 0,
    podiums: d.podiums || 0,
    dnfs: d.dnfs || 0,
    earnings: d.earnings || 0,
    freeAgent: !!d.freeAgent,
  });
});

// Return recent races
app.get('/api/recent-races', (req, res) => {
  const key = (req.query.driver || 'lemon').toLowerCase();
  const d = fakeDrivers[key];

  res.json(d ? d.races : []);
});

// Return iRating history
app.get('/api/irating-history', (req, res) => {
  const key = (req.query.driver || 'lemon').toLowerCase();
  const d = fakeDrivers[key];

  if (!d || !d.irHistory) {
    return res.json([]);
  }

  const history = d.irHistory.map((v, i) => ({
    label: `Race ${i + 1}`,
    value: v,
  }));

  res.json(history);
});

// Return all drivers (for leaderboard)
app.get('/api/drivers', (req, res) => {
  const drivers = Object.entries(fakeDrivers).map(([key, d]) => ({
    key,
    name: d.name,
    number: d.number,
    team: d.team,
    primaryCar: d.primaryCar,
    avatar: d.avatar,
    irating: d.irating,
    license: d.license,
    starts: d.starts,
    championships: d.championships || 0,
    wins: d.wins || 0,
    podiums: d.podiums || 0,
    dnfs: d.dnfs || 0,
    earnings: d.earnings || 0,
  }));

  res.json(drivers);
});

// ---------------------------------------------------------------------------
// PAGE ROUTES
// ---------------------------------------------------------------------------

// Home page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'home.html'));
});

// Drivers (tracker list)
app.get('/tracker', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Driver profile page
app.get('/driver/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'driver.html'));
});

// Card builder
app.get('/card-builder', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'card-builder.html'));
});

// Season Hub
app.get('/season', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'season.html'));
});

// Leaderboard page
app.get('/leaderboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'leaderboard.html'));
});

// ---------------------------------------------------------------------------
// STATIC ASSETS
// ---------------------------------------------------------------------------
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------------------------
// START SERVER
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
