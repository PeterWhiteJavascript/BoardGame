var quintusGameControl = function(Quintus) {
"use strict";

Quintus.GameControl = function(Q) {
    //Functions used to set up the map.
    //Also checks moving around the map
    Q.GameObject.extend("mapController", {
        //Checks to see if anything should be reset when going back to a tile.
        checkResetPassByTile: function(player, tile){
            let boardActions = Q.GameState.currentBoardActions;
            let actionsIdxs = [];
            for(let i = 0; i < boardActions.length; i++){
                if(boardActions[i][0].loc[0] === tile.loc[0] && boardActions[i][0].loc[1] === tile.loc[1]){
                    actionsIdxs.push(i);
                }
            }
            actionsIdxs.forEach((idx) => {
                let action = boardActions[idx];
                Q.GameController[action[1]](...action[2]);
            });
            actionsIdxs.reverse().forEach((idx) => {boardActions.splice(idx, 1);});
        },
        //Checks if anything should happen when this player passes by this tile (also occurs if he lands on the tile).
        checkPassByTile: function(player, tile, finish){
            function finishCallback(){
                if(finish){
                    Q.GameController.askFinishMove(player);
                } else {
                    Q.GameState.inputState = {func: "playerMovement"};
                    if(!Q.isServer() && Q.isActiveUser()){
                        Q.stage(0).on("pressedInput", Q.GameController, "playerMovement");
                    }
                }
            }
            switch(tile.type){
                case "main":
                    //Skip the menu if the player has no sets that can be exchanged.
                    let sets = Q.GameController.getCompleteSets(player);
                    if(!sets.length){
                        return false;
                    }
                    if(!Q.isServer() && Q.isActiveUser()){
                        Q.stage(0).off("pressedInput", Q.GameController, "playerMovement");
                    }
                    let setOptions = sets.map((set, i) => {
                        return [set.name, "purchaseSet", [i]];
                    });
                    setOptions.push(["Nothing", "noExchange"]);
                    Q.MenuController.makeDialogueMenu("askExchangeSets", {
                        options:setOptions,
                        onHoverOption: (option) => {
                            option.stage.setsMenu.hoverSet(option);
                        },
                        onLoadMenu: (stage) => {
                            stage.setsMenu = stage.insert(new Q.SetsMenu({player: player}));
                        },
                        purchaseSet: (num) => {
                            Q.GameController.purchaseSet(num, player.playerId);
                            Q.MenuController.turnOffStandardInputs();
                            finishCallback();
                            return {func: "purchaseSet", num: num, finish: finish, playerId: player.playerId};
                        },
                        noExchange: () => {
                            Q.MenuController.turnOffStandardInputs();
                            finishCallback();
                            return {func: "purchaseSet", finish: finish};
                        }
                    });
                    return true;
                    
                case "vendor":
                    //Not enough money, so don't even ask.
                    if(player.money < tile.itemCost){
                        return false;
                    }
                    
                    if(!Q.isServer() && Q.isActiveUser()){
                        Q.stage(0).off("pressedInput", Q.GameController, "playerMovement");
                    }
                    Q.MenuController.makeDialogueMenu("askVendorBuyItem", {
                        text: Q.c.vendorText[tile.itemName],
                        confirmTrue: () => {
                            Q.GameController.purchaseSetItem(tile.loc, player.playerId);
                            Q.MenuController.turnOffStandardInputs();
                            finishCallback();
                            return {func: "purchaseSetItem", loc: tile.loc, finish: finish, playerId: player.playerId};
                        },
                        confirmFalse: () => {
                            Q.MenuController.turnOffStandardInputs();
                            finishCallback();
                            return {func: "purchaseSetItem", finish: finish};
                        }
                    });
                    return true;
            }
        },
        //Run when the player presses a directional input while moving their dice roll.
        processPlayerMovement: function(input, id){
            let finish, direction, invalidForwardLoc;
            let player = Q.GameController.getPlayer(id);
            let tileOn = Q.MapController.getTileAt(player.loc);
            let tileTo = tileOn.dir[input];
            
            //If there's a tile, and it's not equal to the lastTile (the tile that the player landed on from last turn)
            if(tileTo && (Q.GameState.currentMovementPath.length > 1 || tileTo !== player.lastTile)){
                
                //If the tile that the player is on can only go certain directions, make sure that the user has pressed a valid direction.
                if(tileOn.dirs){
                    let dirs = tileOn.dirs.slice();
                    let allowDir = Q.convertCoordToDir(Q.compareLocsForDirection(tileOn.loc, tileTo.loc));
                    //Only allow it if the previous tile is equal to the tile to
                    if(Q.GameState.currentMovementPath.length > 1 && Q.locsMatch(tileTo.loc, Q.GameState.currentMovementPath[Q.GameState.currentMovementPath.length - 2].loc)){
                        dirs.push(allowDir);
                    }
                    if(!dirs.includes(input)){
                        return false;
                    }
                }
                
                
                
                if(tileTo.dirs && tileTo.dirs.length === 1 && tileTo.dirs[0] === Q.getOppositeDir(input)){
                    invalidForwardLoc = true;
                }
                
                //If the player has gone back a tile
                if(Q.GameState.currentMovementPath.length > 1 && tileTo === Q.GameState.currentMovementPath[Q.GameState.currentMovementPath.length - 2]){
                    Q.GameState.currentMovementPath.pop();
                    direction = "back";
                } 
                //If the player has gone forward a tile.
                else {
                    if(!invalidForwardLoc){
                        if(Q.GameState.currentMovementPath.length <= Q.GameState.currentMovementNum){
                            Q.GameState.currentMovementPath.push(tileTo);
                        } else {
                            return false;
                        }
                        direction = "forward";
                    }
                }
                if(!direction) return false;
                Q.GameController.movePlayer(player, tileTo);
                
                finish = Q.GameState.currentMovementPath.length === Q.GameState.currentMovementNum + 1;
                if(!Q.isServer()){
                Q.GameController.tileDetails.displayShop(tileTo);
                }
                if(direction === "forward"){
                    if(Q.MapController.checkPassByTile(player, tileTo, finish)) return {loc: tileTo.loc};
                } else if(direction === "back"){
                    Q.MapController.checkResetPassByTile(player, tileTo);
                    return {loc: tileTo.loc};
                }
            } else {
                return false;
            }
            return {loc: tileTo.loc, finish: finish};
        },
        
        getTileAt: function(loc){
            return Q.GameState.map.grid[loc[1]][loc[0]];
        },
        addToGrid: function(x, y, w, h, arr, add){
            for(let i = 0; i < h; i++){
                for(let j = 0; j < w; j++){
                    arr[y + i][x + j] = add;
                }
            } 
        },
        getShopsOwnedInDistrict: function(shop){
            return Q.GameState.map.districts[shop.district].filter((s) => {return shop.ownedBy === s.ownedBy;}).length;
        },
        generateShopValue: function(value, rank, investedCapital){
            return value * rank + investedCapital;
        },
        generateShopCost: function(value, rank, investedCapital, numberOfShopsInDistrict){
            // 20 - 25 - 30 - 35 - 40
            return ~~((value * rank + investedCapital) * (0.2 + (rank - 1) * 0.05 + numberOfShopsInDistrict * 0.05));
        },
        //Initial value plus half of an initial value for every rank. Minus the capital that has already been invested.
        generateShopMaxCapital: function(value, rank, investedCapital){
            return ~~(value + (value / 2 * rank)) - investedCapital;
        },
        //Pass the map data and return the fully generated map inside a tile w*h tile grid.
        generateMap: function(mapData, settings){
            let map = {
                data: mapData,
                tiles: [],
                districts: []
            };
            mapData.districts.forEach(() => {map.districts.push([]);});
            let grid = Q.createArray(false, mapData.map.w, mapData.map.h);
            //Add tiles to grid and generate their sprite.
            for(let i = 0; i < mapData.tiles.length; i++){
                let tileData = mapData.tiles[i];
                let tile = {
                    loc: [tileData.x, tileData.y],
                    type: tileData.type,
                    dirs: tileData.dirs
                };
                map.tiles.push(tile);
                Q.MapController.addToGrid(tileData.x, tileData.y, 2, 2, grid, tile);
                //Do different things based on the tile type.
                switch(tile.type){
                    case "shop":
                        tile.initialValue = tileData.value;
                        tile.rank = tileData.rank;
                        tile.investedCapital = 0;
                        tile.name = tileData.name;
                        tile.district = tileData.district;
                        tile.value = Q.MapController.generateShopValue(tile.initialValue, tile.rank, tile.investedCapital);
                        tile.cost = Q.MapController.generateShopCost(tile.initialValue, tile.rank, tile.investedCapital, 1);
                        tile.maxCapital = Q.MapController.generateShopMaxCapital(tile.initialValue, tile.rank, tile.investedCapital, 1);
                        map.districts[tile.district].push(tile);
                        break;
                    case "main":
                        map.mainTile = tile;
                        break;
                    case "vendor":
                        tile.itemName = tileData.item[0];
                        tile.itemCost = tileData.item[1];
                        break;
                }
            }
            //Loop through the tiles and detect the tile that is at the direction that is available.
            for(let i = 0; i < map.tiles.length; i++){
                let tile = map.tiles[i];
                let dirObj = {};
                //The dir idx of any tiles around this tile
                let tilesAroundAt = {};
                let dirIdxs = Q.c.dirIdxs.all;
                //This can be optimized to only check the necessary directions that are saved on the tile object.
                //Loop all 16 directions to find tiles
                for(let j = 0; j < dirIdxs.length; j++){
                    let checkAt = [tile.loc[0] + dirIdxs[j][0], tile.loc[1] + dirIdxs[j][1]];
                    //Make sure the loc is above 0 and less than maxX/Y
                    if(Q.locInBounds(checkAt, mapData.map.w, mapData.map.h)){
                        let tileOn = grid[checkAt[1]][checkAt[0]];
                        if(tileOn && Q.locsMatch(tileOn.loc, checkAt)){
                            tilesAroundAt[j] = tileOn;
                        }
                    }
                }
                //Remove diagonals if there is an adjacent.
                //Optimization: do this with a loop
                if(tilesAroundAt[2]){
                    delete tilesAroundAt[0];
                    delete tilesAroundAt[4];
                }
                if(tilesAroundAt[6]){
                    delete tilesAroundAt[4];
                    delete tilesAroundAt[8];
                }
                if(tilesAroundAt[10]){
                    delete tilesAroundAt[8];
                    delete tilesAroundAt[12];
                }
                if(tilesAroundAt[14]) {
                    delete tilesAroundAt[12];
                    delete tilesAroundAt[0];
                }
                //Convert all dir idxs to button inputs.
                //Do all adjacent and offset, and then if there are overlapping diagonals, deal with them.
                let order = [1, 3, 5, 7, 9, 11, 13, 15, 2, 6, 10, 14, 0, 4, 8, 12];
                for(let j = 0; j < order.length; j++){
                    //If there's a tile at this idx
                    if(tilesAroundAt[order[j]]){
                        //Get the direction
                        if(order[j] >= 1 && order[j] <= 3){
                            dirObj.up = tilesAroundAt[order[j]];
                        } else if(order[j] >= 5 && order[j] <= 7){
                            dirObj.right = tilesAroundAt[order[j]];
                        } else if(order[j] >= 9 && order[j] <= 11){
                            dirObj.down = tilesAroundAt[order[j]];
                        } else if(order[j] >= 13 && order[j] <= 15){
                            dirObj.left = tilesAroundAt[order[j]];
                        }
                        
                        if(order[j] === 0){
                            if(dirObj.left){
                                dirObj.up = tilesAroundAt[order[j]];
                            } else {
                                dirObj.left = tilesAroundAt[order[j]];
                            }
                        } else if(order[j] === 4){
                            if(dirObj.up){
                                dirObj.right = tilesAroundAt[order[j]];
                            } else {
                                dirObj.up = tilesAroundAt[order[j]];
                            }
                        } else if(order[j] === 8){
                            if(dirObj.right){
                                dirObj.down = tilesAroundAt[order[j]];
                            } else {
                                dirObj.right = tilesAroundAt[order[j]];
                            }
                        } else if(order[j] === 12){
                            if(dirObj.down){
                                dirObj.left = tilesAroundAt[order[j]];
                            } else {
                                dirObj.down = tilesAroundAt[order[j]];
                            }
                        }
                    }
                }
                
                //Dir IDX Positions - [[-2, -2], [-1, -2], [0, -2], [1, -2], [2, -2], [2, -1], [2, 0], [2, 1], [2, 2], [1, 2], [0, 2], [-1, 2], [-2, 2], [-2, 1], [-2, 0], [-2, -1]]
                //Dir IDXS - 0 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15
                
                //Diagonal - 0 4 8 12           (i * 4)
                //Offset   - 1 3 5 7 9 11 13 15 (i * 4 + 2)
                //Adjacent - 2 6 10 14          (i * 2 + 1)
                
                //Up    - 0 1 2 3 4
                //Right - 4 5 6 7 8
                //Down  - 8 9 10 11 12
                //Left  - 12 13 14 15 0
                
                /* Visualization
                 * 0   1   2   3   4  
                 * 15  x   x   x   5
                 * 14  x   C   x   6
                 * 13  x   x   x   7
                 * 12  11  10  9   8
                 */
                
                tile.dir = dirObj;
                
                
                
            }
            map.grid = grid;
            return map;
        }
    });
    Q.Sprite.extend("ShopSelector", {
        init: function(p){
            //TODO: pass this xy value it.
            let pos = Q.getXY(p.pos || Q.GameState.turnOrder[0].loc);
            this._super(p,{
                x: pos.x + Q.c.tileW / 2,
                y: pos.y + Q.c.tileH / 2,
                w: Q.c.tileW * 3,
                h: Q.c.tileH * 2
            });
            this.acceptedInput = false;
            this.animating = false;
            this.timerSet = false;
            this.atTile = true;
            
            this.add("tween");
            this.on("inserted");
            this.on("moved");
            this.on("step");
        },
        inserted: function(){
            this.sprite = this.stage.insert(new Q.Sprite({sheet:"selector-sprite", frame:1, x: this.p.x, y: this.p.y}));
            this.on("step", function(){
                this.sprite.p.x = this.p.x;
                this.sprite.p.y = this.p.y;
            });
        },
        tweenToTile: function(){
            let tile = this.shopOn;
            if(tile){
                let pos = Q.getXY(tile.loc);
                this.animate(
                    {x: pos.x + Q.c.tileW / 2, y: pos.y + Q.c.tileH / 2}, 0.1, Q.Easing.Quadratic.InOut, 
                        {
                        callback: function(){
                            this.animating = false; 
                            this.atTile = true;
                            this.hoverShop();
                        }
                    }
                );
                this.animating = true;
            }
        },
        dehoverShop: function(){
            if(this.sprite){
                this.sprite.p.frame = 0;
            }
        },
        hoverShop: function(){
            if(this.sprite){
                this.sprite.p.frame = 1;
            }
        },
        moved: function(coord){
            let speed = 1.5;
            this.p.x = this.p.x + coord[0] * (4 * speed);
            this.p.y = this.p.y + coord[1] * (3 * speed);
            this.acceptedInput = true;
            this.atTile = false;
            this.dehoverShop();
            let loc = Q.getLoc(this.p.x - Q.c.tileW / 2, this.p.y - Q.c.tileH / 4);
            if(Q.locInBounds(loc, Q.GameState.map.data.map.w, Q.GameState.map.data.map.h)){
                this.shopOn = Q.MapController.getTileAt(loc);
                if(!Q.isServer()){
                    Q.GameController.tileDetails.displayShop(this.shopOn);
                }
            } else {
                this.shopOn = false;
                if(!Q.isServer()){
                    Q.GameController.tileDetails.displayShop(this.shopOn);
                }
            }
        },
        step: function(){
            if(this.acceptedInput && this.animating){
                this.stop();
                this.animating = false;
                this.atTile = false;
            }
            if(!this.acceptedInput && !this.animating && !this.atTile){
                this.tweenToTile();
            }
            this.acceptedInput = false;
        }
    });
    
    //Functions that are run during gameplay.
    //Add/remove shop from player, stocks, etc...
    Q.GameObject.extend("gameController", {
        addBoardAction: function(tile, action, props){
            if(tile === "prev") tile = Q.GameState.currentMovementPath[Q.GameState.currentMovementPath.length - 2];
            Q.GameState.currentBoardActions.push([tile, action, props]);
        },
        purchaseSet: function(num, playerId){
            let player = Q.GameController.getPlayer(playerId);
            let sets = Q.GameController.getCompleteSets(player);
            let set = sets[num];
            Q.GameController.changePlayerMoney(player, set.value);
            Q.GameController.addBoardAction("prev", "changePlayerMoney", [player, -set.value]);
            Q.GameController.changePlayerNetValue(player, set.value);
            Q.GameController.addBoardAction("prev", "changePlayerNetValue", [player, -set.value]);
            set.items.forEach((item) => {
                Q.GameController.changeSetItemQuantity(player, item, -1);
                Q.GameController.addBoardAction("prev", "changeSetItemQuantity", [player, item, 1]);
            });
            Q.GameController.changePlayerRank(player, 1);
            Q.GameController.addBoardAction("prev", "changePlayerRank", [player, -1]);

        },
        purchaseSetItem: function(tileLoc, playerId){
            let tile = Q.MapController.getTileAt(tileLoc);
            let player = Q.GameController.getPlayer(playerId);
            Q.GameController.changePlayerMoney(player, -tile.itemCost);
            Q.GameController.addBoardAction("prev", "changePlayerMoney", [player, tile.itemCost]);
            Q.GameController.changeSetItemQuantity(player, tile.itemName, 1);
            Q.GameController.addBoardAction("prev", "changeSetItemQuantity", [player, tile.itemName, -1]);

        },
        changePlayerRank: function(player, rank){
            player.rank += rank;
        },
        changeSetItemQuantity: function(player, itemName, number){
            if(!player.setPieces[itemName]) player.setPieces[itemName] = 0;
            player.setPieces[itemName] += number;
        },
        changePlayerMoney: function(player, amount){
            player.money += amount;
            if(!Q.isServer()){
                player.sprite.trigger("moneyChanged");
            }
        },
        changePlayerNetValue: function(player, amount){
            player.netValue += amount;
            if(!Q.isServer()){
                player.sprite.trigger("netValueChanged");
            }
        },
        getCompleteSets: function(player){
            return Q.GameState.map.data.sets.filter((set) => {
                return set.items.every((item) => {
                    return player.setPieces[item];
                });
            });
        },
        startRollingDie: function(num, player){
            Q.clearStage(1);
            this.dice = [];
            for(let i = 0; i < num; i++){
                this.dice.push(Q.stage(0).insert(new Q.Die({x: player.p.x, y: player.p.y - Q.c.tileH * 2})));
            }
            if(Q.isActiveUser()){
                Q.stage(0).on("pressedInput", this.dice[0], "stopDie");
            }
        },
        //Removes all dice
        removeDice: function(){
            this.dice.forEach((die) => {die.removeDie();});
        },
        //Stops the first die in the array. Usually there will be only one die, but sometimes there could be two due to an item or something.
        stopDie: function(num){
            if(Q.GameState.currentMovementNum){
                this.dice[0].stop(num);
            }
        },
        playerMovement: function(input, playerId){
            let id = playerId || Q.user.id;
            let obj = Q.MapController.processPlayerMovement(input, id);
            if(obj.finish){
                if(Q.isActiveUser()){
                    Q.stage(0).off("pressedInput", Q.GameController, "playerMovement");
                }
                Q.GameController.askFinishMove(Q.GameController.getPlayer(id));
            }
        },
        allowPlayerMovement: function(num){
            Q.GameState.currentMovementNum = num;
            Q.GameState.currentMovementPath = [Q.MapController.getTileAt(Q.GameState.turnOrder[0].loc)];
            if(Q.GameState.turnOrder[0].sprite){
                Q.GameState.turnOrder[0].sprite.showMovementDirections();
                if(Q.isActiveUser()){
                    Q.stage(0).on("pressedInput", Q.GameController, "playerMovement");
                }
            }
        },
        //After the player says "yes" to stopping here.
        playerConfirmMove: function(id){
            let player = this.getPlayer(id);
            let tileOn = Q.MapController.getTileAt(player.loc);
            switch(tileOn.type){
                case "shop":
                    //Pay the owner and then give the option to buy out
                    if(tileOn.ownedBy){
                        //If the tile is owned by the player (do nothing???)
                        if(tileOn.ownedBy === player){
                            Q.GameController.endTurn();
                        } 
                        //Pay the owner
                        else {
                            Q.GameController.changePlayerMoney(player, -tileOn.cost);
                            Q.GameController.changePlayerNetValue(player, -tileOn.cost);
                            Q.GameController.changePlayerMoney(tileOn.ownedBy, tileOn.cost);
                            Q.GameController.changePlayerNetValue(tileOn.ownedBy, tileOn.cost);
                            //Ask for buyout
                            if(player.money >= tileOn.value * 5){
                                Q.MenuController.makeDialogueMenu("askBuyOutShop");
                            } else {
                                Q.GameController.endTurn();
                            }
                        }
                    } 
                    //Ask if the player would like to buy it.
                    else {
                        //If the player doesn't have enough money, skip this step and end the turn
                        if(player.money < tileOn.value){
                            Q.GameController.endTurn();
                        } else {
                            Q.MenuController.makeDialogueMenu("askBuyShop");
                        }
                    }
                    break;
                case "main":
                    Q.GameController.endTurn();
                    break;
                case "vendor":
                    Q.GameController.endTurn();
                    
                    break;
            }
        },
        playerGoBackMove: function(id){
            let player = this.getPlayer(id);
            Q.GameState.currentMovementPath.pop();
            let tileTo = Q.GameState.currentMovementPath[Q.GameState.currentMovementPath.length - 1];
            Q.GameController.movePlayer(player, tileTo);
            Q.MapController.checkResetPassByTile(player, tileTo);
            if(!Q.isServer()){
                player.sprite.p.allowMovement = true;
                //Show the tile props in a menu
                Q.GameController.tileDetails.displayShop(Q.MapController.getTileAt(tileTo.loc));
            }
            return tileTo.loc;
        },  
        //When the player steps onto the last tile of the movement
        askFinishMove: function(player){
            if(!Q.isServer()){
                player.sprite.destroyArrows();
                player.sprite.p.allowMovement = false;
            }
            return Q.MenuController.makeDialogueMenu("menuMovePlayer");
        },
        movePlayer: function(player, tileTo){
            player.loc = tileTo.loc;
            if(player.sprite){
                player.sprite.moveTo(tileTo.loc);
            }
        },
        getPlayer: function(id){
            return Q.GameState.turnOrder.find(player => { return player.playerId === id;});
        },
        setUpPlayers: function(data, mainTile){
            let players = [];
            for(let i = 0; i < data.users.length; i++){
                players.push({
                    playerId: data.users[i].id,
                    loc: [mainTile.loc[0], mainTile.loc[1] - 2],
                    money: data.mapData.modes[data.settings.mode].startMoney,
                    netValue: data.mapData.modes[data.settings.mode].startMoney,
                    color: data.users[i].color,
                    shops: [],
                    items: [],
                    setPieces: {
                        Peanut: 1
                    },
                    stocks: [],
                    investments: [],
                    rank: 1,
                    maxItems: 1,
                    dieMin: 1,
                    dieMax: 6
                    //Etc... Add more as I think of more. TODO
                });
            }
            return players;
        },
        //When a game is started (all players connected, settings are set, about to load map)
        setUpGameState: function(data){
            let map = Q.MapController.generateMap(data.mapData, data.settings);
            let players = Q.GameController.setUpPlayers(data, map.mainTile);
            return {map: map, players: players, inputState: Q.MenuController.inputStates.playerTurnMenu};
        },
        //Functions that happen when the current player ends the turn
        endTurn: function(){
            Q.GameState.turnOrder[0].lastTile = Q.GameState.currentMovementPath[Q.GameState.currentMovementPath.length - 2];
            Q.GameState.turnOrder.push(Q.GameState.turnOrder.shift());
            Q.GameController.startTurn();
        },
        //Functions that happen when the new current player starts his turn
        startTurn: function(){
            Q.GameState.currentMovementNum = false;
            Q.GameState.currentBoardActions = [];
                    
            let player = Q.GameState.turnOrder[0];
            player.turn = true;
            player.invested = 0;
            Q.MenuController.makeMenu("playerTurnMenu", [0, 0]);
            if(!Q.isServer()){
                if(Q.isActiveUser()){
                    Q.stage(0).insert(new Q.TurnAnimation());
                    Q.inputs["confirm"] = false;
                }   
            }
        },
        buyShop: function(player, shop){
            Q.GameController.changePlayerMoney(player, -shop.value);
            shop.ownedBy = player;
            Q.GameController.adjustShopValues(player, shop);
            if(!Q.isServer()){
                shop.sprite.updateTile(player.color);
                Q.GameController.tileDetails.displayShop(shop);
            }
        },
        buyOutShop: function(player, shop){
            Q.GameController.changePlayerMoney(shop.ownedBy, shop.value * 3);
            Q.GameController.changePlayerNetValue(shop.ownedBy, shop.value * 3);
            Q.GameController.changePlayerMoney(player, -shop.value * 5);
            Q.GameController.changePlayerNetValue(player, -shop.value * 4);
            if(!Q.isServer()){
                shop.sprite.updateTile(player.color);
            }
            shop.ownedBy = player;
            Q.GameController.adjustShopValues(player, shop);
            Q.GameController.adjustShopValues(shop.ownedBy, shop);
        },
        //Changes the value of shops in the district based on the number that the player owns.
        adjustShopValues: function(player, shop){
            let shopsOwned = Q.MapController.getShopsOwnedInDistrict(shop);
            if(shopsOwned.length > 1){
                shopsOwned.forEach((shop) => {
                    shop.cost = Q.MapController.generateShopCost(shop.initialValue, shop.rank, shop.investedCapital, shopsOwned.length);
                    shop.maxCapital = Q.MapController.generateShopMaxCapital(shop.initialValue, shop.rank, shop.investedCapital, shopsOwned.length);
                    if(!Q.isServer()){
                        shop.sprite.updateTile(player.color);
                    }
                });
            }
        },
        //Updates the shop to the current values.
        updateShopValues: function(shop){
            let shopsOwned = shop.ownedBy ? Q.MapController.getShopsOwnedInDistrict(shop) : 1;
            shop.value = Q.MapController.generateShopValue(shop.initialValue, shop.rank, shop.investedCapital);
            shop.cost = Q.MapController.generateShopCost(shop.initialValue, shop.rank, shop.investedCapital, shopsOwned);
            if(!Q.isServer()){
                shop.sprite.updateTile(shop.ownedBy.color);
                Q.GameController.tileDetails.displayShop(shop);
            }
        }
    });
    
    
    //This does not display anything or make sounds. It's run on the client and server.
    Q.GameObject.extend("menuController", {
        makeDialogueMenu: function(state, dialogue){
            Q.GameState.inputState = dialogue ? {...dialogue, ...Q.MenuController.inputStates[state]} : Q.MenuController.inputStates[state];
            Q.MenuController.initializeMenu(Q.GameState.inputState);
            if(!Q.isServer()){
                Q.stageScene("dialogue", 1, {dialogue: Q.GameState.inputState});
                Q.MenuController.turnOnStandardInputs();
            }
        },
        makeCustomMenu: function(menu, props){
            Q.GameState.inputState = Q.MenuController.inputStates[menu];
            Q.GameState.inputState.shop = props.shop;
            //These are all custom menus,so do all of the "makeMenu" code here.
            switch(menu){
                case "investMenu":
                    Q.MenuController.initializeNumberCycler(props);
                    if(!Q.isServer()){
                        Q.stageScene("investMenu", 1, props);
                        Q.MenuController.turnOnNumberCyclerInputs();
                    }
                    break;
                case "upgradeMenu":
                    Q.MenuController.initializeConfirmer();
                    if(!Q.isServer()){
                        Q.stageScene("upgradeMenu", 1, props);
                        Q.MenuController.turnOnConfirmerInputs();
                    }
                    
                    break;
                case "auctionMenu":
                    
                    break;
            }
            return Q.GameState.inputState;
        },
        makeMenu: function(state, selected){
            Q.GameState.inputState = Q.MenuController.inputStates[state];
            Q.MenuController.initializeMenu(Q.GameState.inputState, selected);
            if(Q.GameState.inputState.preDisplay) Q.GameState.inputState.preDisplay();
            if(!Q.isServer()){
                Q.stageScene("menu", 1, {menu: Q.GameState.inputState, selected: selected || [0, 0], options: Q.MenuController.itemGrid});
                Q.MenuController.turnOnStandardInputs();
            }
            return Q.GameState.inputState;
        },
        makeMoveShopSelector: function(confirmType, backFunc, startPos){
            let goBack, finish;
            switch(confirmType){
                case "invest":
                    finish = function(shop){
                        if(!shop) return;//TODO: play sound???
                        Q.MenuController.turnOffMoveSelectShopInputs();
                        Q.MenuController.makeCustomMenu("investMenu", {shop: shop, cycler: 6});
                        return {
                            func: "turnOffMoveSelectShopInputs", 
                            next: {
                                menu: "investMenu",
                                type: "custom"
                            }
                        };
                    };
                    break;
                case "upgrade":
                    finish = function(shop){
                        if(!shop) return;//TODO: play sound???
                        Q.MenuController.turnOffMoveSelectShopInputs();
                        Q.MenuController.makeCustomMenu("upgradeMenu", {shop: shop});
                        return {
                            func: "turnOffMoveSelectShopInputs", 
                            next: {
                                menu: "upgradeMenu",
                                type: "custom"
                            }
                        };
                    };
                    break;
                case "auction":
                    finish = function(shop){
                        if(!shop) return;//TODO: play sound???
                        Q.MenuController.turnOffMoveSelectShopInputs();
                        Q.MenuController.makeCustomMenu("auctionMenu", {shop: shop});
                        return {
                            func: "turnOffMoveSelectShopInputs", 
                            next: {
                                menu: "auctionMenu",
                                type: "custom"
                            }
                        };
                    };
                    break;
            }
            switch(backFunc){
                case "toShopsMenu":
                    goBack = function(backOption){
                        let backOpt = backOption === "invest" ? [0, 0] : backOption === "upgrade" ? [0, 1] : [0, 2];
                        Q.MenuController.turnOffMoveSelectShopInputs();
                        Q.MenuController.makeMenu("shopsMenu", backOpt);
                        return {
                            func: "turnOffMoveSelectShopInputs", 
                            next: {
                                menu: "shopsMenu",
                                type: "normal"
                            }
                        };
                    };
                    break;
            }
            Q.GameState.inputState = {
                func: "moveShopSelector", 
                goBack: goBack,
                finish: finish,
                type: "currentOwned",
                backOption: confirmType
            };
            Q.GameState.shopSelector = new Q.ShopSelector({pos: startPos});
            Q.MenuController.turnOnMoveSelectShopInputs();
            return {func: "makeMoveShopSelector", confirmType: confirmType, backFunc: backFunc, startPos: startPos};
        },
        runDeepFunction: function(props){
            console.log(props)
            let obj = Q.getDeepValue(Q.MenuController.inputStates, props);
        },
        turnOffMoveSelectShopInputs: function(){
            if(!Q.isServer()){
                Q.preventMultipleInputs = true;
                Q.GameState.shopSelector.sprite.destroy();
                if(Q.isActiveUser()){
                    Q.stage(0).off("pressedInput", Q.MenuController, "processShopSelectorInput");
                }
            }
        },
        turnOnMoveSelectShopInputs: function(){
            if(!Q.isServer()){
                Q.preventMultipleInputs = false;
                Q.stage(0).insert(Q.GameState.shopSelector);
                if(Q.isActiveUser()){
                    Q.stage(0).on("pressedInput", Q.MenuController, "processShopSelectorInput");
                    Q.GameState.shopSelector.on("destroyed", function(){
                        Q.stage(0).off("pressedInput", Q.MenuController, "processShopSelectorInput");
                    });
                }
            }
        },
        turnOffConfirmerInputs: function(){
            if(!Q.isServer()){
                Q.clearStage(1);
                if(Q.isActiveUser()){
                    Q.stage(0).off("pressedInput", Q.MenuController, "processConfirmerInput");
                }
            }
        },
        turnOnConfirmerInputs: function(){
            if(Q.isActiveUser()){
                Q.stage(0).on("pressedInput", Q.MenuController, "processConfirmerInput");
                Q.stage(1).on("destroyed", function(){Q.stage(0).off("pressedInput", Q.MenuController, "processConfirmerInput");});
            }
        },
        turnOffNumberCyclerInputs: function(){
            if(!Q.isServer()){
                Q.clearStage(1);
                if(Q.isActiveUser()){
                    Q.stage(0).off("pressedInput", Q.MenuController, "processNumberCyclerInput");
                }
            }
        },
        turnOnNumberCyclerInputs: function(){
            if(Q.isActiveUser()){
                Q.stage(0).on("pressedInput", Q.MenuController, "processNumberCyclerInput");
                Q.stage(1).on("destroyed", function(){Q.stage(0).off("pressedInput", Q.MenuController, "processNumberCyclerInput");});
            }
        },
        turnOffStandardInputs: function(){
            if(!Q.isServer()){
                Q.clearStage(1);
                if(Q.isActiveUser()){
                    Q.stage(0).off("pressedInput", Q.MenuController, "processInput");
                }
            }
        },
        turnOnStandardInputs: function(){
            if(Q.isActiveUser()){
                Q.stage(0).on("pressedInput", Q.MenuController, "processInput");
                Q.stage(1).on("destroyed", function(){Q.stage(0).off("pressedInput", Q.MenuController, "processInput");});
            }
        },
        inputStates: {
            investMenu: {
                func: "controlNumberCycler",
                cycler: 6,
                confirm: () => {
                    let investAmount = Q.MenuController.getValueFromNumberCycler();
                    let maxCapital = Q.GameState.inputState.shop.maxCapital;
                    let playerMoney = Q.GameState.turnOrder[0].money;
                    //If the invest amount is greater than allowed, set the amount to the allowed amount.
                    if(investAmount > maxCapital || investAmount > playerMoney){
                        let newAmount = Math.min(maxCapital, playerMoney);
                        Q.MenuController.setNumberCyclerValue(newAmount);
                    }
                    //Otherwise, invest that amount into the shop.
                    else {
                        if(investAmount){
                            Q.GameState.inputState.shop.maxCapital -= investAmount;
                            Q.GameState.inputState.shop.investedCapital += investAmount;
                            Q.GameController.updateShopValues(Q.GameState.inputState.shop);
                            Q.GameController.changePlayerMoney(Q.GameState.turnOrder[0], -investAmount);
                            Q.GameState.turnOrder[0].invested++;
                        }
                        Q.MenuController.turnOffNumberCyclerInputs();
                        return Q.MenuController.makeMenu("playerTurnMenu", [0, 0]);
                    }
                },
                goBack: () => {
                    Q.MenuController.turnOffNumberCyclerInputs();
                    return Q.MenuController.inputStates.shopsMenu.cursorSelectShop("invest", "toShopsMenu", Q.GameState.inputState.shop.loc);
                }
            },
            upgradeMenu: {
                func: "confirmer",
                confirm: () => {
                    //Upgrade the shop
                    console.log("upgrade")
                },
                goBack: () => {
                    console.log("going back")
                    Q.MenuController.turnOffConfirmerInputs();
                    return Q.MenuController.inputStates.shopsMenu.cursorSelectShop("upgrade", "toShopsMenu", Q.GameState.inputState.shop.loc);
                }
            },
            auctionMenu: {
                
            },  
            askExchangeSets: {
                func: "navigateMenu",
                text: ["Looks like you've got a set! \nWhich one would you like to exchange?"]
            },
            askVendorBuyItem: {
                func: "navigateMenu",
                options:[
                    ["Yes", "confirmTrue"],
                    ["No", "confirmFalse"]
                ]
            },
            playerTurnMenu: {
                func: "navigateMenu",
                options:[
                    ["Roll", "rollDie"],
                    ["Shops", "showShopsMenu"],
                    ["View Board", "viewBoard"],
                    ["View Standings", "viewStandings"],
                    ["Options", "showOptions"]
                ],
                rollDie: () => {
                    let roll;
                    if(Q.isServer()){
                        roll = ~~(Q.random() * Q.GameState.turnOrder[0].dieMax + 1 - Q.GameState.turnOrder[0].dieMin) + Q.GameState.turnOrder[0].dieMin;
                        Q.GameState.currentMovementNum = roll;
                    }
                    Q.GameState.inputState = {func: "rollDie", roll: roll, self: true};
                    return Q.GameState.inputState;
                },
                showShopsMenu: () => {
                    Q.MenuController.makeMenu("shopsMenu");
                    return {func: "loadOptionsMenu", menu: "shopsMenu", selected: [0, 0]};
                },
                viewBoard: () => {
                    
                },
                viewStandings: () => {
                    
                },
                showOptions: () => {
                    
                }
            },
            shopsMenu: {
                func: "navigateMenu",
                preDisplay: () => {
                    let player = Q.GameState.turnOrder[0];
                    //TODO: check against the allowed for this turn
                    //TODO: instead of removal, cross it out (mark as not allowed or something)
                    if(player.invested > 0){
                        Q.MenuController.itemGrid.splice(0, 1);
                    }
                    if(player.upgraded > 0){
                        Q.MenuController.itemGrid.splice(1, 1);
                    }
                    if(player.auctioned > 0){
                        Q.MenuController.itemGrid.splice(2, 1);
                    }
                },
                options:[
                    ["Invest", "cursorSelectShop", ["invest", "toShopsMenu"]],
                    ["Upgrade", "cursorSelectShop", ["upgrade", "toShopsMenu"]],
                    ["Auction", "cursorSelectShop", ["auction", "toShopsMenu"]]
                ],
                goBack: () => {
                    Q.GameState.inputState = Q.MenuController.inputStates.playerTurnMenu;
                    let selected = [0, 1];
                    Q.MenuController.initializeMenu(Q.GameState.inputState, selected);
                    if(!Q.isServer()){
                        Q.stageScene("menu", 1, {menu: Q.GameState.inputState, selected: selected, options: Q.MenuController.itemGrid});
                        Q.MenuController.turnOnStandardInputs();
                    }
                    return {func: "loadOptionsMenu", selected: selected, menu: "playerTurnMenu"};
                },
                //Gives the active player a cursor that they can move around the map to select a shop.
                //What happens after selecting the shop is determined by the passed in type
                cursorSelectShop: (finish, goBack, startPos) => {
                    Q.MenuController.turnOffStandardInputs();
                    return Q.MenuController.makeMoveShopSelector(finish, goBack, startPos);
                }
            },
            menuMovePlayer: {
                func: "navigateMenu",
                text: ["Would you like to end your roll here?"],
                options:[
                    ["Yes", "confirmTrue"],
                    ["No", "confirmFalse"]
                ],
                confirmTrue: () => {
                    if(!Q.isServer()){
                        if(Q.isActiveUser()){
                            Q.stage(0).off("pressedInput", Q.MenuController, "processInput");
                        }
                    }
                    Q.GameController.playerConfirmMove(Q.GameState.turnOrder[0].playerId);
                    return {func: "playerConfirmMove"};
                },
                confirmFalse: () => {
                    let loc = Q.GameController.playerGoBackMove(Q.GameState.turnOrder[0].playerId);
                    Q.GameState.inputState = {func: "playerMovement"};
                    Q.MenuController.turnOffStandardInputs();
                    if(!Q.isServer()){
                        if(Q.isActiveUser()){
                            Q.stage(0).on("pressedInput", Q.GameController, "playerMovement");
                        }
                    }
                    Q.GameState.inputState = {func: "playerMovement", locTo: loc};
                    return {func: "playerGoBackMove", locTo: loc};
                }
            },
            askBuyShop: {
                func: "navigateMenu",
                text: ["Would you like to buy this shop?"],
                options:[
                    ["Yes", "confirmTrue"],
                    ["No", "confirmFalse"]
                ],
                confirmTrue: () => {
                    let player = Q.GameState.turnOrder[0];
                    let tileOn = Q.MapController.getTileAt(player.loc);
                    Q.GameController.buyShop(player, tileOn);
                    Q.MenuController.turnOffStandardInputs();
                    
                    Q.GameController.endTurn();
                    return {func: "buyShop", shopLoc: player.loc};
                },
                confirmFalse: () => {
                    Q.GameController.endTurn();
                    return {func: "endTurn"};
                }
            },
            askBuyOutShop: {
                func: "navigateMenu",
                text: ["Would you like to buy out this shop?"],
                options:[
                    ["Yes", "confirmTrue"],
                    ["No", "confirmFalse"]
                ],
                confirmTrue: () => {
                    let player = Q.GameState.turnOrder[0];
                    let tileOn = Q.MapController.getTileAt(player.loc);
                    let ownedBy = tileOn.ownedBy;
                    Q.GameController.buyOutShop(player, tileOn);
                    Q.MenuController.turnOffStandardInputs();
                    
                    Q.GameController.endTurn();
                    return {func: "buyOutShop", shopLoc: player.loc};
                },
                confirmFalse: () => {
                    Q.GameController.endTurn();
                    return {func: "endTurn"};
                }
            }
        },
        //Confirmer does not take directional inputs. Only confirm/back
        initializeConfirmer: function(){
            this.currentItem = [0, 0];
            this.itemGrid = [[[0, "confirm"]]];
        },
        initializeNumberCycler: function(data){
            this.currentItem = data.currentItem || [data.cycler - 1, 0];
            this.itemGrid = [[]];
            for(let i = 0 ; i < data.cycler; i++){
                this.itemGrid[0].push([0, "confirm"]);
            }
        },
        initializeMenu: function(data, currentItem){
            if(this.currentCont) this.currentCont = false;
            this.currentItem = currentItem || [0, 0];
            this.itemGrid = [];
            for(let i = 0 ; i < data.options.length; i++){
                this.itemGrid.push([data.options[i]]);
            }
        },
        confirmMenuOption: function(){
            let option = this.itemGrid[this.currentItem[1]][this.currentItem[0]];
            option[2] = option[2] !== undefined ? option[2] : [];
            return Q.GameState.inputState[option[1]](...option[2]);
        },
        pressBackInMenu: function(){
            if(Q.GameState.inputState.goBack){
                Q.GameState.inputState.goBack();
                return {func: "goBackMenu"};
            }
            return false;
        },
        keepInRange: function(coord){
            let currentItem = this.currentItem;
            currentItem[0] += coord[0];
            currentItem[1] += coord[1];
            let itemGrid = this.itemGrid;
            let maxX, maxY;
            
            function getMaxY(){
                let num = 0;
                for(let i = 0; i < itemGrid.length; i++){
                    if(itemGrid[i] && itemGrid[i][currentItem[0]]) num++;
                }
                return num - 1;
            }
            if(coord[0]) maxX = itemGrid[currentItem[1]].length - 1;
            if(coord[1]) maxY = getMaxY();
            if(currentItem[0] > maxX) return [0, currentItem[1]];
            if(currentItem[1] > maxY) return [currentItem[0], 0];
            if(currentItem[0] < 0) return [maxX, currentItem[1]];
            if(currentItem[1] < 0) return [currentItem[0], maxY];
            return currentItem;
        },
        setNumberCyclerValue: function(value){
            let itemGrid = this.itemGrid;
            let strValue = value.toString();
            let dif = itemGrid[0].length - strValue.length;
            for(let i = itemGrid[0].length - 1; i >= 0; i--){
                let value = strValue[i - dif] || 0;
                itemGrid[0][i][0] = parseInt(value);
                if(this.currentCont){
                    this.currentCont.p.menuButtons[i][0].changeLabel(itemGrid[0][i][0]);
                }
            }
        },
        getValueFromNumberCycler: function(){
            let itemGrid = this.itemGrid;
            let value = "";
            for(let i = 0; i < itemGrid[0].length; i++){
                value += itemGrid[0][i][0];
            }
            return parseInt(value);
        },
        adjustNumberCyclerPosition: function(coord){
            let currentItem = this.currentItem;
            let itemGrid = this.itemGrid;
            //Move up/down
            if(coord[1]){
                itemGrid[currentItem[1]][currentItem[0]][0] += coord[1];
                if(itemGrid[currentItem[1]][currentItem[0]][0] < 0) itemGrid[currentItem[1]][currentItem[0]][0] = 9;
                else if(itemGrid[currentItem[1]][currentItem[0]][0] > 9) itemGrid[currentItem[1]][currentItem[0]][0] = 0;
                if(this.currentCont){
                    this.currentCont.p.menuButtons[this.currentItem[0]][this.currentItem[1]].changeLabel(itemGrid[currentItem[1]][currentItem[0]][0]);
                    this.currentCont.trigger("adjustedNumber");
                }
            } 
            //Move left/right
            else if(coord[0]){
                do {
                    currentItem = this.keepInRange(coord);
                }
                while(!itemGrid[currentItem[1]][currentItem[0]]);
                this.currentItem = currentItem;
                if(this.currentCont){
                    this.currentCont.p.menuButtons[this.currentItem[0]][this.currentItem[1]].selected();
                }
            }
            
            return {item: this.currentItem, func: "controlNumberCycler"};
        },
        adjustMenuPosition: function(coord){
            let currentItem = this.currentItem;
            let itemGrid = this.itemGrid;
            do {
                currentItem = this.keepInRange(coord);
            }
            while(!itemGrid[currentItem[1]][currentItem[0]]);
            this.currentItem = currentItem;
            //On the client, hover the new button
            if(this.currentCont){
                this.currentCont.p.menuButtons[this.currentItem[1]][this.currentItem[0]].hover();
            }
            return {item: this.currentItem, func: "navigateMenu"};
        },
        processShopSelectorInput: function(input){
            if(input === "confirm"){
                //Make sure the tile is valid
                let tile = Q.MapController.getTileAt(Q.getLoc(Q.GameState.shopSelector.p.x, Q.GameState.shopSelector.p.y));
                if(!tile) return;
                let valid = false;
                switch(Q.GameState.inputState.type){
                    case "currentOwned":
                        if(Q.GameState.turnOrder[0] === tile.ownedBy) valid = true;
                        break;
                }
                if(valid) Q.GameState.inputState.finish(tile);
            } else if(input === "back"){
                Q.GameState.inputState.goBack(Q.GameState.inputState.backOption);
            } else {
                Q.GameState.shopSelector.trigger("moved", Q.convertDirToCoord(input));
            }
            return {func: "processShopSelectorInput", input: input};
        },
        processConfirmerInput: function(input){
            if(input === "confirm"){
                Q.MenuController.confirmMenuOption();
            } else if(input === "back"){
                Q.MenuController.pressBackInMenu();
            }
            return {func: "processConfirmerInput", input: input};
        },
        processNumberCyclerInput: function(input){
            if(input === "confirm"){
                Q.MenuController.confirmMenuOption();
            } else if(input === "back") { 
                Q.MenuController.pressBackInMenu();
            } else if(input === "up"){
                this.adjustNumberCyclerPosition([0, 1]);
            } else if(input === "down"){
                this.adjustNumberCyclerPosition([0, -1]);
            } else if(input === "left"){
                this.adjustNumberCyclerPosition([-1, 0]);
            } else if(input === "right"){
                this.adjustNumberCyclerPosition([1, 0]);
            }
            return {func: "controlNumberCycler", input: input};
        },
        processInput: function(input){
            if(input === "confirm"){
               return Q.MenuController.confirmMenuOption();
            } else if(input === "back") { 
                return Q.MenuController.pressBackInMenu();
            } else if(input === "up"){
               return {func: "navigateMenu", pos:this.adjustMenuPosition([0, -1])};
            } else if(input === "down"){
               return {func: "navigateMenu", pos:this.adjustMenuPosition([0, 1])};
            }
        }
    });
    
    Q.MapController = new Q.mapController();
    Q.GameController = new Q.gameController();
    Q.MenuController = new Q.menuController();
};
};

if(typeof Quintus === 'undefined') {
  module.exports = quintusGameControl;
} else {
  quintusGameControl(Quintus);
}