const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const PORT = process.env.PORT || 4001;
const app = express();
app.use(express.static('public'));

const server = http.createServer(app);
const io = socketIo(server);

// Armazenar dispositivos conectados em memória
const connectedDevices = new Map();

io.on('connection', (socket) => {
  
  // Quando um dispositivo se identifica
  socket.on('registerDevice', async (deviceInfo) => {
    console.log('Received device registration:', deviceInfo);
    
    try {
      // Cria ou atualiza o dispositivo no banco de dados
      const device = await prisma.device.upsert({
        where: { id: deviceInfo.deviceId },
        update: {
          socketId: socket.id,
          name: deviceInfo.name || `Device ${deviceInfo.deviceId}`
        },
        create: {
          id: deviceInfo.deviceId,
          socketId: socket.id,
          name: deviceInfo.name || `Device ${deviceInfo.deviceId}`
        }
      });

      connectedDevices.set(deviceInfo.deviceId, device);
      
      // Envia lista atualizada de dispositivos para todos
      const allDevices = await prisma.device.findMany();
      io.emit('deviceList', allDevices);
    } catch (error) {
      console.error('Error registering device:', error);
    }
  });

  // Quando a localização é enviada
  socket.on('sendLocation', async (data) => {
    try {
      const device = Array.from(connectedDevices.values())
        .find(d => d.socketId === socket.id);
      
      if (device) {
        // Atualiza a localização no banco de dados
        const updatedDevice = await prisma.device.update({
          where: { id: device.id },
          data: {
            lastLatitude: data.latitude,
            lastLongitude: data.longitude,
            lastUpdate: new Date()
          }
        });

        const locationUpdate = {
          deviceId: device.id,
          latitude: data.latitude,
          longitude: data.longitude,
          timestamp: new Date()
        };

        // Atualiza a lista de dispositivos
        const allDevices = await prisma.device.findMany({
          orderBy: {
            lastUpdate: 'desc'
          }
        });
        io.emit('locationUpdate', locationUpdate);
        io.emit('deviceList', allDevices);
      }
    } catch (error) {
      console.error('Error updating device location:', error);
    }
  });

  // Quando um dispositivo desconecta
  socket.on('disconnect', async () => {
    try {
      const deviceId = Array.from(connectedDevices.entries())
        .find(([_, device]) => device.socketId === socket.id)?.[0];
      
      if (deviceId) {
        // Atualiza o socketId para null no banco de dados
        await prisma.device.update({
          where: { id: deviceId },
          data: { socketId: null }
        });

        connectedDevices.delete(deviceId);
        
        const allDevices = await prisma.device.findMany();
        io.emit('deviceList', allDevices);
        io.emit('deviceDisconnected', deviceId);
      }
    } catch (error) {
      console.error('Error handling device disconnect:', error);
    }
  });
});

// Endpoint para listar todos os dispositivos
app.get('/api/devices', async (req, res) => {
  try {
    const devices = await prisma.device.findMany({
      orderBy: {
        lastUpdate: 'desc'
      }
    });
    res.json(devices);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching devices' });
  }
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));