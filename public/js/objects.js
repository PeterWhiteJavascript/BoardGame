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
        destroyArrows: function(){
            this.directionArrows.forEach((arrow) => { arrow.destroy(); });
        },
        //Animate the player to the tile that they are going to. Also remove the directional arrows (these are added when the player arrives on the tile).
        moveTo: function(loc){
            let pos = Q.getXY(loc);
            this.animate({ x: pos.x, y:  pos.y - Q.c.tileH }, 0.10, Q.Easing.Quadratic.InOut, {callback: function(){ if(this.p.allowMovement) this.showMovementDirections(); }});
            this.p.loc = loc;
            this.destroyArrows();
        },
        showMovementDirections: function(){
            this.p.allowMovement = true;
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
                sheet:"die",
                frame: 0,
                maxFrame: 5,
                animSpeed: 5,
                curStep: 0,
                cx:0, cy:0,
                frameRandomSeed: new Math.seedrandom()
            });
            this.on("step", this, "randomize");
        },
        //This is just an animation. The number is decided before the user presses the stop button.
        randomize: function(){
            this.p.curStep ++;
            if(this.p.curStep >= this.p.animSpeed){
                let newFrame;
                do {
                    newFrame = ~~(this.p.frameRandomSeed() * this.p.maxFrame);
                } while(newFrame === this.p.frame);
                this.p.frame = newFrame;
                this.p.curStep = 0;
            }
        },
        slow: function(){
            this.p.animSpeed = 15;
            Q.stage(0).off("pressedConfirm", this, "slow");
        },
        removeDie: function(){
            this.destroy();
            this.stage.off("directionalInput", this, "removeDie");
        },
        stop: function(num){
            this.off("step", this, "randomize");
            this.p.frame = num - 1;
            this.stage.on("directionalInput", this, "removeDie");
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
    Q.Sprite.extend("Cursor", {
        init: function(p){
            this._super(p,{
                sheet:"cursor", 
                frame:0
            });
        },
        attachItem: function(item){
            this.p.itemSprite = this.stage.insert(new Q.Sprite({x: -16, y: 16, w:32, h:32, sheet: "objects", frame:item.tile, item: item}), this);
        },
        removeItem: function(){
            this.p.itemSprite.destroy();
            this.p.itemSprite = false;
        }
    });
    Q.UI.Container.extend("MenuButtonContainer",{
        init: function(p){
            this._super(p, {
                fill: Q.OptionsController.options.menuColor, 
                cx: 0, 
                cy:0,
                menuButtons: []
            });
        },
        interact: function(button){
            button.trigger("interactWith", button.p.toContainer);
        },
        dehoverAll: function(){
            for(let i = 0; i < this.p.menuButtons.length; i++){
                for(let j = 0; j < this.p.menuButtons[i].length; j++){
                    this.p.menuButtons[i][j].dehover();
                }
            }
        },
        removeContent:function(){
            let stage = this.stage;
            this.children.forEach(function(child){stage.remove(child);});
            this.p.menuButtons = [];
        },
        fillEmptyMenuButtons: function(fillTo){
            if(!fillTo){
                fillTo = 0;
                for(let i = 0; i < this.p.menuButtons.length; i++){
                    fillTo = Math.max(this.p.menuButtons[i].length, fillTo);
                }
            }
            for(let i = this.p.menuButtons.length - 1; i >= 0; i--){
                if(!this.p.menuButtons[i].length){ 
                    this.p.menuButtons.splice(i, 1);
                    continue;
                };
                if(this.p.menuButtons[i].length < fillTo){
                    let diff = fillTo - this.p.menuButtons[i].length;
                    for(let j = 0; j < diff; j++){
                        this.p.menuButtons[i].push(this.p.menuButtons[i][fillTo - diff - 1]);
                    }
                }
            }
        }
    });
    Q.UI.Container.extend("MenuButton", {
        init: function(p){
            this._super(p, {
                w: 140,
                h: 35,
                x:5,
                cx:0, cy:0,
                fill: "white",
                selectedColour: "teal",
                defaultColour: "white"
            });
            if(p.label){
                this.on("inserted", this, "addText");
            }
            this.p.defaultRadius = this.p.radius;
        },
        dehover:function(){
            this.p.fill = this.p.defaultColour;
            this.trigger("dehover");
            this.p.radius = this.p.defaultRadius;
        },
        setFill: function(color){
            this.p.fill = color || this.p.selectedColour;
        },
        hover:function(){
            for(let i = 0; i < this.container.p.menuButtons.length; i++){
                for(let j = 0; j < this.container.p.menuButtons[i].length; j++){
                    this.container.p.menuButtons[i][j].dehover();
                }
            }
            this.setFill();
            
            this.stage.insert(this.p.cursor, this.container);
            this.p.cursor.p.x = this.p.x + this.p.w - 5;
            this.p.cursor.p.y = this.p.y + 5;
            this.p.cursor.refreshMatrix();
            this.p.radius = this.p.defaultRadius / 2;
            this.trigger("hover");
        },
        addText:function(){
            let size = this.p.size || 14;
            this.insert(new Q.UI.Text({label: this.p.label, x: this.p.w / 2, y: this.p.h / 2 - size + 2, size: size || 14}));
        }
    });
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
};
};

if(typeof Quintus === 'undefined') {
  module.exports = quintusObjects;
} else {
  quintusObjects(Quintus);
}