var quintusGame = function(Quintus) {
"use strict";

Quintus.Game = function(Q) {
    //Client side game tracking. Any visuals are displayed here.
    Q.scene("game", function(stage){
        Q.AudioController.playMusic(stage.options.mapData.map.bgm, () => {
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
                    Q.inputs["left"] = false;
                } else if(Q.inputs["right"]){
                    Q.socket.emit("inputted", {input: "right"});
                    stage.trigger("pressedInput", "right");
                    Q.inputs["right"] = false;
                } else if(Q.inputs["up"]){
                    Q.socket.emit("inputted", {input: "up"});
                    stage.trigger("pressedInput", "up");
                    Q.inputs["up"] = false;
                } else if(Q.inputs["down"]){
                    Q.socket.emit("inputted", {input: "down"});
                    stage.trigger("pressedInput", "down");
                    Q.inputs["down"] = false;
                }
            });

            Q.GameController.startTurn();
            Q.processInputResult({func: "toPlayerTurnMainMenu", props: {selected: 0} });
        });
    });
    Q.scene("hud", function(stage){
        let boxWidth = 300;
        let boxHeight = 220;
        
        
        let shopStatusBox = stage.insert(new Q.StandardMenu({x: Q.width - boxWidth - 50, y: 120, w: boxWidth, h: boxHeight, radius: 0}));
        let shopIconAndRankCont = shopStatusBox.insert(new Q.UI.Container({x: 10, y:10, w: shopStatusBox.p.w / 2 - 10, h: shopStatusBox.p.h - 20, cx:0, cy:0}));
        
        let shopRankContainer = shopIconAndRankCont.insert(new Q.UI.Container({x: shopIconAndRankCont.p.w / 2, y:70, w:shopIconAndRankCont.p.w - 20, h: 30, fill: "gold"}));
        shopRankContainer.insertStars = function(rank){
            this.children.forEach((star) => {star.destroy(); });
            let space = 20;
            for(let i = 0; i < rank; i++){
                this.insert(new Q.UI.Text({label: "*", x: i * space - (((rank - 1 ) / 2) * space), y: -shopRankContainer.p.h / 4}));
            }
        };
        
        let shopBackground = shopIconAndRankCont.insert(new Q.UI.Container({cx: 0, cy: 0, x: 10, y: 90, fill: "#222", w:shopIconAndRankCont.p.w - 20, h: 90 }));
        let shopIcon = shopIconAndRankCont.insert(new Q.Sprite({x: shopIconAndRankCont.p.w / 2, y: 130, w: 64, h: 64}));
        
        let shopTextCont = shopStatusBox.insert(new Q.UI.Container({x: shopStatusBox.p.w / 2, y:10, w: shopStatusBox.p.w / 2 - 10, h: shopStatusBox.p.h - 20, cx:0, cy:0}));
        let shopName = shopTextCont.insert(new Q.StandardText({x: 0, y:0, label: " ", align: "center", size: 24, cx: 0, cy:0, w: 1000, h: 1000}));
        
        let valueCont = shopTextCont.insert(new Q.SmallText({x:shopTextCont.p.w / 2, y: 40, label: "Shop value"}));
        let valueText = shopTextCont.insert(new Q.BGText({x: 10, y: 65, w: shopStatusBox.p.w / 2 - 20, h: 25, textP: {textClass: "StandardText", label: " ", x: shopStatusBox.p.w / 2 - 30, y: 3, color: "#EEE"}}));
        
        let pricesCont = shopTextCont.insert(new Q.SmallText({x: shopTextCont.p.w / 2, y: 95, label: "Shop prices"}));
        let pricesText = shopTextCont.insert(new Q.BGText({x: 10, y: 120, w: shopStatusBox.p.w / 2 - 20, h: 25, textP: {textClass: "StandardText", label: " ", x: shopStatusBox.p.w / 2 - 30, y: 3, color: "#EEE"}}));
        
        let capitalCont = shopTextCont.insert(new Q.SmallText({x: shopTextCont.p.w / 2, y: 150, label: "Max. capital"}));
        let capitalText = shopTextCont.insert(new Q.BGText({x: 10, y: 175, w: shopStatusBox.p.w / 2 - 20, h: 25, textP: {textClass: "StandardText", label: " ", x: shopStatusBox.p.w / 2 - 30, y: 3, color: "#EEE"}}));
        
        let districtCont = shopStatusBox.insert(new Q.BGText({x: - 10, y: -25, w: boxWidth + 20, h: 30, fill: "#AAA", textP: {textClass: "StandardText", label: " ", x: boxWidth, y: 5, color: "#111"}}));
        
        let bottomDecoration = shopStatusBox.insert(new Q.UI.Container({cx: 0, cy: 0, x: -5, y: boxHeight - 2, w: boxWidth + 10, h: 5,  fill: "#AAA", radius: 3}));
        
        stage.hoverShop = function(shop){
            switch(shop.type){
                case "main":
                    shopTextCont.hide();
                    shopRankContainer.hide();
                    
                    districtCont.p.fill = "#AAA";
                    districtCont.text.p.label = "Home Base";
                    
                    shopIcon.p.sheet = "home-base-1";
                    break;
                case "shop":
                    shopTextCont.show();
                    shopRankContainer.show();
                    
                    districtCont.p.fill = Q.GameState.map.data.districts[shop.district].color;
                    districtCont.text.p.label = "District " + (shop.district + 1);

                    shopName.p.label = shop.name;
                    shopRankContainer.insertStars(shop.rank);
                    if(shop.ownedBy){
                        shopIcon.p.sheet = "tile-structure-" + shop.rank;
                        shopBackground.p.fill = shop.ownedBy.color;
                    } else {
                        shopIcon.p.sheet = "shop-for-sale-signpost";
                        shopBackground.p.fill = "#222";
                    }
                    
                    valueText.text.p.label = shop.value + " G";
                    pricesText.text.p.label = shop.cost + " G";
                    capitalText.text.p.label = shop.maxCapital + " G";
                    break;
            }
            
        };
        stage.hoverShop(Q.MapController.getTileAt(Q.GameState.turnOrder[0].loc));
        
        
        //Create the standings
        let standingsCont = stage.insert(new Q.StandardMenu({w: boxWidth, h: boxHeight, x: Q.width - boxWidth - 50, y: boxHeight + 150}));
        
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
