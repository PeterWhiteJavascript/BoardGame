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
        stopDie: function(input){
            if(input === "confirm"){
                Q.stage(0).off("pressedInput", this, "stopDie");
                Q.processInputResult({func: "stopDieAndAllowMovement", props:{move: Q.GameState.currentMovementNum}});
            } else if(input === "back"){
                Q.stage(0).off("pressedInput", this, "stopDie");
                Q.processInputResult({func: "removeDiceAndBackToPTM", props:{num: 0}});
            }
        },
        removeDie: function(){
            //this.stage.off("pressedInput", this, "removeDie");
            //TODO: figure out if this bind is removed by looking in stage.binds after more than one die has been rolle.d
            //If it's removed, great. Otherwise, put in settimeout
            this.stage.remove(this);
        },
        stop: function(num){
            this.off("step", this, "randomize");
            this.p.frame = num - 1;
            this.stage.on("pressedInput", this, "removeDie");
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
                sheet:"arrow-left", 
                frame:0
            });
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
        },
        displayOptions: function(options){
            let cursor = new Q.Cursor();
            this.p.menuButtons = [];
            let menuButtonCont = this;
            for(let i = 0; i < options.length; i++){
                let button = this.insert(new Q.MenuButton({x: 5, y: 5 + 40 * i, w:175, label: options[i][0], func: options[i][1], props:options[i][2], cursor: cursor}));
                button.on("interactWith", function(){
                    this.removeContent();
                    //If there's no function, we're just cycling text.
                    if(!this.p.func){
                        processDialogue();
                    } else {
                        let newTextAvailable = Q.MenuController.menuButtonInteractFunction(this.p.func, this.p.props, this.stage.options);
                        if(newTextAvailable){
                            menuButtonCont.p.dialogue = newTextAvailable;
                            menuButtonCont.p.idx = 0;
                            processDialogue();
                        }
                    }
                });
                this.p.menuButtons.push([button]);
            }
            this.p.menuButtons[0][0].hover();
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
            this.p.cursor.p.x = this.p.x + this.p.w - 15;
            this.p.cursor.p.y = this.p.y + this.p.h / 2;
            this.p.cursor.refreshMatrix();
            this.p.radius = this.p.defaultRadius / 2;
            this.trigger("hover");
        },
        addText:function(){
            let size = this.p.size || 14;
            this.insert(new Q.UI.Text({label: this.p.label, x: this.p.w / 2, y: this.p.h / 2 - size + 2, size: size || 14}));
        }
    });
    Q.UI.Text.extend("ScrollingText",{
        init: function(p){
            this._super(p, {
                x:10, y: 5,
                align: "left",
                cx:0, cy:0
            });
            this.on("inserted");
        },
        inserted: function(){
            this.calcSize();
            this.on("interact", this, "doneScrolling");
        },
        doneScrolling: function(){
            this.trigger("doneScrolling");
        }
    });
    Q.GameObject.extend("textProcessor",{
        evaluateStringConditional:function(vr, op, vl){
            switch(op){
                case "==": return vr == vl;
                case "!=": return vr != vl;
                case ">": return vr > vl;
                case "<": return vr < vl;
                case ">=": return vr >= vl;
                case "<=": return vr <= vl;
                case "set": return vl ? vr : !vr;
            }
        },
        getDeepValue:function(obj, path){
            for (var i=0, path=path.split('.'), len=path.length; i<len; i++){
                obj = obj[path[i]];
            };
            return obj;
        },
        //Takes a string and evaluates anything within {} and then returns a new string
        replaceText:function(text){
            //Loop through each {}
            while(typeof text === "string" && text.indexOf("{") !== -1){
                text = text.replace(/\{(.*?)\}/,function(match, p1, p2, p3, offset, string){
                    return Q.TextProcessor.getVarValue(p1);
                });
            }
            return text;
           
        },
        getVarValue:function(text){
            var newText;
            var category = text[0];
            var prop = text.slice(text.indexOf("@")+1,text.length);
            switch(category){
                //{w@worldVariable}
                case "w":
                    newText = Q.DataController.currentWorld[prop];
                    break;
            }
            
            return newText;
        }
    });
    Q.scene("dialogue", function(stage){
        let dialogueBox = stage.insert(new Q.UI.Container({x: Q.width / 2 - 350, y:Q.height - 210, w: 700, h: 200, cx:0, cy:0, fill: Q.OptionsController.options.menuColor, opacity:0.8, border:1}));
        let textArea = dialogueBox.insert(new Q.UI.Container({x:5, y:5, cx:0, cy:0, w:500, h:190, fill: Q.OptionsController.options.menuColor}));
        let optionsArea = dialogueBox.insert(new Q.MenuButtonContainer({x:510, y:5, cx:0, cy:0, w:185, h:190, fill: Q.OptionsController.options.menuColor}));
        optionsArea.p.dialogue = stage.options.dialogue.text;
        optionsArea.p.idx = 0;
        function processDialogue(){
            let dialogue = optionsArea.p.dialogue;
            let idx = optionsArea.p.idx;
            stage.off("step", Q.MenuController, "acceptInteract");
            stage.off("step", Q.MenuController, "acceptInputs");
            let item = dialogue[idx];
            idx ++;
            if(!item) return Q.MenuController.returnToGame();
            
            if(textArea.p.text) textArea.p.text.destroy();
            item = Q.TextProcessor.replaceText(item);
            textArea.p.text = textArea.insert(new Q.ScrollingText({label:item}));
            textArea.p.text.on("doneScrolling", processDialogue);
            Q.MenuController.currentCont = textArea.p.text;
            
            if(!dialogue[idx + 1]){
                Q.MenuController.currentCont = optionsArea;
                Q.MenuController.currentCont.displayOptions(stage.options.dialogue.options);
            }
        }
        processDialogue();
    });
    
    Q.scene("menu", function(stage){
        let menu = stage.options.menu;
        let menuBox = stage.insert(new Q.UI.Container({x: Q.width - 350, y:Q.height - 500, w: 195, h: menu.options.length * 35 + 45, cx:0, cy:0, fill: Q.OptionsController.options.menuColor, opacity:0.8, border:1}));
        let optionsArea = menuBox.insert(new Q.MenuButtonContainer({x:5, y:5, cx:0, cy:0, w:menuBox.p.w - 10, h:menuBox.p.h - 10, fill: Q.OptionsController.options.menuColor}));
        Q.MenuController.currentCont = optionsArea;
        Q.MenuController.currentCont.displayOptions(menu.options);
        
        let selected = stage.options.selected || 0;
        Q.MenuController.currentCont.p.menuButtons[0][selected].hover();
    });
    
    Q.GameObject.extend("optionsController",{
        toggleBoolOpt:function(opt){
            if(this.options[opt]) this.options[opt] = false;
            else this.options[opt] = true;
            
            if(opt === "musicEnabled"){
                Q.audioController.checkMusicEnabled();
            }
        },
        adjustSound:function(){
            
        }
    });
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
};
};

if(typeof Quintus === 'undefined') {
  module.exports = quintusObjects;
} else {
  quintusObjects(Quintus);
}