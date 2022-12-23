import express from 'express';
import { Server as ServerSocket} from 'socket.io';
import http from 'http';
import cors from 'cors';
import morgan from 'morgan';
import { dataPositions } from './dataPositions.js';

const app = express();
const server = http.createServer(app);
const io = new ServerSocket(server, {
    cors: {
        origin: 'https://chess3dloop.netlify.app',
    }
});

app.get('/', (req, res) => {
    res.write('<h1>Chess backend is running</h1>');
    res.end();
});

app.use(cors());
app.use(morgan('dev'));

let users = [];
let rooms = [];

io.on('connection', (user) => {
    
    user.on('newUser', (data) => {
        let userConnect = false;
        console.log(users);
        user.emit('serverMsg', 'esperando pareja');
        const dataUser = {user: data, id: user.id, waiting: true, enemy: null, color: null, nameEnemy: '', room: false, pause: false, host: false};
        for (let i = 0; i < users.length; i++) {
            if (users[i].waiting && users[i].host === false) {
                user.join(`${users[i].id}${users[i].user}`);
                users[i].enemy = dataUser.id;
                users[i].room =  `${users[i].id}${users[i].user}`;
                users[i].color = 'white';
                users[i].nameEnemy = dataUser.user;
                users[i].waiting = false;
                dataUser.color = 'black';
                dataUser.room =  `${users[i].id}${users[i].user}`;
                dataUser.nameEnemy = users[i].user;
                dataUser.enemy = users[i].id;
                dataUser.waiting = false;
                const dataRoom = {user1: users[i], user2: dataUser, room: `${users[i].id}${users[i].user}`};
                rooms.push(dataRoom);
                io.to(`${users[i].id}${users[i].user}`).emit('setRoom', {
                    dataRoom,
                    dataPositions
                });
                io.to(users[i].id).emit('dataPlayer', {
                    user: users[i],
                    dataPositions,
                    enemy: dataUser
                });
                io.to(dataUser.id).emit('dataPlayer', {
                    user: dataUser,
                    dataPositions,
                    enemy: users[i]
                });
                userConnect = true;
            };
        };
        if (!userConnect) {
            dataUser.room = `${user.id}${data}`;
            user.join(`${user.id}${data}`);
            user.emit('serverRoom', `sala creada ${dataUser.user}`);
        }

        users.push(dataUser);
    });

    user.on('disconnect', () => {
        const userData = users.findIndex((element) => element.id === user.id);
        if (userData >= 0 && users[userData].enemy && users[userData].pause === false) {
            const colorWin = users[userData].color === 'white' ? 'black' : 'white';
            io.to(users[userData].enemy).emit('leaveServer', colorWin);
            const indexRoom = rooms.findIndex((element) => element.room === users[userData].room);
            const indexEnemy = users.findIndex((element) => element.id === users[userData].enemy);
            if (users[indexEnemy]) {
                users[indexEnemy].enemy = null;
                users[indexEnemy].nameEnemy = '';
                users[indexEnemy].color = null;
                users[indexEnemy].room = false;
                users[indexEnemy].pause = true;
                users[indexEnemy].host = false;
            };

            rooms.splice(indexRoom, 1);
            if (users[userData].room) {
                user.leave(users[userData].room);
            }
            users.splice(userData, 1);
        } else if (userData >= 0) {
            users.splice(userData, 1);
        }
    });

    user.on('moveClient', (data) => {
        const userData = users.find((element) => element.id === user.id);
        io.to(userData.enemy).emit('moveServer', data.data);
    });

    user.on('killClient', (data) => {
        const userData = users.find((element) => element.id === user.id);
        io.to(userData.enemy).emit('killServer', data.data);
    });

    user.on('checkmate1', (data) => {
        const userData = users.find((element) => element.id === user.id);
        io.to(userData.enemy).emit('checkmateServer', data.data);
    });

    user.on('checkmate2', (data) => {
        const dataUser = users.findIndex((element) => element.id === user.id);
        const indexEnemy = users.findIndex((element) => element.id === users[dataUser].enemy);
        user.leave(users[dataUser].room);
        io.sockets.sockets.forEach((socket) => {
            if(socket.id === users[indexEnemy].id)
                socket.leave(users[indexEnemy].room);
        });
        io.to(users[indexEnemy].id).emit('checkmate2Server', data.data);
        if (users[dataUser].host === false) {
            users[dataUser].enemy = null;
            users[dataUser].nameEnemy = '';
            users[dataUser].color = null;
            users[dataUser].room = false;
            users[dataUser].pause = true; 
            users[indexEnemy].enemy = null;
            users[indexEnemy].nameEnemy = '';
            users[indexEnemy].color = null;
            users[indexEnemy].room = false;
            users[indexEnemy].pause = true;
        } else {
            users[dataUser].pause = true;
            users[indexEnemy].pause = true;
        }
    });

    user.on('promPawn', (data) => {
        const userData = users.findIndex((element) => element.id === user.id);
        io.to(userData.enemy).emit('promPawnServer', data.data);
    });

    user.on('playAgain', (data) => {
        const userData = users.findIndex((element) => element.id === user.id);
        if (users[userData].host === false) {
            let userConnect = false;
            users.forEach((element, index) => {
                if (element.waiting && element.id !== users[userData].id && element.room && element.host === false) {
                    user.join(element.room);
                    users[index].waiting = false;
                    users[index].enemy = users[userData].id;
                    users[index].color = 'white';
                    users[index].nameEnemy = users[userData].user;
                    users[index].pause = false;
                    users[userData].waiting = false;
                    users[userData].enemy = users[index].id;
                    users[userData].color = 'black';
                    users[userData].nameEnemy = users[index].user;
                    users[userData].room = users[index].room;
                    users[userData].pause = false;
                    const dataRoom = {user1: users[index], user2: users[userData], room: users[index].room};
                    rooms.push(dataRoom);
                    io.to(users[index].room).emit('setRoom', {
                        dataRoom,
                        dataPositions
                    });
                    io.to(users[index].id).emit('dataPlayer', {
                        user: users[index],
                        dataPositions,
                        enemy: users[userData]
                    });
                    io.to(users[userData].id).emit('dataPlayer', {
                        user: users[userData],
                        dataPositions,
                        enemy: users[index]
                    });
                    userConnect = true;
                }
            });

            if (!userConnect) {
                users[userData].waiting = true;
                user.join(`${users[userData].id}${users[userData].user}`);
                users[userData].room = `${users[userData].id}${users[userData].user}`;
            }
        } else {
            users[userData].pause = false;
            const indexEnemy = users.findIndex((element) => element.id === users[userData].enemy);
            if (users[indexEnemy] && users[indexEnemy].pause === false) {
                user.join(users[userData].host);
                io.sockets.sockets.forEach((socket) => {
                    if (socket.id === users[indexEnemy].id) {
                        socket.join(users[userData].host);
                    }
                });
                const color1 = Math.round(Math.random() * 2) === 1 ? 'white' : 'black';
                const color2 = color1 === 'white' ? 'black' : 'white';
                users[userData].color = color1;
                users[indexEnemy].color = color2;
                const dataRoom = {user1: users[userData], user2: users[indexEnemy], room: users[userData].host};
                io.to(users[userData].room).emit('setRoom', {
                    dataRoom,
                    dataPositions
                });
                io.to(users[userData].id).emit('dataPlayer', {
                    user: users[userData],
                    dataPositions,
                    enemy: users[indexEnemy]
                });
                io.to(users[indexEnemy].id).emit('dataPlayer', {
                    user: users[indexEnemy],
                    dataPositions,
                    enemy: users[userData]
                });
            } else if (!users[indexEnemy]) {
                user.emit('noPlayer', 'Your opponent has exited the game');
            }
        }
    });

    user.on('createRoom', (data) => {
        const numberRoom = Math.round(Math.random() * (9000 - 1000) + 1000);
        const room = `${data}${numberRoom}`;
        const dataUser = {user: data, id: user.id, waiting: true, enemy: null, color: null, nameEnemy: '', room: false, pause: false, host: room};
        user.emit('serverRoom', `sala creada ${dataUser.user}`);
        user.join(room);
        user.emit('numberRoom', dataUser);
        users.push(dataUser);
    });

    user.on('joinRoom', (data) => {
        let findUser = false;
        users.forEach((userData, index) => {
            if (userData.host === data.room && userData.waiting) {
                findUser = index;
            }
        });
        if (findUser === false) {
            user.emit('noRoom', 'The room does not exist');
        } else {
            user.join(users[findUser].host);
            const color1 = Math.round(Math.random() * 2) === 1 ? 'white' : 'black';
            const color2 = color1 === 'white' ? 'black' : 'white';
            const dataUser = {user: data.name, id: user.id, waiting: false, enemy: users[findUser].id, color: color1, nameEnemy: users[findUser].user, room: users[findUser].host, pause: false, host: users[findUser].host};
            users[findUser].waiting = false;
            users[findUser].enemy = dataUser.id;
            users[findUser].color = color2;
            users[findUser].nameEnemy = dataUser.user;
            users[findUser].room = dataUser.room;
            users.push(dataUser);
            const dataRoom = {user1: users[findUser], user2: dataUser, room: users[findUser].host};
            rooms.push(dataRoom);
            io.to(users[findUser].room).emit('setRoom', {
                dataRoom,
                dataPositions
            });
            io.to(users[findUser].id).emit('dataPlayer', {
                user: users[findUser],
                dataPositions,
                enemy: dataUser
            });
            io.to(dataUser.id).emit('dataPlayer', {
                user: dataUser,
                dataPositions,
                enemy: users[findUser]
            });
        }
    });

    user.on('reset', () => {
        const userData = users.findIndex((element) => element.id === user.id);
        users.splice(userData, 1);
    });

    user.on('leave', () => {
        const userData = users.findIndex((element) => element.id === user.id);
        const colorWin = users[userData].color === 'white' ? 'black' : 'white';
        io.to(users[userData].enemy).emit('leaveServer', colorWin);
        const indexRoom = rooms.findIndex((element) => element.room === users[userData].room);
        const indexEnemy = users.findIndex((element) => element.id === users[userData].enemy);
        users[indexEnemy].enemy = null;
        users[indexEnemy].nameEnemy = '';
        users[indexEnemy].color = null;
        users[indexEnemy].room = false;
        users[indexEnemy].pause = true;
        rooms.splice(indexRoom, 1);
        if (users[userData].room) {
            user.leave(users[userData].room);
        }
        users.splice(userData, 1);
    });
});

server.listen(4000);
console.log('server running on port 4000');
