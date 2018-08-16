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
	var randMsgIndex = Math.floor(Math.random() * messages.length);
	var msg = messages[randMsgIndex];

	var userId = 'bot-' + Math.floor(Math.random() * 100);

	socket.emit('new message', {
		username: '',
		message: msg,
		sender: userId
	});
}
chatbot.sendMsg = sendMsg;

module.exports = chatbot;



