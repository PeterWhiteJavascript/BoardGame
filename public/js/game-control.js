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
                        Q.stage(0).on("pressedInput", Q.GameController, "localPlayerMovement");
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
                        Q.stage(0).off("pressedInput", Q.GameController, "localPlayerMovement");
                    }
                    let setOptions = sets.map((set, i) => {
                        return [set.name, "purchaseSet", [i]];
                    });
                    setOptions.push(["Nothing", "noExchange"]);
                    Q.MenuController.makeDialogueMenu("askExchangeSets", {
                        options:setOptions,
                        onHoverOption: (option) => {
                            //TODO: find the set in the set menu and highlight the container.
                            option.stage.setsMenu.hoverSet(option);
                        },
                        onLoadMenu: (stage) => {
                            //TODO
                            //This should just add a normal sets menu and highlight the set that is selected in the menu
                            stage.setsMenu = stage.insert(new Q.SetsMenu({player: player}));
                        },
                        purchaseSet: (num) => {
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

                            Q.MenuController.turnOffDialogueInputs();
                            finishCallback();
                        },
                        noExchange: () => {
                            Q.MenuController.turnOffDialogueInputs();
                            finishCallback();
                        }
                    });
                    return true;
                    
                case "vendor":
                    //Not enough money, so don't even ask.
                    if(player.money < tile.itemCost){
                        return false;
                    }
                    
                    if(!Q.isServer() && Q.isActiveUser()){
                        Q.stage(0).off("pressedInput", Q.GameController, "localPlayerMovement");
                    }
                    Q.MenuController.makeDialogueMenu("askVendorBuyItem", {
                        text: Q.c.vendorText[tile.itemName],
                        confirmTrue: () => {
                            //The item was bought.
                            Q.GameController.changePlayerMoney(player, -tile.itemCost);
                            Q.GameController.addBoardAction("prev", "changePlayerMoney", [player, tile.itemCost]);
                            Q.GameController.changeSetItemQuantity(player, tile.itemName, 1);
                            Q.GameController.addBoardAction("prev", "changeSetItemQuantity", [player, tile.itemName, -1]);
                            
                            Q.MenuController.turnOffDialogueInputs();
                            finishCallback();
                        },
                        confirmFalse: () => {
                            Q.MenuController.turnOffDialogueInputs();
                            finishCallback();
                        }
                    });
                    return true;
            }
        },
        //Run when the player presses a directional input while moving their dice roll.
        processPlayerMovement: function(input, id){
            let finish, direction;
            let player = Q.GameController.getPlayer(id);
            let tileOn = Q.MapController.getTileAt(player.loc);
            let tileTo = tileOn.move.dir[input];
            if(tileTo && (Q.GameState.currentMovementPath > 1 || tileTo !== player.lastTile)){
                //If the player has gone back a tile
                if(Q.GameState.currentMovementPath.length > 1 && tileTo === Q.GameState.currentMovementPath[Q.GameState.currentMovementPath.length - 2]){
                    Q.GameState.currentMovementPath.pop();
                    direction = "back";
                } 
                //If the player has gone forward a tile.
                else {
                    if(Q.GameState.currentMovementPath.length <= Q.GameState.currentMovementNum){
                        Q.GameState.currentMovementPath.push(tileTo);
                    } else {
                        return false;
                    }
                    direction = "forward";
                }
                Q.GameController.movePlayer(player, tileTo);
                
                finish = Q.GameState.currentMovementPath.length === Q.GameState.currentMovementNum + 1;
                if(!Q.isServer()){
                    Q.stage(2).hoverShop(tileTo);
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
        generateShopValue: function(value, rank){
            return value * rank;
        },
        generateShopCost: function(value, rank, investedCapital, numberOfShopsInDistrict){
            // 20 - 25 - 30 - 35 - 40
            return ~~(value * (0.2 + (rank - 1) * 0.05 + numberOfShopsInDistrict * 0.05)) + investedCapital;
        },
        generateShopMaxCapital: function(value, rank, investedCapital, numberOfShopsInDistrict){
            return ~~(value + (value / 2 * rank * numberOfShopsInDistrict)) - investedCapital;
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
                    move: tileData.move
                };
                map.tiles.push(tile);
                Q.MapController.addToGrid(tileData.x, tileData.y, 2, 2, grid, tile);
                //Do different things based on the tile type.
                switch(tile.type){
                    case "shop":
                        tile.initialValue = tileData.value;
                        tile.rank = tileData.rank;
                        tile.investedCapital = 0;
                        tile.value = Q.MapController.generateShopValue(tile.initialValue, tile.rank);
                        tile.cost = Q.MapController.generateShopCost(tile.initialValue, tile.rank, tile.investedCapital, 1);
                        tile.maxCapital = Q.MapController.generateShopMaxCapital(tile.initialValue, tile.rank, tile.investedCapital, 1);
                        tile.capitalInvested = 0;
                        tile.name = tileData.name;
                        tile.district = tileData.district;
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
                
                tile.move.dir = dirObj;
                
                
                
            }
            map.grid = grid;
            return map;
        }
    });
    
    //Functions that are run during gameplay.
    //Add/remove shop from player, stocks, etc...
    Q.GameObject.extend("gameController", {
        addBoardAction: function(tile, action, props){
            if(tile === "prev") tile = Q.GameState.currentMovementPath[Q.GameState.currentMovementPath.length - 2];
            Q.GameState.currentBoardActions.push([tile, action, props]);
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
                this.dice.push(Q.stage(0).insert(new Q.Die({x: player.p.x, y: player.p.y - Q.c.tileH})));
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
        localPlayerMovement: function(input){
            let obj = Q.MapController.processPlayerMovement(input, Q.user.id);
            if(obj.finish){
                Q.stage(0).off("pressedInput", Q.GameController, "localPlayerMovement");
                Q.GameController.askFinishMove(Q.GameController.getPlayer(Q.user.id));
            }
        },
        allowPlayerMovement: function(num){
            Q.GameState.currentMovementNum = num;
            Q.GameState.currentMovementPath = [Q.MapController.getTileAt(Q.GameState.turnOrder[0].loc)];
            if(Q.GameState.turnOrder[0].sprite){
                Q.GameState.turnOrder[0].sprite.showMovementDirections();
                if(Q.isActiveUser()){
                    Q.stage(0).on("pressedInput", Q.GameController, "localPlayerMovement");
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
                Q.stage(2).hoverShop(Q.MapController.getTileAt(tileTo.loc));
            }
            return tileTo.loc;
        },  
        //When the player steps onto the last tile of the movement
        askFinishMove: function(player){
            if(!Q.isServer()){
                player.sprite.destroyArrows();
                player.sprite.p.allowMovement = false;
            }
            
            Q.MenuController.makeDialogueMenu("menuMovePlayer");
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
                    loc: mainTile.loc,
                    money: data.mapData.modes[data.settings.mode].startMoney,
                    netValue: data.mapData.modes[data.settings.mode].startMoney,
                    color: data.users[i].color,
                    shops: [],
                    items: [],
                    setPieces: {},
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
            return {map: map, players: players, inputState: Q.MenuController.inputStates.playerTurnMenu };
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
            Q.MenuController.makeMenu("playerTurnMenu", 0);
            if(!Q.isServer()){
                if(Q.isActiveUser()){
                    Q.stage(0).insert(new Q.TurnAnimation());
                }   
            }
        },
        buyShop: function(player, shop){
            Q.GameController.changePlayerMoney(player, -shop.value);
            if(!Q.isServer()){
                shop.sprite.updateTile(player.color);
            }
            shop.ownedBy = player;
            Q.GameController.adjustShopValues(player, shop);
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
            let district = Q.GameState.map.districts[shop.district];
            let shopsOwned = district.filter((shop) => {return shop.ownedBy === player;});
            if(shopsOwned.length > 1){
                shopsOwned.forEach((shop) => {
                    shop.cost = Q.MapController.generateShopCost(shop.value, shop.rank, shop.investedCapital, shopsOwned.length);
                    shop.maxCapital = Q.MapController.generateShopMaxCapital(shop.value, shop.rank, shop.investedCapital, shopsOwned.length);
                    if(!Q.isServer()){
                        shop.sprite.updateTile(player.color);
                    }
                });
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
                if(Q.isActiveUser()){
                    Q.MenuController.turnOnDialogueInputs();
                }
            }
        },
        makeMenu: function(state, selected){
            Q.GameState.inputState =  Q.MenuController.inputStates[state];
            Q.MenuController.initializeMenu(Q.GameState.inputState);
            if(!Q.isServer()){
                Q.stageScene("menu", 1, {menu: Q.GameState.inputState, selected: selected || 0});
                if(Q.isActiveUser()){
                    Q.MenuController.turnOnDialogueInputs();
                }   
            }
        },
        turnOffDialogueInputs: function(){
            if(!Q.isServer()){
                Q.clearStage(1);
                if(Q.isActiveUser()){
                    Q.stage(0).off("pressedInput", Q.MenuController, "processInput");
                }
            }
        },
        turnOnDialogueInputs: function(){
            if(Q.isActiveUser()){
                Q.stage(0).on("pressedInput", Q.MenuController, "processInput");
                Q.stage(1).on("destroyed", function(){Q.stage(0).off("pressedInput", Q.MenuController, "processInput");});
            }
        },
        inputStates: {
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
                    
                },
                viewBoard: () => {
                    
                },
                viewStandings: () => {
                    
                },
                showOptions: () => {
                    
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
                    if(!Q.isServer() && Q.isActiveUser()){
                        Q.stage(0).off("pressedInput", Q.MenuController, "processInput");
                        Q.processInputResult({func: "playerConfirmMove"});
                    } else {
                        Q.GameController.playerConfirmMove(Q.GameState.turnOrder[0].playerId);
                    }
                    return {func: "playerConfirmMove"};
                },
                confirmFalse: () => {
                    let loc = Q.GameController.playerGoBackMove(Q.GameState.turnOrder[0].playerId);
                    Q.GameState.inputState = {func: "playerMovement"};
                    Q.MenuController.turnOffDialogueInputs();
                    if(!Q.isServer()){
                        Q.stage(0).on("pressedInput", Q.GameController, "localPlayerMovement");
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
                    if(!Q.isServer()){
                        Q.MenuController.turnOffDialogueInputs();
                    }
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
                    if(!Q.isServer()){
                        Q.MenuController.turnOffDialogueInputs();
                    }
                    Q.GameController.endTurn();
                    return {func: "buyOutShop", shopLoc: player.loc};
                },
                confirmFalse: () => {
                    Q.GameController.endTurn();
                    return {func: "endTurn"};
                }
            }
        },
        initializeMenu: function(data){
            this.currentItem = [0, 0];
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
        processInput: function(input){
            if(input === "confirm"){
               return this.confirmMenuOption();
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