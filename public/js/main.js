$(function() {
var Q = window.Q = Quintus({audioSupported: ['mp3','ogg','wav']}) 
        .include("Sprites, Scenes, Input, 2D, Anim, Touch, UI, Audio, Game, Objects, Utility, Animations")
        .setup("quintus", {development:true, width:$("#content-container").width(), height:$("#content-container").height()})
        .touch()
        .controls(true)
        .enableSound();

Q.input.drawButtons = function(){};
Q.setImageSmoothing(false);

//Since this is a top-down game, there's no gravity
Q.gravityY = 0;
//The width of a tile on the grid (properties/shop tiles are 2x2)
Q.tileW = 64;
//The height of the tiles
Q.tileH = 48;
//Astar functions used for pathfinding
Q.astar = astar;
//A necessary component of Astar
Q.Graph = Graph;

//All data files stored here
let GDATA = {};
let SEED = Math.random();
console.log("This game is running off of initial seed " + SEED + ".");
Math.seedrandom();

require(['socket.io/socket.io.js']);
Q.socket = io.connect();
//Once the connection has been made
Q.socket.on('connected', function (connectionData) {
    //Load the files that need to be loaded (this is found out server side)
    Q.load(connectionData.loadFiles.join(","),function(){
        Q.MapController = new Q.mapController();
        Q.GameController = new Q.gameController();
        Q.setUpAnimations();
        
        Q.socket.on('updated', function (data) {

        });
        
        //This is the actual result of user actions.
        //Anything that is shown client side will be correct, unless the user is trying to cheat.
        //Override any changes with these values just in case.
        Q.socket.on("inputResult", function(data){

            console.log("You gamed a "+ data.key);
        });
        Q.stageScene("game", 0, {mapData: Q.assets["data/maps/example-map.json"]});
    });
});
//Q.debug = true;
});