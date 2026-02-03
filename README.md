# Mouse Tracker with Kafka and WebSockets

A real-time mouse tracking system that captures mouse coordinates, sends them through Kafka, and displays them as dots on a web page.

## Result
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

### 1. Start Kafka and Zookeeper

```bash
docker-compose up -d
```

This will start:
- Zookeeper on port 2181
- Kafka on port 9092

To check if Kafka is running:
```bash
docker-compose ps
```

### 2. Install Node.js Dependencies

```bash
npm install
```

### 3. Start the Server

```bash
npm start
```

The server will start on http://localhost:8080

## Usage

1. Open your browser and navigate to http://localhost:8080
2. Move your mouse around the page
3. You'll see blue dots appear at the positions where your mouse moves
4. The top-left corner shows connection status for both WebSocket connections

## How It Works

1. **Frontend Captures Mouse Coordinates**: The HTML page captures `mousemove` events and extracts x,y coordinates
2. **Producer WebSocket**: Coordinates are sent via WebSocket to the server at `ws://localhost:8080/producer`
3. **Kafka Producer**: The server receives coordinates and publishes them to the Kafka topic `mouse-coordinates`
4. **Kafka Consumer**: A consumer listens to the same topic and receives the coordinates
5. **Consumer WebSocket**: The received coordinates are broadcast to all connected clients via `ws://localhost:8080/consumer`
6. **Frontend Draws Dots**: The browser receives coordinates and draws blue dots at those positions

## File Structure

- `index.html` - Frontend web page with mouse tracking and canvas drawing
- `server.js` - Node.js backend with WebSocket servers and Kafka integration
- `package.json` - Node.js dependencies
- `docker-compose.yml` - Docker configuration for Kafka and Zookeeper
- `README.md` - This file

## Stopping the Application

1. Stop the Node.js server: Press `Ctrl+C`
2. Stop Kafka and Zookeeper:
```bash
docker-compose down
```

## Troubleshooting

### WebSocket won't connect
- Ensure the server is running on port 8080
- Check that no firewall is blocking the connection

### Kafka connection errors
- Verify Kafka is running: `docker-compose ps`
- Check Kafka logs: `docker-compose logs kafka`
- Restart Kafka: `docker-compose restart kafka`

### No dots appearing
- Check the browser console for errors
- Verify both WebSocket connections show "Connected" in the UI
- Check the server logs for any Kafka errors

## Customization

### Change the dot color
Edit `index.html` and modify:
```javascript
ctx.fillStyle = '#2196F3';
```

### Change the dot size
Edit `index.html` and modify:
```javascript
ctx.arc(x, y, 5, 0, 2 * Math.PI);
```

### Change the Kafka topic
Edit `server.js` and change:
```javascript
topic: 'mouse-coordinates'
```

### Throttle mouse events
Add throttling in `index.html` to reduce the number of events sent:
```javascript
let lastSent = 0;
const throttleMs = 50;

canvas.addEventListener('mousemove', (event) => {
    const now = Date.now();
    if (now - lastSent < throttleMs) return;
    lastSent = now;
    // ... rest of the code
});
```

## License

MIT
