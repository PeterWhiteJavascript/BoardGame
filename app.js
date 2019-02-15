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
            this.numOfPlayers = 1;//4
            break;
        case "custom":
            this.numOfPlayers = this.settings.numOfPlayers;
            break;
    }
    this.Q.c = constants;
    this.random = p.random;
    this.initialSeed = p.initialSeed;
    
}


io.on('connection', function (socket) {
    userCount++;
    id++;
    const gameRoom = "room" + gameID;
    //TEMP: This connection should join a login room to start (or something like that)
    socket.join(gameRoom);
    //This user information
    let user = {
        id: id,
        ready: false //Ready to start the game
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
            //This holds all of the options for the player turn main menu (roll, stocks, shops, view board, view standings, options, view map)
            case "playerTurnMainMenu":
                //For now, just send to dice roll when pressing confim from this state.
                if(data.input === "confirm"){
                    //TODO: send current selection.
                    io.in(gameRoom).emit("inputResult", {key: data.input, playerId: user.id, func: "rollDie", props: props});
                    Q.GameState.inputState = {func: "confirmMovementDieRoll"};
                }
                break;
            case "confirmMovementDieRoll":
                //Roll the die
                if(data.input === "confirm"){
                    let num = ~~(gameData[gameRoom].random() * Q.GameState.players[0].dieMax + 1 - Q.GameState.players[0].dieMin) + Q.GameState.players[0].dieMin;
                    Q.GameController.allowPlayerMovement(num);
                    props.move = num;
                    io.in(gameRoom).emit("inputResult", {key: data.input, playerId: user.id, func: "getDieRollToMovePlayer", props: props});
                    Q.GameState.inputState = {func: "playerMovement"};
                } 
                //Go back to the main menu
                else if(data.input === "back"){
                    props.num = 0;
                    io.in(gameRoom).emit("inputResult", {key: data.input, playerId: user.id, func: "toPlayerTurnMainMenu", props: props});
                    Q.GameState.inputState = {func: "playerTurnMainMenu"};
                }
                
                break;
            case "navigateMenu":
                props.result = Q.MenuController.processInput(data.input);
                if(props.result === true){
                    Q.GameState.inputState["confirmTrue"]();
                } else if(props.result === false){
                    Q.GameState.inputState["confirmFalse"]();
                }
                io.in(gameRoom).emit("inputResult", {key: data.input, playerId: user.id, func: "navigateMenu", props: props});
                
                break;
            //When the player is moving after the has been rolled
            case "playerMovement":
                let obj = Q.MapController.processPlayerMovement(data.input, user.id);
                if(obj){
                    props.input = data.input;
                    props.locTo = obj.loc;
                    if(obj.finish){
                        props.finish = obj.finish;
                        Q.GameState.inputState = {
                            func: "navigateMenu", 
                            confirmTrue: () => {
                                Q.GameController.playerConfirmMove(user.id);
                                Q.GameState.inputState = {func: "playerTurnMainMenu"};
                                io.in(gameRoom).emit("inputResult", {key: data.input, playerId: user.id, func: "playerConfirmMove", props: props});
                            }, 
                            confirmFalse: () => {
                                let loc = Q.GameController.playerGoBackMove(user.id);
                                Q.GameState.inputState = {func: "playerMovement"};
                                props.locTo = loc;
                                io.in(gameRoom).emit("inputResult", {key: data.input, playerId: user.id, func: "playerGoBackMove", props: props});
                            }
                        };
                        ////This is not added to any stage/scene since those don't exist on the server.
                        Q.MenuController.initializeTextPrompt(Q.MenuController.menus.text.endRollHere);
                    }
                    io.in(gameRoom).emit("inputResult", {key: data.input, playerId: user.id, func: "playerMovement", props: props});
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
            //Tell all users in this room that this users is ready.
            //When all users are ready, all users will load the map data locally.
            io.in(gameRoom).emit("usersReady", {
                allReady: allReady,
                users: gameData[gameRoom].users,
                map: gameData[gameRoom].map, 
                settings: gameData[gameRoom].settings
            });
            if(allReady){
                Q.GameState = gameData[gameRoom].Q.GameController.setUpGameState({
                    settings: gameData[gameRoom].settings, 
                    mapData: gameData[gameRoom].mapData,
                    users: gameData[gameRoom].users
                });
            }
        }
    });
    
    
});


server.listen(process.env.PORT || 5000);
console.log("Multiplayer app listening on port 5000");