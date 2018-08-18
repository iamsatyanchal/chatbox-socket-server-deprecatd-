"use strict";
var fs = require('fs');
var express = require('express');
var app = express();


var server = require('http').createServer(app);
var port = 8088;

// Use below settings if need to run https locally
// var options = {
//   key: fs.readFileSync('./file.pem'),
//   cert: fs.readFileSync('./file.crt')
// };
// var server = require('https').createServer(options, app);
// var port = 443;

var StatsD = require('node-statsd');
var metrics = new StatsD({host: '52.52.151.75'});

var io = require('socket.io')(server);

var roomHandler = require('./handlers/roomHandler.js');
var socketHandler = require('./handlers/socketHandler.js');
var adminHandler = require('./handlers/adminHandler.js');
var msgHandler = require('./handlers/msgHandler.js');
var fileHandler = require('./handlers/fileHandler.js');
var usernameHandler = require('./handlers/usernameHandler.js');

var chatbot = require('./chatbot.js');

//set timeout, default is 1 min
//io.set("heartbeat timeout", 3*60*1000);



server.listen(port, function () {
    console.log('Server listening at port %d', port);
});

// Routing

// allow ajax request from different domain, you can comment it out if you don't want it
app.use(function (req, res, next) {

    // Website you wish to allow to connect
    res.setHeader('Access-Control-Allow-Origin', '*');
    // Request methods you wish to allow
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    // Request headers you wish to allow
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
    // Set to true if you need the website to include cookies in the requests sent
    // to the API (e.g. in case you use sessions)
    res.setHeader('Access-Control-Allow-Credentials', true);
    // Pass to next layer of middleware
    next();
});


// Endpoints for monitoring

app.get('/admin/users', function (req, res) {
    res.send(socketHandler.getAllUsers());
})

app.get('/admin/user/:userId', function (req, res) {
    res.send(socketHandler.getUser(req.params.userId));
})

app.get('/admin/room', function (req, res) {
    res.send(roomHandler.getAllRooms());
})

app.get('/admin/room/:roomID', function (req, res) {
    res.send(roomHandler.getRoom(req.params.roomID));
})

app.get('/admin/socket', function (req, res) {
    // TODO: Converting circular structure to JSON at Object.stringify (native) failed
    res.send(socketHandler.getAllSockets());
})

app.get('/admin/socket/:socketId', function (req, res) {
    // TODO: Converting circular structure to JSON at Object.stringify (native) failed
    res.send(socketHandler.getSocket(req.params.socketId));
})



// Chatbox
io.on('connection', function (socket) {
    // Todo: also log IP
    adminHandler.log('New socket connected, socket.id: '+ socket.id);
    socketHandler.socketConnected(socket);

    // adminHandler.log("socket.ip: " + socket.remoteAddress); //useless with nginx since it will always be 127.0.0.1

    // Once the new user is connected, we ask him to login
    socket.emit('login', {
        // TODO: may want to pass some data to user
    });

    // Once a new client is connected, this is the first msg he send
    // we'll find out if he's a new user or existing one looking at the cookie uuid
    // then we'll map the user and the socket
    socket.on('login', function (data) {
        var client_requested_name = data.username;
        // "isNewUser" boolean disregard room 
        var isNewUser = socketHandler.socketJoin(socket, data.url, data.referrer, data.uuid, client_requested_name);
        
        var isNewUserOfRoom = roomHandler.socketJoin(socket, data.roomID);

        adminHandler.log('uuid: '+ data.uuid + " socket.id: " + socket.id + " joined room: " + data.roomID + ' isNewUser: ' + isNewUser + ' isNewUserOfRoom: ' + isNewUserOfRoom);

        var user = socket.user;
        var server_agreed_name = '';

        if (isNewUserOfRoom) {
            // ensure username unique in same chat room
            server_agreed_name = usernameHandler.registerUniqueName(client_requested_name, socket.roomID);
            socket.username = server_agreed_name;

            // If the username given to user from server is different from the client one
            // the client need to update local name

            // welcome the new user
            socket.emit('welcome new user', {
                username: server_agreed_name,
                onlineUsers: usernameHandler.getNamesInRoom(socket.roomID) 
            });
            // echo to others that a new user just joined
            io.in(socket.roomID).emit('user joined', {
                username: server_agreed_name,
                onlineUsers: usernameHandler.getNamesInRoom(socket.roomID) 
            });
            if (Math.random()>0.9) {
                setTimeout(function(){
                    chatbot.sendMsg(socket);
                }, Math.floor(Math.random() * 30)*1000);
            }

        } else {
            // The user already exists in Room, this is just a new connection from him
            // Find an earlier socket in this room to get his server-agreed-name
            var i = 0;
            for (; i<user.socketIDList.length; i++) {
                var old_socket = socketHandler.getSocket(user.socketIDList[i]);
                if (old_socket.roomID == socket.roomID && old_socket.username){
                    socket.username = old_socket.username;
                    server_agreed_name = socket.username
                    break;
                }
            }
            socket.emit('welcome new connection', {
                username: server_agreed_name,
                onlineUsers: usernameHandler.getNamesInRoom(socket.roomID)
            });
        }
        var shorterURL = data.roomID.replace('https://','').replace('http://','').replace('/','-');
        metrics.increment('url.'+shorterURL);
        metrics.increment('login');
    });

    // when the socket disconnects
    socket.on('disconnect', function () {
        // the user only exist after login
        // socket disconnected before logging in
        if (!socket.joined) {
            return;
        }
        // remove user from room if it's his last connection
        var lastConnectionOfUserInOneRoom = roomHandler.socketLeftRoom(socket);
        // last Connection of User boolean disregard room
        var lastConnectionOfUser = socketHandler.socketDisconnected(socket);

        if (lastConnectionOfUserInOneRoom) {
            io.in(socket.roomID).emit('stop typing', { username: socket.username });
            io.in(socket.roomID).emit('user left', {
                username: socket.username,
                onlineUsers: usernameHandler.getNamesInRoom(socket.roomID)
            });
        }
        metrics.increment('disconnect');

    });

    // this is when one user wants to change his name
    // enforce that all his socket connections change name too
    socket.on('change name', function (data) {
        var oldName = socket.username;
        usernameHandler.userEditName(socket, data.username);
        io.in(socket.roomID).emit('name changed', {
            username: socket.username,
            oldName: oldName
        });
        metrics.increment('change_name');
    });

    // when the client emits 'new message', this listens and executes
    socket.on('new message', function (data) {

        io.in(socket.roomID).emit('new message', {//send to everybody including sender
            username: socket.username,
            message: data.msg,
            sender: socket.user.id
        });
        msgHandler.receiveMsg(socket, data.msg);
        roomHandler.newMsg(socket.roomID);
        metrics.increment('message');

    });

    socket.on('base64 file', function (data) {

        adminHandler.log('received base64 file from ' + socket.username, socket.roomID);

        fileHandler.receiveFile(socket, data.file, data.fileName);

        io.in(socket.roomID).emit('base64 file',

            {
              username: socket.username,
              file: data.file,
              fileName: data.fileName,
              sender: socket.user.id
            }
        );
        metrics.increment('send_file');
    });

    // when the client emits 'typing', we broadcast it to others
    socket.on('typing', function (data) {

        io.in(socket.roomID).emit('typing', { username: data.username });
        metrics.increment('typing');
    });

    // when the client emits 'stop typing', we broadcast it to others
    socket.on('stop typing', function (data) {
    
        io.in(socket.roomID).emit('stop typing', { username: data.username });
        metrics.increment('typing_stop');
    });
    metrics.increment('connection');
});
