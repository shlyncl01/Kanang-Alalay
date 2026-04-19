import { useEffect, useRef, useCallback } from 'react';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL ||
    (process.env.NODE_ENV === 'production'
        ? 'https://kanang-alalay-backend.onrender.com'
        : 'http://localhost:5000');

export const useSocket = () => {
    const socketRef = useRef(null);
    const listenersRef = useRef({});

    useEffect(() => {
        const connect = () => {
            if (typeof window !== 'undefined' && window.io) {
                socketRef.current = window.io(SOCKET_URL, {
                    transports: ['websocket', 'polling'],
                    reconnectionAttempts: 5,
                    reconnectionDelay: 2000,
                });
                socketRef.current.on('connect', () => console.log('[Socket] Connected'));
                socketRef.current.on('disconnect', () => console.log('[Socket] Disconnected'));
                Object.entries(listenersRef.current).forEach(([event, handlers]) => {
                    handlers.forEach(h => socketRef.current.on(event, h));
                });
            }
        };

        if (!window.io) {
            const script = document.createElement('script');
            script.src = `${SOCKET_URL}/socket.io/socket.io.js`;
            script.onload = connect;
            script.onerror = () => console.warn('[Socket] socket.io-client not available');
            document.head.appendChild(script);
        } else {
            connect();
        }

        return () => {
            if (socketRef.current) { socketRef.current.disconnect(); socketRef.current = null; }
        };
    }, []);

    const on = useCallback((event, handler) => {
        if (!listenersRef.current[event]) listenersRef.current[event] = [];
        listenersRef.current[event].push(handler);
        if (socketRef.current) socketRef.current.on(event, handler);
    }, []);

    const off = useCallback((event, handler) => {
        if (listenersRef.current[event]) {
            listenersRef.current[event] = listenersRef.current[event].filter(h => h !== handler);
        }
        if (socketRef.current) socketRef.current.off(event, handler);
    }, []);

    const emit = useCallback((event, data) => {
        if (socketRef.current) socketRef.current.emit(event, data);
    }, []);

    return { on, off, emit };
};