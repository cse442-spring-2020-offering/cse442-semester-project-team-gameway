<!--Constants-->
const express = require('express');
const session = require('express-session');
const mysql = require('mysql');
const pageRouter = require('./routes/pages');
const fileRouter = require('./routes/files');
const gameRoomRouter = require('./routes/game-room');
const databaseRouter = require('./routes/database');
const app = express();
var serv = require('http').Server(app);

const bodyParser = require('body-parser');
const urlencodedParser = bodyParser.urlencoded({ extended: false });

<!--START WEBSITE-->
serv.listen('3000', () => {
    console.log('Server Started on Port 3000')
});
<!--End Of Website-->


<!--Database Connection-->
var db = mysql.createConnection({
    host: "tethys.cse.buffalo.edu",
    user: "plrobert",
    password: "50227586",
    multipleStatements: true
});

<!--Connecting To Database-->
db.connect((err) =>{
    if(err) throw err;
});

<!--Body Parser-->
app.use(urlencodedParser);

<!--Setting View Engine-->
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

<!--Session-->
app.use(session({
    secret:'login-session',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 60 * 1000 * 30
    }
}));

<!--Start Routing-->
// Serve Static Files
app.use(express.static(path.join(__dirname, 'client')));
// Serve Pages
app.use(pageRouter);
// Serve Files
app.use(fileRouter);
// Serve Game Rooms
app.use(gameRoomRouter);
// Serve Database
app.use(databaseRouter);
// Error Handling
app.use((req, res, next) => {
    var err = new Error('Page not found');
    err.status = 404;
    next(err);
});
app.use((err, req, res, next) =>{
    res.status(err.status || 500);
    res.send(err.message);
});
<!--End Routing-->

//Game
var gameEnd = false;
var SOCKET_LIST = {};

var Entity = function(){
    var self = {
        x:250,
        y:250,
        spdX:0,
        spdY:0,
        id:"",
    }
    self.update = function(){
        self.updatePosition();
    }
    self.updatePosition = function(){
        self.x += self.spdX;
        self.y += self.spdY;
    }
    self.getDistance = function(pt){
        return Math.sqrt(Math.pow(self.x-pt.x,2) + Math.pow(self.y-pt.y,2));
    }
    return self;
}

var Player = function(id){
    var self = Entity();
    self.id = id;
    self.number = "" + Math.floor(10 * Math.random());
    self.pressingRight = false;
    self.pressingLeft = false;
    self.pressingUp = false;
    self.pressingDown = false;
    self.pressingAttack = false;
    self.mouseAngle = 0;
    self.maxSpd = 10;
    self.hp = 10;
    self.hpMax = 10;
    self.score = 0;

    var super_update = self.update;
    self.update = function(){
        self.updateSpd();
        super_update();

        if(self.pressingAttack){
            self.shootBullet(self.mouseAngle);
        }
    }
    self.shootBullet = function(angle){
        var b = Bullet(self.id,angle);
        b.x = self.x;
        b.y = self.y;
    }


    self.updateSpd = function(){
        if(self.pressingRight)
            self.spdX = self.maxSpd;
        else if(self.pressingLeft)
            self.spdX = -self.maxSpd;
        else
            self.spdX = 0;

        if(self.pressingUp)
            self.spdY = -self.maxSpd;
        else if(self.pressingDown)
            self.spdY = self.maxSpd;
        else
            self.spdY = 0;
    }

    self.getInitPack = function(){
        return {
            id:self.id,
            x:self.x,
            y:self.y,
            number:self.number,
            hp:self.hp,
            hpMax:self.hpMax,
            score:self.score,
        };
    }

    self.getUpdatePack = function(){
        return {
            id:self.id,
            x:self.x,
            y:self.y,
            hp:self.hp,
            score:self.score,
        }
    }

    Player.list[id] = self;

    initPack.player.push(self.getInitPack());
    return self;
}
Player.list = {};
Player.onConnect = function(socket){
    var player = Player(socket.id);
    socket.on('keyPress',function(data){
        if(data.inputId === 'left')
            player.pressingLeft = data.state;
        else if(data.inputId === 'right')
            player.pressingRight = data.state;
        else if(data.inputId === 'up')
            player.pressingUp = data.state;
        else if(data.inputId === 'down')
            player.pressingDown = data.state;
        else if(data.inputId === 'attack')
            player.pressingAttack = data.state;
        else if(data.inputId === 'mouseAngle')
            player.mouseAngle = data.state;
    });

    socket.emit('init',{
        selfId:socket.id,
        player:Player.getAllInitPack(),
        bullet:Bullet.getAllInitPack(),
    })
}

Player.getAllInitPack = function(){
    var players = [];
    for(var i in Player.list)
        players.push(Player.list[i].getInitPack());
    return players;
}


Player.onDisconnect = function(socket){
    delete Player.list[socket.id];
    removePack.player.push(socket.id);
}
Player.update = function(){
    var pack = [];
    for(var i in Player.list){
        var player = Player.list[i];
        player.update();
        pack.push(player.getUpdatePack());
    }
    return pack;
}


var Bullet = function(parent,angle){
    var self = Entity();
    self.id = Math.random();
    self.spdX = Math.cos(angle/180*Math.PI) * 10;
    self.spdY = Math.sin(angle/180*Math.PI) * 10;
    self.parent = parent;
    self.timer = 0;
    self.toRemove = false;
    var super_update = self.update;
    self.update = function(){
        if(self.timer++ > 100)
            self.toRemove = true;
        super_update();

        for(var i in Player.list){
            var p = Player.list[i];
            if(self.getDistance(p) < 32 && self.parent !== p.id){
                p.hp -= 1;

                if(p.hp <= 0){

                    var shooter = Player.list[self.parent];
                    if(shooter){
                        shooter.score += 1;
                    }

                    if (shooter.score == 3){
                        gameOver(shooter.id);
                        stopGame();
                        endGame();
                    }

                    self.toRemove == true;
                    p.hp = p.hpMax;
                    p.x = Math.random() * 500;
                    p.y = Math.random() * 500;


                }

                self.toRemove = true;
            }
        }
    }
    self.getInitPack = function(){
        return {
            id:self.id,
            x:self.x,
            y:self.y,
        };
    }

    self.getUpdatePack = function(){
        return {
            id:self.id,
            x:self.x,
            y:self.y,
        };
    }

    Bullet.list[self.id] = self;
    initPack.bullet.push(self.getInitPack());
    return self;
}
Bullet.list = {};

Bullet.update = function(){
    var pack = [];
    for(var i in Bullet.list) {
        var bullet = Bullet.list[i];
        bullet.update();
        if (bullet.toRemove){
            delete Bullet.list[i];
            removePack.bullet.push(bullet.id);
        } else
            pack.push(bullet.getUpdatePack());
    }
    return pack;
}

Bullet.getAllInitPack = function(){
    var bullets = [];
    for(var i in Bullet.list)
        bullets.push(Bullet.list[i].getInitPack());
    return bullets;
}


var io = require('socket.io')(serv,{});
io.sockets.on('connection', function(socket){
    socket.id = Math.random();
    SOCKET_LIST[socket.id] = socket;

    Player.onConnect(socket);

    socket.on('disconnect',function(){
        delete SOCKET_LIST[socket.id];
        Player.onDisconnect(socket);
    });

    socket.on('pauseTheGame',function(){
        startGame();
        console.log("Game has started.");
        console.log(gameEnd);
    });

});

var initPack = {player:[],bullet:[]};
var removePack = {player:[],bullet:[]};

setInterval(function(){
    if(gameEnd == true){
        for(var i in Player.list){
            Player.list[i].score = 0;
        }
        endGame();
    }

    var pack = {
        player:Player.update(),
        bullet:Bullet.update(),
    }

    for(var i in SOCKET_LIST){
        var socket = SOCKET_LIST[i];
        socket.emit('init',initPack);
        socket.emit('update',pack);
        socket.emit('remove',removePack);
    }
    initPack.player = [];
    initPack.bullet = [];
    removePack.player = [];
    removePack.bullet = [];
},1000/25);


function gameOver(id) {
    for(var i in SOCKET_LIST) {
        var socket = SOCKET_LIST[i];
        socket.emit('gameOver', id);
    }
}

function startGame() {
    gameEnd = false;
}

function stopGame() {
    gameEnd = true;
}
function endGame() {
    if(gameEnd == true){
        setTimeout(function (){},1000/33);
    }
    console.log("Game has ended");
    console.log(gameEnd);
}