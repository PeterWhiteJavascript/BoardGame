var quintusGameControl = function(Quintus) {
"use strict";

Quintus.GameControl = function(Q) {
    //Functions used to set up the map.
    //Also checks moving around the map
    Q.GameObject.extend("mapController", {
        //Run when the player presses a directional input while moving their dice roll.
        processPlayerMovement: function(input, id){
            let player = Q.GameController.getPlayer(id);
            let tileOn = Q.MapController.getTileAt(player.loc);
            
            let tileTo = tileOn.move.dir[input];
            if(tileTo){
                if(Q.GameState.currentMovementPath.length > 1 && tileTo === Q.GameState.currentMovementPath[Q.GameState.currentMovementPath.length - 2]){
                    Q.GameState.currentMovementPath.pop();
                } else {
                    if(Q.GameState.currentMovementPath.length <= Q.GameState.currentMovementNum){
                        Q.GameState.currentMovementPath.push(tileTo);
                    } else {
                        return false;
                    }
                }
                Q.GameController.movePlayer(player, tileTo);
            } else {
                return false;
            }
            return {loc: tileTo.loc, finish: Q.GameState.currentMovementPath.length === Q.GameState.currentMovementNum + 1};
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
        //Pass the map data and return the fully generated map inside a tile w*h tile grid.
        generateMap: function(mapData, settings){
            let map = {
                data: mapData,
                tiles: []
            };
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
                        tile.value = tileData.value;
                        tile.cost = tileData.cost;
                        tile.rank = tileData.rank;
                        tile.name = tileData.name;
                        tile.district = tileData.district;
                        break;
                    case "main":
                        map.mainTile = tile;
                        break;
                }
            }
            //connectTiles(map.tiles, );
            //Loop through the tiles and detect the tile that is at the direction that is available.
            for(let i = 0; i < map.tiles.length; i++){
                let tile = map.tiles[i];
                let dirs = tile.move.dir;
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
        startRollingDie: function(num, player){
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
            this.dice[0].stop(num);
        },
        localPlayerMovement: function(input){
            let obj = Q.MapController.processPlayerMovement(input, Q.user.id);
            if(obj.finish){
                Q.stage(0).off("pressedInput", Q.GameController, "localPlayerMovement");
                Q.GameController.askFinishMove(Q.GameController.getPlayer(Q.user.id));
            }
        },
        allowPlayerMovement: function(num){
            if(Q.GameState.turnOrder[0].sprite){
                Q.GameState.turnOrder[0].sprite.showMovementDirections();
                if(Q.isActiveUser()){
                    Q.stage(0).on("pressedInput", Q.GameController, "localPlayerMovement");
                }
            }
            Q.GameState.currentMovementNum = num;
            Q.GameState.currentMovementPath = [Q.MapController.getTileAt(Q.GameState.turnOrder[0].loc)];
        },
        //After the player says "yes" to stopping here.
        playerConfirmMove: function(id){
            //For now, just make the player able to roll again.
            
            
        },
        playerGoBackMove: function(id){
            let player = this.getPlayer(id);
            Q.GameState.currentMovementPath.pop();
            let tileTo = Q.GameState.currentMovementPath[Q.GameState.currentMovementPath.length - 1];
            this.movePlayer(player, tileTo);
            if(player.sprite){
                player.sprite.p.allowMovement = true;
            }
            return tileTo.loc;
        },  
        //When the player steps onto the last tile of the movement
        askFinishMove: function(player){
            player.sprite.destroyArrows();
            player.sprite.p.allowMovement = false;
            
            Q.GameState.inputState = Q.MenuController.inputStates.menuMovePlayer;
            //Create the "do you want to stop here" menu.
            Q.stageScene("dialogue", 1, {dialogue: Q.GameState.inputState});
            Q.MenuController.initializeMenu(Q.GameState.inputState);
            if(Q.isActiveUser()){
                Q.stage(0).on("pressedInput", Q.MenuController, "processInput");
                Q.stage(1).on("destroyed", function(){Q.stage(0).off("pressedInput", Q.MenuController, "processInput");});
            }  
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
                    shops: [],
                    items: [],
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
            Q.GameState.turnOrder.push(Q.GameState.turnOrder.shift());
            Q.GameController.startTurn();
        },
        //Functions that happen when the new current player starts his turn
        startTurn: function(){
            let player = Q.GameState.turnOrder[0];
            player.turn = true;
            Q.GameState.inputState =  Q.MenuController.inputStates.playerTurnMenu;
            Q.MenuController.initializeMenu(Q.GameState.inputState);
        }
    });
    
    
    //This does not display anything or make sounds. It's run on the client and server.
    Q.GameObject.extend("menuController", {
        inputStates: {
            playerTurnMenu: {
                func: "navigateMenu",
                options:[
                    ["Roll", "rollDie"],
                    ["Shops", "showShopsMenu"],
                    ["View Board", "viewBoard"],
                    ["View Standings", "viewStandings"],
                    ["Options", "showOptions"],
                    ["View Map", "viewMap"]
                ],
                rollDie: (socket) => {
                    let roll;
                    if(Q.isServer()){
                        roll = ~~(Q.random() * Q.GameState.turnOrder[0].dieMax + 1 - Q.GameState.turnOrder[0].dieMin) + Q.GameState.turnOrder[0].dieMin;
                        //Send this roll to the active user
                        socket.emit("receiveRoll", {roll: roll});
                        Q.GameState.currentMovementNum = roll;
                    } else {
                       Q.processInputResult({func: "rollDie"});
                    }
                    Q.GameState.inputState = {func: "rollDie", roll: roll};
                    return {func: "rollDie", roll: roll};
                },
                showShopsMenu: () => {
                    
                },
                viewBoard: () => {
                    
                },
                viewStandings: () => {
                    
                },
                showOptions: () => {
                    
                },
                viewMap: () => {
                    
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
                        //TODO: this is where the on tile effect should be triggered.
                        Q.GameController.playerConfirmMove(Q.GameState.turnOrder[0].playerId);
                        //For now, just make the next player go.
                        Q.GameController.endTurn();
                        Q.GameState.inputState = Q.MenuController.inputStates.playerTurnMenu;
                    }
                    return {func: "playerConfirmMove"};
                },
                confirmFalse: () => {
                    let loc = Q.GameController.playerGoBackMove(Q.GameState.turnOrder[0].playerId);
                    Q.GameState.inputState = {func: "playerMovement"};
                    if(!Q.isServer()){
                        Q.clearStage(1);
                        if(Q.isActiveUser()){
                            Q.stage(0).off("pressedInput", Q.MenuController, "processInput");
                            Q.stage(0).on("pressedInput", Q.GameController, "localPlayerMovement");
                        }
                    }
                    Q.GameState.inputState = {func: "playerMovement", locTo: loc};
                    return {func: "playerGoBackMove", locTo: loc};
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
        confirmMenuOption: function(socket){
            let option = this.itemGrid[this.currentItem[1]][this.currentItem[0]];
            return Q.GameState.inputState[option[1]](socket);
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
            console.log(this.currentItem)
            return {item: this.currentItem, func: "navigateMenu"};
        },
        processInput: function(input, socket){
            if(input === "confirm"){
               return this.confirmMenuOption(socket);
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