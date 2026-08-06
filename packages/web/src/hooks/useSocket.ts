'use client';

import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Socket } from 'socket.io-client';
import { getSocket } from '@/lib/socket';
import type { ClientToServerEvents, ServerToClientEvents } from '@hermes/shared';

type HermesSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
type Emit = <K extends keyof ClientToServerEvents>(event: K, ...args: Parameters<ClientToServerEvents[K]>) => void;
type Listener<K extends keyof ServerToClientEvents> = (...args: Parameters<ServerToClientEvents[K]>) => void;
type SocketApi = { socket: HermesSocket; isConnected: boolean; emit: Emit; on: <K extends keyof ServerToClientEvents>(event: K, listener: Listener<K>) => void; off: <K extends keyof ServerToClientEvents>(event: K, listener: Listener<K>) => void };

const SocketContext = createContext<SocketApi | null>(null);

export function SocketProvider({ children }: { children: ReactNode }) {
  const [socket] = useState(getSocket);
  const [isConnected, setIsConnected] = useState(socket.connected);

  useEffect(() => {
    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.connect();
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.disconnect();
      setIsConnected(false);
    };
  }, [socket]);

  const emit = useCallback<Emit>((event, ...args) => { socket.emit(event, ...args); }, [socket]);
  const on = useCallback(<K extends keyof ServerToClientEvents>(event: K, listener: Listener<K>) => { socket.on(event, listener as never); }, [socket]);
  const off = useCallback(<K extends keyof ServerToClientEvents>(event: K, listener: Listener<K>) => { socket.off(event, listener as never); }, [socket]);
  const value = useMemo(() => ({ socket, isConnected, emit, on, off }), [socket, isConnected, emit, on, off]);

  return createElement(SocketContext.Provider, { value }, children);
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) throw new Error('useSocket must be used inside SocketProvider');
  return context;
}
