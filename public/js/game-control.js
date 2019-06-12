var quintusGameControl = function(Quintus) {
"use strict";

Quintus.GameControl = function(Q) {
    //Functions used to set up the map.
    //Also checks moving around the map
    Q.GameObject.extend("mapController", {
        //Checks to see if anything should be reset when going back to a tile.
        checkResetPassByTile: function(state, tile){
            let boardActions = state.currentBoardActions;
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
        checkPassByTile: function(state, player){
            let tile = player.tileTo;
            switch(tile.type){
                case "main":
                    //Skip the menu if the player has no sets that can be exchanged.
                    let sets = Q.GameController.getCompleteSets(state, player);
                    if(!sets.length){
                        return false;
                    }
                    let setOptions = sets.map((set, i) => {
                        return [set.name, "purchaseSet", [i]];
                    });
                    setOptions.push(["Nothing", "confirmFalse"]);
                    Q.MenuController.makeDialogueMenu(state, "askExchangeSets", {
                        options:setOptions,
                        onHoverOption: (option) => {
                            option.stage.setsMenu.hoverSet(option);
                        },
                        onLoadMenu: (stage) => {
                            stage.setsMenu = stage.insert(new Q.SetsMenu({player: player}));
                        },
                        purchaseSet: (state, num) => {
                            Q.GameController.purchaseSet(state, num, player.playerId);
                            let props = [
                                {func: "purchaseSet", num: num},
                                {func: "clearStage", num: 2}
                            ];
                            let finish = Q.GameController.checkFinishMove(state, player);
                            if(finish) props = props.concat(finish);
                            return props;
                        },
                        confirmFalse: (state) => {
                            let props = [{func: "clearStage", num: 2}];
                            let move = Q.GameController.checkFinishMove(state, player);
                            if(move){
                                props.push(move);
                            }
                            return props;
                        }
                    });
                    return true;
                    
                case "vendor":
                    //Not enough money, so don't even ask.
                    if(player.money < tile.itemCost){
                        return false;
                    }
                    Q.MenuController.makeDialogueMenu(state, "askVendorBuyItem", {
                        text: Q.c.vendorText[tile.itemName],
                        confirmTrue: (state) => {
                            Q.GameController.purchaseSetItem(state, tile.loc, player.playerId);
                            let props = [
                                {func: "purchaseSetItem", loc: tile.loc},
                                {func: "clearStage", num: 2}
                            ];
                            let finish = Q.GameController.checkFinishMove(state, player);
                            if(finish) props = props.concat(finish);
                            return props;
                        },
                        confirmFalse: () => {
                            let props = [{func: "clearStage", num: 2}];
                            let move = Q.GameController.checkFinishMove(state, player);
                            if(move){
                                props.push(move);
                            }
                            return props;
                        }
                    });
                    return true;
                case "itemshop":
                    state.tileTo = tile;
                    Q.MenuController.makeDialogueMenu(state, "askIfWantToBuyItem", {
                        text: ["Would you like to buy an item?"],
                        confirmTrue: (state) => {
                            Q.MenuController.makeDialogueMenu(state, "buyItemsMenu");
                            return {func: "makeDialogueMenu", menu: "buyItemsMenu"};
                        },
                        confirmFalse: (state) => {
                            let response = Q.GameController.checkFinishMove(state, player);
                            if(response){
                                response = [{func: "clearStage", num: 2}, response];
                            } else {
                                response = {func: "clearStage", num: 2};
                            }
                            return response;
                        }
                    });
                    return true;
            }
        },
        //Run when the player presses a directional input while moving their dice roll.
        processPlayerMovement: function(state, inputs, id){
            let invalidForwardLoc;
            let player = Q.GameController.getPlayer(state, id);
            let tileOn = Q.MapController.getTileAt(state, player.loc);
            let input = Q.getSingleInput(inputs);
            let tileTo = tileOn.dir[input];
            //If the input wasn't a valid directional input, don't do anything.
            if(!tileTo) return false;
            player.tileTo = tileTo;
            let props = {
                func: "playerMovement",
                loc: tileTo.loc,
                passBy: false
            };
            
            //If the tile is not equal to the lastTile (the tile that the player landed on from last turn)
            if(state.currentMovementPath.length > 1 || tileTo !== player.lastTile){
                
                //If the tile that the player is on can only go certain directions, make sure that the user has pressed a valid direction.
                if(tileOn.dirs){
                    let dirs = tileOn.dirs.slice();
                    let allowDir = Q.convertCoordToDir(Q.compareLocsForDirection(tileOn.loc, tileTo.loc));
                    //Only allow it if the previous tile is equal to the tile to
                    if(state.currentMovementPath.length > 1 && Q.locsMatch(tileTo.loc, state.currentMovementPath[state.currentMovementPath.length - 2].loc)){
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
                if(state.currentMovementPath.length > 1 && tileTo === state.currentMovementPath[state.currentMovementPath.length - 2]){
                    state.currentMovementPath.pop();
                    props.direction = "back";
                } 
                //If the player has gone forward a tile.
                else {
                    if(!invalidForwardLoc){
                        if(state.currentMovementPath.length <= state.currentMovementNum){
                            state.currentMovementPath.push(tileTo);
                        } else {
                            return false;
                        }
                        props.direction = "forward";
                    }
                }
                if(!props.direction) return false;
                Q.GameController.movePlayer(player, tileTo);
                
                props.finish = state.currentMovementPath.length === state.currentMovementNum + 1;
                player.finish = props.finish;
                if(props.direction === "forward"){
                    if(Q.MapController.checkPassByTile(state, player)){
                        props.passBy = true;
                        return props;
                    }
                } else if(props.direction === "back"){
                    Q.MapController.checkResetPassByTile(state, tileTo);
                    return props;
                }
            } else {
                return false;
            }
            return props;
        },
        
        getTileAt: function(state, loc){
            return state.map.grid[loc[1]][loc[0]];
        },
        addToGrid: function(x, y, w, h, arr, add){
            for(let i = 0; i < h; i++){
                for(let j = 0; j < w; j++){
                    arr[y + i][x + j] = add;
                }
            } 
        },
        getShopsOwnedInDistrict: function(state, shop){
            return state.map.districts[shop.district].tiles.filter((s) => {return shop.ownedBy === s.ownedBy;});
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
                districts: [],
                grid: Q.createArray(false, mapData.map.w, mapData.map.h),
                minX: 0, //Use the min/max to determine center (used for view map)
                maxX: 0,
                minY: 0,
                maxY:0
            };
            mapData.districts.forEach((d, i) => {
                map.districts.push({
                    id: i,
                    name: "District " + i,
                    color: d.color,
                    tiles: [],
                    stockPrice: 0, //The cost per stock in a district. This goes up with value and rank.
                    stockAvailable: 0, //How much stock can be purchased in a district. This goes up with value and rank.
                    totalStock: 0, //The total number of stocks in this district (bought or unbought)
                    value: 0, //The total value of all shops in a district
                    rank: 0, //The average rank of shops in the district (rounded down)
                    totalRanks: 0 //The sum of all shop ranks (so we don't have to recalculate it everytime a shop rank changes)
                });
            });
            function updateMinMax(pos){
                map.minX = Math.min(pos.x, map.minX);
                map.maxX = Math.max(pos.x, map.maxX);
                map.minY = Math.min(pos.y, map.minY);
                map.maxY = Math.max(pos.y, map.maxY);
            }
            function setCenterMinMax(map){
                map.centerX = (map.minX + map.maxX) / 2;
                map.centerY = (map.minY + map.maxY) / 2;
            } 
            function generateTile(data){
                let tile = {
                    loc: [data.x, data.y],
                    type: data.type,
                    dirs: data.dirs
                };
                //Do different things based on the tile type.
                switch(tile.type){
                    case "shop":
                        tile.initialValue = data.value;
                        tile.rank = data.rank;
                        tile.investedCapital = 0;
                        tile.name = data.name;
                        tile.district = data.district;
                        tile.value = Q.MapController.generateShopValue(tile.initialValue, tile.rank, tile.investedCapital);
                        tile.cost = Q.MapController.generateShopCost(tile.initialValue, tile.rank, tile.investedCapital, 1);
                        tile.maxCapital = Q.MapController.generateShopMaxCapital(tile.initialValue, tile.rank, tile.investedCapital);
                        map.districts[tile.district].tiles.push(tile);
                        break;
                    case "main":
                        map.mainTile = tile;
                        break;
                    case "vendor":
                        tile.itemName = data.item[0];
                        tile.itemCost = data.item[1];
                        break;
                    case "itemshop":
                        tile.items = data.items.map((item) =>{
                            return Object.assign(Q.c.items[item[0]], {cost: item[1], id: item[0]});
                        });
                        break;
                }
                return tile;
            }
            function addTileToGame(tile){
                map.tiles.push(tile);
                Q.MapController.addToGrid(tile.loc[0], tile.loc[1], 2, 2, map.grid, tile);
            }
            function generateDistrictValues(districts){
                for(let i = 0; i < districts.length; i++){
                    let district = districts[i];
                    for(let j = 0; j < district.tiles.length; j++){
                        let tile = district.tiles[j];
                        district.totalRanks += tile.rank;
                        district.value += tile.value;
                    }
                    district.rank = ~~(district.totalRanks / district.tiles.length);
                    //For every 250 value, the stock price is 1G
                    //For every 1 rank, add 5G
                    district.stockPrice = Math.ceil(district.value / 250) + district.rank * 5;
                    //The number of stock available is equal to the district value / 10
                    district.stockAvailable = Math.ceil(district.value / 10);
                    district.totalStock = district.stockAvailable;
                }
            }
            
            function generateTileDirections(tile){
                //The dir idx of any tiles around this tile
                let tilesAroundAt = {};
                let dirIdxs = Q.c.dirIdxs.all;
                //This can be optimized to only check the necessary directions that are saved on the tile object.
                //Loop all 16 directions to find tiles
                for(let j = 0; j < dirIdxs.length; j++){
                    let checkAt = [tile.loc[0] + dirIdxs[j][0], tile.loc[1] + dirIdxs[j][1]];
                    //Make sure the loc is above 0 and less than maxX/Y
                    if(Q.locInBounds(checkAt, mapData.map.w, mapData.map.h)){
                        let tileOn = map.grid[checkAt[1]][checkAt[0]];
                        if(tileOn && Q.locsMatch(tileOn.loc, checkAt)){
                            tilesAroundAt[j] = tileOn;
                        }
                    }
                }
                return tilesAroundAt;
            }
            function removeDiagonals(tilesAroundAt){
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
            }
            function convertDirIdxs(tilesAroundAt){
                let dirObj = {};
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
                return dirObj;
            }
            
            //Generate the tiles.
            for(let i = 0; i < mapData.tiles.length; i++){
                updateMinMax(mapData.tiles[i]);
                addTileToGame(generateTile(mapData.tiles[i]));
            }
            generateDistrictValues(map.districts);
            setCenterMinMax(map);
            //Once the tiles are generated, check the tiles neighbours to determine which directions the player can go on each tile.
            for(let i = 0; i < map.tiles.length; i++){
                let tilesAroundAt = generateTileDirections(map.tiles[i]);
                removeDiagonals(tilesAroundAt);
                map.tiles[i].dir = convertDirIdxs(tilesAroundAt);
                
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
            }
            return map;
        }
    });
    Q.Sprite.extend("ShopSelector", {
        init: function(p){
            //TODO: pass this xy value it.
            let pos = Q.getXY(p.pos || p.state.turnOrder[0].loc);
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
        },
        inserted: function(){
            this.sprite = this.stage.insert(new Q.Sprite({sheet:"selector-sprite", frame:1, x: this.p.x, y: this.p.y}));
            this.on("step", function(){
                this.sprite.p.x = this.p.x;
                this.sprite.p.y = this.p.y;
            });
        },
        moveToTile: function(){
            let tile = this.shopOn;
            if(tile){
                if(!this.animating){
                    let pos = Q.getXY(tile.loc);
                    let toX = pos.x + Q.c.tileW / 2;
                    let toY = pos.y + Q.c.tileH / 2;

                    this.p.dx = toX - this.p.x;
                    this.p.dy = toY - this.p.y;
                    this.p.destX = toX;
                    this.p.destY = toY;
                    this.animating = true;
                    this.p.dt = new Date().getTime();
                    this.p.stepDelay = 0.1;
                    this.p.stepWait = this.p.stepDelay;
                } else {
                    let now = new Date().getTime();
                    let dt = (now - this.p.dt) / 1000;
                    this.p.stepWait -= dt;
                    this.p.x += this.p.dx * dt / this.p.stepDelay;
                    this.p.y += this.p.dy * dt / this.p.stepDelay;
                    this.p.dt = now;
                    if(this.p.stepWait > 0) {return; }
                    this.p.x = this.p.destX;
                    this.p.y = this.p.destY;
                    this.animating = false;
                    this.atTile = true;
                }
            }
        },
        dehoverShop: function(){
            if(this.sprite) this.sprite.p.frame = 0;
            this.p.hovering = false;
        },
        hoverShop: function(){
            if(this.sprite){
                this.sprite.p.frame = 1;
                Q.AudioController.playSound("hover-shop");
            }
            this.p.hovering = true;
            
        },
        showShopDetails: function(){
            if(this.sprite){
                Q.GameController.tileDetails.displayShop(Q.MapController.getTileAt(this.p.state, Q.getLoc(this.p.x - Q.c.tileW / 2, this.p.y - Q.c.tileH / 4)));
            }
        },
        moved: function(inputs){
            this.changedShop = false;
            let lastShopOn = this.shopOn;
            this.p.lastX = this.p.x;
            this.p.lastY = this.p.y;
            let coord = [0, 0];
            let keys = Object.keys(inputs);
            keys.forEach((key) => {
                let newCoord = Q.convertDirToCoord(key);
                if(newCoord){
                    if(newCoord[0]) coord[0] = newCoord[0];
                    if(newCoord[1]) coord[1] = newCoord[1];
                }
            });
            if(coord[0] || coord[1]){
                let speed = 1.5;
                let x = this.p.x + coord[0] * (4 * speed);
                let y = this.p.y + coord[1] * (3 * speed);
                this.moveTo(x, y);
                this.acceptedInput = true;
                this.atTile = false;
                this.dehoverShop();
                let loc = Q.getLoc(this.p.x - Q.c.tileW / 2, this.p.y - Q.c.tileH / 4);
                if(Q.locInBounds(loc, this.p.state.map.data.map.w, this.p.state.map.data.map.h)){
                    this.shopOn = Q.MapController.getTileAt(this.p.state, loc);
                    if(!Q.isServer()){
                        Q.GameController.tileDetails.displayShop(this.shopOn);
                    }
                } else {
                    this.shopOn = false;
                    if(!Q.isServer()){
                        Q.GameController.tileDetails.displayShop(this.shopOn);
                    }
                }
            }
            this.checkSeekTile();
            if(this.shopOn !== lastShopOn){
                this.changedShop = true;
            }
        },
        moveTo: function(x, y, hover){
            this.p.x = x;
            this.p.y = y;
            if(hover){
                if(hover === "details"){
                    this.showShopDetails();
                } else {
                    this.hoverShop();
                }
            } else {
                this.dehoverShop();
            }
        },
        checkSeekTile: function(){
            if(this.acceptedInput && this.animating){
                this.animating = false;
                this.atTile = false;
            }
            if(!this.acceptedInput && !this.atTile){
                this.moveToTile();
            }
            this.acceptedInput = false;
        }
    });
    
    //Functions that are run during gameplay.
    //Add/remove shop from player, stocks, etc...
    Q.GameObject.extend("gameController", {
        addBoardAction: function(state, tile, action, props){
            if(tile === "prev") tile = state.currentMovementPath[state.currentMovementPath.length - 2];
            state.currentBoardActions.push([tile, action, props]);
        },
        getItemEffect: function(state, player, effect){
            return player.itemEffects.filter((e) => {
                return e.name === effect;
            }).length;
        },
        playerHasItem: function(state, player, itemIdx){
            return player.items.filter((itm) => {
                return itm.id === itemIdx;
            });
        },
        warpPlayerTo: function(state, player, tileTo){
            player.loc = tileTo.loc;
            player.tileTo = tileTo;
            state.currentMovementPath = [];
            player.finish = true;
            player.skipFinish = true;
            if(!Q.isServer()){
                player.sprite.moveTo(tileTo.loc);
            }
            let props = {
                func: "playerMovement",
                loc: tileTo.loc,
                passBy: false,
                finish: player.finish,
                skipFinish: player.skipFinish
            };
            if(Q.MapController.checkPassByTile(state, player)){
                props.passBy = true;
                return props;
            }
            return Q.GameController.playerConfirmMove(state, player.playerId);
        },
        finishMoveShopSelector: function(state, key, tile, props){
            let response = [{func: "setQValue", path: "preventMultipleInputs", value: true}, {func: "removeItem", item: "shopSelector"}, {func: "finishMoveShopSelector", key: key, loc: tile.loc, props: props}];
            switch(key){
                case "investMenu":
                case "upgradeMenu":
                case "auctionMenu":
                    Q.MenuController.makeCustomMenu(state, key, Object.assign({shop: tile}, props));
                    break;
                case "warpPlayerTo":
                    response = response.concat(Q.GameController.warpPlayerTo(state, state.turnOrder[0], tile));
                    break;
                case "confirmSellShop":
                    response.push(Q.MenuController.makeDialogueMenu(state, "confirmSellShop"));
                    state.inputState.shop = tile;
                    break;
            }
            return response;
        },
        useItem: function(state, itemIdx){
            //If we want to have items that have number of uses (block the next 3 shop fees, etc...), 
            //a new property should be added called "uses" and it should be decreased on use.
            //Right now, the items that last one time just get removed at the start of the user's next turn.
            
            
            let player = state.turnOrder[0];
            let item = player.items[itemIdx];
            /* Delayed use items (add an item effect for activation later) */
            /* 25% off Shop Coupon
             * 50% off Item Coupon
             * Extra Die
             * Double Turn
             * Invisible
             * Double Stock
             * Commision
             * Big Commision
             * Stock Stealer
             */
            if(item.turns){
                let effect = {
                    turns: item.turns,
                    name: item.name
                };
                player.itemEffects.push(effect);
                Q.MenuController.makeMenu(state, "playerTurnMenu", [0, 0]);
                if(!Q.isServer()){
                    Q.AudioController.playSound("use-item");
                }
            } 
            
            /* Immediate use items (don't add an item effect) */
            /* Warp
             * Steal Set Piece
             * Thief
             * Steal Item
             * Bingo Player
             */
            else {
                switch(item.name){
                    case "Warp":
                        Q.MenuController.makeMoveShopSelector(state, "warpPlayerTo", false, player.loc, "all");
                        break;
                }
                
            };
            player.items.splice(itemIdx, 1);
            return {func: "useItem", itemIdx: itemIdx};
        },
        purchaseSet: function(state, num, playerId){
            let player = Q.GameController.getPlayer(state, playerId);
            let sets = Q.GameController.getCompleteSets(state, player);
            let set = sets[num];
            Q.GameController.changePlayerMoney(player, set.value);
            Q.GameController.addBoardAction(state, "prev", "changePlayerMoney", [player, -set.value]);
            Q.GameController.changePlayerNetValue(player, set.value);
            Q.GameController.addBoardAction(state, "prev", "changePlayerNetValue", [player, -set.value]);
            set.items.forEach((item) => {
                Q.GameController.changeSetItemQuantity(player, item, -1);
                Q.GameController.addBoardAction(state, "prev", "changeSetItemQuantity", [player, item, 1]);
            });
            Q.GameController.changePlayerRank(state, player, 1);
            Q.GameController.addBoardAction(state, "prev", "changePlayerRank", [player, -1]);
            
        },
        purchaseSetItem: function(state, tileLoc, playerId){
            let tile = Q.MapController.getTileAt(state, tileLoc);
            let player = Q.GameController.getPlayer(state, playerId);
            Q.GameController.changePlayerMoney(player, -tile.itemCost);
            Q.GameController.addBoardAction(state, "prev", "changePlayerMoney", [player, tile.itemCost]);
            Q.GameController.changeSetItemQuantity(player, tile.itemName, 1);
            Q.GameController.addBoardAction(state, "prev", "changeSetItemQuantity", [player, tile.itemName, -1]);
            Q.GameController.changePlayerNetValue(player, -tile.itemCost);
            Q.GameController.addBoardAction(state, "prev", "changePlayerNetValue", [player, tile.itemCost]);

        },
        purchaseItem: function(state, item, playerId){
            let player = Q.GameController.getPlayer(state, playerId);
            Q.GameController.changePlayerItem(player, item, true);
            Q.GameController.addBoardAction(state, "prev", "changePlayerItem", [player, item]);
            Q.GameController.changePlayerMoney(player, -item.cost);
            Q.GameController.addBoardAction(state, "prev", "changePlayerMoney", [player, item.cost]);
            Q.GameController.changePlayerNetValue(player, -item.cost);
            Q.GameController.addBoardAction(state, "prev", "changePlayerNetValue", [player, item.cost]);
        },
        changePlayerItem: function(player, item, add){
            if(add){
                player.items.push(item);
            } else {
                player.items.splice(player.items.indexOf(item), 1);
            }
        },
        buyStock: function(player, num, price, district){
            district.stockAvailable -= num;
            player.stocks[district.id].num += num;
            Q.GameController.changePlayerMoney(player, -price);
        },
        sellStock: function(player, num, price, district){
            district.stockAvailable += num;
            player.stocks[district.id].num -= num;
            Q.GameController.changePlayerMoney(player, price);
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
        getCompleteSets: function(state, player){
            return state.map.data.sets.filter((set) => {
                return set.items.every((item) => {
                    return player.setPieces[item];
                });
            });
        },
        startRollingDie: function(state, rollsNums, player){
            Q.clearStage(2);
            state.dice = [];
            let space = 100;
            let playerPos = Q.getXY(player.p.loc);
            for(let i = 0; i < rollsNums.length; i++){
                state.dice.push(Q.stage(1).insert(new Q.Die({x: playerPos.x + i * space - (((rollsNums.length - 1 ) / 2) * space), y: playerPos.y - Q.c.tileH * 2, roll: rollsNums[i]})));
            }
            function soundOn(){
                if(state.dice.length && !state.currentMovementNum){
                    if(!Q.AudioController.checkSoundIsPlaying("roll-die")){
                        Q.AudioController.playSound("roll-die", soundOn);
                    }
                }
            }
            soundOn();
        },
        //Removes all dice
        removeDice: function(state){
            if(state.dice.length){
                state.dice.forEach((die) => {die.removeDie();});
                state.dice = [];
            }
        },
        stopDice: function(state){
            state.dice.forEach((die) => {die.stop();});
        },
        playerMovement: function(state, inputs, id){
            let obj = Q.MapController.processPlayerMovement(state, inputs, id);
            if(obj.finish && !obj.passBy){
                Q.GameController.askFinishMove(state, Q.GameController.getPlayer(state, id));
                obj = [obj, {func: "removeItem", item: "moveArrows"}];
            }
            return obj;
        },
        allowPlayerMovement: function(state, num){
            state.currentMovementNum = num;
            state.currentMovementPath = [Q.MapController.getTileAt(state, state.turnOrder[0].loc)];
            if(!Q.isServer()){
                state.turnOrder[0].sprite.showMovementDirections();
                Q.AudioController.stopSound("roll-die");
                Q.AudioController.playSound("throw-die");
            }
        },
        checkFinishMove: function(state, player){
            let finish = player.finish;
            let skipFinish = player.skipFinish;
            if(skipFinish){
                return Q.GameController.playerConfirmMove(state, player.playerId);
            } else if(finish){
                return Q.GameController.askFinishMove(state, player);
            } else {
                state.inputState = {func: "playerMovement"};
            }
        },
        payOwnerOfShop: function(state, player, tileOn){
            Q.GameController.changePlayerMoney(player, -tileOn.cost);
            Q.GameController.changePlayerNetValue(player, -tileOn.cost);
            Q.GameController.changePlayerMoney(tileOn.ownedBy, tileOn.cost);
            Q.GameController.changePlayerNetValue(tileOn.ownedBy, tileOn.cost);
            return {func: "payOwnerOfShop", loc: tileOn.loc};
        },
        askToBuyShop: function(state, player, tileOn){
            //If the player doesn't have enough money, skip this step and end the turn
            if(player.money < tileOn.value){
                Q.GameController.endTurn(state);
            } else {
                Q.MenuController.makeDialogueMenu(state, "askBuyShop");
            }
            return {func: "askToBuyShop", loc: tileOn.loc};
        },
        landOnMainTile: function(state, player){
            //The player gets another roll when landing on the base tile.
            state.currentMovementPath = [];
            state.currentBoardActions = [];
            state.inputState.forceRoll = true;
            //The player can go any possible direction now.
            //Set the lastTile to the correct tile if we want to force forward direction of the player on this extra roll.
            player.lastTile = false;
        },
        //After the player says "yes" to stopping here.
        playerConfirmMove: function(state, id){
            let player = this.getPlayer(state, id);
            let tileOn = Q.MapController.getTileAt(state, player.loc);
            switch(tileOn.type){
                case "shop":
                    //Pay the owner and then give the option to buy out
                    if(tileOn.ownedBy){
                        //If the tile is owned by the player (do nothing???)
                        if(tileOn.ownedBy === player){
                            return Q.GameController.endTurn(state);
                        } 
                        //Pay the owner
                        else {
                            let response = [];
                            response.push(Q.GameController.payOwnerOfShop(state, player, tileOn));
                            //Ask for buyout
                            if(player.money >= tileOn.value * 5){
                                response.push(Q.MenuController.makeDialogueMenu(state, "askBuyOutShop"));
                            } else {
                                response.push(Q.GameController.endTurn(state));
                            }
                            return response;
                        }
                    } 
                    //Ask if the player would like to buy it.
                    else {
                        return Q.GameController.askToBuyShop(state, player, tileOn);
                    }
                case "main":
                    Q.MenuController.inputStates.playerTurnMenu.rollDie(state);
                    Q.GameController.landOnMainTile(state, player);
                    return [{func: "clearStage", num: 2}, {func: "landOnMainTile"}, {func: "rollDie", rollsNums: state.inputState.rollsNums}];
                case "vendor":
                    return Q.GameController.endTurn(state);
                case "itemshop":
                    return Q.GameController.endTurn(state);
            }
        },
        playerGoBackMove: function(state, id){
            let player = this.getPlayer(state, id);
            state.currentMovementPath.pop();
            let tileTo = state.currentMovementPath[state.currentMovementPath.length - 1];
            Q.GameController.movePlayer(player, tileTo);
            Q.MapController.checkResetPassByTile(state, tileTo);
            if(!Q.isServer()){
                Q.GameController.tileDetails.displayShop(tileTo);
            }
            return tileTo.loc;
        },  
        //When the player steps onto the last tile of the movement
        askFinishMove: function(state){
            Q.MenuController.makeDialogueMenu(state, "menuMovePlayer");
            return {func: "makeDialogueMenu", menu: "menuMovePlayer"};
        },
        movePlayer: function(player, tileTo){
            player.loc = tileTo.loc;
            if(!Q.isServer()){
                player.sprite.moveTo(tileTo.loc);
                Q.AudioController.playSound("step-on-tile");
            }
        },
        getPlayer: function(state, id){
            return state.turnOrder.find(player => { return player.playerId === id;});
        },
        setUpPlayers: function(data, mainTile){
            let players = [];
            for(let i = 0; i < data.users.length; i++){
                let player = {
                    playerId: data.users[i].id,
                    loc: [6, 6],
                    //loc: [mainTile.loc[0], mainTile.loc[1]],
                    money: data.mapData.modes[data.settings.mode].startMoney,
                    netValue: data.mapData.modes[data.settings.mode].startMoney,
                    color: data.users[i].color,
                    shops: [],
                    items: [{name: "Warp"}],
                    itemEffects: [],
                    setPieces: {
                        Peanut: 1
                    },
                    stocks: [],
                    stockControl: 0,
                    investments: [],
                    rank: 1,
                    maxItems: 1
                    //Etc... Add more as I think of more. TODO
                };
                for(let j = 0; j < data.mapData.districts.length; j++){
                    player.stocks.push({
                        num: 0
                    });
                }
                players.push(player);
            }
            return players;
        },
        //When a game is started (all players connected, settings are set, about to load map)
        setUpGameState: function(data){
            let state = {};
            state.map = Q.MapController.generateMap(data.mapData, data.settings);
            state.players = Q.GameController.setUpPlayers(data, state.map.mainTile);
            state.inputState = Q.MenuController.inputStates.playerTurnMenu;
            state.dice = [];
            //Only generate random numbers on the server.
            if(Q.isServer()){
                let randSeed = Math.random();
                state.random = new Math.seedrandom(randSeed);
                state.initialSeed = randSeed;
                state.turnOrder = Q.shuffleArray(state.players);
            }
            return state;
        },
        //Reduce the active turns for each item effect by 1. If the item is at 0, remove the effect.
        reduceItemTurns: function(player){
            for(let i = player.itemEffects.length - 1; i >= 0; i--){
                let effect = player.itemEffects[i];
                effect.turns --;
                if(!effect.turns){
                    player.itemEffects.splice(i, 1);
                    //Could do something else when certain items wear off (revert player colour, etc..)
                }
            }
        },
        //Functions that happen when the current player ends the turn
        endTurn: function(state){
            //If the player doesn't have any ready cash at the end of his turn, force him to sell shops or stocks.
            //Once he's above 0, run this endTurn function again and it'll go past this.
            if(state.turnOrder[0].money < 0){
                return Q.MenuController.makeDialogueMenu(state, "forceSellAsset");
            }
            
            state.turnOrder[0].lastTile = state.currentMovementPath[state.currentMovementPath.length - 2];
            state.turnOrder.push(state.turnOrder.shift());
            Q.GameController.startTurn(state);
            return {func: "endTurn"};
        },
        //Functions that happen when the new current player starts his turn
        startTurn: function(state){
            state.currentMovementNum = false;
            state.currentBoardActions = [];
            state.forceSellAssets = false;
                    
            let player = state.turnOrder[0];
            player.turn = true;
            //Player gets additional stock buying power based on rank, number of shops owned, and amount of money on hand.
            //The player can buy number of stock equal or below the stockControl value at any time.
            player.stockControl += player.rank * 3 + player.shops.length + ~~(player.money / 500);
            //255 is max number for stock control.
            player.stockControl = Math.min(255, player.stockControl);
            player.invested = 0;
            player.upgraded = 0;
            player.auctioned = 0;
            player.tileTo = false;
            player.finish = false;
            player.skipFinish = false;
            Q.GameController.reduceItemTurns(player);
            if(!state.doIt){
                Q.GameController.buyShop(state, state.turnOrder[0], Q.MapController.getTileAt(state, [6, 4]), 0)
                Q.GameController.buyStock(state.turnOrder[0], 10, state.map.districts[0].stockPrice * 10, state.map.districts[0]);
            }
            state.doIt = true;

            Q.MenuController.makeMenu(state, "playerTurnMenu", [0, 0]);
            if(Q.isActiveUser()){
                Q.stage(1).insert(new Q.TurnAnimation());
                Q.inputs["confirm"] = false;
            }
        },
        gameOver: function(state){
            //Once the game is over, show the final stats.
        },
        buyShop: function(state, player, shop, couponPercentage){
            let couponValue = ~~(shop.value * couponPercentage);
            let cost = shop.value - couponValue;
            Q.GameController.changePlayerMoney(player, -cost);
            Q.GameController.changePlayerNetValue(player, couponValue);
            shop.ownedBy = player;
            Q.GameController.adjustShopValues(state, player, shop);
            player.shops.push(shop);
            if(!Q.isServer()){
                shop.sprite.updateTile(player.color);
                Q.GameController.tileDetails.displayShop(shop);
                Q.AudioController.playSound("purchase-item");
            }
        },
        buyOutShop: function(state, player, shop){
            Q.GameController.changePlayerMoney(shop.ownedBy, shop.value * 3);
            Q.GameController.changePlayerNetValue(shop.ownedBy, shop.value * 3);
            Q.GameController.changePlayerMoney(player, -shop.value * 5);
            Q.GameController.changePlayerNetValue(player, -shop.value * 4);
            if(!Q.isServer()){
                shop.sprite.updateTile(player.color);
                Q.AudioController.playSound("purchase-item");
            }
            shop.ownedBy.shops.splice(shop.ownedBy.shops.indexOf(shop), 1);
            shop.ownedBy = player;
            player.shops.push(shop);
            Q.GameController.adjustShopValues(state, player, shop);
            Q.GameController.adjustShopValues(state, shop.ownedBy, shop);
        },
        sellShop: function(state, shop, price, sellTo){
            Q.GameController.changePlayerMoney(shop.ownedBy, price);
            Q.GameController.changePlayerNetValue(shop.ownedBy, -shop.value + price);
            Q.GameController.adjustShopValues(state, shop.ownedBy, shop);
            shop.ownedBy.shops.splice(shop.ownedBy.shops.indexOf(shop), 1);
            
            shop.ownedBy = sellTo;
            if(shop.ownedBy){
                Q.GameController.changePlayerMoney(shop.ownedBy, -price);
                Q.GameController.changePlayerNetValue(shop.ownedBy, -price + shop.value);
                Q.GameController.adjustShopValues(state, shop.ownedBy, shop);
                
            } else {
                shop.cost = Q.MapController.generateShopCost(shop.initialValue, shop.rank, shop.investedCapital, 1);
                shop.maxCapital = Q.MapController.generateShopMaxCapital(shop.initialValue, shop.rank, shop.investedCapital);
                if(!Q.isServer()){
                    shop.sprite.updateTile();
                }
            }
            if(!Q.isServer()){
                Q.AudioController.playSound("purchase-item");
            }
        },
        //Changes the value of shops in the district based on the number that the player owns.
        adjustShopValues: function(state, player, shop){
            let shopsOwned = Q.MapController.getShopsOwnedInDistrict(state, shop);
            if(shopsOwned.length > 1){
                shopsOwned.forEach((shop) => {
                    shop.cost = Q.MapController.generateShopCost(shop.initialValue, shop.rank, shop.investedCapital, shopsOwned.length);
                    shop.maxCapital = Q.MapController.generateShopMaxCapital(shop.initialValue, shop.rank, shop.investedCapital);
                    if(!Q.isServer()){
                        shop.sprite.updateTile(player.color);
                    }
                });
            }
        },
        //Updates the shop to the current values.
        updateShopValues: function(state, shop){
            let shopsOwned = shop.ownedBy ? Q.MapController.getShopsOwnedInDistrict(state, shop).length : 1;
            shop.value = Q.MapController.generateShopValue(shop.initialValue, shop.rank, shop.investedCapital);
            shop.cost = Q.MapController.generateShopCost(shop.initialValue, shop.rank, shop.investedCapital, shopsOwned);
            shop.maxCapital = Q.MapController.generateShopMaxCapital(state.inputState.shop.initialValue, state.inputState.shop.rank, state.inputState.shop.investedCapital);
            if(!Q.isServer()){
                shop.sprite.updateTile(shop.ownedBy.color);
                Q.GameController.tileDetails.displayShop(shop);
            }
        },
        investInShop: function(state, investAmount){
            if(!investAmount) return;
            state.inputState.shop.maxCapital -= investAmount;
            state.inputState.shop.investedCapital += investAmount;
            Q.GameController.updateShopValues(state, state.inputState.shop);
            Q.GameController.changePlayerMoney(state.turnOrder[0], -investAmount);
            state.turnOrder[0].invested++;
        },
        upgradeShop: function(state, rankUp, cost){
            state.inputState.shop.rank += rankUp;
            Q.GameController.changePlayerMoney(state.turnOrder[0], -cost);
            Q.GameController.updateShopValues(state, state.inputState.shop);
            state.turnOrder[0].upgraded++;
        },
        //Processes the input on the server
        processInputs: function(state, inputs){
            if(!state) return;
            switch(state.inputState.func){
                case "navigateMenu":
                    return Q.MenuController.processMenuInput(state, inputs);
                case "rollDie": 
                    return Q.MenuController.processRollDieInput(state, inputs);
                case "playerMovement":
                    return Q.GameController.playerMovement(state, inputs, state.turnOrder[0].playerId);
                case "moveShopSelector":
                    return Q.MenuController.processShopSelectorInput(state, inputs);
                case "controlNumberCycler":
                    return Q.MenuController.processNumberCyclerInput(state, inputs);
                case "confirmer":
                    return Q.MenuController.processConfirmerInput(state, inputs);
            }
        },
        getNumberOfStocks: function(player){
            return player.stocks.reduce((a, i) => a + i.num, 0);
        }
    });
    
    
    //This does not display anything or make sounds. It's run on the client and server.
    Q.GameObject.extend("menuController", {
        makeDialogueMenu: function(state, menu, dialogue){
            state.inputState = dialogue ? {...dialogue, ...Q.MenuController.inputStates[menu]} : Q.MenuController.inputStates[menu];
            Q.MenuController.initializeMenu(state, state.inputState, state.inputState.selected);
            if(state.inputState.preDisplay) state.inputState.preDisplay(state);
            if(!Q.isServer()){
                Q.stageScene("dialogue", 2, {dialogue: state.inputState, state: state});
            }
            return {func: "makeDialogueMenu", menu: menu};
        },
        makeCustomMenu: function(state, menu, props){
            state.inputState = Q.MenuController.inputStates[menu];
            //These are all custom menus,so do all of the "makeMenu" code here.
            switch(menu){
                case "investMenu":
                    state.inputState.shop = props.shop;
                    props.menu = menu;
                    Q.MenuController.initializeNumberCycler(state, props);
                    if(!Q.isServer()){
                        Q.stageScene("investMenu", 2, props);
                    }
                    
                    break;
                case "upgradeMenu":
                    state.inputState.shop = props.shop;
                    Q.MenuController.initializeConfirmer(state);
                    if(!Q.isServer()){
                        Q.stageScene("upgradeMenu", 2, props);
                    }
                    
                    break;
                case "auctionMenu":
                    state.inputState.shop = props.shop;
                    Q.MenuController.makeDialogueMenu(state, "auctionMenu");
                    if(!Q.isServer()){
                        Q.stageScene("auctionMenu", 3, props);
                    }
                    break;
                case "buyStockMenu":
                    if(!Q.isServer()){
                        Q.stageScene("districtMenu", 3, props);
                    }
                    Q.MenuController.makeDialogueMenu(state, "districtMenu", props);
                    break;
                case "buyStockCyclerMenu":
                    state.inputState.district = state.map.districts[props.district];
                    Q.MenuController.initializeNumberCycler(state, props);
                    if(!Q.isServer()){
                        Q.stageScene("buyStockCyclerMenu", 2, props);
                    }
                    break;
                case "sellStockMenu":
                    if(!Q.isServer()){
                        Q.stageScene("districtMenu", 3, props);
                    }
                    Q.MenuController.makeDialogueMenu(state, "districtMenu", props);
                    break;
                case "sellStockCyclerMenu":
                    state.inputState.district = state.map.districts[props.district];
                    Q.MenuController.initializeNumberCycler(state, props);
                    if(!Q.isServer()){
                        Q.stageScene("sellStockCyclerMenu", 2, props);
                    }
                    break;
                case "checkStockMenu":
                    Q.MenuController.initializeConfirmer(state);
                    if(!Q.isServer()){
                        Q.stageScene("checkStockMenu", 2);
                    }
                    break;
                case "setsMenu":
                    Q.MenuController.initializeConfirmer(state);
                    if(!Q.isServer()){
                        Q.stageScene("setsMenu", 2);
                    }
                    break;
                case "mapMenu":
                    Q.MenuController.initializeConfirmer(state);
                    if(!Q.isServer()){
                        Q.stageScene("mapMenu", 2);
                    }
                    break;
            }
            return {func: "makeCustomMenu", menu: menu, props: props};
        },
        makeMenu: function(state, menu, selected, playSound){
            state.inputState = Q.MenuController.inputStates[menu];
            Q.MenuController.initializeMenu(state, state.inputState, selected);
            if(state.inputState.preDisplay) state.inputState.preDisplay(state);
            if(!Q.isServer()){
                Q.stageScene("menu", 2, {menu: state.inputState, selected: selected || [0, 0], state: state});
            }
            return {func: "loadOptionsMenu", menu: menu, selected: selected, playSound: playSound};
        },
        makeMoveShopSelector: function(state, confirmType, backFunc, startPos, selType){
            let goBack, finish, selectType;
            if(selType) selectType = selType;
            switch(confirmType){
                case "invest":
                    finish = function(state, shop){
                        if(!shop) return {func: "invalidAction"};
                        return Q.GameController.finishMoveShopSelector(state, "investMenu", shop, {cycler: 6});
                    };
                    selectType = "currentOwned";
                    break;
                case "upgrade":
                    finish = function(state, shop){
                        if(!shop) return {func: "invalidAction"};
                        return Q.GameController.finishMoveShopSelector(state, "upgradeMenu", shop);
                    };
                    selectType = "currentOwned";
                    break;
                case "auction":
                    finish = function(state, shop){
                        if(!shop) return {func: "invalidAction"};
                        return Q.GameController.finishMoveShopSelector(state, "auctionMenu", shop);
                    };
                    selectType = "currentOwned";
                    break;
                case "warpPlayerTo":
                    finish = function(state, tile){
                        if(!tile) return {func: "invalidAction"};
                        return Q.GameController.finishMoveShopSelector(state, "warpPlayerTo", tile);
                    };
                    break;
                case "viewBoard":
                    finish = function(state, tile){
                        return false;
                    };
                    break;
                case "confirmSellShop": 
                    finish = function(state, tile){
                        return Q.GameController.finishMoveShopSelector(state, "confirmSellShop", tile);
                    };
                    selectType = "currentOwned";
                    break;
            }
            switch(backFunc){
                case "toShopsMenu":
                    goBack = function(state, backOption){
                        let backOpt = backOption === "invest" ? [0, 0] : backOption === "upgrade" ? [0, 1] : [0, 2];
                        state.shopSelector = false;
                        return [
                            {func: "setQValue", path: "preventMultipleInputs", value: true}, 
                            {func: "removeItem", item: "shopSelector"}, 
                            Q.MenuController.makeMenu(state, "shopsMenu", backOpt)
                        ];
                    };
                    break;
                case "toViewMenu":
                    goBack = function(state, backOption){
                        let backOpt = [0, 0];
                        state.shopSelector = false;
                        return [
                            {func: "setQValue", path: "preventMultipleInputs", value: true}, 
                            {func: "removeItem", item: "shopSelector"}, 
                            Q.MenuController.makeMenu(state, "viewMenu", backOpt)
                        ];
                    };
                    break;
                case "forceSellAsset":
                    goBack = function(state){
                        return Q.MenuController.makeDialogueMenu(state, "forceSellAsset");
                    };
                    break;
                default: 
                    goBack = function(state){
                        return {func: "invalidAction"};
                    };
                    break;
            }
            state.inputState = {
                func: "moveShopSelector", 
                goBack: goBack,
                finish: finish,
                backOption: confirmType
            };
            state.shopSelector = new Q.ShopSelector({pos: startPos, state: state, type: selectType});
            if(!Q.isServer()){
                Q.clearStage(2);
                Q.preventMultipleInputs = false;
                Q.stage(1).insert(state.shopSelector);
            }
            return {func: "makeMoveShopSelector", confirmType: confirmType, backFunc: backFunc, startPos: startPos};
        },
        inputStates: {
            investMenu: {
                func: "controlNumberCycler",
                cycler: 6,
                confirm: (state) => {
                    let investAmount = Q.MenuController.getValueFromNumberCycler(state);
                    let maxCapital = state.inputState.shop.maxCapital;
                    let playerMoney = state.turnOrder[0].money;
                    //If the invest amount is greater than allowed, set the amount to the allowed amount.
                    if(investAmount > maxCapital || investAmount > playerMoney){
                        let newAmount = Math.min(maxCapital, playerMoney);
                        return Q.MenuController.setNumberCyclerValue(state, newAmount);
                    }
                    //Otherwise, invest that amount into the shop.
                    else {
                        Q.GameController.investInShop(state, investAmount);
                        return [
                            {func: "finalizeInvestInShop", investAmount: investAmount},
                            Q.MenuController.makeMenu(state, "playerTurnMenu", [0, 0], "purchase-item")
                        ];
                    }
                },
                goBack: (state) => {
                    return Q.MenuController.inputStates.shopsMenu.cursorSelectShop(state, "invest", "toShopsMenu", state.inputState.shop.loc);
                }
            },
            upgradeMenu: {
                func: "confirmer",
                confirm: (state) => {
                    let player = state.turnOrder[0];
                    let shop = state.inputState.shop;
                    
                    //Give a 10% discount for every player level above 1 (10, 20, 30, etc...)
                    let cost = shop.value - ((player.rank - 1) * shop.value / 10);
                    let playerMoney = player.money;
                    let rankUp = 1;
                    if(playerMoney >= cost && shop.rank < 5){
                        Q.GameController.upgradeShop(state, rankUp, cost);
                        return [
                            {func: "finalizeUpgradeShop", cost: cost, rankUp: rankUp},
                            Q.MenuController.makeMenu(state, "playerTurnMenu", [0, 0], "purchase-item")
                        ];
                    } else {
                        return {func: "invalidAction"};
                    }
                },
                goBack: (state) => {
                    return Q.MenuController.inputStates.shopsMenu.cursorSelectShop(state, "upgrade", "toShopsMenu", state.inputState.shop.loc);
                }
            },
            auctionMenu: {
                func: "navigateMenu",
                text: ["How would you like to auction this shop?"],
                options: [
                    ["Normal", "normalAuction"],
                    ["Blind", "blindAuction"],
                    ["Back", "goBack"]
                ],
                getValidParticipants: (players, shop) => {
                    //If there are 1+ players who have enough money to bid, start the bidding process, otherwise sell to the bank for 0.75 of the value.
                    
                    let validParticipants = [];
                    //Start at 1 since 0 is the active player.
                    for(let i = 1; i < players.length; i++){
                        if(players[i].money >= shop.value){
                            validParticipants.push(players[i]);
                        }
                    }
                    return validParticipants;
                },
                sellToBank: (state, shop) => {
                    let value = ~~(shop.value * 0.75);
                    let sellTo = false;
                    Q.GameController.sellShop(state, shop, value, sellTo);
                    return {func: "sellShop", value: value, loc: shop.loc, sellTo: sellTo};
                },
                normalAuction: (state) => {
                    //Players bid until the timer goes down to 0. Bids set the timer to 5 seconds.
                    let players = state.turnOrder;
                    let shop = state.inputState.shop;
                    let valid = Q.MenuController.inputStates.auctionMenu.getValidParticipants(players, shop);
                    if(valid.length >= 1){
                        //TODO blind auction first. This is that with an extra step.
                    } 
                    else {
                        return [
                            {func: "clearStage", num: 2},
                            {func: "clearStage", num: 3},
                            Q.MenuController.inputStates.auctionMenu.sellToBank(state, shop),
                            Q.MenuController.makeMenu(state, "playerTurnMenu", [0, 0], "purchase-item")
                        ];
                    }
                },
                blindAuction: (state) => {
                    //Players get one bid and whoever bids the highest gets the shop.
                    //All forced shop auctions are this type.
                    let players = state.turnOrder;
                    let shop = state.inputState.shop;
                    let valid = Q.MenuController.inputStates.auctionMenu.getValidParticipants(players, shop);
                    if(valid.length >= 1){
                        //TODO: show the auction scene.
                        //1. Ask all players if they'd like to participate
                        //2a. If no one want to participate, the bank buys it for 0.75x
                        //2b. If one person wants to participate, they auto buy it for the 100% value (25% goes to the bank).
                        //2c. If multiple people want in, allow each entrant to say how much they want to bid.
                        //3. Whoever bids the highest gets to buy the shop (25% still goes to the bank).
                        
                        //Procedure:
                        //1. Answer yes or no to wanting in to the bid.
                        //2. Once all players have decided, show a number cycler on each screen.
                        //3. Each player submits their bid before the time runs out (20 seconds)
                        //3a. If the time runs out (server tracks it), then submit the current number on the cycler.
                        //4. Once all players have submitted their bid, a message is sent to all players with the result.
                        //4a. Losers show a "you lost" message, and the winner gets a "you win" message.
                        //5. The shop changes ownership and values are changed.
                    }
                    else {
                        return [
                            {func: "clearStage", num: 2},
                            {func: "clearStage", num: 3},
                            Q.MenuController.inputStates.auctionMenu.sellToBank(state, shop),
                            Q.MenuController.makeMenu(state, "playerTurnMenu", [0, 0], "purchase-item")
                        ];
                    }
                },
                goBack: (state) => {
                    return [
                        {func: "clearStage", num: 2},
                        Q.MenuController.makeMenu(state, "shopsMenu", [0, 2])
                    ];
                }
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
            buyItemsMenu: {
                func: "navigateMenu",
                text: ["What would you like to buy?"],
                options: [],
                preDisplay: (state) => {
                    state.tileTo.items.map((item) => {
                        return [item.name + " (" + item.cost + ")", "confirmBuyItem", [item]];
                    }).forEach((item) => {
                        state.itemGrid.push([item]);
                    });
                    state.itemGrid.push([["Back", "goBack"]]);
                },
                onHoverOption: (option) => {
                    console.log(option)
                },
                onLoadMenu: (stage) => {
                    //TODo: custom item menu
                },
                confirmBuyItem: (state) => {
                    let player = state.turnOrder[0];
                    let item = state.itemGrid[state.currentItem[1]][state.currentItem[0]][2][0]; 
                    if(player.money >= item.cost){
                        Q.GameController.purchaseItem(state, item, player.playerId);
                        let props = [
                            {func: "purchaseItem", item: {id: item.id, cost: item.cost}}, 
                            {func: "clearStage", num: 2}
                        ];
                        let finish = Q.GameController.checkFinishMove(state, player);
                        if(finish) props = props.concat(finish);
                        return props;
                    } else {
                        return {func: "invalidAction"};
                    }
                },
                goBack: (state) => {
                    let player = state.turnOrder[0];
                    return [{func: "clearStage", num: 2}, Q.GameController.checkFinishMove(state, player)];
                }
            },
            askIfWantToBuyItem: {
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
                    ["Stocks", "showStocksMenu"],
                    ["Items", "showItemsMenu"],
                    ["Make a Deal", "showDealMenu"],
                    ["View", "showViewMenu"]
                ],
                rollDie: (state) => {
                    if(Q.isServer()){
                        let extraDie = Q.GameController.getItemEffect(state, state.turnOrder[0], "Extra Die");
                        let rolls = 1 + (extraDie ? 1: 0);
                        let dieMin = 1; 
                        let dieMax = 8;
                        let roll = 0;
                        let rollsNums = [];
                        for(let i = 0; i < rolls; i++){
                            let num = ~~(state.random() * (dieMax + 1 - dieMin)) + dieMin;
                            roll += num;
                            rollsNums.push(num);
                        }
                        state.currentMovementNum = roll;
                        state.inputState = {func: "rollDie", roll: roll, self: true, rollsNums: rollsNums};
                    }
                    return state.inputState;
                },
                showShopsMenu: (state) => {
                    return Q.MenuController.makeMenu(state, "shopsMenu", [0, 0], "change-menu");
                },
                showStocksMenu: (state) => {
                    return Q.MenuController.makeMenu(state, "stocksMenu", [0, 0], "change-menu");
                },
                showItemsMenu: (state) => {
                    return Q.MenuController.makeMenu(state, "itemsMenu", [0, 0], "change-menu");
                },
                showDealMenu: (state) => {
                    //This might actually be a custom menu.
                    
                },
                showViewMenu: (state) => {
                    return Q.MenuController.makeMenu(state, "viewMenu", [0, 0], "change-menu");
                }
            },
            shopsMenu: {
                func: "navigateMenu",
                preDisplay: (state) => {
                    let player = state.turnOrder[0];
                    //TODO: check against the allowed for this turn (deafult is one time)
                    if(player.auctioned > 0){
                        state.itemGrid[2][0][1] = "invalidAction";
                    } else {
                        state.itemGrid[2][0][1] = "cursorSelectShop";
                    }
                    if(player.upgraded > 0){
                        state.itemGrid[1][0][1] = "invalidAction";
                    } else {
                        state.itemGrid[1][0][1] = "cursorSelectShop";
                    }
                    if(player.invested > 0){
                        state.itemGrid[0][0][1] = "invalidAction";
                    } else {
                        state.itemGrid[0][0][1] = "cursorSelectShop";
                    }
                },
                options:[
                    ["Invest", "cursorSelectShop", ["invest", "toShopsMenu"]],
                    ["Upgrade", "cursorSelectShop", ["upgrade", "toShopsMenu"]],
                    ["Auction", "cursorSelectShop", ["auction", "toShopsMenu"]],
                    ["Back", "goBack"]
                ],
                invalidAction: () => {
                    return {func: "invalidAction"};
                },
                goBack: (state) => {
                    return Q.MenuController.makeMenu(state, "playerTurnMenu", [0, 1], "change-menu");
                },
                //Gives the active player a cursor that they can move around the map to select a shop.
                //What happens after selecting the shop is determined by the passed in type
                cursorSelectShop: (state, finish, goBack, startPos) => {
                    return Q.MenuController.makeMoveShopSelector(state, finish, goBack, startPos);
                }
            },
            stocksMenu: {
                func: "navigateMenu",
                preDisplay: (state) => {
                    let player = state.turnOrder[0];
                    /*if(player.soldStock > 0){
                        state.itemGrid[0][0][1] = "invalidAction";
                    } else {
                        state.itemGrid[0][0][1] = "showBuyStockMenu";
                    }
                    if(player.boughtStock > 0){
                        state.itemGrid[1][0][1] = "invalidAction";
                    } else {
                        state.itemGrid[1][0][1] = "showSellStockMenu";
                    }*/
                },
                options:[
                    ["Buy Stock", "showBuyStockMenu"],
                    ["Sell Stock", "showSellStockMenu"],
                    ["Check Stock", "showCheckStockMenu"],
                    ["Back", "goBack"]
                ],
                showBuyStockMenu: (state, selected) => {
                    return Q.MenuController.makeCustomMenu(state, "buyStockMenu", {type: "buyStock", prev: ["stocksMenu", [0, 0]], selected: selected});
                },
                showSellStockMenu: (state, selected) => {
                    return Q.MenuController.makeCustomMenu(state, "sellStockMenu", {type: "sellStock", prev: ["stocksMenu", [0, 1]], selected: selected});
                },
                showCheckStockMenu: (state) => {
                    return Q.MenuController.makeCustomMenu(state, "checkStockMenu", {type: "checkStock", prev: ["stocksMenu", [0, 2]]});
                },
                goBack: (state) => {
                    return Q.MenuController.makeMenu(state, "playerTurnMenu", [0, 2], "change-menu");
                }
            },
            districtMenu: {
                func: "navigateMenu",
                preDisplay: (state) => {
                    state.map.districts.forEach((d, i) => {
                        state.itemGrid.push([[d.name, "selectDistrict", [i]]]);
                    });
                    state.itemGrid.push([["Back", "goBack"]]);
                    switch(state.inputState.type){
                        case "buyStock":
                            state.inputState.text = ["Select a district to buy stock in."];
                            break;
                        case "sellStock":
                            state.inputState.text = ["Select the district you want to sell stock in."];
                            break;
                    }
                },
                options: [],
                text: ["Placeholder (text should be set in preDisplay)."],
                onHoverOption: (option, idx) => {
                    if(idx < Q.GameState.map.districts.length){
                        Q.GameState.mapMenu.pulseDistrictTiles(idx);
                    }
                },
                selectDistrict: (state, itemIdx) => {
                    switch(state.inputState.type){
                        case "buyStock":
                            return [
                                {func: "clearStage", num: 2},
                                {func: "clearStage", num: 3},
                                Q.MenuController.makeCustomMenu(state, "buyStockCyclerMenu", {cycler: 4, district: itemIdx})
                            ];
                        case "sellStock":
                            return [
                                {func: "clearStage", num: 2},
                                {func: "clearStage", num: 3},
                                Q.MenuController.makeCustomMenu(state, "sellStockCyclerMenu", {cycler: 4, district: itemIdx})
                            ];
                    }
                },
                goBack: (state) => {
                    if(state.forceSellAssets){
                        return [
                            {func: "clearStage", num: 3},
                            Q.MenuController.makeDialogueMenu(state, "forceSellAsset")
                        ];
                        
                    } else {
                        return [
                            {func: "clearStage", num: 3},
                            Q.MenuController.makeMenu(state, state.inputState.prev[0], state.inputState.prev[1], "change-menu")   
                        ];
                    }
                }
            },
            buyStockCyclerMenu: {
                func: "controlNumberCycler",
                confirm: (state) => {
                    let stockNumber = Q.MenuController.getValueFromNumberCycler(state);
                    let district = state.inputState.district;
                    //If the invest amount is greater than allowed, set the amount to the allowed amount.
                    let stockCost = stockNumber * district.stockPrice;
                    let player = state.turnOrder[0];
                    let maxPurchasable = ~~(player.money / district.stockPrice);
                    if(stockNumber > district.stockAvailable || stockCost > player.money){
                        let newAmount = Math.min(district.stockAvailable, maxPurchasable);
                        return Q.MenuController.setNumberCyclerValue(state, newAmount);
                    }
                    else {
                        if(stockNumber === 0){
                            return Q.MenuController.inputStates.buyStockCyclerMenu.goBack(state);
                        } else {
                            Q.GameController.buyStock(player, stockNumber, stockCost, district);
                            return [
                                {func: "finalizeBuyStock", num: stockNumber, cost: stockCost, district: state.inputState.district.id, playerId: player.playerId},
                                Q.MenuController.makeMenu(state, "playerTurnMenu", [0, 0], "purchase-item")
                            ];
                        }
                    }
                },  
                goBack: (state) => {
                    return Q.MenuController.inputStates.stocksMenu.showBuyStockMenu(state, [0, state.inputState.district.id]);
                }
            },
            sellStockCyclerMenu: {
                func: "controlNumberCycler",
                confirm: (state) => {
                    let stockNumber = Q.MenuController.getValueFromNumberCycler(state);
                    let district = state.inputState.district;
                    //If the invest amount is greater than allowed, set the amount to the allowed amount.
                    let stockCost = stockNumber * district.stockPrice;
                    let player = state.turnOrder[0];
                    if(stockNumber > player.stocks[district.id].num){
                        let newAmount = player.stocks[district.id].num;
                        return Q.MenuController.setNumberCyclerValue(state, newAmount);
                    }
                    else {
                        if(stockNumber === 0){
                            return Q.MenuController.inputStates.sellStockCyclerMenu.goBack(state);
                        } else {
                            let response = [{func: "finalizeSellStock", num: stockNumber, cost: stockCost, district: state.inputState.district.id, playerId: player.playerId}];
                            Q.GameController.sellStock(player, stockNumber, stockCost, district);
                            if(state.forceSellAssets){
                                if(player.money >= 0){
                                    response.push(Q.GameController.endTurn(state));
                                } else {
                                    response.push(Q.MenuController.makeDialogueMenu(state, "forceSellAsset"));
                                }
                            } else {
                                response.push(Q.MenuController.makeMenu(state, "playerTurnMenu", [0, 0], "purchase-item"));
                            }
                            return response;
                        }
                    }
                },  
                goBack: (state) => {
                    return Q.MenuController.inputStates.stocksMenu.showSellStockMenu(state, [0, state.inputState.district.id]);
                }
            },
            checkStockMenu: {
                func: "confirmer",
                confirm: (state) => {
                    return Q.MenuController.inputStates.checkStockMenu.goBack(state);
                },
                goBack: (state) => {
                    return Q.MenuController.makeMenu(state, "stocksMenu", [0, 2], "change-menu");
                }
            },
            itemsMenu: {
                func: "navigateMenu",
                preDisplay: (state) => {
                    state.turnOrder[0].items.forEach((item, i) => {
                        state.itemGrid.push([[item.name, "useItem", [i]]]);
                    });
                    state.itemGrid.push([["Back", "goBack"]]);
                },
                options: [],
                useItem: (state, itemIdx) => {
                    return Q.GameController.useItem(state, itemIdx);
                },
                goBack: (state) => {
                    return Q.MenuController.makeMenu(state, "playerTurnMenu", [0, 3], "change-menu");
                }
            },
            viewMenu: {
                func: "navigateMenu",
                options:[
                    ["View Board", "viewBoard"],
                    ["View Map", "viewMap"],
                    ["View Sets", "viewSets"],
                    ["View Standings", "viewStandings"],
                    ["Back", "goBack"]
                ],
                viewBoard: (state) => {
                    let player = state.turnOrder[0];
                    return Q.MenuController.makeMoveShopSelector(state, "viewBoard", "toViewMenu", player.loc, "all");
                },
                viewMap: (state) => {
                    return Q.MenuController.makeCustomMenu(state, "mapMenu");
                },
                viewSets: (state) => {
                    return Q.MenuController.makeCustomMenu(state, "setsMenu");
                },
                viewStandings: (state) => {
                    
                },
                goBack: (state) => {
                    return Q.MenuController.makeMenu(state, "playerTurnMenu", [0, 5], "change-menu");
                }
            },
            dealMenu: {
                
            },
            setsMenu: {
                func: "confirmer",
                confirm: (state) => {
                    return Q.MenuController.inputStates.setsMenu.goBack(state);
                },
                goBack: (state) => {
                    return Q.MenuController.makeMenu(state, "viewMenu", [0, 2], "change-menu");
                }
            },
            mapMenu: {
                "func": "confirmer",
                confirm: (state) => {
                    return Q.MenuController.inputStates.mapMenu.goBack(state);
                },
                goBack: (state) => {
                    return Q.MenuController.makeMenu(state, "viewMenu", [0, 1], "change-menu");
                }
            },
            menuMovePlayer: {
                func: "navigateMenu",
                text: ["Would you like to end your roll here?"],
                options:[
                    ["Yes", "confirmTrue"],
                    ["No", "confirmFalse"]
                ],
                confirmTrue: (state) => {
                    return Q.GameController.playerConfirmMove(state, state.turnOrder[0].playerId);
                },
                confirmFalse: (state) => {
                    let loc = Q.GameController.playerGoBackMove(state, state.turnOrder[0].playerId);
                    state.inputState = {func: "playerMovement", loc: loc};
                    return {func: "playerGoBackMove", loc: loc};
                }
            },
            askBuyShop: {
                func: "navigateMenu",
                text: ["Would you like to buy this shop?"],
                preDisplay: (state) => {
                    //id 0 is for 25% off
                    let coupon = Q.GameController.playerHasItem(state, state.turnOrder[0], 0);
                    if(coupon.length){
                        state.itemGrid.splice(1, 0, [["Yes (with 25% off coupon)", "confirmTrue", [0]]]);
                    }
                },
                options:[
                    ["Yes", "confirmTrue"],
                    ["No", "confirmFalse"]
                ],
                confirmTrue: (state, couponId) => {
                    let player = state.turnOrder[0];
                    let couponValue = 0;
                    let itemIdx = -1;
                    if(couponId >= 0){
                        itemIdx = player.items.indexOf(player.items.find((item) => {return item.id === couponId;}));
                        player.items.splice(itemIdx, 1);
                        couponValue = couponId === 0 ? 0.25 : 0;
                    }
                    let tileOn = Q.MapController.getTileAt(state, player.loc);
                    Q.GameController.buyShop(state, player, tileOn, couponValue);
                    
                    Q.GameController.endTurn(state);
                    return {func: "buyShop", loc: player.loc, itemIdx: itemIdx, couponValue: couponValue};
                },
                confirmFalse: (state) => {
                    return Q.GameController.endTurn(state);
                }
            },
            askBuyOutShop: {
                func: "navigateMenu",
                text: ["Would you like to buy out this shop?"],
                options:[
                    ["Yes", "confirmTrue"],
                    ["No", "confirmFalse"]
                ],
                confirmTrue: (state) => {
                    let player = state.turnOrder[0];
                    let tileOn = Q.MapController.getTileAt(state, player.loc);
                    let ownedBy = tileOn.ownedBy;
                    Q.GameController.buyOutShop(state, player, tileOn);
                    Q.GameController.endTurn(state);
                    return {func: "buyOutShop", loc: player.loc};
                },
                confirmFalse: (state) => {
                    return Q.GameController.endTurn(state);
                }
            },
            forceSellAsset: {
                func: "navigateMenu",
                text: ["You're out of cash! \nSell some stock or shops."],
                options: [
                    ["Sell Stock", "sellStock"],
                    ["Sell Shop", "sellShop"]
                ],
                preDisplay: (state) => {
                    state.forceSellAssets = true;
                    let player = state.turnOrder[0];
                    if(player.shops.length === 0){
                        state.itemGrid.splice(1, 1);
                    }
                    if(Q.GameController.getNumberOfStocks(player) === 0){
                        state.itemGrid.splice(0, 1);
                    }
                    if(!state.itemGrid.length){
                        state.inputState.text = ["You don't have any more assets. \nYou lose!"];
                        state.itemGrid.push([["Done", "loseGame"]]);
                    }
                },
                sellStock: (state) => {
                    return Q.MenuController.makeCustomMenu(state, "sellStockMenu", {type: "sellStock", prev: ["stocksMenu", [0, 1]]});
                },
                sellShop: (state) => {
                    return Q.MenuController.makeMoveShopSelector(state, "confirmSellShop", "forceSellAsset", state.turnOrder[0].loc);
                },
                loseGame: (state) => {
                    state.turnOrder.splice(0, 1);
                    //Change this eventually to check the bankruptcy limit set in the map.
                    if(state.turnOrder.length === 1){
                        Q.GameController.gameOver();
                        return {func: "gameOver"};
                    }
                }
            },
            confirmSellShop: {
                func: "navigateMenu",
                text: ["Are you sure you want to sell this shop?"],
                options: [
                    ["Yes", "sellShop"],
                    ["No", "goBack"]
                ],
                sellShop: (state) => {
                    let response = [
                        Q.MenuController.inputStates.auctionMenu.sellToBank(state, state.inputState.shop)
                    ];
                    if(state.forceSellAssets){
                        //This just sells the shop to the bank at 0.75 rate. 
                        response.push(Q.GameController.endTurn(state));
                    }
                    return response;
                },
                goBack: (state) => {
                    if(state.forceSellAssets){
                        return [
                            {func: "clearStage", num: 3},
                            Q.MenuController.makeDialogueMenu(state, "forceSellAsset")
                        ];
                        
                    } else {
                        return [
                            {func: "clearStage", num: 3},
                            Q.MenuController.makeMenu(state, state.inputState.prev[0], state.inputState.prev[1], "change-menu")   
                        ];
                    }
                }
            }
        },
        //Confirmer does not take directional inputs. Only confirm/back
        initializeConfirmer: function(state){
            state.currentItem = [0, 0];
            state.itemGrid = [[[0, "confirm"]]];
        },
        initializeNumberCycler: function(state, data){
            state.currentItem = data.currentItem || [data.cycler - 1, 0];
            state.itemGrid = [[]];
            for(let i = 0 ; i < data.cycler; i++){
                state.itemGrid[0].push([0, "confirm"]);
            }
        },
        initializeMenu: function(state, data, currentItem){
            if(state.currentCont) state.currentCont = false;
            state.currentItem = currentItem || [0, 0];
            state.itemGrid = [];
            for(let i = 0 ; i < data.options.length; i++){
                state.itemGrid.push([data.options[i]]);
            }
        },
        confirmMenuOption: function(state){
            let option = state.itemGrid[state.currentItem[1]][state.currentItem[0]];
            option[2] = option[2] !== undefined ? option[2] : [];
            return state.inputState[option[1]](state, ...option[2]);
        },
        pressBackInMenu: function(state){
            if(state.inputState.goBack){
                return state.inputState.goBack(state);
            }
            return false;
        },
        keepInRange: function(state, coord){
            let currentItem = state.currentItem;
            currentItem[0] += coord[0];
            currentItem[1] += coord[1];
            let itemGrid = state.itemGrid;
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
        setNumberCyclerValue: function(state, value){
            let itemGrid = state.itemGrid;
            let strValue = value.toString();
            let dif = itemGrid[0].length - strValue.length;
            for(let i = itemGrid[0].length - 1; i >= 0; i--){
                let value = strValue[i - dif] || 0;
                itemGrid[0][i][0] = parseInt(value);
                if(state.currentCont){
                    state.currentCont.p.menuButtons[i][0].changeLabel(state.itemGrid[0][i][0]);
                }
            }
            return {func: "controlNumberCycler", value: value};
        },
        getValueFromNumberCycler: function(state){
            let itemGrid = state.itemGrid;
            let value = "";
            for(let i = 0; i < itemGrid[0].length; i++){
                value += itemGrid[0][i][0];
            }
            return parseInt(value);
        },
        adjustNumberCyclerPosition: function(state, coord){
            let currentItem = state.currentItem;
            let itemGrid = state.itemGrid;
            //Move up/down
            if(coord[1]){
                itemGrid[currentItem[1]][currentItem[0]][0] += coord[1];
                if(itemGrid[currentItem[1]][currentItem[0]][0] < 0) itemGrid[currentItem[1]][currentItem[0]][0] = 9;
                else if(itemGrid[currentItem[1]][currentItem[0]][0] > 9) itemGrid[currentItem[1]][currentItem[0]][0] = 0;
                return {func: "controlNumberCycler", num: itemGrid[currentItem[1]][currentItem[0]][0]};
            } 
            //Move left/right
            else if(coord[0]){
                do {
                    currentItem = this.keepInRange(state,coord);
                }
                while(!itemGrid[currentItem[1]][currentItem[0]]);
                state.currentItem = currentItem;
                return {func: "controlNumberCycler", item: state.currentItem};
            }
            
        },
        setMenuPosition: function(state, coord){
            state.currentItem = coord;
            if(state.currentCont){
                state.currentCont.p.menuButtons[state.currentItem[1]][state.currentItem[0]].hover();
                Q.AudioController.playSound("option-hover");
            }
        },
        adjustMenuPosition: function(state, coord){
            let currentItem = state.currentItem;
            let itemGrid = state.itemGrid;
            do {
                currentItem = this.keepInRange(state, coord);
            }
            while(!itemGrid[currentItem[1]][currentItem[0]]);
            this.setMenuPosition(state, currentItem);
            return {item: state.currentItem, func: "navigateMenu"};
        },
        processShopSelectorInput: function(state, inputs){
            if(inputs.confirm){
                //Make sure the tile is valid
                let tile = Q.MapController.getTileAt(state, Q.getLoc(state.shopSelector.p.x, state.shopSelector.p.y));
                if(!tile) return;
                let valid = false;
                switch(state.shopSelector.p.type){
                    case "currentOwned":
                        if(state.turnOrder[0] === tile.ownedBy) valid = true;
                        break;
                    case "unowned":
                        if(!tile.ownedBy) valid = true;
                        break;
                    case "unownedByCurrent":
                        if(state.turnOrder[0] !== tile.ownedBy) valid = true;
                        break;
                    case "vendor":
                        if(tile.type === "vendor") valid = true;
                        break;
                    case "shop":
                        if(tile.type === "shop") valid = true;
                        break;
                    case "itemshop":
                        if(tile.type === "itemshop") valid = true;
                        break;
                    case "all":
                        valid = true;
                        break;
                }
                if(valid){
                    return state.inputState.finish(state, tile);
                } else {
                    return {func: "invalidAction"};
                }
            } else if(inputs.back){
                return state.inputState.goBack(state, state.inputState.backOption);
            } else {
                state.shopSelector.trigger("moved", inputs);
                if(state.shopSelector.p.x !== state.shopSelector.p.lastX || state.shopSelector.p.y !== state.shopSelector.p.lastY){
                    let props = [state.shopSelector.p.x, state.shopSelector.p.y];
                    if(state.shopSelector.atTile){
                        props.push(true);
                    } else if(state.shopSelector.changedShop){
                        props.push("details");
                    }
                    return {func: "moveShopSelector", move: props};
                }
            }
        },
        processConfirmerInput: function(state, inputs){
            if(inputs.confirm){
                return Q.MenuController.confirmMenuOption(state);
            } else if(inputs.back){
                return Q.MenuController.pressBackInMenu(state);
            }
        },
        processNumberCyclerInput: function(state, inputs){
            if(inputs.confirm){
                return Q.MenuController.confirmMenuOption(state);
            } else if(inputs.back) { 
                return Q.MenuController.pressBackInMenu(state);
            } else if(inputs.up) { 
                return this.adjustNumberCyclerPosition(state, [0, 1]);
            } else if(inputs.down) { 
                return this.adjustNumberCyclerPosition(state, [0, -1]);
            } else if(inputs.left) { 
                return this.adjustNumberCyclerPosition(state, [-1, 0]);
            } else if(inputs.right) { 
                return this.adjustNumberCyclerPosition(state, [1, 0]);
            }
        },
        processMenuInput: function(state, inputs){
            if(inputs.confirm){
               return Q.MenuController.confirmMenuOption(state);
            } else if(inputs.back) { 
               return Q.MenuController.pressBackInMenu(state);
            } else if(inputs.up){
               return this.adjustMenuPosition(state, [0, -1]);
            } else if(inputs.down){
               return this.adjustMenuPosition(state, [0, 1]);
            }
        },
        processRollDieInput: function(state, inputs){
            if(inputs.confirm){
                state.inputState = {func: "playerMovement"};
                Q.GameController.allowPlayerMovement(state, state.currentMovementNum);
                return [{func: "stopDice", rollsNums: state.inputState.rollsNums}, {func: "allowPlayerMovement", currentMovementNum: state.currentMovementNum}];
            } else if(inputs.back){
                if(state.inputState.forceRoll){
                    return {func: "invalidAction"};
                } else {
                    state.currentMovementNum = false;
                    return [
                        {func: "removeItem", item: "dice"}, 
                        {func:"setStateValue", path: "currentMovementNum", value: false}, 
                        Q.MenuController.makeMenu(state, "playerTurnMenu", [0, 0])
                    ];
                }
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