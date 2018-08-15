"use strict";

var messages = [
	'Is anyone here?',
	'LOL',
	'Hi there, small world!',
	"Wow, this is cooool!",
	'Hey, how are you!'
]



var chatbot = {}

function sendMsg(socket) {
	if (!socket) return;
	var rand = Math.floor(Math.random() * messages.length);
	var msg = messages[rand];
	socket.emit('new message', {
		username: 'Linda',
		message: msg,
		sender: 'bot-linda'
	});
}
chatbot.sendMsg = sendMsg;

module.exports = chatbot;



