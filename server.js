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
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
});

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: 'mouse-tracker-group' });
const admin = kafka.admin();

// WebSocket servers
const producerWss = new WebSocket.Server({ noServer: true });
const consumerWss = new WebSocket.Server({ noServer: true });

// Store consumer WebSocket clients
const consumerClients = new Set();

// Create topic if it doesn't exist
async function createTopic() {
    try {
        await admin.connect();
        const topics = await admin.listTopics();
        
        if (!topics.includes('mouse-coordinates')) {
            console.log('Creating topic: mouse-coordinates');
            await admin.createTopics({
                topics: [{
                    topic: 'mouse-coordinates',
                    numPartitions: 3,
                    replicationFactor: 1
                }]
            });
            console.log('Topic created successfully');
        } else {
            console.log('Topic already exists');
        }
        
        await admin.disconnect();
    } catch (error) {
        console.error('Error creating topic:', error.message);
        try {
            await admin.disconnect();
        } catch (e) {
            // Ignore disconnect errors
        }
    }
}

// Initialize Kafka producer
async function initProducer() {
    let retries = 5;
    while (retries > 0) {
        try {
            await producer.connect();
            console.log('Kafka producer connected');
            return;
        } catch (error) {
            retries--;
            console.log(`Failed to connect producer, retries left: ${retries}`);
            if (retries === 0) throw error;
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }
}

// Initialize Kafka consumer
async function initConsumer() {
    let retries = 5;
    while (retries > 0) {
        try {
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
            return;
        } catch (error) {
            retries--;
            console.log(`Failed to connect consumer, retries left: ${retries}`);
            if (retries === 0) throw error;
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }
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
        // Wait a bit for Kafka to be fully ready
        console.log('Waiting for Kafka to be ready...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        await createTopic();
        await initProducer();
        await initConsumer();
        
        const PORT = process.env.PORT || 8080;
        server.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
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