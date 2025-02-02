const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);
const {v4: uuidV4} = require('uuid')
const path = require('path');

const PORT_NUMBER = 3000;

server.listen(PORT_NUMBER);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));

app.get('/', (req, res) => {
    const roomId = uuidV4();
    res.redirect(`/${roomId}`);
});

app.get('/freelancer', (req, res) => {
    res.render('freelancer', {roomId: "SALES_ROOM"})
});

app.get('/client', (req, res) => {
    res.render('client', {roomId: "SALES_ROOM"})
});

app.get('/:room', (req, res) => {
    res.render('room', {roomId: req.params.room})
});

const rooms = {};

io.on('connection', socket => {
    socket.on('join-room', (roomId, userId) => {
        console.log(`user ${userId} trying to join room ${roomId}`);

        // JOIN ROOM
        socket.join(roomId);
        
        // SHARE ROOM INFO WITH NEW PEER
        socket.emit('user-joined', rooms[roomId]);

        // SHARE NEW PEER INFO WITH EXISTING PEERS
        socket.to(roomId).emit('user-connected', userId);

        // ADD PEER TO ROOM
        if (rooms[roomId]) {
            // console.log(`EXISTING ROOM: ${roomId}`);
            // console.log(`peers: ${rooms[roomId]}`);
            rooms[roomId].push(userId);
        } else {
            // console.log(`NEW ROOM: ${roomId}`);
            // console.log(`peers: ${rooms[roomId]}`);
            rooms[roomId] = [userId];
        }
       
        // WHEN PEER LEAVES:
        // - INFORM OTHER PEERS
        // - REMOVE PEER FROM ROOMS LIST
        socket.on('disconnect', () => {
            socket.to(roomId).emit('user-disconnected', userId);
            rooms[roomId].pop(userId);
        });
    })
})