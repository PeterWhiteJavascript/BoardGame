const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);
const seedrandom = require('seedrandom');
const fs = require('fs');

app.use(express.static(__dirname + '/public'));

app.get('/', function(req, res){
  res.render('/index.html');
});

let Quintus = require("./public/lib/quintus.js");

require("./public/lib/quintus_sprites.js")(Quintus);
require("./public/lib/quintus_scenes.js")(Quintus);
require("./public/lib/quintus_2d.js")(Quintus);
require("./public/js/game-control.js")(Quintus);
require("./public/js/utility.js")(Quintus);

//Constructor for server code (anything above "Game" level)
let Server = function(){
    this.userCount = 0;
    this.gameID = 0;
    this.userID = 0;
    
    this.filesFolder = 'public/';
    this.loadDirectories = ["audio", "data", "images"];
    this.loadFiles = this.loadAllGameFiles(this.loadDirectories, this.filesFolder);
    
    this.constants = JSON.parse(fs.readFileSync(this.filesFolder + "data/constants/data.json"));
    this.gameData = {};
};
Server.prototype.readDirectory = function(path, filesFolder){
    let files = [];
    fs.readdirSync(filesFolder + path).forEach(file => {
        //If path leads to antoher directory, look in that directory too
        if(fs.lstatSync(filesFolder + path + "/" + file).isDirectory()){
            this.readDirectory(path + "/" + file, filesFolder).forEach( f => {
                files.push(f);
            });
        } else {
            files.push(filesFolder + path + "/" + file);
        }
    });
    return files;
};
Server.prototype.loadAllGameFiles = function(directories, filesFolder){
    let loadFiles = [];
    directories.forEach(path => {
        this.readDirectory(path, filesFolder).forEach(file => {
            loadFiles.push(file.replace(filesFolder, ""));
        });
    });
    return loadFiles;
};
Server.prototype.createNewUser = function(p){
    let user = new User(p);
    this.userCount++;
    this.userID++;
    return user;
};
Server.prototype.addUserToGame = function(user, socket, room){
    if(!this.gameData[room]){
        this.gameData[room] = this.createNewGame({
            host: user,
            map: "example-map.json",
            settings:{
                mode: "ffa",
                numOfPlayers: 2
            }
        });
    } else {
        this.gameData[room].users.push(user);
    }
    socket.join(room);
    if(this.gameData[room].users.length === this.gameData[room].settings.numOfPlayers) this.gameID++;
    return this.gameData[room];
};
Server.prototype.createNewGame = function(p){
    let game = new Game(p);
    return game;
};

let User = function(p){
    this.id = serv.userID;
    this.ready = false;
    this.color = p.color || serv.constants.colors[~~(Math.random() * serv.constants.colors.length )];
    this.gameRoom = p.gameRoom;
};

//Constructor function for games (when a user is hosting a map, use the map settings as well as custom settings set by the host).
let Game = function(p){
    //Host is always first user.
    this.users = [
        p.host
    ];
    this.settings = p.settings;
    this.map = p.map;
    this.mapData = JSON.parse(fs.readFileSync(serv.filesFolder + "data/maps/" + this.map));
};

let serv = new Server();
let Q = new Quintus().include("Sprites, Scenes, 2D, GameControl, Utility");
Q.c = serv.constants;

io.on('connection', function (socket) {
    //TEMP: This connection should join a login room to start (or something like that)
    let user = serv.createNewUser({
        gameRoom: "room" + serv.gameID
    });
    //Adds the user to the game room. Creates a game if there isn't one available.
    let game = serv.addUserToGame(user, socket, user.gameRoom);
    //Confirm with the client that a connection has occured
    socket.emit("connected", {
        loadFiles: serv.loadFiles, 
        id: user.id, 
        gameRoom: user.gameRoom,
        initialSeed: game.initialSeed
    });
    //Once the game is full, all players will report back to the serv saying that they are ready to start the game.
    socket.on("readyToStartGame", function(data){
        user.ready = true;
        if(game.users.length === game.settings.numOfPlayers){
            //Check if all users are ready
            let allReady = game.users.every((user) => user.ready);
            //If all users are ready, start the game
            if(allReady){
                game.state = Q.GameController.setUpGameState({
                    mapData: game.mapData,
                    settings: game.settings,
                    users: game.users
                });
                console.log("Game started. This room uses the seed: " + game.state.initialSeed);
                io.in(user.gameRoom).emit("allUsersReady", {
                    allReady: allReady,
                    users: game.users,
                    map: game.map,
                    settings: game.settings,
                    turnOrder: game.state.turnOrder.map((player) => {return player.playerId;})
                });
                //Start the game by starting the first player's turn.
                Q.GameController.startTurn(game.state);
            }   
        }
    });
    
    socket.on('disconnect', function (data) {
        //TODO: figure out how to get the user id and game room of the disconnector and tell all users in that game that there was a disconnect.
        serv.userCount--;
        
        //TODO: allow for reconnecting to the game
        
        
    });
    
    socket.on("inputted", function(data){
        let response = Q.GameController.processInputs(game.state, data);
        if(response){
            io.in(user.gameRoom).emit("inputResult", {id: user.id, response: response});
        }
    });
});


server.listen(process.env.PORT || 5000);
console.log("Multiplayer app listening on port 5000");