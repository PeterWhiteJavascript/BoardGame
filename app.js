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
                numOfPlayers: 1
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

//Take all input from users and figure out what to do with them.
Game.prototype.processInput = function(input){
    
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
    /*
    socket.on('update', function (data) {
        socket.broadcast.emit('updated', data);
    });*/
    
    socket.on("inputted", function(data){
        let response = Q.GameController.processInput(game.state, data.input);
        if(response){
            response.playerId = user.id;
            io.in(user.gameRoom).emit("inputResult", response);
        }
    });
    
    /*
    //This function takes inputs from the client and processes them.
    socket.on("inputted", function(data){
        
        
        let props = {};
        switch(Q.GameState.inputState.func){
            case "moveShopSelector":
                props = Q.MenuController.processShopSelectorInput(data.input);
                if(props && props.func){
                    socket.broadcast.to(gameRoom).emit("inputResult", {key: data.input, playerId: user.id, func: props.func, props: props});
                }
                break;
            case "rollDie":
                //Roll the die
                if(data.input === "confirm"){
                    let num = Q.GameState.currentMovementNum;
                    Q.GameController.allowPlayerMovement(num);
                    props.move = num;
                    socket.broadcast.to(gameRoom).emit("inputResult", {key: data.input, playerId: user.id, func: "stopDieAndAllowMovement", props: props});
                    Q.GameState.inputState = {func: "playerMovement"};
                } 
                //Go back to the main menu
                else if(data.input === "back"){
                    props.num = 0;
                    socket.broadcast.to(gameRoom).emit("inputResult", {key: data.input, playerId: user.id, func: "removeDiceAndBackToPTM", props: props});
                    Q.GameState.inputState = Q.MenuController.inputStates.playerTurnMenu;
                    Q.MenuController.initializeMenu(Q.GameState.inputState);
                }
                
                break;
            case "navigateMenu":
                props = Q.MenuController.processInput(data.input);
                if(props && props.func){
                    socket.broadcast.to(gameRoom).emit("inputResult", {key: data.input, playerId: user.id, func: props.func, props: props});
                    //Use this when serv response is required (random numbers)
                    if(props.self){
                        socket.emit("inputResult", {key: data.input, playerId: user.id, func: props.func, props: props});
                    }
                }
                break;
            case "controlNumberCycler":
                props = Q.MenuController.processNumberCyclerInput(data.input);
                if(props && props.func){
                    socket.broadcast.to(gameRoom).emit("inputResult", {key: data.input, playerId: user.id, func: props.func, props: props});
                    //Use this when serv response is required (random numbers)
                    if(props.self){
                        socket.emit("inputResult", {key: data.input, playerId: user.id, func: props.func, props: props});
                    }
                }
                break;
            //When the player is moving after the has been rolled
            case "playerMovement":
                let obj = Q.MapController.processPlayerMovement(data.input, user.id);
                if(obj){
                    props.input = data.input;
                    props.locTo = obj.loc;
                    if(obj.finish && !obj.passBy){
                        props.finish = obj.finish;
                        Q.GameState.inputState = Q.MenuController.inputStates.menuMovePlayer;
                        ////This is not added to any stage/scene since those don't exist on the serv.
                        Q.MenuController.initializeMenu(Q.GameState.inputState);
                    }
                    socket.broadcast.to(gameRoom).emit("inputResult", {key: data.input, playerId: user.id, func: "playerMovement", props: props});
                }
                break;
        }
    });
    */
});


server.listen(process.env.PORT || 5000);
console.log("Multiplayer app listening on port 5000");