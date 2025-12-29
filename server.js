const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// --- Fake "database" of drivers (temporary) ---
const fakeDrivers = {
  riley: {
    name: "Riley McAlpine",
    number: 93,
    team: "SolanaGP",
    primaryCar: "Mazda MX-5 Cup",
    avatar: "/images/riley.png",
    irating: 2580,
    license: "B Class Oval",
    starts: 0,

    championships: 0,
    wins: 0,
    podiums: 0,
    dnfs: 0,

    races: [
      { track: "Sebring",   car: "Mazda MX-5", finish: 3, srChange: 0.12 },
      { track: "Lime Rock", car: "Mazda MX-5", finish: 1, srChange: 0.18 },
      { track: "Spa",       car: "GT3",        finish: 7, srChange: -0.04 }
    ],

    irHistory: [2200, 2250, 2300, 2400, 2450, 2520, 2580]
  },

  alex: {
    name: "Alex Fastboi",
    number: 7,
    team: "Free Agent",
    primaryCar: "Audi R8 LMS GT3",
    avatar: "/images/alex.png",
    irating: 3200,
    license: "A Class Road",
    starts: 0,

    championships: 0,
    wins: 0,
    podiums: 0,
    dnfs: 0,

    races: [
      { track: "Nürburgring",  car: "GT3",  finish: 2, srChange: 0.20 },
      { track: "Road Atlanta", car: "LMP2", finish: 5, srChange: 0.05 },
      { track: "Mosport",      car: "GT4",  finish: 1, srChange: 0.19 }
    ],

    irHistory: [3000, 3050, 3100, 3120, 3150, 3180, 3200]
  }
};

// --- API ROUTES ---

// Simple backend test
app.get('/hello', (req, res) => {
  res.send('Backend is working! 🏁');
});

// Return single driver stats
app.get('/api/stats', (req, res) => {
  const key = (req.query.driver || 'riley').toLowerCase();
  const d = fakeDrivers[key];

  if (!d) {
    return res.json({
      name: "Unknown",
      number: 0,
      team: "Unknown",
      primaryCar: "Unknown",
      avatar: "",
      irating: 0,
      license: "N/A",
      starts: 0
    });
  }

  res.json({
    name: d.name,
    number: d.number,
    team: d.team,
    primaryCar: d.primaryCar,
    avatar: d.avatar,
    irating: d.irating,
    license: d.license,
    starts: d.starts
  });
});

// Return recent races
app.get('/api/recent-races', (req, res) => {
  const key = (req.query.driver || 'riley').toLowerCase();
  const d = fakeDrivers[key];

  res.json(d ? d.races : []);
});

// Return iRating history
app.get('/api/irating-history', (req, res) => {
  const key = (req.query.driver || 'riley').toLowerCase();
  const d = fakeDrivers[key];

  if (!d || !d.irHistory) return res.json([]);

  const history = d.irHistory.map((v, i) => ({
    label: `Race ${i + 1}`,
    value: v
  }));

  res.json(history);
});

// ⭐ NEW: Return all drivers (for leaderboard)
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
    dnfs: d.dnfs || 0
  }));

  res.json(drivers);
});

// --- PAGE ROUTES ---

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

// ⭐ NEW: Leaderboard page
app.get('/leaderboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'leaderboard.html'));
});

// Static assets
app.use(express.static(path.join(__dirname, 'public')));

// Start server
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
