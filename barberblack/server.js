const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'bookings.json');

// Cargar citas guardadas del disco
let bookings = {};
if (fs.existsSync(DATA_FILE)) {
  try {
    bookings = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    bookings = {};
  }
}

// Servir los archivos estáticos de tu HTML
app.use(express.static(__dirname));

// Sincronización Realtime vía WebSockets
io.on('connection', (socket) => {
  // Enviar las citas acumuladas al nuevo cliente que entra
  socket.emit('initBookings', bookings);

  // Escuchar cuando un cliente agenda
  socket.on('newBooking', (data) => {
    const { dateRaw, timeSlot } = data;
    if (dateRaw && timeSlot) {
      if (!bookings[dateRaw]) {
        bookings[dateRaw] = [];
      }
      if (!bookings[dateRaw].includes(timeSlot)) {
        bookings[dateRaw].push(timeSlot);
        // Persistir en archivo JSON
        fs.writeFileSync(DATA_FILE, JSON.stringify(bookings, null, 2));
      }
      // Notificar a TODOS los demás clientes conectados
      io.emit('bookingUpdated', { dateRaw, timeSlot });
    }
  });
});

server.listen(PORT, () => {
  console.log(`Servidor de The Black Lion Barber Shop activo en el puerto ${PORT}`);
});