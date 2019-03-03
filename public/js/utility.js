var quintusUtility = function(Quintus) {
"use strict";

Quintus.Utility = function(Q) {
    
    Q.getXY = function(loc){
        return {x:loc[0] * Q.c.tileW + Q.c.tileW / 2  + loc[0] * Q.c.tileOffset,y:loc[1] * Q.c.tileH + Q.c.tileH / 2 + loc[1] * Q.c.tileOffset};
    };
    Q.setXY = function(obj, loc){
        loc = loc || obj.p.loc;
        obj.p.x = loc[0] * Q.c.tileW + loc[0] * Q.c.tileOffset;
        obj.p.y = loc[1] * Q.c.tileH + loc[1] * Q.c.tileOffset;
    };
    Q.createArray = function(value, width, height) {
        let array = [];
        for (let i = 0; i < height; i++) {
            array.push([]);
            for (let j = 0; j < width; j++) {
                array[i].push(value);
            }
        }
        return array;
    };
    Q.shuffleArray = function(a){
        var j, x, i;
        for (i = a.length - 1; i > 0; i--) {
            j = ~~(Math.random() * (i + 1));
            x = a[i];
            a[i] = a[j];
            a[j] = x;
        }
        return a;
    };
    Q.locsMatch = function(loc1, loc2){
        return loc1[0] === loc2[0] && loc1[1] === loc2[1];
    };
    Q.locInBounds = function(loc, w, h){
        return loc[0] >= 0 && loc[0] < w && loc[1] >= 0 && loc[1] < h;
    };
    Q.isActiveUser = function(){
        return Q.user.id === Q.GameState.turnOrder[0].playerId;
    };
    Q.isServer = function() {
        return ! (typeof window != 'undefined' && window.document);
    };
};
};

if(typeof Quintus === 'undefined') {
  module.exports = quintusUtility;
} else {
  quintusUtility(Quintus);
}