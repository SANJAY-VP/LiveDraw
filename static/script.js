// Initialize socket with fallback for demo
let socket;
try {
    socket = io();
} catch (e) {
    // Fallback for demo - create mock socket
    socket = {
        emit: (event, data) => console.log('Demo mode - would emit:', event, data),
        on: (event, callback) => console.log('Demo mode - would listen for:', event)
    };
}

// Get username and initialize
let username = prompt("🎨 Welcome to LiveDraw Studio!\n\nEnter your name:");
if (!username || username.trim() === "") {
    username = "Artist" + Math.floor(Math.random() * 1000);
}

document.getElementById('username').textContent = username;
document.getElementById('userAvatar').textContent = username.charAt(0).toUpperCase();

if (socket.emit) socket.emit('set_username', username);

// Canvas setup
const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
    const container = document.querySelector('.canvas-container');
    const rect = container.getBoundingClientRect();
    canvas.width = Math.max(300, rect.width - 40);
    canvas.height = Math.max(200, rect.height - 40);
    // Redraw after resize
    setTimeout(() => {
        if (typeof redrawCanvas === 'function') {
            redrawCanvas();
        }
    }, 100);
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// State
let drawing = false;
let lastX = null;
let lastY = null;
let color = '#000000';
let size = 4;
let isErasing = false;
const history = [];

function redrawCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const line of history) {
        drawLine(line.x0, line.y0, line.x1, line.y1, line.color, line.size);
    }
}

// Color palette functionality
document.querySelectorAll('.color-option').forEach(option => {
    option.addEventListener('click', () => {
        document.querySelectorAll('.color-option').forEach(o => o.classList.remove('active'));
        option.classList.add('active');
        color = option.dataset.color;
        document.getElementById('colorPicker').value = color;
        isErasing = false;
        updateEraserButton();
    });
});

// Custom color picker
document.getElementById('colorPicker').addEventListener('change', e => {
    color = e.target.value;
    document.querySelectorAll('.color-option').forEach(o => o.classList.remove('active'));
    isErasing = false;
    updateEraserButton();
});

// Size picker
const sizePicker = document.getElementById('sizePicker');
const sizeIndicator = document.getElementById('sizeIndicator');

sizePicker.addEventListener('input', e => {
    size = e.target.value;
    updateSizeIndicator();
});

function updateSizeIndicator() {
    const diameter = Math.max(4, Math.min(24, size));
    sizeIndicator.style.width = diameter + 'px';
    sizeIndicator.style.height = diameter + 'px';
}
updateSizeIndicator();

// Eraser functionality
function updateEraserButton() {
    const eraserBtn = document.getElementById('eraserBtn');
    if (isErasing) {
        eraserBtn.textContent = '✏️ Draw';
        eraserBtn.classList.add('active');
    } else {
        eraserBtn.textContent = '🧽 Eraser';
        eraserBtn.classList.remove('active');
    }
}

document.getElementById('eraserBtn').addEventListener('click', () => {
    isErasing = !isErasing;
    updateEraserButton();
});

// Drawing functions
function getCanvasCoordinates(e) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
}

function drawLine(x0, y0, x1, y1, strokeColor, strokeSize) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x0 ?? x1, y0 ?? y1);
    ctx.lineTo(x1, y1);
    ctx.stroke();
}

function draw(e) {
    if (!drawing) return;

    const coords = getCanvasCoordinates(e);
    const currentColor = isErasing ? '#ffffff' : color;

    drawLine(lastX, lastY, coords.x, coords.y, currentColor, size);

    if (socket.emit) {
        socket.emit('draw_event', {
            x0: lastX, y0: lastY, x1: coords.x, y1: coords.y,
            color: currentColor, size
        });
    }

    history.push({ 
        x0: lastX, y0: lastY, x1: coords.x, y1: coords.y, 
        color: currentColor, size 
    });

    lastX = coords.x;
    lastY = coords.y;
}

// Move redrawCanvas function definition before resizeCanvas call

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Toolbar toggle functionality
const toolbar = document.getElementById('toolbar');

// Drawing cursor management
function updateCursor(userId, x, y, userName) {
    if (userId === username) return; // Don't show own cursor
    
    let cursor = document.getElementById(`cursor-${userId}`);
    if (!cursor) {
        cursor = document.createElement('div');
        cursor.id = `cursor-${userId}`;
        cursor.className = 'drawing-cursor';
        cursor.innerHTML = `
            <div class="cursor-dot"></div>
            <div class="cursor-name">${userName}</div>
        `;
        document.body.appendChild(cursor);
    }
    
    const canvasRect = canvas.getBoundingClientRect();
    cursor.style.left = (canvasRect.left + x) + 'px';
    cursor.style.top = (canvasRect.top + y) + 'px';
    
    // Auto-hide cursor after inactivity
    clearTimeout(otherCursors.get(userId));
    otherCursors.set(userId, setTimeout(() => {
        if (cursor && cursor.parentNode) {
            cursor.parentNode.removeChild(cursor);
            otherCursors.delete(userId);
        }
    }, 3000));
}

function removeCursor(userId) {
    const cursor = document.getElementById(`cursor-${userId}`);
    if (cursor && cursor.parentNode) {
        cursor.parentNode.removeChild(cursor);
        otherCursors.delete(userId);
    }
}

// Mouse events
canvas.addEventListener('mousedown', e => {
    drawing = true;
    const coords = getCanvasCoordinates(e);
    lastX = coords.x;
    lastY = coords.y;
});

canvas.addEventListener('mouseup', () => {
    drawing = false;
    lastX = null;
    lastY = null;
});

canvas.addEventListener('mouseout', () => drawing = false);
canvas.addEventListener('mousemove', e => {
    // Send cursor position to other users
    const coords = getCanvasCoordinates(e);
    if (socket.emit) {
        socket.emit('cursor_move', {
            x: coords.x,
            y: coords.y,
            user: username
        });
    }
    
    draw(e);
});

// Touch events
canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    drawing = true;
    const touch = e.touches[0];
    const coords = getCanvasCoordinates(touch);
    lastX = coords.x;
    lastY = coords.y;
});

canvas.addEventListener('touchend', e => {
    e.preventDefault();
    drawing = false;
    lastX = null;
    lastY = null;
});

canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    const touch = e.touches[0];
    draw(touch);
});

// Action buttons
document.getElementById('undoBtn').addEventListener('click', () => {
    if (history.length === 0) return;
    history.pop();
    redrawCanvas();
    if (socket.emit) socket.emit('undo_event');
});

document.getElementById('clearBtn').addEventListener('click', () => {
    if (confirm('Are you sure you want to clear the canvas?')) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        history.length = 0;
        if (socket.emit) socket.emit('clear_canvas');
    }
});

// Chat functionality
const chatInput = document.getElementById('chatInput');
const chatMessages = document.getElementById('chatMessages');

function appendChatMessage(msg, isOwnMessage = false, senderName = '') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isOwnMessage ? 'own' : 'other'}`;
    
    const messageInfo = document.createElement('div');
    messageInfo.className = 'message-info';
    
    const messageBubble = document.createElement('div');
    messageBubble.className = 'message-bubble';

    messageInfo.textContent = isOwnMessage ? 'You' : senderName || 'Unknown';
    messageBubble.textContent = msg;

    messageDiv.appendChild(messageInfo);
    messageDiv.appendChild(messageBubble);
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}



chatInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && chatInput.value.trim() !== '') {
        const message = chatInput.value.trim();
        if (socket.emit) socket.emit('chat_message', message);
        chatInput.value = '';
    }
});

// Socket listeners
if (socket.on) {
    socket.on('broadcast_draw', data => {
        drawLine(data.x0, data.y0, data.x1, data.y1, data.color, data.size);
    });

    socket.on('broadcast_clear', () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        history.length = 0;
    });

    socket.on('broadcast_undo', () => {
        if (history.length === 0) return;
        history.pop();
        redrawCanvas();
    });

    socket.on('broadcast_chat', data => {
    const { user, senderName, message } = data;
    const isOwnMessage = user === socket.id;
    appendChatMessage(message, isOwnMessage, senderName);
    });

    socket.on('cursor_update', data => {
        updateCursor(data.user, data.x, data.y, data.user);
    });

    socket.on('user_disconnected', userId => {
        removeCursor(userId);
    });
}

// Demo messages for showcase
if (!socket.emit) {
    setTimeout(() => appendChatMessage("🎨 Welcome to LiveDraw Studio!", false, "System"), 1000);
    setTimeout(() => appendChatMessage("✨ This is demo mode - connect to server for real-time collaboration", false, "System"), 2000);
    setTimeout(() => appendChatMessage("Hello everyone!", true), 3000);
    setTimeout(() => appendChatMessage("Hi there! Nice to meet you 👋", false, "Alice"), 4000);
}