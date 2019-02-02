var quintusGame = function(Quintus) {
"use strict";

Quintus.Game = function(Q) {
    Q.scene("game", function(stage){
        let mapData = stage.options.mapData;
        let map = Q.MapController.generateMap(mapData, stage);
        
        let player = stage.insert(new Q.Player({loc: map.shops[0].loc}));
        console.log(player)
        console.log(mapData, map)
        stage.insert(new Q.MapBorder({w: mapData.map.w * Q.tileW, h: mapData.map.h * Q.tileH}));
        
        stage.on("step", function(){
            if(Q.inputs["interact"]){
                Q.socket.emit('inputted', {input: "confirm"});
            }
            if(Q.inputs["back"]){
                Q.socket.emit('inputted', {input: "back"});
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
