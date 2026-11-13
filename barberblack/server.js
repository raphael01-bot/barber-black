

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

const PORT = process.env.PORT || 3000;

// ✅ CREDENCIALES DE JSONBIN.IO CONFIGURADAS
const JSONBIN_BIN_ID = process.env.JSONBIN_BIN_ID || "6af74e00ffd5d16053bf473b";
const JSONBIN_API_KEY = process.env.JSONBIN_API_KEY || "$2a$10$17Ob.9aN2Q6NU4oIEVWZm.aoAUi5qHZMco1EUEhizSZULxyLoPE0K";
const JSONBIN_URL = `https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`;

let bookings = {};
let customCatalog = null;

// Función para leer los datos guardados en la nube al despertar Render
async function loadFromCloud() {
  try {
    const res = await fetch(`${JSONBIN_URL}/latest`, {
      headers: { 'X-Master-Key': JSONBIN_API_KEY }
    });
    const data = await res.json();
    if (data && data.record) {
      bookings = data.record.bookings || {};
      customCatalog = data.record.catalog || null;
      console.log("✅ Datos cargados desde JSONBin correctamente");
    }
  } catch (err) {
    console.error("❌ Error al cargar de JSONBin:", err.message);
  }
}

// Función para guardar cualquier cambio en la nube al instante
async function saveToCloud() {
  try {
    await fetch(JSONBIN_URL, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': JSONBIN_API_KEY
      },
      body: JSON.stringify({
        bookings: bookings,
        catalog: customCatalog
      })
    });
    console.log("☁️ Cambios respaldados en la nube");
  } catch (err) {
    console.error("❌ Error al guardar en JSONBin:", err.message);
  }
}

// Servir la página web HTML
app.use(express.static(__dirname));

// Manejo de conexiones en tiempo real
io.on('connection', (socket) => {
  // Enviar citas existentes y catálogo actualizado al cliente que entra
  socket.emit('initBookings', bookings);
  if (customCatalog) {
    socket.emit('catalogUpdated', customCatalog);
  }

  // 1. Escuchar nueva reservación
  socket.on('newBooking', async (data) => {
    const { dateRaw, timeSlot } = data;
    if (dateRaw && timeSlot) {
      if (!bookings[dateRaw]) {
        bookings[dateRaw] = [];
      }
      if (!bookings[dateRaw].includes(timeSlot)) {
        bookings[dateRaw].push(timeSlot);
        io.emit('bookingUpdated', { dateRaw, timeSlot });
        await saveToCloud();
      }
    }
  });

  // 2. Escuchar cuando un cliente o el dueño CANCELA/LIBERA una cita
  socket.on('cancelBooking', async (data) => {
    const { dateRaw, timeSlot } = data;
    if (dateRaw && timeSlot && bookings[dateRaw]) {
      bookings[dateRaw] = bookings[dateRaw].filter(slot => slot !== timeSlot);
      io.emit('bookingCancelled', { dateRaw, timeSlot });
      await saveToCloud();
    }
  });

  // 3. Escuchar cuando el dueño actualiza precios o promociones
  socket.on('updateCatalog', async (catalog) => {
    if (catalog && Array.isArray(catalog.services) && Array.isArray(catalog.packages)) {
      customCatalog = catalog;
      io.emit('catalogUpdated', customCatalog);
      await saveToCloud();
    }
  });
});

// Arrancar servidor cargando primero la memoria en la nube
loadFromCloud().then(() => {
  server.listen(PORT, () => {
    console.log(`Servidor activo en el puerto ${PORT}`);
  });
});


