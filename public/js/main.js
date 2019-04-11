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
            menuColor: "#111",
            textColor: "#EEE",
            musicEnabled: false,
            musicVolume: 0.1,
            soundEnabled: false,
            soundVolume: 0.1
        };//GDATA.saveFiles["save-file1.json"].options;
        
        Q.c = Q.assets["data/constants/data.json"];
        Q.setUpAnimations();
        
        Q.socket.on('updated', function (data) {

        });
        
        //This is the actual result of user actions, shown on all clients except the one who did the action
        Q.processInputResult = function(data){
            let player;
            switch(data.func){
                case "turnOffShopInputs":
                    
                    break;
                case "moveShopSelectorResult":
                    console.log(data)
                    break;
                case "rollDie":
                    Q.GameState.currentMovementNum = data.props.roll;
                    Q.GameController.startRollingDie(1, Q.GameState.turnOrder[0].sprite);
                    break;
                case "stopDieAndAllowMovement":
                    Q.GameController.stopDie(data.props.move);
                    //TODO: Once all dice are rolled, allow the player movement (right now it just does one die).
                    Q.GameController.allowPlayerMovement(data.props.move);
                    break;
                case "removeDiceAndBackToPTM":
                    Q.GameController.removeDice();
                    data.func = "toPlayerTurnMainMenu";
                    Q.processInputResult(data);
                    break;
                case "playerMovement":
                    //If there are dice showing, remove them.
                    if(Q.GameController.dice) Q.GameController.removeDice();
                    
                    player = Q.GameController.getPlayer(data.playerId);
                    Q.GameController.movePlayer(player, {loc: data.props.locTo});
                    //Show the tile props in a menu
                    Q.stage(2).hoverShop(Q.MapController.getTileAt(data.props.locTo));
                    
                    //Check the passby
                    Q.MapController.checkPassByTile(player, data.props.locTo, data.props.finish);
                    
                    if(data.props.finish && !data.props.passBy){
                        Q.GameController.askFinishMove(player);
                    }
                    break;
                //When going to the playerTurnMainMenu (also used when going back to it.)
                case "toPlayerTurnMainMenu":
                    Q.GameState.inputState = Q.MenuController.inputStates.playerTurnMenu;
                    let menuOptionSelected = data.props.selected;
                    Q.MenuController.initializeMenu(Q.GameState.inputState);
                    Q.stageScene("menu", 1, {menu: Q.GameState.inputState, selected: menuOptionSelected, options: Q.MenuController.itemGrid});
                    Q.MenuController.turnOnStandardInputs();
                    
                    break;
                //TODO: move the cursor up/down/whatever in the menu
                case "navigateMenu":
                    let pos = data.props.pos.item;
                    Q.MenuController.currentItem = pos;
                    Q.MenuController.currentCont.p.menuButtons[Q.MenuController.currentItem[1]][Q.MenuController.currentItem[0]].hover();
                    break;
                //If the player says yes to ending their move here.
                case "playerConfirmMove":
                    Q.clearStage(1);
                    Q.GameController.playerConfirmMove(Q.GameState.turnOrder[0].playerId);
                    break;
                case "buyShop":
                    Q.GameController.buyShop(Q.GameController.getPlayer(data.playerId), Q.MapController.getTileAt(data.props.shopLoc));
                    Q.GameController.endTurn();
                    break;
                case "buyOutShop":
                    Q.GameController.buyOutShop(Q.GameController.getPlayer(data.playerId), Q.MapController.getTileAt(data.props.shopLoc));
                    Q.GameController.endTurn();
                    break;
                case "endTurn":
                    Q.GameController.endTurn();
                    break;
                //If the player says they don't want to end their move here.
                case "playerGoBackMove":
                    player = Q.GameController.getPlayer(data.playerId);
                    player.sprite.p.allowMovement = true;
                    Q.GameController.movePlayer(player, {loc: data.props.locTo});
                    //Show the tile props in a menu
                    Q.stage(2).hoverShop(Q.MapController.getTileAt(data.props.locTo));
                    
                    Q.clearStage(1);
                    break;
                case "goBackMenu":
                    Q.GameState.inputState.goBack();
                    break;
            }
        };
        Q.socket.on("inputResult", Q.processInputResult);
        
        Q.socket.emit("readyToStartGame");
        
        let users;
        Q.socket.on("usersReady", function(data){
            users = data.users;
            if(data.allReady){
                Q.stageScene("game", 0, {
                    mapData: Q.assets["data/maps/"+data.map], 
                    settings: data.settings, 
                    host: data.host,
                    users: users,
                    turnOrder: data.turnOrder
                });
            }
        });
        
    });
});
//Q.debug = true;
});