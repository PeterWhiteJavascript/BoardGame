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
            switch(this.p.type){
                case "shop":
                    this.p.borderColor = this.stage.insert(new Q.UI.Container({w: this.p.w - 6, h: this.p.h - 6, x: 3, y: 3, cx:0, cy:0, border: 5, stroke: Q.GameState.map.data.districts[this.p.district].color, fill: "transparent"}), this);
                    this.p.propertyIcon = this.stage.insert(new Q.Sprite({x:Q.c.tileW / 2, y: 0, cx:0, cy:0, sheet: "tile-structure-" + this.p.rank, frame: 0}), this);
                    this.p.valueText = this.stage.insert(new Q.UI.Text({x:Q.c.tileW, y: Q.c.tileH * 1.35, label:"" + this.p.value, size: 18}), this);
                    break;
                case "main":
                    //TEMP
                    this.p.homeText = this.stage.insert(new Q.UI.Text({x:Q.c.tileW, y: Q.c.tileH * 1.35, label:"HOME TILE", size: 18}), this);
                    break;
            }
            
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
            this.directionArrows = [];
            this.add("animation, tween");
            Q.setXY(this);
            this.p.x += Q.c.tileW / 2;
            this.p.y -= Q.c.tileH / 2;
        },
        //Animate the player to the tile that they are going to. Also remove the directional arrows (these are added when the player arrives on the tile).
        moveTo: function(loc){
            let pos = Q.getXY(loc);
            this.animate({ x: pos.x, y:  pos.y - Q.c.tileH }, 0.25, Q.Easing.Quadratic.InOut, {callback: function(){ this.showMovementDirections(); }});
            this.p.loc = loc;
            this.directionArrows.forEach((arrow) => { arrow.destroy(); });
        },
        showMovementDirections: function(){
            let tileOn = Q.MapController.getTileAt(this.p.loc);
            let dirs = Object.keys(tileOn.move.dir);
            
            for(let i = 0; i < dirs.length; i++){
                this.directionArrows.push(this.stage.insert(new Q.DirectionArrow({sheet: "arrow-" + dirs[i]}), this));
            }
        }
    });
    Q.Sprite.extend("DirectionArrow", {
        init: function(p){
            this._super(p, {
                frame: 0
            });
            this.add("tween");
            this.on("inserted");
        },
        flash: function(){
            this.animate({opacity: 0}, 0.5, Q.Easing.Quadratic.InOut, {delay: 0.5})
                .chain({opacity: 1}, 0.25, Q.Easing.Quadratic.InOut, {callback: function() { this.flash(); }});
            
        },
        inserted: function(){
            switch(this.p.sheet){
                case "arrow-up":
                    this.p.x = this.container.p.w / 2;
                    break;
                case "arrow-right":
                    this.p.x = this.container.p.w;
                    this.p.y = this.container.p.h / 2;
                    break;
                case "arrow-down":
                    this.p.x = this.container.p.w / 2;
                    this.p.y = this.container.p.h;
                    break;
                case "arrow-left":
                    this.p.y = this.container.p.h / 2;
                    break;
            }
            this.flash();
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
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
};
};

if(typeof Quintus === 'undefined') {
  module.exports = quintusObjects;
} else {
  quintusObjects(Quintus);
}