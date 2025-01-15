const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('pixel_battle.db');

db.serialize(() => {
  db.run("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, last_pixel_time INTEGER)");
  db.run("CREATE TABLE IF NOT EXISTS pixels (id INTEGER PRIMARY KEY, color INTEGER, owner_id INTEGER)");
});

function addUser(username, callback) {
  const stmt = db.prepare("INSERT INTO users (username, last_pixel_time) VALUES (?, ?)");
  stmt.run(username, 0, function(err) {
    stmt.finalize();
    callback(err, this.lastID);
  });
}

function getUser(username, callback) {
  db.get("SELECT * FROM users WHERE username = ?", [username], callback);
}

function updateUserLastPixelTime(id, time, callback) {
    const stmt = db.prepare("UPDATE users SET last_pixel_time = ? WHERE id = ?");
    stmt.run(time, id, function(err) {
        stmt.finalize();
        callback(err);
    });
}


function getPixels(callback) {
  db.all("SELECT p.id, p.color, p.owner_id, u.username FROM pixels p LEFT JOIN users u ON p.owner_id = u.id", callback);
}


function setPixel(id, color, owner_id, callback) {
    const stmt = db.prepare("INSERT OR REPLACE INTO pixels (id, color, owner_id) VALUES (?, ?, ?)");
    stmt.run(id, color, owner_id, function(err) {
        stmt.finalize();
        callback(err);
    });
}

module.exports = { db, addUser, getUser, updateUserLastPixelTime, getPixels, setPixel };
