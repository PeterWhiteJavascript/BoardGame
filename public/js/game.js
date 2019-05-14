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
            //Set the initial turn order based on the array of ids sent by the server.
            Q.GameState.turnOrder = [];
            for(let i = 0; i < stage.options.turnOrder.length; i++){
                Q.GameState.turnOrder.push(Q.GameState.players.find((player) => {return player.playerId === stage.options.turnOrder[i];}));
            }
            
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
                //There are a few things that players can do when it's not their turn.
                //This includes checking stats/opening menus.
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
                let inputs = {};
                if(Q.inputs["confirm"]){
                    inputs["confirm"] = true;
                    Q.inputs["confirm"] = false;
                }
                if(Q.inputs["back"]){
                    inputs["back"] = true;
                    Q.inputs["back"] = false;
                }
                if(Q.inputs["left"]){
                    inputs["left"] = true;
                    if(Q.preventMultipleInputs){
                        Q.inputs["left"] = false;
                    }
                } else if(Q.inputs["right"]){
                    inputs["right"] = true;
                    if(Q.preventMultipleInputs){
                        Q.inputs["right"] = false;
                    }
                }
                if(Q.inputs["up"]){
                    inputs["up"] = true;
                    if(Q.preventMultipleInputs){
                        Q.inputs["up"] = false;
                    }
                } else if(Q.inputs["down"]){
                    inputs["down"] = true;
                    if(Q.preventMultipleInputs){
                        Q.inputs["down"] = false;
                    }
                }
                for (var key in inputs) {
                    if(inputs[key] === false) {
                        delete inputs[key];
                    }
                }
                Q.socket.emit('inputted', inputs);
            });
            Q.GameController.startTurn(Q.GameState);
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
    });
    
};
};

if(typeof Quintus === 'undefined') {
  module.exports = quintusGame;
} else {
  quintusGame(Quintus);
}
