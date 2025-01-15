const express = require('express');
const bodyParser = require('body-parser');
const db = require('./db');
const app = express();
const port = 3001;
const { WebSocketServer } = require('ws');
const http = require('http');
const path = require('path');
const { fileURLToPath } = require('url');
const config = require('./public/config'); // Импорт config

app.use(bodyParser.json());

const publicPath = path.join(__dirname, 'public')

app.use(express.static(publicPath));

const BOARD_SIZE = config.BOARD_SIZE; // Используем размер поля из config
const PIXEL_COOLDOWN = config.PIXEL_COOLDOWN; // Используем кулдаун из config
let pixelData = Array(BOARD_SIZE * BOARD_SIZE).fill(0); // Создаем массив на основе размера поля
let pixelOwners = Array(BOARD_SIZE * BOARD_SIZE).fill(null);


const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Store connected clients
const clients = new Set();

// WebSocket logic
wss.on('connection', (ws) => {
    console.log('Client connected');
    clients.add(ws);

    // Send initial pixel data to new clients
    const initialData = pixelData.map((color, index) => ({
        color: color,
        owner_id: pixelOwners[index]
    }));
    ws.send(JSON.stringify({ type: 'pixels', data: initialData }));

    ws.on('close', () => {
        console.log('Client disconnected');
        clients.delete(ws);
    });
});

function broadcastPixelData() {
  const data = pixelData.map((color, index) => ({
      color: color,
      owner_id: pixelOwners[index]
    }));
  const message = JSON.stringify({ type: 'pixels', data: data });
  clients.forEach(client => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(message);
    }
  });
}

// Load initial pixel data from db
db.getPixels((err, rows) => {
  if (err) {
    return console.error('Error loading pixels from DB', err);
  }
  if (rows) {
    rows.forEach(row => {
        pixelData[row.id] = row.color;
        pixelOwners[row.id] = row.username;
      });
    }
  });

// Get initial pixel data
app.get('/api/pixels', (req, res) => {
  const data = pixelData.map((color, index) => ({
    color: color,
    owner_id: pixelOwners[index]
  }));
  res.json(data);
});

app.post('/api/pixels', (req, res) => {
  const { x, y, username, color } = req.body;
  
  if (x < 0 || x >= BOARD_SIZE || y < 0 || y >= BOARD_SIZE) {
    return res.status(400).json({ message: "Invalid coordinates" });
  }
  if (!username) {
    return res.status(400).json({ message: "Username is required" });
  }
  if(!color) {
      return res.status(400).json({ message: "Color is required" });
  }
    let colorToUse = color;
    const hexColorRegex = /^#([0-9a-fA-F]{3}){1,2}$/;
    if(typeof color === 'string' && !hexColorRegex.test(color)){
         colorToUse = parseInt(color);
    }
  
  db.getUser(username, (err, user) => {
    if (err) {
      return res.status(500).json({ message: "Database error" });
    }

    if (!user) {
      db.addUser(username, (err, id) => {
        if (err) {
          return res.status(500).json({ message: "Database error on user add"});
        }
          pixelData[y * BOARD_SIZE + x] = colorToUse;
        pixelOwners[y * BOARD_SIZE + x] = username;


        db.setPixel(y * BOARD_SIZE + x, colorToUse, id, (err) => {
          if (err) {
            return res.status(500).json({ message: "Database error on setPixel" });
          }
          db.updateUserLastPixelTime(id, Date.now(), (err) => {
              if (err) {
                return res.status(500).json({ message: "Database error on update pixel time" });
              }
              broadcastPixelData();
              res.json(pixelData);
            });
        });
      });
      return;
    }

    const now = Date.now();
    if (now - user.last_pixel_time < PIXEL_COOLDOWN) {
      return res.status(429).json({ message: "Cooldown period" });
    }

      pixelData[y * BOARD_SIZE + x] = colorToUse;
      pixelOwners[y * BOARD_SIZE + x] = username;


    db.setPixel(y * BOARD_SIZE + x, colorToUse, user.id, (err) => {
      if (err) {
        return res.status(500).json({ message: "Database error on setPixel" });
      }
        db.updateUserLastPixelTime(user.id, now, (err) => {
            if (err) {
              return res.status(500).json({ message: "Database error on update pixel time" });
            }
            broadcastPixelData();
            res.json(pixelData);
        });
    });
  });
});


app.get('/api/leaderboard', (req, res) => {
    db.db.all(`
        SELECT u.username, COUNT(p.owner_id) as pixel_count
        FROM users u
        LEFT JOIN pixels p ON u.id = p.owner_id
        GROUP BY u.username
        ORDER BY pixel_count DESC
    `, (err, rows) => {
        if (err) {
          return res.status(500).json({ message: "Database error on getting leaderboard" });
        }
      res.json(rows);
    });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
