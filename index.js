// Initialize the app
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const PORT = process.env.PORT || 4001;
const app = express();
app.use(express.static('public'));

const server = http.createServer(app);
const io = socketIo(server);

// Armazenar dispositivos conectados
const connectedDevices = new Map();

io.on('connection', (socket) => {
  //console.log('New client connected');
  
  // Quando um dispositivo se identifica
  socket.on('registerDevice', (deviceInfo) => {
    const deviceId = deviceInfo.deviceId;
    console.log('Received device registration:', deviceInfo);
    connectedDevices.set(deviceId, {
      id: deviceId,
      name: deviceInfo.name || `Device ${deviceId}`,
      lastLocation: null,
      socketId: socket.id
    });
    // Envia lista atualizada de dispositivos para todos
    io.emit('deviceList', Array.from(connectedDevices.values()));
  });

  // Quando a localização é enviada
  socket.on('sendLocation', (data) => {
    //console.log('Received location data:', data);
    const device = Array.from(connectedDevices.values())
      .find(d => d.socketId === socket.id);
    
    if (device) {
      const locationUpdate = {
        deviceId: device.id,
        latitude: data.latitude,
        longitude: data.longitude,
        timestamp: new Date()
      };
      //console.log('Sending location update:', locationUpdate);
      io.emit('locationUpdate', locationUpdate);
      
      // Atualiza o lastLocation do dispositivo
      device.lastLocation = {
        latitude: data.latitude,
        longitude: data.longitude,
        timestamp: new Date()
      };
      
      // Atualiza a lista de dispositivos
      io.emit('deviceList', Array.from(connectedDevices.values()));
    } else {
      //console.log('Device not found for socket:', socket.id);
    }
  });

  // Quando um dispositivo desconecta
  socket.on('disconnect', () => {
    const deviceId = Array.from(connectedDevices.entries())
      .find(([_, device]) => device.socketId === socket.id)?.[0];
    
    if (deviceId) {
      connectedDevices.delete(deviceId);
      io.emit('deviceList', Array.from(connectedDevices.values()));
      io.emit('deviceDisconnected', deviceId);
    }
    //console.log('Client disconnected');
  });
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));