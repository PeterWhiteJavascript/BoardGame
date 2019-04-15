const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);
const seedrandom = require('seedrandom');

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

let userCount = 0;
let id = 0;
let gameID = 0;

//Generate a list of all of the files that need to be loaded. 
//This list is sent to each client when they connect.
const fs = require('fs');

const filesFolder = 'public/';
const loadDirectories = ["audio", "data", "images"];
let loadFiles = [];
function readDirectory(path){
    let files = [];
    fs.readdirSync(filesFolder + path).forEach(file => {
        //If path leads to antoher directory, look in that directory too
        if(fs.lstatSync(filesFolder + path + "/" + file).isDirectory()){
            readDirectory(path + "/" + file).forEach( f => {
                files.push(f);
            });
        } else {
            files.push(filesFolder + path + "/" + file);
        }
    });
    return files;
}
loadDirectories.forEach(path => {
    readDirectory(path).forEach(file => {
        loadFiles.push(file.replace("public/", ""));
    });
});
//End generate list of files

//Contains all game constants set in data.json
const constants = JSON.parse(fs.readFileSync(filesFolder + "data/constants/data.json"));

//Object containing all game data for all rooms.
let gameData = {};

//Constructor function for games (when a user is hosting a map, use the map settings as well as custom settings set by the host).
function game(p){
    this.Q = new Quintus().include("Sprites, Scenes, 2D, GameControl, Utility");
    this.host = p.host;
    this.users = [
        this.host
    ];
    this.map = p.map;
    //Get the default data from the json file.
    this.mapData = JSON.parse(fs.readFileSync(filesFolder + "data/maps/" + this.map));
    this.settings = p.settings;
    switch(this.settings.mode){
        case "ffa":
        case "timed":
        case "2v2":
            this.numOfPlayers = 2;//4
            break;
        case "custom":
            this.numOfPlayers = this.settings.numOfPlayers;
            break;
    }
    this.Q.c = constants;
    this.random = p.random;
    this.initialSeed = p.initialSeed;
    
}

let colors = ["blue", "red", "yellow", "green", "cyan", "teal", "brown", "orange", "gold", "purple"];
io.on('connection', function (socket) {
    userCount++;
    id++;
    const gameRoom = "room" + gameID;
    //TEMP: This connection should join a login room to start (or something like that)
    socket.join(gameRoom);
    //This user information
    let user = {
        id: id,
        ready: false,
        color: colors[~~(Math.random() * colors.length )]
    };
    //Create a game if there is none in this room
    if(!gameData[gameRoom]){
        let randSeed = Math.random();
        //TODO: The game settings will be set in a game hosting UI on the client side. This code will obviously not run directly after connecting at that point.
        gameData[gameRoom] = new game({ 
            host: user,
            map: "example-map.json",
            random: new Math.seedrandom(randSeed),
            initialSeed: randSeed,
            settings: {
                mode: "ffa"
            }//Additional settings TODO WHEN UI IS CREATED FOR HOSTING GAME
        });
        console.log("New game room created. This room uses the seed: " + randSeed);
     } 
    //Add the user to the game.
    else {
        gameData[gameRoom].users.push(user);
    }
    let Q = gameData[gameRoom].Q;
    Q.random = gameData[gameRoom].random;
    
    socket.emit("connected", {loadFiles: loadFiles, id: id, gameRoom: gameRoom, users:gameData[gameRoom].users, initialSeed: gameData[gameRoom].initialSeed});
    
    socket.on('disconnect', function () {
        userCount--;
        //TODO: allow for reconnecting to the game
    });

    socket.on('update', function (data) {
        socket.broadcast.emit('updated', data);
    });
    
    //This function takes inputs from the client and processes them.
    socket.on("inputted", function(data){
        //TODO: using current game state, figure out what this input is for.
        //For now, move the player around.
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
                    //Use this when server response is required (random numbers)
                    if(props.self){
                        socket.emit("inputResult", {key: data.input, playerId: user.id, func: props.func, props: props});
                    }
                }
                break;
            case "controlNumberCycler":
                props = Q.MenuController.processNumberCyclerInput(data.input);
                if(props && props.func){
                    socket.broadcast.to(gameRoom).emit("inputResult", {key: data.input, playerId: user.id, func: props.func, props: props});
                    //Use this when server response is required (random numbers)
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
                        ////This is not added to any stage/scene since those don't exist on the server.
                        Q.MenuController.initializeMenu(Q.GameState.inputState);
                    }
                    socket.broadcast.to(gameRoom).emit("inputResult", {key: data.input, playerId: user.id, func: "playerMovement", props: props});
                }
                break;
        }
    });
    
    //This user is ready to start the game.
    socket.on("readyToStartGame", function(data){
        user.ready = true;
        if(gameData[gameRoom].users.length === gameData[gameRoom].numOfPlayers){
            gameID ++;
            //Check if all users are ready
            let allReady = gameData[gameRoom].users.every((user) => user.ready);
            if(allReady){
                Q.GameState = gameData[gameRoom].Q.GameController.setUpGameState({
                    settings: gameData[gameRoom].settings, 
                    mapData: gameData[gameRoom].mapData,
                    users: gameData[gameRoom].users
                });
                Q.GameState.turnOrder = Q.shuffleArray(Q.GameState.players);//Might need to shuffle this only on server...
                //There will be different animations, like for turn order, maybe showing the map, etc...
                //After the animations, show the playerTurnMenu on the first player and allow them to roll
                //Create the playerTurnMenu TEMP (need to do turn order first eventually)
                Q.MenuController.initializeMenu(Q.GameState.inputState);
                Q.GameController.startTurn();
                //Tell all users in this room that this user is ready.
                //When all users are ready, all users will load the map data locally.
                io.in(gameRoom).emit("usersReady", {
                    allReady: allReady,
                    users: gameData[gameRoom].users,
                    map: gameData[gameRoom].map, 
                    settings: gameData[gameRoom].settings,
                    turnOrder: Q.GameState.turnOrder.map((player) => {return player.playerId;})
                });
            }   
        }
    });
    
    
});


server.listen(process.env.PORT || 5000);
console.log("Multiplayer app listening on port 5000");