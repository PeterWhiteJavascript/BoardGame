var quintusGame = function(Quintus) {
"use strict";

Quintus.Game = function(Q) {
    //Client side game tracking. Any visuals are displayed here.
    Q.scene("game", function(stage){
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
        Q.GameController.startTurn();
        Q.processInputResult({func: "toPlayerTurnMainMenu", props: {selected: 0} });
        if(Q.isActiveUser()){
            console.log("It's your turn.")
        }
        
        
        stage.on("step", function(){
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
    });
    
    
    
};
};

if(typeof Quintus === 'undefined') {
  module.exports = quintusGame;
} else {
  quintusGame(Quintus);
}
