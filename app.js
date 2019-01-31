const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);

app.use(express.static(__dirname + '/public'));

app.get('/', function(req, res){
  res.render('/index.html');
});

let playerCount = 0;
let id = 0;

//Generate a list of all of the files that need to be loaded. 
//This list is sent to each client when they connect.
const fs = require('fs');

const filesFolder = 'public/';
const loadDirectories = ["audio", "data", "images"];
let loadFiles = [];
function readDirectory(path){
    let files = [];
    fs.readdirSync(filesFolder + path).forEach(file => {
        //If path leads to antoher directory, look in that directory too
        if(fs.lstatSync(filesFolder + path + "/" + file).isDirectory()){
            readDirectory(path + "/" + file).forEach( f => {
                files.push(f);
            });
        } else {
            files.push(filesFolder + path + "/" + file);
        }
    });
    return files;
}
loadDirectories.forEach(path => {
    readDirectory(path).forEach(file => {
        loadFiles.push(file.replace("public/", ""));
    });
});
//End generate list of files

io.on('connection', function (socket) {
    playerCount++;
    id++;
    socket.emit("connected", {loadFiles: loadFiles});
    
    socket.on('disconnect', function () {
        playerCount--;
        io.emit('count', { playerCount: playerCount });
    });

    socket.on('update', function (data) {
        socket.broadcast.emit('updated', data);
    });
    
    socket.on("inputted", function(data){
        io.emit("inputResult", {key: data.input});
    });
});


server.listen(60);
console.log("Multiplayer app listening on port 60");