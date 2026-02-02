import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import socket from './socket';
import Home from './components/Home';
import Documentation from './components/Documentation';
import PasswordModal from './components/PasswordModal';
import TorrentSearch from './components/TorrentSearch';
import './App.css';

function App() {
  const [joinedRoom, setJoinedRoom] = useState(null);
  const [videoSrc, setVideoSrc] = useState(null);
  const [videoFile, setVideoFile] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [lastLog, setLastLog] = useState("Waiting for events...");
  const [userCount, setUserCount] = useState(0);

  // Auth State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pendingRoomId, setPendingRoomId] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [agentPort, setAgentPort] = useState(() => {
    // Load saved port from localStorage, default to 3000
    return localStorage.getItem('agentPort') || '3000';
  });

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // ... (socket event listeners remain the same)
    function onConnect() {
      setIsConnected(true);
      setLastLog("Socket Connected!");
    }

    function onDisconnect() {
      setIsConnected(false);
      setLastLog("Socket Disconnected");
    }

    function onSyncAction(data) {
      setLastLog(`Rx Action: ${data.action} @ ${data.time.toFixed(2)}s`);
    }

    function onRoomUsersUpdate(count) {
      console.log("Room users updated:", count);
      setUserCount(count);
    }

    function onSyncMagnetLink(data) {
      console.log('Viewer: Received sync_magnet_link:', data);
      if (data.magnet) {
        setLastLog(`Host selected torrent, starting download...`);
        processLocalMagnet(data.magnet);
      }
    }

    function onTorrentMetadataUpdate(data) {
      console.log('Received torrent metadata update:', data);
      if (data.duration > 0) {
        setLastLog(`Torrent duration available: ${Math.round(data.duration / 60)} minutes`);
        // Note: Video player will automatically update when it detects the new duration
        // via the metadata in the stream. This log just confirms receipt.
      }
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('sync_action', onSyncAction);
    socket.on('room_users_update', onRoomUsersUpdate);
    socket.on('sync_magnet_link', onSyncMagnetLink);
    socket.on('torrent_metadata_update', onTorrentMetadataUpdate);
    setIsConnected(socket.connected);

    socket.on('is_host', (status) => {
      console.log("Am I host?", status);
      setIsHost(status);
      setLastLog(`Host Status Change: ${status ? 'Host' : 'Viewer'}`);
    });

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('sync_action', onSyncAction);
      socket.off('room_users_update', onRoomUsersUpdate);
      socket.off('sync_magnet_link', onSyncMagnetLink);
      socket.off('torrent_metadata_update', onTorrentMetadataUpdate);
      socket.off('is_host');
    };
  }, []);

  const handleJoinRoom = (roomId, password = null) => {
    setAuthLoading(true);
    setAuthError(false);

    // Try to join
    socket.emit('join_room', { roomId, password }, (response) => {
      setAuthLoading(false);

      if (response && response.success) {
        setJoinedRoom(roomId);
        setLastLog(`Joined Room: ${roomId}`);
        // Clear auth state
        setShowPasswordModal(false);
        setPendingRoomId(null);
        // Persist password for this session if needed, or just keep it in memory
        if (password) {
          localStorage.setItem('temp_session_pass', password);
        }
        // Navigate to discover after joining room
        navigate('/discover');
      } else if (response && response.error === "Unauthorized") {
        // Trigger Modal
        setPendingRoomId(roomId);
        setShowPasswordModal(true);
        // If we tried with a password and failed, show error
        if (password) {
          setAuthError(true);
        }
      } else {
        alert("Failed to join room: " + (response?.error || 'Unknown error'));
      }
    });
  };

  const handleAuthSubmit = (password) => {
    if (pendingRoomId) {
      handleJoinRoom(pendingRoomId, password);
    }
  };

  const handleLeaveRoom = () => {
    setJoinedRoom(null);
    setVideoSrc(null);
    setVideoFile(null);
    setIsHost(false);
    setUserCount(0);
    window.location.reload();
  };

  const handleVideoSelect = (src, type, file) => {
    setVideoSrc(src);
    if (type === 'file' && file) {
      setVideoFile(file);
    } else {
      setVideoFile(null);
    }
    setLastLog(`Video Loaded (${type})`);
  };

  const handleFileReceived = (blobUrl) => {
    setVideoSrc(blobUrl);
    setLastLog("P2P Download Complete - Playing");
  };

  const processLocalMagnet = async (magnet) => {
    setLastLog(`Processing magnet link...`);

    try {
      // Use user-configured agent port from state
      const AGENT_URL = `http://localhost:${agentPort}`;

      const response = await fetch(`${AGENT_URL}/play`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: magnet, type: 'magnet' })
      });

      const data = await response.json();
      if (data.success) {
        const streamUrl = `${AGENT_URL}/stream/${data.streamId}`;
        setVideoSrc(streamUrl);
        setVideoFile(null);
        setLastLog('Torrent stream ready');

        // Start polling for metadata updates (for solo users)
        let pollCount = 0;
        const maxPolls = 12; // Poll for 3 minutes (12 * 15s)
        const pollInterval = setInterval(async () => {
          pollCount++;

          try {
            const metaRes = await fetch(`${AGENT_URL}/metadata/${data.streamId}`);
            const metaData = await metaRes.json();

            if (metaData.duration > 0) {
              console.log(`[App] Metadata poll successful - Duration: ${metaData.duration}s`);
              setLastLog(`Duration available: ${Math.round(metaData.duration / 60)} minutes`);
              clearInterval(pollInterval);
            } else if (pollCount >= maxPolls) {
              console.log('[App] Metadata polling timeout');
              clearInterval(pollInterval);
            }
          } catch (err) {
            console.log('[App] Metadata poll failed:', err.message);
            if (pollCount >= maxPolls) clearInterval(pollInterval);
          }
        }, 15000); // Poll every 15 seconds

      } else {
        alert('Failed to start stream: ' + data.error);
        setLastLog('Stream failed');
      }
    } catch (err) {
      console.error('Local Agent Error:', err);
      alert('Could not connect to Local Agent. Is it running?');
      setLastLog('Agent connection failed');
    }
  };

  const handleTorrentPlay = async (magnet, type = 'magnet') => {
    // If in a room, broadcast the magnet link to all viewers
    if (joinedRoom) {
      socket.emit('sync_magnet_link', {
        roomId: joinedRoom,
        magnet: magnet,
        type: type
      });
      console.log('Host: Broadcasting magnet link to room:', joinedRoom);
    }

    // Process the magnet on this user's local agent
    await processLocalMagnet(magnet);
    navigate('/');
  };

  return (
    <div className="app-container">
      <header>
        <div className="header-content">
          <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
            <h1 className="brand-logo">
              <span style={{ fontSize: '1.6rem' }}>📽️</span> ChitraKatha
            </h1>
          </Link>

          <div className="status-group">
            {/* Navigation Links */}
            <Link
              to="/"
              className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}
            >
              {joinedRoom ? '📺 Back to Room' : '🏠 Home'}
            </Link>

            <Link
              to="/docs"
              className={`nav-link ${location.pathname === '/docs' ? 'active' : ''}`}
            >
              📚 Guide
            </Link>

            <Link
              to="/discover"
              className={`nav-link ${location.pathname === '/discover' ? 'active' : ''}`}
            >
              🔍 Discover
            </Link>


            {joinedRoom && (
              <div className="role-badge" style={{ color: isHost ? 'var(--primary)' : 'var(--text-muted)' }}>
                {isHost ? '👑 Host' : '👤 Viewer'}
              </div>
            )}

            {joinedRoom && (
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)', opacity: 0.8 }}>
                👥 {userCount}
              </div>
            )}

            {/* Agent Port Configuration */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                Agent:
              </label>
              <input
                type="number"
                value={agentPort}
                onChange={(e) => {
                  const newPort = e.target.value;
                  setAgentPort(newPort);
                  localStorage.setItem('agentPort', newPort);
                }}
                placeholder="3000"
                style={{
                  width: '60px',
                  padding: '4px 8px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '4px',
                  color: 'var(--text-main)',
                  fontSize: '0.85rem',
                  textAlign: 'center'
                }}
              />
            </div>

            <div className="connection-badge">
              <span style={{ color: isConnected ? '#4caf50' : '#f44336', marginRight: '6px' }}>●</span>
              {isConnected ? 'Online' : 'Offline'}
            </div>
          </div>
        </div>
      </header>

      <main className={`${joinedRoom ? 'joined' : ''} ${location.pathname === '/docs' ? 'docs-mode' : ''} ${location.pathname === '/discover' ? 'discover-mode' : ''}`}>
        <Routes>
          <Route path="/" element={
            <Home
              joinedRoom={joinedRoom}
              isHost={isHost}
              videoSrc={videoSrc}
              videoFile={videoFile}
              handleJoinRoom={handleJoinRoom}
              handleLeaveRoom={handleLeaveRoom}
              handleVideoSelect={handleVideoSelect}
              handleFileReceived={handleFileReceived}
            />
          } />
          <Route path="/discover" element={
            joinedRoom ? (
              <TorrentSearch onPlay={handleTorrentPlay} />
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                <h2 style={{ color: 'var(--text-main)', marginBottom: '20px' }}>🔒 Join a Room First</h2>
                <p style={{ marginBottom: '30px' }}>You need to join a room to access the torrent discovery feature.</p>
                <button
                  onClick={() => navigate('/')}
                  style={{
                    padding: '12px 24px',
                    background: 'var(--primary)',
                    color: '#000',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    fontWeight: '600'
                  }}
                >
                  Go to Home
                </button>
              </div>
            )
          } />
          <Route path="/docs" element={<Documentation />} />
        </Routes>
      </main>
      <PasswordModal
        isOpen={showPasswordModal}
        onSubmit={handleAuthSubmit}
        onCancel={() => setShowPasswordModal(false)}
        isLoading={authLoading}
        isError={authError}
      />
    </div>
  );
}

export default App;
