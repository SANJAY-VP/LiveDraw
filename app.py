from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit

app = Flask(__name__, static_folder='static', template_folder='templates')
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app, cors_allowed_origins="*")

# Store usernames by session ID
users = {}

@app.route('/')
def index():
    return render_template('index.html')

@socketio.on('connect')
def handle_connect():
    print(f'Client connected: {request.sid}')
    users[request.sid] = f'User-{request.sid[:4]}'

@socketio.on('disconnect')
def handle_disconnect():
    print(f'Client disconnected: {request.sid}')
    users.pop(request.sid, None)

@socketio.on('set_username')
def handle_set_username(username):
    users[request.sid] = username.strip() or f'User-{request.sid[:4]}'

@socketio.on('chat_message')
def handle_chat_message(msg):
    sender = users.get(request.sid, f'User-{request.sid[:4]}')
    emit('broadcast_chat', {
        'user': request.sid,
        'senderName': sender,
        'message': msg
    }, broadcast=True)


@socketio.on('draw_event')
def handle_draw_event(data):
    emit('broadcast_draw', data, broadcast=True, include_self=False)

@socketio.on('clear_canvas')
def handle_clear_canvas():
    emit('broadcast_clear', broadcast=True)

@socketio.on('undo_event')
def handle_undo():
    emit('broadcast_undo', broadcast=True)

if __name__ == '__main__':
    socketio.run(app, debug=True)
