"use strict";

var md5 = require('../utils/md5.js');
var socketHandler = require('./socketHandler.js');

var DEFAULT_ROOM = 'Lobby';
var roomHandler = {};
var roomDict = {}; // Holds a dictionary of roomIDs


// Room Model
// room.id = roomID;
// room.createTime = (new Date()).toString();
// room.userDict = {};
// room.userCount = 0; ???
// room.totalUsers = 0; ???
// room.totalSockets = 0;
// room.totalMsg = 0;
// room.adminUserDict = {};


//TODO: add back md5.encode(inToken)
roomHandler.validToken = function (inToken) {

    var roomID = md5.encode(inToken);

    return roomID in roomDict;
};

roomHandler.addAdmin = function (inToken, userID) {
    
    var roomID = md5.encode(inToken);

    roomDict[roomID].adminUserDict[userID] = true;
    
};

roomHandler.getAdmins = function (roomID) {
    return roomDict[roomID].adminUserDict;
};

//TODO: add back md5.encode(inToken)
roomHandler.getUsersInRoom = function(inToken) {

    return roomDict[md5.encode(inToken)].userDict;
};


// Check if the socket's user already in the room
roomHandler.socketJoin = function(socket, roomID) {

    // Check if room exist, if not create new room
    // Check if user already has other socket in this room

    var user = socket.user;
    var isNewUserOfRoom = true;

    var room = null;

    if (roomID in roomDict)

        room = roomDict[roomID];

    else

        room = createRoom(roomID); 

    room.totalSockets ++;

    if (user.id in room.userDict) {

        isNewUserOfRoom = false;

    }


    room.userDict[user.id] = user;
    // user.roomID = roomID;  Wrong! user can have multiple rooms  

    socket.join(roomID);
    socket.roomID = roomID;

    return isNewUserOfRoom;
    
};

roomHandler.socketLeftRoom = function(socket) {

    var room = roomDict[socket.roomID];
    var user = socket.user;

    var last_socket_in_this_room = true;
    var i = 0;
    for (; i<user.socketIDList.length; i++) {
        var s = socketHandler.getSocket(user.socketIDList[i]);
        if (s.id != socket.id && s.roomID == socket.roomID) {
            last_socket_in_this_room = false;
            break;
        }
    }
    
    if (last_socket_in_this_room) {
        delete room.userDict[socket.user.id];
        // delete room.adminUserDict[user.id];
        room.userCount--;
    }

    // May not want to delete the room, we'll lose the total user count and message count
    if (room.userCount === 0)
        delete roomDict[roomID];

    return last_socket_in_this_room;

};

roomHandler.newMsg = function (roomID) {
    roomDict[roomID].totalMsg++;
};

roomHandler.getRoomInfo = function(inToken) {

    var room = roomDict[md5.encode(inToken)];

    return {

        createTime: room.createTime,
        totalUsers: room.totalUsers,
        totalSockets: room.totalSockets,
        totalMsg: room.totalMsg

    };
};


function createRoom(roomID) {

    if (roomID in roomDict)
        return roomDict[roomID];

    var room = {};
    room.id = roomID;
    room.createTime = (new Date()).toString();
    room.userDict = {};
    room.userCount = 0;
    room.totalUsers = 0;
    room.totalSockets = 0;
    room.totalMsg = 0;
    room.adminUserDict = {};
    roomDict[roomID] = room;

    return room;
}


module.exports = roomHandler;