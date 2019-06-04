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
            this.tileData = p;
            Q.setXY(this);
            this.on("inserted");
            this.p.backgroundColor = Q.stage(1).insert(new Q.UI.Container({x: this.p.x + 3, y: this.p.y + 3, h: this.p.h - 6, w: this.p.w - 6, fill: "lightgrey", cx: 0, cy:0}));
        },
        inserted: function(){
            switch(this.p.type){
                case "shop":
                    this.p.borderColor = this.stage.insert(new Q.UI.Container({w: this.p.w - 6, h: this.p.h - 6, x: 3, y: 3, cx:0, cy:0, border: 5, stroke: Q.GameState.map.data.districts[this.tileData.district].color, fill: "transparent"}), this);
                    this.p.propertyIcon = this.stage.insert(new Q.Sprite({x:Q.c.tileW / 2, y: 0, cx:0, cy:0, sheet: "shop-for-sale-signpost", frame: 0}), this);
                    this.p.valueText = this.stage.insert(new Q.UI.Text({x:Q.c.tileW, y: 10, label:"" + this.tileData.value, size: 18}), this);
                    break;
                case "main":
                    //TEMP
                    this.p.homeText = this.stage.insert(new Q.UI.Text({x:Q.c.tileW, y: Q.c.tileH * 1.35, label:"HOME", size: 18}), this);
                    break;
                case "vendor":
                    this.p.vendorIcon = this.stage.insert(new Q.Sprite({x:Q.c.tileW / 2, y: 0, cx:0, cy:0, sheet: (this.tileData.itemName.toLowerCase()) + "-vendor", frame: 0}), this);
                    this.p.vendorText = this.stage.insert(new Q.UI.Text({x:Q.c.tileW, y: Q.c.tileH * 1.35, label: "" + (this.tileData.itemCost ? this.tileData.itemCost : "Free"), size: 18}), this);
                    break;
                case "itemshop":
                    this.p.itemshopText = this.stage.insert(new Q.UI.Text({x:Q.c.tileW, y: Q.c.tileH * 1.35, label:"ITEMS", size: 18}), this);
                    break;
            }
            //If the tile has restricted directions, display them.
            if(this.tileData.dirs){
                for(let i = 0; i < this.tileData.dirs.length; i++){
                    this.stage.insert(new Q.Sprite({x: Q.c.tileW - 20, y: Q.c.tileH * 2 + 8, sheet: "arrow-" + this.tileData.dirs[i], frame: 0}), this);
                    this.stage.insert(new Q.Sprite({x: Q.c.tileW, y: Q.c.tileH * 2 + 8, sheet: "arrow-" + this.tileData.dirs[i], frame: 0}), this);
                    this.stage.insert(new Q.Sprite({x: Q.c.tileW + 20, y: Q.c.tileH * 2 + 8, sheet: "arrow-" + this.tileData.dirs[i], frame: 0}), this);
                }
            }
        },
        sellTile: function(){
            this.p.valueText.p.y = 10;
            this.p.valueText.p.label = "" + this.tileData.value;
            //Todo: animate this and then set it
            this.p.propertyIcon.p.sheet = "shop-for-sale-signpost";
            this.p.backgroundColor.p.fill = "lightgrey";
        },
        //Set the color of the background, as well as the position of the cost text
        updateTile: function(color){
            this.p.valueText.p.y = Q.c.tileH * 1.35;
            this.p.valueText.p.label = "" + this.tileData.cost;
            //Todo: animate this and then set it
            this.p.propertyIcon.p.sheet = "tile-structure-" + this.tileData.rank;
            this.p.backgroundColor.p.fill = color;
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
            let stage = this.stage;
            this.directionArrows.forEach((arrow) => { stage.remove(arrow); });
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
            let lastTile = Q.GameState.currentMovementPath[Q.GameState.currentMovementPath.length - 2];
            let tileOn = Q.MapController.getTileAt(Q.GameState, this.p.loc);
            let dirs = tileOn.dirs ? tileOn.dirs.slice() : Object.keys(tileOn.dir);
            //Force the player to continue along the path that they were on from last turn.
            if(Q.GameState.currentMovementPath.length <= 1) {
                let lastTile =  Q.GameState.turnOrder[0].lastTile;
                if(lastTile){
                    dirs.forEach((dir, i) => {
                        let loc = Q.convertDirToCoord(dir);
                        if(tileOn.loc[0] + loc[0] === lastTile.loc[0] && tileOn.loc[1] + loc[1] === lastTile.loc[1]) dirs.splice(i, 1);
                    });
                }
            }
            //Check all potential tiles and make sure that if any of them are one-way, don't allow this tile to go there.
            dirs.forEach((dir, i) => {
                let tile = tileOn.dir[dir];
                if(tile && (!lastTile || !Q.locsMatch(lastTile.loc, tile.loc))){
                    let toDir = Q.convertCoordToDir(Q.compareLocsForDirection(tile.loc, tileOn.loc));
                    if(tile.dirs && tile.dirs.includes(toDir)){
                        dirs.splice(i, 1);
                        i--;
                    }
                }
            });
            
            //Allow going back if it's the last tile
            if(tileOn.dirs){
                if(lastTile){
                    let allowDir = Q.convertCoordToDir(Q.compareLocsForDirection(tileOn.loc, lastTile.loc));
                    dirs.push(allowDir);
                }
            }
            
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
                Q.processInputResult({func: "stopDieAndAllowMovement", props:{move: Q.GameState.currentMovementNum}});
            } else if(input === "back"){
                this.removeDie();
                Q.processInputResult({func: "removeDiceAndBackToPTM", props:{num: 0}});
            }
        },
        removeDie: function(){
            this.stage.remove(this);
        },
        stop: function(){
            this.off("step", this, "randomize");
            this.p.frame = this.p.roll - 1;
            this.stage.on("pressedInput", this, "removeDie");
        }   
    });
    
    Q.UI.Container.extend("TurnAnimation", {
        init: function(p){
            this._super(p, {
                x:Q.width / 2,
                y:Q.height / 12,
                w: 280,
                h: 40,
                fill: "grey"
            });
            this.add("tween");
            this.on("inserted");
        },
        inserted: function(){
            let text = this.insert(new Q.UI.Text({label: "It's your turn!", y: -10}));
            text.add("tween");
            text.animate({opacity: 0}, 1, Q.Easing.Quadratic.In, {delay: 0.5, callback: function(){ this.destroy();}});
            this.animate({opacity: 0}, 1, Q.Easing.Quadratic.In, {delay: 0.5, callback: function(){ this.destroy();}});
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
        displayOptions: function(onHover){
            let options = Q.GameState.itemGrid;
            let cursor = new Q.Cursor();
            this.p.menuButtons = [];
            let menuButtonCont = this;
            for(let i = 0; i < options.length; i++){
                this.p.menuButtons[i] = [];
                for(let j = 0; j < options[i].length; j++){
                    let button = this.insert(new Q.MenuButton({x: 5, y: 5 + 40 * i, w:175, label: options[i][j][0], func: options[i][j][1], props:options[i][j][2], cursor: cursor}));
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
                    if(onHover) {
                        button.on("hover", function(){
                            onHover(button);
                        });
                    }
                    this.p.menuButtons[i].push(button);
                }
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
            this.insert(new Q.UI.Text({label: this.p.label, x: 10, y: this.p.h / 2 - size / 2, size: size || 14, align: "left"}));
        }
    });
    Q.UI.Text.extend("ScrollingText",{
        init: function(p){
            this._super(p, {
                x:10, y: 5,
                align: "left",
                cx:0, cy:0,
                color: Q.OptionsController.options.textColor,
                family: "Comic Sans MS"
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
    Q.UI.Container.extend("StandardMenu", {
        init: function(p){
            this._super(p, {
                cx:0, 
                cy:0, 
                fill: Q.OptionsController.options.menuColor, 
                opacity:0.8, 
                border:1
            });
        }
    });
    Q.UI.Text.extend("StandardText", {
        init: function(p){
            this._super(p, {
                size: 18,
                color: Q.OptionsController.options.textColor,
                align: "right",
                family: "Verdana"
            });
        }
    });
    Q.UI.Text.extend("SmallText", {
        init: function(p){
            this._super(p, {
                size: 16,
                align: "center",
                color: Q.OptionsController.options.textColor
            });
        }
    });
    Q.UI.Container.extend("BGText", {
        init: function(p){
            this._super(p, {
                cx:0, cy:0,
                fill: "#222"
            });
            if(p.textP){
                this.on("inserted", this, "addText");
            }
        },
        addText:function(){
            let p = this.p.textP;
            this.text = this.insert(new Q[p.textClass](p));
            
        }
    });
    Q.UI.Container.extend("SetsMenu",{
        init: function(p){
            this._super(p, {
                cx:0, cy:0,
                w: Q.width / 2,
                h: Q.height / 2,
                x: Q.width / 4,
                y: Q.height / 4, 
                fill: Q.OptionsController.options.menuColor, 
                opacity:0.8, 
                border:1
            });
            this.on("inserted");
        },
        inserted: function(){
            let player = this.p.player;
            let sets = Q.GameState.map.data.sets;
            //Insert all sets that exist in this map and show the passed in player's set items.
            let setHeight = this.p.h / 5 - 12;
            for(let i = 0; i < sets.length; i++){
                let cont = this.insert(new Q.UI.Container({cx:0, cy:0, w: this.p.w - 20, h: setHeight, x: 10, y: 10 + i * ~~((this.p.h - 10) / 5)}));
                let setImagesCont = cont.insert(new Q.UI.Container({cx:0, cy:0, w: cont.p.w * 0.7, h: cont.p.h}));
                for(let j = 0; j < sets[i].items.length; j++){
                    let xLoc = j * 100 - (((sets[i].items.length - 1 ) / 2) * 100) + setImagesCont.p.w / 2;
                    setImagesCont.insert(new Q.UI.Container({x: xLoc, y: 10 - 5, w: 70, h: 70, cy:0, border: 5, radius: 20, fill: "gold", opacity: 0.5}));
                    setImagesCont.insert(new Q.Sprite({x: xLoc, y: 10, cy:0, sheet: (sets[i].items[j].toLowerCase()) + "-vendor", frame: 0}));
                    setImagesCont.insert(new Q.UI.Text({x: xLoc + 20, y: 10, label: (player.setPieces[sets[i].items[j]] || 0) + ""}));
                }
                let setTextCont = cont.insert(new Q.UI.Container({cx:0, cy:0, w: cont.p.w * 0.3, h: cont.p.h, x: cont.p.w * 0.7, fill: "#EEE"}));
                setTextCont.insert(new Q.UI.Text({cx:0, cy:0, x: 10, y: 10, label: sets[i].name, align: "left"}));
                setTextCont.insert(new Q.UI.Text({cx:0, cy:0, x: 10, y: setTextCont.p.h / 2, label: sets[i].value + " G", align: "left"}));
            }
        },
        hoverSet: function(set){
            this.children.forEach((child) => {
                child.children[0].p.fill = "transparent";
            });
            if(set.p.label === "Nothing") return;
            
            let toHover = this.children.find((child) => {
                return child.children[1].children[0].p.label === set.p.label;
            });
            toHover.children[0].p.fill = "gold";
        }
    });
    Q.UI.Container.extend("MapMenu", {
        init: function(p){
            this._super(p, {
                cx:0, cy:0,
                w: Q.width / 2,
                h: Q.height / 2,
                x: Q.width / 4,
                y: Q.height / 4, 
                fill: Q.OptionsController.options.menuColor, 
                opacity:0.8, 
                border:1
            }); 
            this.on("inserted");
        },
        inserted: function(){
            //TODO: size things based on actual map size to fit the screen better.
            let map = Q.GameState.map;
            let mapObj = this.stage.insert(new Q.UI.Container({x: this.p.w, y: this.p.h, w: this.p.w - 20, h: this.p.h - 20, border: 1, fill: "#BBB"}));
            let distance = 16;
            //Pulse the tile that the player is on
            let player = this.p.player;
            for(let i = 0; i < map.tiles.length; i++){
                let tile = map.tiles[i];
                let miniTile = mapObj.insert(new Q.UI.Container({x: (tile.loc[0] - map.centerX) * distance, y: (tile.loc[1] - map.centerY) * distance, w: 24, h: 16, fill: "transparent", radius: 1, border: 2, stroke: "black"}));
                switch(tile.type){
                    case "main":
                        miniTile.insert(new Q.UI.Text({label: "H", size: 12, y: -miniTile.p.h / 2 + 1}));
                        break;
                    case "vendor":
                        miniTile.insert(new Q.UI.Text({label: "V", size: 12, y: -miniTile.p.h / 2 + 1}));
                        break;
                    case "itemshop":
                        miniTile.insert(new Q.UI.Text({label: "I", size: 12, y: -miniTile.p.h / 2 + 1}));
                        break;
                    case "shop":
                        if(tile.ownedBy){
                            miniTile.p.fill = tile.ownedBy.color;
                        }
                        miniTile.p.stroke = Q.GameState.map.data.districts[tile.district].color;
                        break;
                }
                if(Q.locsMatch(player.loc, tile.loc)){
                    miniTile.add("tween");
                    function animate(){
                        miniTile.animate({ opacity: 0.1 }, 1, Q.Easing.Linear)
                            .chain({ opacity: 1 }, 0.5, Q.Easing.Quadratic.InOut, {callback: () => {animate();}});
                    }
                    animate();
                }
            }
        }
    });
    
    
    Q.UI.Container.extend("ShopStatusBox", {
        init: function(p){
            this._super(p, {
                cx:0, 
                cy:0, 
                fill: Q.OptionsController.options.menuColor, 
                opacity:0.8, 
                border:1
            });
            this.on("inserted");
        },
        inserted: function(){
            let shopStatusBox = this;
            this.shopIconAndRankCont = shopStatusBox.insert(new Q.UI.Container({x: 10, y:10, w: shopStatusBox.p.w / 2 - 10, h: shopStatusBox.p.h - 20, cx:0, cy:0}));

            this.shopRankContainer = this.shopIconAndRankCont.insert(new Q.UI.Container({x: this.shopIconAndRankCont.p.w / 2, y:70, w:this.shopIconAndRankCont.p.w - 20, h: 30, fill: "gold"}));
            this.shopRankContainer.insertStars = function(rank){
                this.children.forEach((star) => {star.destroy(); });
                let space = 20;
                for(let i = 0; i < rank; i++){
                    this.insert(new Q.UI.Text({label: "*", x: i * space - (((rank - 1 ) / 2) * space), y: -this.p.h / 4}));
                }
            };

            this.shopBackground = this.shopIconAndRankCont.insert(new Q.UI.Container({cx: 0, cy: 0, x: 10, y: 90, fill: "#222", w:this.shopIconAndRankCont.p.w - 20, h: 90 }));
            this.shopIcon = this.shopIconAndRankCont.insert(new Q.Sprite({x: this.shopIconAndRankCont.p.w / 2, y: 130, w: 64, h: 64}));

            this.shopTextCont = shopStatusBox.insert(new Q.UI.Container({x: shopStatusBox.p.w / 2, y:10, w: shopStatusBox.p.w / 2 - 10, h: shopStatusBox.p.h - 20, cx:0, cy:0}));
            this.shopName = this.shopTextCont.insert(new Q.StandardText({x: 0, y:0, label: " ", align: "center", size: 24, cx: 0, cy:0, w: 1000, h: 1000}));

            this.valueCont = this.shopTextCont.insert(new Q.SmallText({x:this.shopTextCont.p.w / 2, y: 40, label: "Shop value"}));
            this.valueText = this.shopTextCont.insert(new Q.BGText({x: 10, y: 65, w: shopStatusBox.p.w / 2 - 20, h: 25, textP: {textClass: "StandardText", label: " ", x: shopStatusBox.p.w / 2 - 30, y: 3, color: "#EEE"}}));

            this.pricesCont = this.shopTextCont.insert(new Q.SmallText({x: this.shopTextCont.p.w / 2, y: 95, label: "Shop prices"}));
            this.pricesText = this.shopTextCont.insert(new Q.BGText({x: 10, y: 120, w: shopStatusBox.p.w / 2 - 20, h: 25, textP: {textClass: "StandardText", label: " ", x: shopStatusBox.p.w / 2 - 30, y: 3, color: "#EEE"}}));

            this.capitalCont = this.shopTextCont.insert(new Q.SmallText({x: this.shopTextCont.p.w / 2, y: 150, label: "Max. capital"}));
            this.capitalText = this.shopTextCont.insert(new Q.BGText({x: 10, y: 175, w: shopStatusBox.p.w / 2 - 20, h: 25, textP: {textClass: "StandardText", label: " ", x: shopStatusBox.p.w / 2 - 30, y: 3, color: "#EEE"}}));

            this.districtCont = shopStatusBox.insert(new Q.BGText({x: - 10, y: -25, w: Q.c.boxWidth + 20, h: 30, fill: "#AAA", textP: {textClass: "StandardText", label: " ", x: Q.c.boxWidth, y: 5, color: "#111"}}));

            this.bottomDecoration = shopStatusBox.insert(new Q.UI.Container({cx: 0, cy: 0, x: -5, y: Q.c.boxHeight - 2, w: Q.c.boxWidth + 10, h: 5,  fill: "#AAA", radius: 3}));
            shopStatusBox.displayShop(Q.MapController.getTileAt(Q.GameState, this.p.shopLoc));
        },
        
        //Take a tile and display the correct information.
        displayShop: function(shop){
            if(!shop){
                this.hide();
            } else {
                this.show();
                switch(shop.type){
                    case "main":
                        this.shopTextCont.hide();
                        this.shopRankContainer.hide();

                        this.districtCont.p.fill = "#AAA";
                        this.districtCont.text.p.label = "Home Base";

                        this.shopIcon.p.sheet = "home-base-1";
                        break;
                    case "shop":
                        this.shopTextCont.show();
                        this.shopRankContainer.show();

                        this.districtCont.p.fill = Q.GameState.map.data.districts[shop.district].color;
                        this.districtCont.text.p.label = "District " + (shop.district + 1);

                        this.shopName.p.label = shop.name;
                        this.shopRankContainer.insertStars(shop.rank);
                        if(shop.ownedBy){
                            this.shopIcon.p.sheet = "tile-structure-" + shop.rank;
                            this.shopBackground.p.fill = shop.ownedBy.color;
                        } else {
                            this.shopIcon.p.sheet = "shop-for-sale-signpost";
                            this.shopBackground.p.fill = "#222";
                        }

                        this.valueText.text.p.label = shop.value + " G";
                        this.pricesText.text.p.label = shop.cost + " G";
                        this.capitalText.text.p.label = shop.maxCapital + " G";
                        break;
                    case "vendor":
                        this.shopTextCont.hide();
                        this.shopRankContainer.hide();

                        this.districtCont.p.fill = "#AAA";
                        this.districtCont.text.p.label = shop.itemName + " Vendor";

                        this.shopIcon.p.sheet = (shop.itemName.toLowerCase()) + "-vendor";
                        break;
                    case "itemshop":
                        this.shopTextCont.hide();
                        this.shopRankContainer.hide();

                        this.districtCont.p.fill = "#AAA";
                        this.districtCont.text.p.label = "Item Shop";

                        this.shopIcon.p.sheet = "tile-structure-4";
                        break;
                }
            }
        }
    });
    
    Q.UI.Container.extend("NumberDigit", {
        init: function(p){
            this._super(p, {
                w: 40,
                h: 60,
                border: 1,
                fill: "white"
            });
            this.on("inserted");
            this.on("selected");
        },
        selected: function(){
            this.container.p.menuButtons.forEach((button) => {button[0].p.fill = "white";});
            this.p.fill = "red";
        },
        changeLabel: function(label){
            this.p.textNumber.p.label = label + "";
        },
        inserted: function(){
            this.p.textNumber = this.insert(new Q.UI.Text({size:20, label: this.p.number + "", y: -8}));
        }
    });
    Q.UI.Container.extend("NumberCycler", {
        init: function(p){
            this._super(p, {
            });
            this.on("inserted");
            this.on("adjustedNumber");
        },
        adjustedNumber: function(state){
            let value = Q.MenuController.getValueFromNumberCycler(state);
            let td = state.currentCont.tileDetails;
            let shop = Q.stage(2).options.shop;
            let newCapital = shop.maxCapital - value;
            if(newCapital < 0) {
                newCapital = 0;
                value = shop.maxCapital;
            }
            let newCost = Q.MapController.generateShopCost(shop.initialValue, shop.rank, shop.investedCapital + value, Q.MapController.getShopsOwnedInDistrict(state, shop).length);
            td.valueText.text.p.label =  (shop.initialValue * shop.rank + shop.investedCapital + value) + " G";
            td.pricesText.text.p.label = newCost + " G";
            td.capitalText.text.p.label = newCapital + " G";
            
        },
        inserted: function(){
            this.p.menuButtons = [];
            let space = 40;
            for(let i = 0; i < this.p.digits; i++){
                this.p.menuButtons.push([this.insert(new Q.NumberDigit({x: i * space - (((this.p.digits - 1 ) / 2) * space), y: 0, number: 0}))]);
            }
        }
    });
    
    Q.scene("dialogue", function(stage){
        let dialogueBox = stage.insert(new Q.StandardMenu({x: Q.width / 2 - 350, y:Q.height - 210, w: 700, h: 200}));
        let textArea = dialogueBox.insert(new Q.UI.Container({x:10, y:10, cx:0, cy:0, w:490, h:180}));
        let optionsArea = dialogueBox.insert(new Q.MenuButtonContainer({x:510, y:5, cx:0, cy:0, w:185, h:190}));
        if(stage.options.dialogue.onLoadMenu) stage.options.dialogue.onLoadMenu(stage);
        
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
            textArea.p.text = textArea.insert(new Q.ScrollingText({label:item}));
            textArea.p.text.on("doneScrolling", processDialogue);
            Q.GameState.currentCont = textArea.p.text;
            
            if(!dialogue[idx + 1]){
                Q.GameState.currentCont = optionsArea;
                Q.GameState.currentCont.displayOptions(stage.options.dialogue.onHoverOption);
            }
        }
        processDialogue();
    });
    
    Q.scene("menu", function(stage){
        stage.options.selected = stage.options.selected || [0, 0];
        let menu = stage.options.menu;
        let state = stage.options.state;
        let options = Q.GameState.itemGrid;
        let menuBox = stage.insert(new Q.UI.Container({x: 50, y:50, w: 195, h: options.length * 40 + 15 , cx:0, cy:0, fill: Q.OptionsController.options.menuColor, opacity:0.8, border:1}));
        
        let optionsArea = menuBox.insert(new Q.MenuButtonContainer({x:5, y:5, cx:0, cy:0, w:menuBox.p.w - 10, h:menuBox.p.h - 10, fill: Q.OptionsController.options.menuColor}));
        state.currentCont = optionsArea;
        state.currentCont.displayOptions();
        state.currentCont.p.menuButtons[stage.options.selected[1]][stage.options.selected[0]].hover();
    });
    
    Q.scene("investMenu", function(stage){
        let shop = stage.options.shop;
        let digits = stage.options.cycler;
        let currentItem = stage.options.currentItem || [digits - 1, 0];
        console.log(currentItem)
        let menuBox = stage.insert(new Q.StandardMenu({x: Q.width / 2 - 350, y: Q.height / 2 - 250, w: 700, h: 500}));
        menuBox.insert(new Q.StandardText({x: menuBox.p.w / 2, y: 30, label: "Invest in " + shop.name, align: "middle"}));
        stage.numberCycler = menuBox.insert(new Q.NumberCycler({digits: digits, x: menuBox.p.w / 2, y: 100}));
        stage.numberCycler.p.menuButtons[currentItem[0]][currentItem[1]].selected();
        Q.GameState.currentCont = stage.numberCycler;
        let baseTileDetails = menuBox.insert(new Q.ShopStatusBox({x: 20, y: menuBox.p.h / 2 - 40, w: Q.c.boxWidth, h: Q.c.boxHeight, radius: 0, shopLoc: shop.loc, stage: stage}));
        Q.GameState.currentCont.tileDetails = menuBox.insert(new Q.ShopStatusBox({x:menuBox.p.w - Q.c.boxWidth - 20, y: menuBox.p.h / 2 - 40, w: Q.c.boxWidth, h: Q.c.boxHeight, radius: 0, shopLoc: shop.loc, stage: stage}));
    });
    
    Q.scene("upgradeMenu", function(stage){
        console.log("showing upgrade menu");
    });
    Q.scene("setsMenu", function(stage){
        stage.insert(new Q.SetsMenu({player: Q.GameState.turnOrder[0]})); 
    });
    Q.scene("mapMenu", function(stage){
        stage.insert(new Q.MapMenu({player: Q.GameState.turnOrder[0]}));
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