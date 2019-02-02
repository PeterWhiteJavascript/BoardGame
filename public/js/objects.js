var quintusObjects = function(Quintus) {
"use strict";

Quintus.Objects = function(Q) {
    Q.Sprite.extend("Tile", {
        init: function(p){
            this._super(p, {
                sheet: "tile-1",
                frame: 0,
                cx:0,
                cy:0
                //Todo: border of tile, actually make sprite/frame work
            });
            Q.setXY(this);
            this.on("inserted");
        },
        inserted: function(){
            this.p.borderColor = this.stage.insert(new Q.UI.Container({w: this.p.w - 6, h: this.p.h - 6, x: 3, y: 3, cx:0, cy:0, border: 5, stroke: Q.MapController.currentMap.data.districts[this.p.district].color, fill: "transparent"}), this);
            this.p.propertyIcon = this.stage.insert(new Q.Sprite({x:Q.tileW / 2, y: 0, cx:0, cy:0, sheet: "tile-structure-" + this.p.rank, frame: 0}), this);
            this.p.valueText = this.stage.insert(new Q.UI.Text({x:Q.tileW, y: Q.tileH * 1.35, label:"" + this.p.value, size: 18}), this);
        }
    });
    Q.Sprite.extend("Player", {
        init: function(p){
            this._super(p, {
                sheet: "player-1",
                frame: 0,
                cx:0,
                cy:0
            });
            Q.setXY(this);
            this.p.x += Q.tileW / 2;
            this.p.y -= Q.tileH / 2;
        }
    });
    Q.Sprite.extend("Die", {
        init: function(p){
            this._super(p, {
                
            });
        }
    });
    Q.UI.Container.extend("MapBorder", {
        init: function(p){
            this._super(p, {
                x: 0,
                y: 0,
                border: 2,
                stroke: "orange",
                fill: "transparent",
                cx:0,
                cy:0
            });
        }
    });
    //Functions used to set up the map.
    Q.GameObject.extend("mapController", {
        addToGrid: function(x, y, w, h, arr, add){
            for(let i = 0; i < h; i++){
                for(let j = 0; j < w; j++){
                    arr[y + i][x + j] = add;
                }
            } 
        },
        //Pass the map data and return the fully generated map inside a tile w*h tile grid.
        generateMap: function(mapData, stage){
            this.currentMap = {
                data: mapData,
                shops: []
            };
            let grid = Q.createArray(false, mapData.map.w, mapData.map.h);
            //Add tiles to grid and generate their sprite.
            for(let i = 0; i < mapData.tiles.length; i++){
                let tileData = mapData.tiles[i];
                let tile = {
                    loc: [tileData.x, tileData.y],
                    value : tileData.value,
                    cost: tileData.cost, 
                    rank: tileData.rank,
                    name: tileData.name,
                    district: tileData.district
                };
                tile.sprite = stage.insert(new Q.Tile(tile));
                //tile.move = {}; Set move after all tiles have been added to the map grid
                this.currentMap.shops.push(tile);
                Q.MapController.addToGrid(tileData.x, tileData.y, 2, 2, grid, tile);
                
            }
            this.currentMap.grid = grid;
            return this.currentMap;
        }
    });
    
    //Functions that are run during gameplay.
    //Add/remove shop from player, stocks, etc...
    Q.GameObject.extend("gameController", {
        
    });
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
};
};

if(typeof Quintus === 'undefined') {
  module.exports = quintusObjects;
} else {
  quintusObjects(Quintus);
}