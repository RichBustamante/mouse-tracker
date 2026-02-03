const WebSocket = require('ws');
const express = require('express');
const http = require('http');
const { Kafka } = require('kafkajs');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Serve static files
app.use(express.static(__dirname));

// Kafka configuration
const kafka = new Kafka({
    clientId: 'mouse-tracker',
    brokers: ['localhost:9092']
});

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: 'mouse-tracker-group' });

// WebSocket servers
const producerWss = new WebSocket.Server({ noServer: true });
const consumerWss = new WebSocket.Server({ noServer: true });

// Store consumer WebSocket clients
const consumerClients = new Set();

// Initialize Kafka producer
async function initProducer() {
    await producer.connect();
    console.log('Kafka producer connected');
}

// Initialize Kafka consumer
async function initConsumer() {
    await consumer.connect();
    await consumer.subscribe({ topic: 'mouse-coordinates', fromBeginning: false });
    
    await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
            const data = JSON.parse(message.value.toString());
            console.log('Received from Kafka:', data);
            
            // Broadcast to all consumer WebSocket clients
            consumerClients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(data));
                }
            });
        }
    });
    
    console.log('Kafka consumer connected and listening');
}

// Handle producer WebSocket connections (receives mouse coords from browser)
producerWss.on('connection', (ws) => {
    console.log('Producer WebSocket client connected');
    
    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            console.log('Received mouse coordinates:', data);
            
            // Send to Kafka
            await producer.send({
                topic: 'mouse-coordinates',
                messages: [
                    {
                        value: JSON.stringify(data),
                        timestamp: Date.now().toString()
                    }
                ]
            });
        } catch (error) {
            console.error('Error processing message:', error);
        }
    });
    
    ws.on('close', () => {
        console.log('Producer WebSocket client disconnected');
    });
    
    ws.on('error', (error) => {
        console.error('Producer WebSocket error:', error);
    });
});

// Handle consumer WebSocket connections (sends mouse coords to browser)
consumerWss.on('connection', (ws) => {
    console.log('Consumer WebSocket client connected');
    consumerClients.add(ws);
    
    ws.on('close', () => {
        console.log('Consumer WebSocket client disconnected');
        consumerClients.delete(ws);
    });
    
    ws.on('error', (error) => {
        console.error('Consumer WebSocket error:', error);
        consumerClients.delete(ws);
    });
});

// Handle upgrade requests for WebSocket
server.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    
    if (pathname === '/producer') {
        producerWss.handleUpgrade(request, socket, head, (ws) => {
            producerWss.emit('connection', ws, request);
        });
    } else if (pathname === '/consumer') {
        consumerWss.handleUpgrade(request, socket, head, (ws) => {
            consumerWss.emit('connection', ws, request);
        });
    } else {
        socket.destroy();
    }
});

// Initialize and start server
async function start() {
    try {
        await initProducer();
        await initConsumer();
        
        const PORT = 8080;
        server.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
            console.log('WebSocket endpoints:');
            console.log('  - Producer: ws://localhost:8080/producer');
            console.log('  - Consumer: ws://localhost:8080/consumer');
        });
    } catch (error) {
        console.error('Error starting server:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\nShutting down gracefully...');
    await producer.disconnect();
    await consumer.disconnect();
    server.close();
    process.exit(0);
});

start();
