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
                case "makeMoveShopSelector":
                    Q.MenuController.makeMoveShopSelector(state, data.confirmType, data.backFunc, data.startPos);
                    break;
                case "processShopSelectorInput":
                    if(data.back){
                        state.inputState.goBack(state, state.inputState.backOption);
                    } else if(data.finish){
                        state.inputState.finish(state, Q.MapController.getTileAt(state, data.finish));
                    } else if(data.move){
                        state.shopSelector.moveTo(data.move[0], data.move[1]);
                    }
                    break;
                case "controlNumberCycler":
                    if(data.item){
                        state.currentItem = data.item;
                        state.currentCont.p.menuButtons[state.currentItem[0]][state.currentItem[1]].selected();
                    } else if(data.num >= 0){
                        state.itemGrid[state.currentItem[1]][state.currentItem[0]][0] = data.num;
                        state.currentCont.p.menuButtons[state.currentItem[0]][state.currentItem[1]].changeLabel(state.itemGrid[state.currentItem[1]][state.currentItem[0]][0]);
                        state.currentCont.trigger("adjustedNumber", state);
                    } else if(data.value >= 0){
                        Q.MenuController.setNumberCyclerValue(state, data.value);
                        state.currentCont.trigger("adjustedNumber", state);
                    }
                    break;
                case "finalizeInvestInShop":
                    Q.GameController.investInShop(state, data.investAmount);
                    Q.MenuController.makeMenu(state, "playerTurnMenu", [0, 0]);
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