var quintusGame = function(Quintus) {
"use strict";

Quintus.Game = function(Q) {
    Q.scene("game", function(stage){
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
