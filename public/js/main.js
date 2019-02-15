$(function() {
var Q = window.Q = Quintus({audioSupported: ['mp3','ogg','wav']}) 
        .include("Sprites, Scenes, Input, 2D, Anim, Touch, UI, Audio, Game, Objects, Utility, Animations, Viewport, GameControl, Music")
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
        
        Q.AudioController = new Q.audioController();
        Q.OptionsController = new Q.optionsController();
        Q.OptionsController.options = {
            menuColor: "white"
        };//GDATA.saveFiles["save-file1.json"].options;
        Q.TextProcessor = new Q.textProcessor();
        
        Q.c = Q.assets["data/constants/data.json"];
        Q.setUpAnimations();
        
        Q.socket.on('updated', function (data) {

        });
        
        //This is the actual result of user actions.
        //Anything that is shown client side will be correct, unless the user is trying to cheat.
        //Override any changes with these values just in case.
        Q.socket.on("inputResult", function(data){
            let player;
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
                    player = Q.GameController.getPlayer(data.playerId);
                    Q.GameController.movePlayer(player, {loc: data.props.locTo});
                    if(data.props.finish){
                        player.sprite.destroyArrows();
                        player.sprite.p.allowMovement = false;
                        //Create the "do you want to stop here" menu.
                        Q.stageScene("dialogue", 1, {dialogue: Q.MenuController.menus.text.endRollHere});
                        if(data.playerId === Q.user.id){
                            Q.MenuController.initializeTextPrompt(Q.MenuController.menus.text.endRollHere);
                            Q.stage(0).on("pressedInput", Q.MenuController, "processInput");
                            Q.stage(1).on("destroyed", function(){Q.stage(0).off("pressedInput", Q.MenuController, "processInput");});
                        }
                    }
                    break;
                //When going to the playerTurnMainMenu (also used when going back to it.)
                case "toPlayerTurnMainMenu":
                    let menuOptionSelected = data.props[0];
                    
                    break;
                //TODO: move the cursor up/down/whatever in the menu
                case "navigateMenu":
                    if(Array.isArray(data.props.result)){
                        //Q.MenuController.currentCont.p.menuButtons[data.props.result[1]][data.props.result[0]].hover();
                    }
                    console.log(Q.MenuController)
                    break;
                //If the player sey yes to ending their move here.
                case "playerConfirmMove":
                    // TODO: on tile effects.
                    
                    
                    Q.clearStage(1);
                    break;
                //If the player says they don't want to end their move here.
                case "playerGoBackMove":
                    Q.GameState.currentMovementPath.pop();
                    player = Q.GameController.getPlayer(data.playerId);
                    player.sprite.p.allowMovement = true;
                    Q.GameController.movePlayer(player, {loc: data.props.locTo});
                    Q.clearStage(1);
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