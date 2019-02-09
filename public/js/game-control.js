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
            //TODO: detect if the player should be able to move to another tile with this input.
            //if()
            if(tileOn.move.dir[input]){
                Q.GameController.movePlayer(player, tileOn.move.dir[input]);
            }
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
                        }else if(order[j] === 12){
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
        movePlayer: function(player, tileTo){
            player.loc = tileTo.loc;
            if(player.sprite){
                player.sprite.moveTo(tileTo.loc);
            }
        },
        getPlayer: function(id){
            return Q.GameState.players.find(player => { return player.playerId === id;});
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
                    maxItems: 1
                    //Etc... Add more as I think of more. TODO
                });
            }
            return players;
        },
        //When a game is started (all players connected, settings are set, about to load map)
        setUpGameState: function(data){
            let map = Q.MapController.generateMap(data.mapData, data.settings);
            let players = Q.GameController.setUpPlayers(data, map.mainTile);
            
            return {map: map, players: players};
        }
    });
    Q.MapController = new Q.mapController();
    Q.GameController = new Q.gameController();
};
};

if(typeof Quintus === 'undefined') {
  module.exports = quintusGameControl;
} else {
  quintusGameControl(Quintus);
}