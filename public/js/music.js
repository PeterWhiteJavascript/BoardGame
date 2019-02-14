Quintus.Music=function(Q){
    
Q.GameObject.extend("audioController",{
    loadedMusic:[],
    currentMusic:"",
    playMusic:function(music,callback){
        if(!music) music = this.currentMusic || this.lastMusic;
        music += ".mp3";
        this.lastMusic = this.currentMusic;
        if(Q.OptionsController.options.musicEnabled){
            var loadedMusic = this.loadedMusic;
            var ld = loadedMusic.includes(music);
            //If the music hasn't been loaded
            if(!ld){
                this.stopMusic(this.currentMusic);
                this.stopMusic(music);
                Q.load("bgm/"+music,function(){
                    Q.audio.play("bgm/"+music,{loop:true, volume:Q.OptionsController.options.musicVolume});
                    loadedMusic.push(music);
                    if(callback){callback();}
                },{progressCallback:Q.progressCallback});
            //If the music is different than the currentMusic
            } else if(this.currentMusic !== music){
                this.stopMusic(this.currentMusic);
                this.stopMusic(music);
                Q.audio.play("bgm/"+music,{loop:true, volume:Q.OptionsController.options.musicVolume});
            }
            //Do the callback instantly if the music has been loaded
            if(ld){
                if(callback){callback();}
            }
        } else {
            if(callback){callback();}
        }
        this.currentMusic = music;
    },
    stopMusic:function(music){
        if(!music) music = this.currentMusic;
        this.lastMusic = this.currentMusic;
        Q.audio.stop("bgm/"+music);
        this.currentMusic = false;
    },
    checkMusicEnabled:function(){
        if(Q.OptionsController.options.musicEnabled){
            this.playMusic();
        } else {
            this.lastMusic = this.currentMusic;
            this.stopMusic();
            this.currentMusic = false;
        }
    },
    playSound:function(sound, callback){
        if(Q.OptionsController.options.soundEnabled){
            if(sound.length){
                Q.audio.play("sfx/"+sound, {volume:Q.OptionsController.options.soundVolume, callback:callback});
            }
        }
    },
    interruptMusic:function(music, callback){
        Q.audio.pause("bgm/"+this.currentMusic);
        this.playSound(music, callback);
    },
    changeVolume:function(value, music){
        if(!music) music = this.currentMusic;
        Q.audio.changeVolume(music, value);
    }
});
};


