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
            console.log(data)
            switch(data.func){
                case "processShopSelectorInput":
                    Q.MenuController.processShopSelectorInput(data.props.input);
                    break;
                case "controlNumberCycler":
                    Q.MenuController.processNumberCyclerInput(data.props.input);
                    break;
                case "makeMoveShopSelector":
                    Q.MenuController.turnOffStandardInputs();
                    Q.MenuController.makeMoveShopSelector(data.props.confirmFunc, data.props.backFunc, data.props.startPos);
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
                    data.func = "loadOptionsMenu";
                    data.props.menu = "playerTurnMenu";
                    data.props.selected = [0, 0];
                    Q.processInputResult(data);
                    break;
                case "playerMovement":
                    //If there are dice showing, remove them.
                    if(Q.GameController.dice) Q.GameController.removeDice();
                    Q.GameController.playerMovement(data.key, data.playerId);
                    break;
                case "loadOptionsMenu":
                    Q.MenuController.makeMenu(data.props.menu, data.props.selected);
                    break;
                case "navigateMenu":
                    let pos = data.props.pos.item;
                    Q.MenuController.currentItem = pos;
                    Q.MenuController.currentCont.p.menuButtons[Q.MenuController.currentItem[1]][Q.MenuController.currentItem[0]].hover();
                    break;
                //If the player says yes to ending their move here.
                case "playerConfirmMove":
                    Q.GameController.playerConfirmMove(data.playerId);
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
                    Q.MenuController.turnOffStandardInputs();
                    Q.GameController.playerGoBackMove(data.playerId);
                    break;
                case "goBackMenu":
                    Q.GameState.inputState.goBack();
                    break;
                case "purchaseSet":
                    if(data.props.num >= 0){
                        Q.GameController.purchaseSet(data.props.num, data.props.playerId);
                    }
                    Q.MenuController.turnOffStandardInputs();
                    if(data.props.finish){
                        Q.GameController.askFinishMove(Q.GameController.getPlayer(data.props.playerId));
                    }
                    break;
                case "purchaseSetItem":
                    if(data.props.loc){
                        Q.GameController.purchaseSetItem(data.props.loc, data.props.playerId);
                    } 
                    Q.MenuController.turnOffStandardInputs();
                    if(data.props.finish){
                        Q.GameController.askFinishMove(Q.GameController.getPlayer(data.props.playerId));
                    }
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