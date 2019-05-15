var quintusViewport = function(Quintus) {
"use strict";

Quintus.Viewport = function(Q){
    Q.UI.Container.extend("ViewSprite",{
        init: function(p) {
            this._super(p, {
                w:Q.width,
                h:Q.height,
                type:Q.SPRITE_UI, 
                dragged:false
            });
            this.add("tween");
            this.on("touch");
            this.on("drag");
        },
        animateTo:function(to, speed, callback){
            if(this.p.obj){
                this.p.obj = false;
                this.off("step","follow");
            }
            if(!speed){
                this.p.x = to.x;
                this.p.y = to.y;
                if(callback){
                    callback();
                }
            } else {
                this.animate({x:to.x,y:to.y},speed,Q.Easing.Quadratic.InOut,{callback:callback || function(){} });
            }
        },
        unfollowObj:function(){
            this.p.obj = false;
        },
        followObj:function(obj){
            this.p.obj = obj;
            this.on("step","follow");
        },
        follow:function(){
            if(this.p.obj){
                this.p.x = this.p.obj.p.x;
                this.p.y = this.p.obj.p.y;
            } else {
                this.off("step","follow");
            }
        },
        //If we're not following the viewSprite, follow it
        touch:function(){
            if(this.stage.viewport.following !== this){
                Q.viewFollow(this, this.stage);
            }
        },
        drag:function(touch){
            this.p.x = touch.origX - touch.dx / this.stage.viewport.scale;
            this.p.y = touch.origY - touch.dy / this.stage.viewport.scale;
            this.stage.dragged = true;
        },
        centerOn:function(loc){
            var pos = Q.getXY(loc);
            this.p.x = pos.x;
            this.p.y = pos.y;
        }
    });
    Q.viewFollow=function(obj, stage){
        if(!stage){stage = Q.stage(1);};
        var minX=0;
        var maxX=(stage.mapWidth*Q.tileW)*stage.viewport.scale;
        var minY=0;
        var maxY=(stage.mapHeight*Q.tileH)*stage.viewport.scale;
        stage.follow(obj,{x:true,y:true}/*,{minX: minX, maxX: maxX, minY: minY,maxY:maxY}*/);
    };
    Q.addViewport = function(stage, toFollow){
        stage.add("viewport");
        /*stage.viewport.scale = 2;
        
        Q.viewFollow(toFollow);
        return;*/
        stage.viewport.scale = 1;
        //The viewSprite is what moves when dragging the viewport
        stage.viewSprite = stage.insert(new Q.ViewSprite());
        stage.viewSprite.centerOn(toFollow.p.loc);
        Q.viewFollow(stage.viewSprite);
    };
};
};
if(typeof Quintus === 'undefined') {
  module.exports = quintusViewport;
} else {
  quintusViewport(Quintus);
}