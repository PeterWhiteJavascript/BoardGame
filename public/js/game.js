var quintusGame = function(Quintus) {
"use strict";

Quintus.Game = function(Q) {
    //Client side game tracking. Any visuals are displayed here.
    Q.scene("game", function(stage){
        Q.AudioController.playMusic(stage.options.mapData.map.bgm, () => {
            Q.preventMultipleInputs = true;
            let gameData = Q.GameState = Q.GameController.setUpGameState({
                mapData:stage.options.mapData, 
                settings: stage.options.settings,
                users: stage.options.users
            });
            Q.GameState.turnOrder = [];
            for(let i = 0; i < stage.options.turnOrder.length; i++){
                Q.GameState.turnOrder.push(Q.GameState.players.find((player) => {return player.playerId === stage.options.turnOrder[i];}));
            }
            console.log(Q.GameState.turnOrder);


            let mapData = gameData.map;
            //Insert all of the tile sprites.
            for(let i = 0; i < gameData.map.tiles.length; i++){
                gameData.map.tiles[i].sprite = stage.insert(new Q.Tile(gameData.map.tiles[i]));
            }
            //Insert all of the player sprites
            for(let i = 0; i < gameData.players.length; i++){
                gameData.players[i].sprite = stage.insert(new Q.Player({playerId: gameData.players[i].playerId, loc: gameData.players[i].loc}));
            }

            Q.addViewport(stage, stage.lists["Player"][0]);

            //Include this if we want to see the edge of the map.
            //stage.insert(new Q.MapBorder({w: mapData.data.map.w * Q.c.tileW, h: mapData.data.map.h * Q.c.tileH}));
            Q.stageScene("hud", 2);


            stage.on("step", function(){
                if(Q.inputs["open-sets-menu"]){
                    if(Q.stage(2).setMenu){ 
                        Q.stage(2).setMenu.destroy();
                        Q.stage(2).setMenu = false;
                    } else {
                        Q.stage(2).setMenu = Q.stage(2).insert(new Q.SetsMenu({player: Q.GameState.turnOrder[0]}));
                    }
                    
                    Q.inputs["open-sets-menu"] = false;
                }
                
                if(!Q.isActiveUser()) return;
                if(Q.inputs["confirm"]){
                    Q.socket.emit('inputted', {input: "confirm"});
                    stage.trigger("pressedInput", "confirm");
                    Q.inputs["confirm"] = false;
                }
                if(Q.inputs["back"]){
                    Q.socket.emit('inputted', {input: "back"});
                    stage.trigger("pressedInput", "back");
                    Q.inputs["back"] = false;
                }
                if(Q.inputs["left"]){
                    Q.socket.emit("inputted", {input: "left"});
                    stage.trigger("pressedInput", "left");
                    if(Q.preventMultipleInputs){
                        Q.inputs["left"] = false;
                    }
                } else if(Q.inputs["right"]){
                    Q.socket.emit("inputted", {input: "right"});
                    stage.trigger("pressedInput", "right");
                    if(Q.preventMultipleInputs){
                        Q.inputs["right"] = false;
                    }
                }
                if(Q.inputs["up"]){
                    Q.socket.emit("inputted", {input: "up"});
                    stage.trigger("pressedInput", "up");
                    if(Q.preventMultipleInputs){
                        Q.inputs["up"] = false;
                    }
                } else if(Q.inputs["down"]){
                    Q.socket.emit("inputted", {input: "down"});
                    stage.trigger("pressedInput", "down");
                    if(Q.preventMultipleInputs){
                        Q.inputs["down"] = false;
                    }
                }
            });
            Q.GameController.startTurn();
        });
    });
    Q.scene("hud", function(stage){
        let tileDetails = Q.GameController.tileDetails = stage.insert(new Q.ShopStatusBox({x: Q.width - Q.c.boxWidth - 50, y: 120, w: Q.c.boxWidth, h: Q.c.boxHeight, radius: 0, shopLoc: Q.GameState.turnOrder[0].loc, stage: stage}));
        
        //Create the standings
        let standingsCont = stage.insert(new Q.StandardMenu({w: Q.c.boxWidth, h: Q.c.boxHeight, x: Q.width - Q.c.boxWidth - 50, y: Q.c.boxHeight + 150}));
        
        for(let i = 0; i < Q.GameState.turnOrder.length; i++){
            let player = Q.GameState.turnOrder[i];
            let playerCont = standingsCont.insert(new Q.UI.Container({x: 5, y: 5 + i * ~~((standingsCont.p.h - 5) / 4), w: standingsCont.p.w - 10, h: standingsCont.p.h / 4 - 5, fill: "white", cx:0, cy:0 }));
            let playerIconContainer = playerCont.insert(new Q.UI.Container({x: 5 + 20, y: playerCont.p.h / 2, w: playerCont.p.h, h: playerCont.p.h, radius:3,  fill: player.color/*"transparent"*/}));
            let playerIcon = playerIconContainer.insert(new Q.Sprite({x: 0, y: 0, sheet: "player-icon-1", frame:0}));
            let playerName = playerCont.insert(new Q.SmallText({x: 60, y: 5, label:"Player " + player.playerId, cx:0, cy:0, color: "#111", align: "left"}));
            let playerMoney = playerCont.insert(new Q.SmallText({x: 60, y: 25, label:player.money + " G", cx:0, cy:0, color: "#111", align: "left"}));
            player.sprite.on("moneyChanged", () => {
                playerMoney.p.label = player.money + " G";
            });
            let playerNetValue = playerCont.insert(new Q.SmallText({x: 280, y: 25, label: "NV " + player.netValue, cx: 0, cy:0, color: "#111", align: "right"}));
            player.sprite.on("netValueChanged", () => {
                playerNetValue.p.label = "NV " + player.netValue;
            });
        }
        //Q.GameController.buyShop(Q.GameState.turnOrder[0], Q.MapController.getTileAt([0, 8]));
    });
    
};
};

if(typeof Quintus === 'undefined') {
  module.exports = quintusGame;
} else {
  quintusGame(Quintus);
}
