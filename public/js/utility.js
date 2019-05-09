var quintusUtility = function(Quintus) {
"use strict";

Quintus.Utility = function(Q) {
    Q.convertDirToCoord = function(dir){
        switch(dir){
            case "up": return [0, -2];
            case "right": return [2, 0];
            case "down": return [0, 2];
            case "left": return [-2, 0];
        }
    };
    Q.convertCoordToDir = function(coord){
        if(coord[0] === 2) return "right";
        if(coord[0] === -2) return "left";
        if(coord[1] === 2) return "down";
        if(coord[1] === -2) return "up";
    };
    Q.getOppositeDir = function(dir){
        switch(dir){
            case "left": return "right";
            case "up": return "down";
            case "right": return "left";
            case "down": return "up";
        }
    };
    Q.compareLocsForDirection = function(loc1, loc2){
        let difX = loc1[0] - loc2[0];
        let difY = loc1[1] - loc2[1];
        let dir;
        if(difX !== 0){
            if(difX < 0) dir = [2, 0];
            else dir = [-2, 0];
        } else {
            if(difY < 0) dir = [0, 2];
            else dir = [0, -2];
        }
        return dir;
    };
    Q.getDeepValue = function(obj, path){
        for (var i=0, path=path.split('.'), len=path.length; i<len; i++){
            obj = obj[path[i]];
        };
        return obj;
    };
    Q.getLoc = function(x, y){
        return [
            ~~(x / Q.c.tileW),
            ~~(y / Q.c.tileH)
        ];
    };
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
        return !Q.isServer() && Q.user.id === Q.GameState.turnOrder[0].playerId;
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