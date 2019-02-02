var quintusUtility = function(Quintus) {
"use strict";

Quintus.Utility = function(Q) {
    Q.setXY = function(obj, loc){
        loc = loc || obj.p.loc;
        obj.p.x = loc[0] * Q.tileW;
        obj.p.y = loc[1] * Q.tileH;
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
    
    
};
};

if(typeof Quintus === 'undefined') {
  module.exports = quintusUtility;
} else {
  quintusUtility(Quintus);
}