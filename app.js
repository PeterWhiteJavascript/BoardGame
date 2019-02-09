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
    this.Q.c = constants;
    this.seed = p.seed;
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
            seed: seedrandom(randSeed),
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
    
    socket.on("inputted", function(data){
        //TODO: using current game state, figure out what this input is for.
        //For now, move the player around.
        Q.MapController.processPlayerMovement(data.input, user.id);
        
        io.in(gameRoom).emit("inputResult", {key: data.input, playerId: user.id, func: "playerMovement", props: [data.input]});
    });
    
    //This user is ready to start the game.
    socket.on("readyToStartGame", function(data){
        user.ready = true;
        if(gameData[gameRoom].users.length === 2){
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


server.listen(80);
console.log("Multiplayer app listening on port 80");