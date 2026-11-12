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

// Cargar citas previas
let bookings = {};
if (fs.existsSync(DATA_FILE)) {
  try {
    bookings = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    bookings = {};
  }
}

// Servir la página web HTML
app.use(express.static(__dirname));

// Manejo de conexiones en tiempo real
io.on('connection', (socket) => {
  // Enviar citas existentes al cliente que se conecta
  socket.emit('initBookings', bookings);

  // 1. Escuchar nueva reservación
  socket.on('newBooking', (data) => {
    const { dateRaw, timeSlot } = data;
    if (dateRaw && timeSlot) {
      if (!bookings[dateRaw]) {
        bookings[dateRaw] = [];
      }
      if (!bookings[dateRaw].includes(timeSlot)) {
        bookings[dateRaw].push(timeSlot);
        fs.writeFileSync(DATA_FILE, JSON.stringify(bookings, null, 2));
      }
      // Transmitir cambio a todos los celulares conectados
      io.emit('bookingUpdated', { dateRaw, timeSlot });
    }
  });

  // 2. Escuchar cuando un cliente CANCELA su cita
  socket.on('cancelBooking', (data) => {
    const { dateRaw, timeSlot } = data;
    if (dateRaw && timeSlot && bookings[dateRaw]) {
      bookings[dateRaw] = bookings[dateRaw].filter(slot => slot !== timeSlot);
      fs.writeFileSync(DATA_FILE, JSON.stringify(bookings, null, 2));
      
      // Notificar a todos los dispositivos que el horario está disponible otra vez
      io.emit('bookingCancelled', { dateRaw, timeSlot });
    }
  });
});

server.listen(PORT, () => {
  console.log(`Servidor activo en el puerto ${PORT}`);
});