import io from 'socket.io-client';

// Automatically detect if we are on localhost or a network IP
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const BACKEND_PORT = 3001;

// Priority 1: Environment Variable (Vite requires VITE_ prefix)
// Priority 2: Production hardcoded URL (Replace this with your actual Render URL)


let backendUrl = import.meta.env.VITE_BACKEND_URL;

if (import.meta.env.DEV) {
    // If in development mode, use local network/localhost logic
    backendUrl = `${window.location.protocol}//${window.location.hostname}:${BACKEND_PORT}`;
}

console.log(`Socket connecting to: ${backendUrl}`);

const socket = io(backendUrl);

export default socket;
