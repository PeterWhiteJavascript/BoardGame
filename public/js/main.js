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
        /*
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
                    Q.MenuController.makeMoveShopSelector(data.props.confirmType, data.props.backFunc, data.props.startPos);
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
            }
        };*/
        Q.applyInputResult = function(data){
            console.log(data);
            let state = Q.GameState;
            let player = Q.GameController.getPlayer(state, data.playerId);
            switch(data.func){
                case "navigateMenu":
                    Q.MenuController.setMenuPosition(state, data.item);
                    break;
                case "loadOptionsMenu":
                    Q.MenuController.makeMenu(state, data.menu, data.selected);
                    break;
                case "rollDie":
                    Q.GameController.startRollingDie(state, 1, player.sprite);
                    break;
                case "stopDieAndAllowMovement":
                    Q.GameController.stopDie(state, data.currentMovementNum);
                    Q.GameController.allowPlayerMovement(state, data.currentMovementNum);
                    break;
                case "removeDiceAndBackToPTM":
                    Q.GameController.removeDice(state);
                    Q.applyInputResult({func: "loadOptionsMenu", menu: "playerTurnMenu", selected: [0, 0]});
                    break;
                case "playerConfirmMove":
                    Q.GameController.playerConfirmMove(state, data.playerId);
                    break;
                case "playerMovement":
                    var tile = Q.MapController.getTileAt(state, data.loc);
                    Q.GameController.removeDice(state);
                    Q.GameController.tileDetails.displayShop(tile);
                    
                    if(data.direction === "forward"){
                        Q.GameController.movePlayer(player, tile);
                        state.currentMovementPath.push(tile);
                        Q.MapController.checkPassByTile(state, player, tile, data.finish);
                    } else if(data.direction === "back"){
                        Q.GameController.playerGoBackMove(state, player.playerId);
                    }
                    if(data.finish && !data.passBy){
                        Q.GameController.askFinishMove(state, player);
                    }
                    break;
                case "playerGoBackMove":
                    Q.clearStage(1);
                    data.func = "playerMovement";
                    player.sprite.showMovementDirections();
                    Q.GameController.playerGoBackMove(state, player.playerId);
                    break;
                case "purchaseSet":
                    Q.clearStage(1);
                    if(data.num >= 0){
                        Q.GameController.purchaseSet(state, data.num, data.playerId);
                    }
                    if(data.finish){
                        Q.GameController.askFinishMove(state, player);
                    }
                    break;
                case "purchaseSetItem":
                    Q.clearStage(1);
                    if(data.loc){
                        Q.GameController.purchaseSetItem(state, data.loc, data.playerId);
                    } 
                    if(data.finish){
                        Q.GameController.askFinishMove(state, player);
                    }
                    break;
                case "buyShop":
                    Q.GameController.buyShop(state, Q.GameController.getPlayer(state, data.playerId), Q.MapController.getTileAt(state, data.loc));
                    Q.GameController.endTurn(state);
                    break;
                case "buyOutShop":
                    Q.GameController.buyOutShop(state, Q.GameController.getPlayer(state, data.playerId), Q.MapController.getTileAt(state, data.loc));
                    Q.GameController.endTurn(state);
                    break;
                case "endTurn":
                    Q.GameController.endTurn(state);
                    break;
                case "goBackMenu":
                    Q.GameState.inputState.goBack(state);
                    break;
            }
        };
        Q.socket.on("inputResult", Q.applyInputResult);
        
        Q.socket.emit("readyToStartGame");
        Q.socket.on("allUsersReady", function(data){
            Q.stageScene("game", 0, {
                mapData: Q.assets["data/maps/"+data.map], 
                settings: data.settings, 
                host: data.host,
                users: data.users,
                turnOrder: data.turnOrder
            });
        });
        
    });
});
//Q.debug = true;
});