var camera, scene, renderer;
var geometry, material, mesh;

init();
animate();

function init() {

    camera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 0.01, 10 );
    camera.position.z = 1;

    scene = new THREE.Scene();

    geometry = new THREE.BoxGeometry( 0.2, 0.2, 0.2 );
    material = new THREE.MeshNormalMaterial();

    mesh = new THREE.Mesh( geometry, material );
    scene.add( mesh );

    renderer = new THREE.WebGLRenderer( { antialias: true } );
    renderer.setSize( window.innerWidth, window.innerHeight );
    document.body.appendChild( renderer.domElement );

}

function animate() {

    requestAnimationFrame( animate );

    mesh.rotation.x += 0.01;
    mesh.rotation.y += 0.02;

    renderer.render( scene, camera );

}

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
            soundEnabled: true,
            soundVolume: 1
        };//GDATA.saveFiles["save-file1.json"].options;
        
        
        Q.c = Q.assets["data/constants/data.json"];
        Q.setUpAnimations();
        Q.applyInputResult = function(data){
            console.log(data)
            let state = Q.GameState;
            state.currentId = data.id;
            let player = Q.GameController.getPlayer(state, data.id);
            if(!Array.isArray(data.response)) data.response = [data.response];
            //data.response is an array of functions along with arguments that should be run.
            data.response.forEach((r) => {
                let func = r.func;
                switch(func){
                    case "removeItem":
                        switch(r.item){
                            case "shopSelector":
                                state.shopSelector.sprite.destroy();
                                break;
                            case "dice":
                                Q.GameController.removeDice(state);
                                Q.AudioController.stopSound("roll-die");
                                break;
                            case "moveArrows":
                                player.sprite.destroyArrows();
                                player.sprite.p.allowMovement = false;
                                break;
                        }
                        break;
                    case "clearStage":
                        Q.clearStage(r.num);
                        break;
                    case "setQValue":
                        Q.setDeepValue(Q, r.path, r.value);
                        break;
                    case "setStateValue":
                        Q.setDeepValue(state, r.path, r.value);
                        break;
                    case "stopSound":
                        Q.AudioController.stopSound(r.sound);
                        break;
                    case "invalidAction":
                        Q.AudioController.playSound("invalid-action");
                        break;
                    case "checkFinishMove":
                        Q.GameController.checkFinishMove(state, player);
                        break;
                    case "useItem":
                        Q.GameController.useItem(state, r.itemIdx);
                        break;
                    case "makeCustomMenu":
                        Q.MenuController.makeCustomMenu(state, r.menu, r.props);
                        break;
                    case "navigateMenu":
                        Q.MenuController.setMenuPosition(state, r.item);
                        break;
                    case "makeMenu":
                        Q.MenuController.makeMenu(state, r.props);
                        if(r.props.sound){
                            Q.AudioController.playSound(r.props.sound);
                        }
                        break;
                    case "switchMenu":
                        Q.MenuController.switchMenu(state, r.props);
                        break;
                    case "rollDie":
                        Q.GameController.startRollingDie(state, r.rollsNums, player.sprite);
                        break;
                    case "landOnMainTile":
                        Q.GameController.landOnMainTile(state, player);
                        break;
                    case "stopDice":
                        Q.GameController.stopDice(state, r.rollsNums);
                        break;
                    case "allowPlayerMovement":
                        Q.GameController.allowPlayerMovement(state, r.currentMovementNum);
                        break;
                    case "playerMovement":
                        var tile = Q.MapController.getTileAt(state, r.loc);
                        Q.GameController.removeDice(state);
                        Q.GameController.tileDetails.displayShop(tile);

                        if(r.direction === "forward"){
                            Q.GameController.movePlayer(player, tile);
                            state.currentMovementPath.push(tile);
                            player.tileTo = tile;
                            player.finish = r.finish;
                            Q.MapController.checkPassByTile(state, player);
                        } else if(r.direction === "back"){
                            Q.GameController.playerGoBackMove(state, player.playerId);
                        }
                        if(r.finish && !r.passBy){
                            Q.GameController.askFinishMove(state, player);
                        }
                        break;
                    case "playerGoBackMove":
                        Q.clearStage(2);
                        r.func = "playerMovement";
                        player.sprite.showMovementDirections();
                        Q.GameController.playerGoBackMove(state, player.playerId);
                        break;
                    case "purchaseSet":
                        Q.GameController.purchaseSet(state, r.num, player.playerId);
                        Q.AudioController.playSound("purchase-item");
                        break;
                    case "purchaseSetItem":
                        Q.GameController.purchaseSetItem(state, r.loc, player.playerId);
                        Q.AudioController.playSound("purchase-item");
                        break;
                    case "purchaseItem":
                        Q.GameController.purchaseItem(state, Object.assign({id: r.item.id, cost: r.item.cost}, Q.c.items[r.item.id]), player.playerId);
                        break;
                    case "buyShop":
                        if(r.itemIdx >= 0){
                            player.items.splice(r.itemIdx, 1);
                        }
                        var shop = Q.MapController.getTileAt(state, r.loc);
                        Q.GameController.buyShop(state, player, shop, r.couponValue);
                        Q.GameController.endTurn(state);
                        break;
                    case "sellShop":
                        var shop = Q.MapController.getTileAt(state, r.loc);
                        if(r.sellTo){
                            r.sellTo = Q.GameController.getPlayer(state, r.id);
                        }
                        Q.GameController.sellShop(state, shop, r.value, r.sellTo);
                        break;
                    case "payOwnerOfShop":
                        Q.GameController.payOwnerOfShop(state, player, Q.MapController.getTileAt(state, r.loc));
                        break;
                    case "buyOutShop":
                        Q.GameController.buyOutShop(state, player, Q.MapController.getTileAt(state, r.loc));
                        break;
                    case "endTurn":
                        Q.GameController.endTurn(state);
                        break;
                    case "goBackMenu":
                        state.menus[0].data.goBack(state);
                        break;
                    case "makeMoveShopSelector":
                        Q.MenuController.makeMoveShopSelector(state, r.confirmType, r.backFunc, r.startPos);
                        break;
                    case "finishMoveShopSelector":
                        Q.GameController.finishMoveShopSelector(state, r.key, Q.MapController.getTileAt(state, r.loc), r.props);
                        break;
                    case "moveShopSelector":
                        state.shopSelector.moveTo(r.move[0], r.move[1], r.move[2]);
                        break;
                    case "controlNumberCycler":
                        if(r.item){
                            state.menus[0].currentItem = r.item;
                            state.menus[0].currentCont.p.menuButtons[state.menus[0].currentItem[0]][state.menus[0].currentItem[1]].selected();
                            Q.AudioController.playSound("change-number-cycler");
                        } else if(r.num >= 0){
                            state.menus[0].itemGrid[state.menus[0].currentItem[1]][state.menus[0].currentItem[0]][0] = r.num;
                            state.menus[0].currentCont.p.menuButtons[state.menus[0].currentItem[0]][state.menus[0].currentItem[1]].changeLabel(state.menus[0].itemGrid[state.menus[0].currentItem[1]][state.menus[0].currentItem[0]][0]);
                            state.menus[0].currentCont.trigger("adjustedNumber", state);
                            Q.AudioController.playSound("change-number-cycler");
                        } else if(r.value >= 0){
                            Q.MenuController.setNumberCyclerValue(state, r.value);
                            state.menus[0].currentCont.trigger("adjustedNumber", state);
                        }
                        break;
                    case "finalizeInvestInShop":
                        Q.GameController.investInShop(state, r.investAmount);
                        break;
                    case "finalizeUpgradeShop":
                        Q.GameController.upgradeShop(state, r.rankUp, r.cost);
                        break;
                    case "finalizeBuyStock":
                        Q.GameController.buyStock(Q.GameController.getPlayer(state, r.playerId), r.num, r.cost, state.map.districts[r.district]);
                        break;
                    case "finalizeSellStock":
                        Q.GameController.sellStock(Q.GameController.getPlayer(state, r.playerId), r.num, r.cost, state.map.districts[r.district]);
                        break;
                    case "addToDeal":
                        Q.GameController.addToDeal(state, r.props);
                        Q.GameState.dealMenu.addToDeal(r.props);
                        break;
                    case "clearMenus":
                        Q.MenuController.clearMenus(state, r.type);
                        break;
                }
            });
        };
        Q.socket.on("inputResult", Q.applyInputResult);
        
        Q.socket.emit("readyToStartGame");
        Q.socket.on("allUsersReady", function(data){
            Q.stageScene("game", 1, {
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