"use strict";
var socketHandler = require('./socketHandler.js');
var utils = require('../utils/utils.js');

var usernameHandler = {};

// var onlineUsernames = {}; // this needs to be changed to honor rooms, not entire system

var roomsOfNames = {}; // a dict of usernamesInRoom

// This method must be called whenever we give out a username so we can 
// keep track of given usernames
// And before calling setUsername, always call checkUsername to get a unique name
function saveNameInRoom(name, roomID) {


    var namesInRoom = {};

    if (roomID in roomsOfNames)

        namesInRoom = roomsOfNames[roomID];

    else
        roomsOfNames[roomID] = namesInRoom;


    namesInRoom[name] = true;

}

// usernameHandler.setUsername = setUsername; //no need to expose this function

// this is called when 1. user left room 2. user change name
usernameHandler.releaseUsername = function (name, roomID) { 

    if (roomID in roomsOfNames) {

        var namesInRoom = roomsOfNames[roomID];

        if (name in namesInRoom)
            delete namesInRoom[name]; 
    }

    //TODO: delelte namesInRoom when there's 0 names left in room
};

// check if the username is used, if not return it
// if it's used, return a username not used by adding number
function checkUsername(name, roomID) {

    //add more filters here to sanitize user input, name change also goes through here
    if (name === '') name = 'no name'; 
    if (!(roomID in roomsOfNames)) return name;
    var namesInRoom = roomsOfNames[roomID];
    // DONT modify user's name!
    // if (name in namesInRoom){
    //     var num = 2;
    //     while (true) {
    //         var newName = name + '(' + num + ')';
    //         if (newName in namesInRoom)
    //             num ++;
    //         else{
    //             return newName;
    //         }
    //     }
    // }
    return name;
}

usernameHandler.checkUsername = checkUsername;

function registerUniqueName (client_requested_name, roomID) {
    // This is called when
    // 1. user first time enter a new room
    // 2. user change name
    var server_agreed_name = checkUsername(client_requested_name, roomID);
    saveNameInRoom(server_agreed_name, roomID);
    return server_agreed_name;
}

usernameHandler.registerUniqueName = registerUniqueName;

usernameHandler.getNamesInRoom = function (roomID) { return roomsOfNames[roomID]; };


function changeName(socket, newName, roomID) {
    // change current socket's name, also tell this
    // user's all socket in current room to change name

    // TBD: do we want to release the name as soon as user changes name?
    usernameHandler.releaseUsername(socket.username, roomID); 

    var approvedNewName = registerUniqueName(newName, roomID);


    var socketIDsToChangeName = socket.user.socketIDList;

    for (var i = 0; i< socketIDsToChangeName.length; i++) {
        var s = socketHandler.getSocket(socketIDsToChangeName[i]);
        if (s.roomID = roomID) {
    	   s.emit('change username', { username: approvedNewName });
           s.username = approvedNewName;
        }
    }
    

    return approvedNewName;
}

// usernameHandler.adminEditName = function(user, newName) {

//     // change name and sync name change
//     var oldName = user.username;

//     if (oldName === newName) return;

//     newName = changeName(user, newName);

//     var action = {};
//     action.type = 'Name Changed by Admin';
//     action.time = utils.getTime();
//     action.url = 'N/A';
//     action.detail = 'Changed name from ' + oldName + ' to ' + newName;
//     user.actionList.push(action);
// };

usernameHandler.userEditName = function(socket, newName) {
    var oldName = socket.username;
    newName = changeName(socket, newName, socket.roomID);

    var action = {};
    action.type = 'Change Name';
    action.time = utils.getTime();
    action.url = socket.url;
    action.detail = 'Changed name from ' + oldName + ' to ' + newName;
    socket.user.actionList.push(action);

};


module.exports = usernameHandler;