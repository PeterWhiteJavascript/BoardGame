$(function() {
var Q = window.Q = Quintus({audioSupported: ['mp3','ogg','wav']}) 
        .include("Sprites, Scenes, Input, 2D, Anim, Touch, UI, Audio, Game, Objects, Utility, Animations, Viewport, GameControl")
        .setup("quintus", {development:true, width:$("#content-container").width(), height:$("#content-container").height()})
        .touch()
        .controls(true)
        .enableSound();

Q.input.drawButtons = function(){};
Q.setImageSmoothing(false);

//Since this is a top-down game, there's no gravity
Q.gravityY = 0;

//Astar functions used for pathfinding
Q.astar = astar;
//A necessary component of Astar
Q.Graph = Graph;

//All data files stored here
let GDATA = {};

require(['socket.io/socket.io.js']);
Q.socket = io.connect();

Q.user = {};

//Once the connection has been made
Q.socket.on('connected', function (connectionData) {
    //let SEED = Math.seedrandom(connectionData.initialSeed);
    Q.user.id = connectionData.id;
    console.log("Player " + Q.user.id + " connected.");
    Q.user.gameRoom = connectionData.gameRoom;
    //Load the files that need to be loaded (this is found out server side)
    Q.load(connectionData.loadFiles.join(","),function(){
        Q.c = Q.assets["data/constants/data.json"];
        Q.setUpAnimations();
        
        Q.socket.on('updated', function (data) {

        });
        
        //This is the actual result of user actions.
        //Anything that is shown client side will be correct, unless the user is trying to cheat.
        //Override any changes with these values just in case.
        Q.socket.on("inputResult", function(data){
            console.log(data)
            switch(data.func){
                case "rollDie":
                    Q.GameController.startRollingDie(1, Q.GameState.turnOrder[0].sprite);
                    break;
                case "getDieRollToMovePlayer":
                    Q.GameController.stopDie(data.props.move);
                    //TODO: Once all dice are rolled, allow the player movement (right now it just does one die).
                    Q.GameController.allowPlayerMovement(data.props.move);
                    break;
                case "playerMovement":
                    let player = Q.GameController.getPlayer(data.playerId);
                    Q.GameController.movePlayer(player, {loc: data.props.locTo});
                    if(data.props.finish){
                        player.sprite.destroyArrows();
                        player.sprite.p.allowMovement = false;
                    }
                    break;
                //When going to the playerTurnMainMenu (also used when going back to it.)
                case "toPlayerTurnMainMenu":
                    let menuOptionSelected = data.props[0];
                    
                    break;
            }
        });
        
        Q.socket.emit("readyToStartGame");
        
        let users;
        Q.socket.on("usersReady", function(data){
            users = data.users;
            if(data.allReady){
                Q.stageScene("game", 0, {
                    mapData: Q.assets["data/maps/"+data.map], 
                    settings: data.settings, 
                    host: data.host,
                    users: users
                });
            }
        });
        
    });
});
//Q.debug = true;
});