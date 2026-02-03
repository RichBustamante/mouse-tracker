# Mouse Tracker with Kafka and WebSockets

A real-time mouse tracking system that captures mouse coordinates, sends them through Kafka, and displays them as dots on a web page.

## Mouse Tracker in Action!
![Result in UI](/assets/result.gif)

## Architecture

```
Browser (Frontend)
    ↓ mousemove events
WebSocket Producer Connection
    ↓ {x, y, timestamp}
Node.js Server
    ↓ produces to
Kafka Topic: "mouse-coordinates"
    ↓ consumed by
Node.js Server (Kafka Consumer)
    ↓ broadcasts to
WebSocket Consumer Connection
    ↓ {x, y, timestamp}
Browser (Frontend) - draws dots
```

## Prerequisites

- Node.js (v14 or higher)
- Docker and Docker Compose (for Kafka)

## Setup Instructions

### 1. Start Kafka

```bash
# Start Kafka in KRaft mode (no Zookeeper needed)
docker compose up -d

# Verify Kafka is running
docker compose ps

# Check Kafka logs (should see "Kafka Server started")
docker compose logs -f kafka
```

**Important:** Wait about 10-15 seconds after starting Kafka before proceeding to step 2. Kafka needs time to fully initialize.

### 2. Install Node.js Dependencies

```bash
npm install
```

### 3. Start the Server

```bash
npm start
```

You should see:
```
Waiting for Kafka to be ready...
Creating topic: mouse-coordinates
Topic created successfully
Kafka producer connected
Kafka consumer connected and listening
Server running on port 8080
```

### 4. Open the Application

Navigate to http://localhost:8080 in your browser and move your mouse around to see blue dots appear!

## How It Works

1. **Frontend Captures Mouse Coordinates**: The HTML page captures `mousemove` events and extracts x,y coordinates
2. **Producer WebSocket**: Coordinates are sent via WebSocket to the server at `ws://localhost:8080/producer`
3. **Kafka Producer**: The server receives coordinates and publishes them to the Kafka topic `mouse-coordinates`
4. **Kafka Consumer**: A consumer listens to the same topic and receives the coordinates
5. **Consumer WebSocket**: The received coordinates are broadcast to all connected clients via `ws://localhost:8080/consumer`
6. **Frontend Draws Dots**: The browser receives coordinates and draws blue dots at those positions

## Features

- **Real-time tracking**: Mouse movements are captured and displayed in real-time
- **Kafka integration**: Demonstrates producer-consumer pattern with Kafka
- **Dual WebSockets**: Separate WebSocket connections for sending and receiving data
- **Connection status**: Visual indicators show WebSocket connection states
- **KRaft mode**: Modern Kafka without Zookeeper dependency
- **Auto-retry**: Server automatically retries Kafka connections on failure
- **Auto-topic creation**: Topic is created automatically if it doesn't exist

## File Structure

- `index.html` - Frontend web page with mouse tracking and canvas drawing
- `server.js` - Node.js backend with WebSocket servers and Kafka integration
- `package.json` - Node.js dependencies
- `docker compose.yml` - Docker configuration for Kafka in KRaft mode
- `railway.json` - Configuration for Railway deployment
- `README.md` - This file
- `DEPLOYMENT.md` - Deployment guide for production environments

## Stopping the Application

1. Stop the Node.js server: Press `Ctrl+C`
2. Stop Kafka:
```bash
docker compose down

# To also remove volumes and completely clean up:
docker compose down -v
```

## Customization

### Change the dot color
Edit `index.html` and modify:
```javascript
ctx.fillStyle = '#2196F3'; // Change to any color (e.g., '#FF5733' for orange)
```

### Change the dot size
Edit `index.html` and modify:
```javascript
ctx.arc(x, y, 5, 0, 2 * Math.PI); // Change 5 to any radius
```

### Change the Kafka topic
Edit `server.js` and change both occurrences:
```javascript
topic: 'mouse-coordinates' // Change to your topic name
```

### Throttle mouse events
Add throttling in `index.html` to reduce the number of events sent:
```javascript
let lastSent = 0;
const throttleMs = 50; // Send max once per 50ms

canvas.addEventListener('mousemove', (event) => {
    const now = Date.now();
    if (now - lastSent < throttleMs) return;
    lastSent = now;
});
```

### Change WebSocket or HTTP port
Edit `server.js`:
```javascript
const PORT = process.env.PORT || 8080; // Change 8080 to your desired port
```

## Architecture Notes

**Why Kafka?**
This demo uses Kafka to showcase event streaming, but for a simple mouse tracker, you could send coordinates directly through WebSockets. Kafka is valuable when you need:
- Message persistence
- Multiple consumers
- Replay capability
- High throughput
- Decoupled architecture

**KRaft vs Zookeeper**
This project uses KRaft mode (Kafka Raft), which is Kafka's new architecture that eliminates the Zookeeper dependency. It's simpler, faster, and the future of Kafka.

## License

MIT